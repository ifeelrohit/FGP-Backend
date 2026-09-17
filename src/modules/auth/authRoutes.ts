// ==============================================================================
// FGP-Backend Auth Routes
// /api/v1/auth/register, /login, /refresh, /logout, and /api/v1/me
// ==============================================================================

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authService } from './authService.ts';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '../../shared/validation/index.ts';
import { formatSuccess } from '../../shared/utils/response.ts';
import { authenticate } from '../../app/plugins/auth.ts';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register
  fastify.post('/auth/register', async (request, reply) => {
    const body = RegisterSchema.parse(request.body);
    const result = await authService.register(body);
    return reply.status(201).send(formatSuccess(result, request.requestId));
  });

  // Login
  fastify.post('/auth/login', async (request, reply) => {
    const body = LoginSchema.parse(request.body);
    const result = await authService.login(body.login, body.password);
    return reply.status(200).send(formatSuccess(result, request.requestId));
  });

  // Refresh
  fastify.post('/auth/refresh', async (request, reply) => {
    const body = RefreshTokenSchema.parse(request.body);
    const result = await authService.refreshTokens(body.refreshToken);
    return reply.status(200).send(formatSuccess(result, request.requestId));
  });

  // Logout
  fastify.post('/auth/logout', async (request, reply) => {
    const body = RefreshTokenSchema.parse(request.body);
    await authService.logout(body.refreshToken);
    return reply.status(200).send(formatSuccess({ loggedOut: true }, request.requestId));
  });

  // Me
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    return reply.status(200).send(formatSuccess({ user: request.user }, request.requestId));
  });
};
