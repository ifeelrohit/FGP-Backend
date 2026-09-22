// ==============================================================================
// FGP-Backend Round Lifecycle Routes
// /api/v1/rounds, /api/v1/rounds/:roundId, /api/v1/rounds/:roundId/transition
// ==============================================================================

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { roundService } from './roundService.ts';
import { formatSuccess } from '../../shared/utils/response.ts';
import { RoundIdParamSchema, RoundTransitionSchema } from '../../shared/validation/index.ts';
import { authenticate, requireRole } from '../../app/plugins/auth.ts';
import { RoundStatus } from '../../shared/types/index.ts';

export const roundRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // List rounds
  fastify.get('/rounds', async (request, reply) => {
    const query = request.query as { gameId?: string; limit?: string };
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 20;
    const rawRounds = await roundService.listRounds(query.gameId, limit);
    const rounds = rawRounds.map((r) => roundService.sanitizeRound(r));
    return reply.status(200).send(formatSuccess({ rounds, count: rounds.length }, request.requestId));
  });

  // Get specific round
  fastify.get('/rounds/:roundId', async (request, reply) => {
    const { roundId } = RoundIdParamSchema.parse(request.params);
    const rawRound = await roundService.getRoundById(roundId);
    const round = roundService.sanitizeRound(rawRound);
    return reply.status(200).send(formatSuccess({ round }, request.requestId));
  });

  // Transition round status (Operator or Admin action)
  fastify.post(
    '/rounds/:roundId/transition',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'OPERATIONS_ADMIN')] },
    async (request, reply) => {
      const { roundId } = RoundIdParamSchema.parse(request.params);
      const body = RoundTransitionSchema.parse(request.body);
      const rawRound = await roundService.transitionRoundStatus(
        roundId,
        body.targetStatus as RoundStatus,
        body.reason ? { reason: body.reason } : undefined
      );
      const round = roundService.sanitizeRound(rawRound);
      return reply.status(200).send(formatSuccess({ round }, request.requestId));
    }
  );
};
