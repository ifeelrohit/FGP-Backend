// ==============================================================================
// FGP-Backend Player Action & Gameplay Routes
// Safe server-authoritative resolution and credit ledger synchronization
// ==============================================================================

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { settlementService } from '../settlements/settlementService.ts';
import { roundService } from '../rounds/roundService.ts';
import { getRepositories } from '../../infrastructure/repositories/index.ts';
import { formatSuccess } from '../../shared/utils/response.ts';
import { authenticate } from '../../app/plugins/auth.ts';
import { BadRequestError, NotFoundError } from '../../shared/errors/index.ts';
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
  // Generic authoritative action (prediction, casino, mini-games)
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

  // Real-time Crash entry: registers durable entry position in active round
  fastify.post('/realtime/crash/enter', { preHandler: [authenticate] }, async (request, reply) => {
    const body = CrashEntrySchema.parse(request.body);

    const result = await settlementService.submitEntry({
      userId: request.user!.id,
      gameId: body.gameId,
      entryAmount: body.entryAmount,
      payload: { autoCashoutMultiplier: body.autoCashoutMultiplier },
      idempotencyKey: body.idempotencyKey,
    });

    return reply.status(200).send(formatSuccess(result, request.requestId));
  });

  // Real-time Crash cashout: server evaluates round crash point and calculates authoritative payout
  fastify.post('/realtime/crash/cashout', { preHandler: [authenticate] }, async (request, reply) => {
    const body = CashoutActionSchema.parse(request.body);
    const userId = request.user!.id;

    let targetEntryId = body.entryId;
    if (!targetEntryId) {
      if (!body.roundId) {
        throw new BadRequestError('Either entryId or roundId must be provided for cashout');
      }
      // Locate active entry for this user and round
      const entries = await getRepositories().entryRepo.findByRoundAndUser(body.roundId, userId);
      const activeEntry = entries.find((e) => e.status === 'CONFIRMED');
      if (!activeEntry) {
        throw new NotFoundError(`No active confirmed entry found for round '${body.roundId}'`);
      }
      targetEntryId = activeEntry.id;
    }

    const result = await settlementService.cashoutCrash({
      userId,
      entryId: targetEntryId,
      idempotencyKey: body.idempotencyKey,
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
