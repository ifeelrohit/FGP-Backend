// ==============================================================================
// FGP-Backend Player Action & Gameplay Routes
// Safe server-authoritative resolution and credit ledger synchronization
// ==============================================================================

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { settlementService } from '../settlements/settlementService.ts';
import { formatSuccess } from '../../shared/utils/response.ts';
import { authenticate } from '../../app/plugins/auth.ts';
import {
  GameActionSchema,
  GameIdParamSchema,
  PredictionSubmissionSchema,
  CasinoSpinSchema,
  CrashEntrySchema,
  CashoutActionSchema,
  MiniGameActionSchema,
} from '../../shared/validation/index.ts';

export const entryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Generic authoritative action
  fastify.post('/games/:gameId/action', { preHandler: [authenticate] }, async (request, reply) => {
    const { gameId } = GameIdParamSchema.parse(request.params);
    const body = GameActionSchema.parse({ ...(request.body as object), gameId });

    const result = await settlementService.executeGameAction({
      userId: request.user!.id,
      gameId,
      roundId: body.roundId,
      entryAmount: body.entryAmount,
      payload: body.payload,
      idempotencyKey: body.idempotencyKey,
    });

    return reply.status(200).send(formatSuccess(result, request.requestId));
  });

  // Prediction submission endpoint
  fastify.post('/predictions/submit', { preHandler: [authenticate] }, async (request, reply) => {
    const body = PredictionSubmissionSchema.parse(request.body);

    const result = await settlementService.executeGameAction({
      userId: request.user!.id,
      gameId: body.gameId,
      roundId: body.roundId,
      entryAmount: body.entryAmount,
      payload: { selection: body.selection },
      idempotencyKey: body.idempotencyKey,
    });

    return reply.status(200).send(formatSuccess(result, request.requestId));
  });

  // Casino spin / deal
  fastify.post('/casino/play', { preHandler: [authenticate] }, async (request, reply) => {
    const body = CasinoSpinSchema.parse(request.body);

    const result = await settlementService.executeGameAction({
      userId: request.user!.id,
      gameId: body.gameId,
      entryAmount: body.entryAmount,
      payload: body.options,
      idempotencyKey: body.idempotencyKey,
    });

    return reply.status(200).send(formatSuccess(result, request.requestId));
  });

  // Real-time Crash entry
  fastify.post('/realtime/crash/enter', { preHandler: [authenticate] }, async (request, reply) => {
    const body = CrashEntrySchema.parse(request.body);

    const result = await settlementService.executeGameAction({
      userId: request.user!.id,
      gameId: body.gameId,
      entryAmount: body.entryAmount,
      payload: { autoCashoutMultiplier: body.autoCashoutMultiplier },
      idempotencyKey: body.idempotencyKey,
    });

    return reply.status(200).send(formatSuccess(result, request.requestId));
  });

  // Real-time Crash cashout
  fastify.post('/realtime/crash/cashout', { preHandler: [authenticate] }, async (request, reply) => {
    const body = CashoutActionSchema.parse(request.body);

    const result = await settlementService.executeGameAction({
      userId: request.user!.id,
      gameId: body.gameId,
      roundId: body.roundId,
      entryAmount: 0, // already debited on enter
      payload: { cashoutMultiplier: body.clientMultiplier },
    });

    return reply.status(200).send(formatSuccess(result, request.requestId));
  });

  // Mini-game action
  fastify.post('/mini-games/action', { preHandler: [authenticate] }, async (request, reply) => {
    const body = MiniGameActionSchema.parse(request.body);

    const result = await settlementService.executeGameAction({
      userId: request.user!.id,
      gameId: body.gameId,
      entryAmount: body.entryAmount,
      payload: { action: body.action, step: body.step },
      idempotencyKey: body.idempotencyKey,
    });

    return reply.status(200).send(formatSuccess(result, request.requestId));
  });
};
