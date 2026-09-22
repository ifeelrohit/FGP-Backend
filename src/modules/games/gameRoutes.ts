// ==============================================================================
// FGP-Backend Game Catalog Routes
// /api/v1/games, /api/v1/games/:gameId, /api/v1/games/:gameId/rounds/active
// ==============================================================================

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { gameService } from './gameService.ts';
import { roundService } from '../rounds/roundService.ts';
import { GameCategory } from '../../shared/types/index.ts';
import { formatSuccess } from '../../shared/utils/response.ts';
import { GameIdParamSchema } from '../../shared/validation/index.ts';

export const gameRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // List games (with optional category filter)
  fastify.get('/games', async (request, reply) => {
    const query = request.query as { category?: string };
    const category = query.category as GameCategory | undefined;
    const games = await gameService.listGames(category);
    return reply.status(200).send(formatSuccess({ games, count: games.length }, request.requestId));
  });

  // Get specific game
  fastify.get('/games/:gameId', async (request, reply) => {
    const { gameId } = GameIdParamSchema.parse(request.params);
    const game = await gameService.getGameById(gameId);
    return reply.status(200).send(formatSuccess({ game }, request.requestId));
  });

  // Get active round for a game
  fastify.get('/games/:gameId/rounds/active', async (request, reply) => {
    const { gameId } = GameIdParamSchema.parse(request.params);
    let round = await roundService.getActiveRound(gameId);
    if (!round) {
      round = await roundService.createRound(gameId);
    }
    const sanitizedRound = roundService.sanitizeRound(round);
    return reply.status(200).send(formatSuccess({ round: sanitizedRound }, request.requestId));
  });
};
