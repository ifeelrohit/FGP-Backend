// ==============================================================================
// FGP-Backend Global Fastify Error Handler
// Centralized mapping to standard JSON envelope: { success: false, data: null, error, meta }
// ==============================================================================

import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/index.ts';
import { formatError } from '../../shared/utils/response.ts';
import { logger } from '../../infrastructure/logging/logger.ts';

export async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error: FastifyError | AppError | ZodError | Error, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.requestId || 'req-unknown';

    // 1. Zod schema validation errors
    if (error instanceof ZodError || (error as any)?.name === 'ZodError' || (error && 'issues' in error && Array.isArray((error as any).issues))) {
      const issues = (error as any).issues || [];
      const issue = issues[0];
      const details = { issues };
      logger.debug({ requestId }, 'Request schema validation failed');
      return reply
        .status(400)
        .send(formatError('VALIDATION_ERROR', issue?.message || 'Invalid request payload', details, requestId));
    }

    // 2. Domain application errors
    if (error instanceof AppError || (error && typeof (error as any).statusCode === 'number' && typeof (error as any).code === 'string')) {
      const appErr = error as AppError;
      if (appErr.statusCode >= 500) {
        logger.error({ requestId, code: appErr.code, message: appErr.message }, 'Application server error handled');
      } else {
        logger.debug({ requestId, statusCode: appErr.statusCode }, 'Application client request rejected');
      }
      return reply
        .status(appErr.statusCode)
        .send(formatError(appErr.code, appErr.message, appErr.details || {}, requestId));
    }

    // 3. Fastify built-in HTTP errors
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      if (error.statusCode >= 500) {
        logger.error({ requestId, statusCode: error.statusCode, err: error.message }, 'HTTP server error handled');
      } else {
        logger.debug({ requestId, statusCode: error.statusCode }, 'HTTP client request rejected');
      }
      return reply
        .status(error.statusCode)
        .send(formatError('BAD_REQUEST_ERROR', error.message, {}, requestId));
    }

    // 4. Uncaught system errors: scrub details, log securely
    logger.error({ requestId, err: error }, 'Unhandled internal server error occurred');
    return reply
      .status(500)
      .send(formatError('INTERNAL_SERVER_ERROR', 'An unexpected internal server error occurred', {}, requestId));
  });
}
