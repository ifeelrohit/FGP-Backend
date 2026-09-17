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
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const details = { issues: error.issues };
      logger.warn({ requestId, err: issue }, 'Request schema validation failed');
      return reply
        .status(400)
        .send(formatError('VALIDATION_ERROR', issue?.message || 'Invalid request payload', details, requestId));
    }

    // 2. Domain application errors
    if (error instanceof AppError) {
      logger.warn({ requestId, code: error.code, message: error.message }, 'Application error handled');
      return reply
        .status(error.statusCode)
        .send(formatError(error.code, error.message, error.details, requestId));
    }

    // 3. Fastify built-in HTTP errors
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      logger.warn({ requestId, statusCode: error.statusCode, err: error.message }, 'HTTP error handled');
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
