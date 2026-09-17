// ==============================================================================
// FGP-Backend Request ID & Correlation Plugin
// Injects unique request ID into request context, child loggers, and HTTP headers
// ==============================================================================

import crypto from 'node:crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

export async function requestIdPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const existing = request.headers['x-request-id'];
    const id = typeof existing === 'string' && existing.length > 0 ? existing : `req-${crypto.randomUUID()}`;
    request.requestId = id;
    reply.header('x-request-id', id);
  });
}
