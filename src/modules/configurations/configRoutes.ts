// ==============================================================================
// FGP-Backend Configuration Management Routes
// Implements multi-step publishing lifecycle and immutable versioning
// ==============================================================================

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { configService } from './configService.ts';
import { auditService } from '../audit/auditService.ts';
import { formatSuccess } from '../../shared/utils/response.ts';
import { authenticate, requireRole } from '../../app/plugins/auth.ts';
import { GameIdParamSchema, ConfigDraftSchema } from '../../shared/validation/index.ts';
import { ConfigStatus } from '../../shared/types/index.ts';
import { z } from 'zod';

export const configRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get active configuration for a game (public or authenticated)
  fastify.get('/games/:gameId/config', async (request, reply) => {
    const { gameId } = GameIdParamSchema.parse(request.params);
    const config = await configService.getActiveConfig(gameId);
    return reply.status(200).send(formatSuccess({ config }, request.requestId));
  });

  // List all versions of a game's configuration (Admin)
  fastify.get(
    '/admin/games/:gameId/configs',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'CONFIGURATION_ADMIN', 'VIEWER')] },
    async (request, reply) => {
      const { gameId } = GameIdParamSchema.parse(request.params);
      const versions = await configService.listVersions(gameId);
      return reply.status(200).send(formatSuccess({ versions, count: versions.length }, request.requestId));
    }
  );

  // Create configuration draft
  fastify.post(
    '/admin/games/:gameId/configs/draft',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'CONFIGURATION_ADMIN')] },
    async (request, reply) => {
      const { gameId } = GameIdParamSchema.parse(request.params);
      const body = ConfigDraftSchema.parse({ ...(request.body as object), gameId });

      const draft = await configService.createDraft({
        gameId,
        generalConfig: body.generalConfig,
        entryConfig: body.entryConfig,
        timingConfig: body.timingConfig,
        ruleConfig: body.ruleConfig,
        rewardConfig: body.rewardConfig,
        displayConfig: body.displayConfig,
        operationalConfig: body.operationalConfig,
      });

      await auditService.logAction({
        actorId: request.user!.id,
        action: 'CREATE_CONFIG_DRAFT',
        targetType: 'GAME_CONFIG',
        targetId: draft.id,
        metadata: { gameId, version: draft.version },
        requestId: request.requestId,
      });

      return reply.status(201).send(formatSuccess({ draft }, request.requestId));
    }
  );

  // Transition configuration lifecycle status
  fastify.post(
    '/admin/configs/:configId/transition',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'CONFIGURATION_ADMIN')] },
    async (request, reply) => {
      const { configId } = request.params as { configId: string };
      const schema = z.object({
        targetStatus: z.enum(['DRAFT', 'VALIDATE', 'PREVIEW', 'APPROVE', 'PUBLISH', 'ACTIVE']),
      });
      const { targetStatus } = schema.parse(request.body);

      const updated = await configService.transitionStatus(
        configId,
        targetStatus as ConfigStatus,
        request.user!.id
      );

      await auditService.logAction({
        actorId: request.user!.id,
        action: `TRANSITION_CONFIG_${targetStatus}`,
        targetType: 'GAME_CONFIG',
        targetId: configId,
        metadata: { gameId: updated.gameId, version: updated.version, status: targetStatus },
        requestId: request.requestId,
      });

      return reply.status(200).send(formatSuccess({ config: updated }, request.requestId));
    }
  );

  // Rollback configuration to target version
  fastify.post(
    '/admin/games/:gameId/configs/rollback',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'CONFIGURATION_ADMIN')] },
    async (request, reply) => {
      const { gameId } = GameIdParamSchema.parse(request.params);
      const schema = z.object({ targetVersion: z.number().int().positive() });
      const { targetVersion } = schema.parse(request.body);

      const rollbackConfig = await configService.rollback(gameId, targetVersion, request.user!.id);

      await auditService.logAction({
        actorId: request.user!.id,
        action: 'ROLLBACK_GAME_CONFIG',
        targetType: 'GAME_CONFIG',
        targetId: rollbackConfig.id,
        reason: `Rollback to version ${targetVersion}`,
        metadata: { gameId, newVersion: rollbackConfig.version, rolledBackFrom: targetVersion },
        requestId: request.requestId,
      });

      return reply.status(200).send(formatSuccess({ config: rollbackConfig }, request.requestId));
    }
  );
};
