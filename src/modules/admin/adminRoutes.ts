// ==============================================================================
// FGP-Backend Operational, Audit, Announcement, and Analytics Routes
// Comprehensive admin portal compatibility for FGP-Admin
// ==============================================================================

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { auditService } from '../audit/auditService.ts';
import { announcementService } from '../announcements/announcementService.ts';
import { analyticsService } from '../analytics/analyticsService.ts';
import { historyService } from '../history/historyService.ts';
import { userService } from '../users/userService.ts';
import { gameService } from '../games/gameService.ts';
import { formatSuccess } from '../../shared/utils/response.ts';
import { authenticate, requireRole } from '../../app/plugins/auth.ts';
import { AnnouncementCreateSchema, GameIdParamSchema } from '../../shared/validation/index.ts';
import { GameStatus, UserStatus } from '../../shared/types/index.ts';
import { z } from 'zod';

export const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ----------------------------------------------------------------------------
  // Announcements (Public / Player & Admin)
  // ----------------------------------------------------------------------------
  fastify.get('/announcements', async (request, reply) => {
    const list = await announcementService.listActive();
    return reply.status(200).send(formatSuccess({ announcements: list }, request.requestId));
  });

  fastify.post(
    '/admin/announcements',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'OPERATIONS_ADMIN')] },
    async (request, reply) => {
      const body = AnnouncementCreateSchema.parse(request.body);
      const created = await announcementService.createAnnouncement(body);

      await auditService.logAction({
        actorId: request.user!.id,
        action: 'CREATE_ANNOUNCEMENT',
        targetType: 'ANNOUNCEMENT',
        targetId: created.id,
        metadata: { title: created.title },
        requestId: request.requestId,
      });

      return reply.status(201).send(formatSuccess({ announcement: created }, request.requestId));
    }
  );

  // ----------------------------------------------------------------------------
  // Audit Logs
  // ----------------------------------------------------------------------------
  fastify.get(
    '/admin/audit',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'VIEWER')] },
    async (request, reply) => {
      const logs = await auditService.listLogs();
      return reply.status(200).send(formatSuccess({ logs, count: logs.length }, request.requestId));
    }
  );

  // ----------------------------------------------------------------------------
  // Analytics Dashboard
  // ----------------------------------------------------------------------------
  fastify.get(
    '/admin/analytics/dashboard',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONFIGURATION_ADMIN', 'VIEWER')] },
    async (request, reply) => {
      const metrics = await analyticsService.getDashboardMetrics();
      return reply.status(200).send(formatSuccess(metrics, request.requestId));
    }
  );

  // ----------------------------------------------------------------------------
  // Users Administration
  // ----------------------------------------------------------------------------
  fastify.get(
    '/admin/users',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'VIEWER')] },
    async (request, reply) => {
      const users = await userService.listUsers();
      const sanitized = users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      }));
      return reply.status(200).send(formatSuccess({ users: sanitized }, request.requestId));
    }
  );

  fastify.patch(
    '/admin/users/:userId/status',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'OPERATIONS_ADMIN')] },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const schema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']) });
      const { status } = schema.parse(request.body);

      const user = await userService.updateUserStatus(userId, status as UserStatus);

      await auditService.logAction({
        actorId: request.user!.id,
        action: 'UPDATE_USER_STATUS',
        targetType: 'USER',
        targetId: userId,
        metadata: { newStatus: status },
        requestId: request.requestId,
      });

      return reply.status(200).send(
        formatSuccess(
          {
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              role: user.role,
              status: user.status,
            },
          },
          request.requestId
        )
      );
    }
  );

  // ----------------------------------------------------------------------------
  // Game Operational Status Management
  // ----------------------------------------------------------------------------
  fastify.patch(
    '/admin/games/:gameId/status',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'OPERATIONS_ADMIN')] },
    async (request, reply) => {
      const { gameId } = GameIdParamSchema.parse(request.params);
      const schema = z.object({ status: z.enum(['ACTIVE', 'MAINTENANCE', 'DISABLED']) });
      const { status } = schema.parse(request.body);

      const updated = gameService.updateGameStatus(gameId, status as GameStatus, request.user!.id);

      await auditService.logAction({
        actorId: request.user!.id,
        action: 'UPDATE_GAME_STATUS',
        targetType: 'GAME',
        targetId: gameId,
        metadata: { newStatus: status },
        requestId: request.requestId,
      });

      return reply.status(200).send(formatSuccess({ game: updated }, request.requestId));
    }
  );

  // ----------------------------------------------------------------------------
  // History Routes
  // ----------------------------------------------------------------------------
  fastify.get('/history', { preHandler: [authenticate] }, async (request, reply) => {
    const history = await historyService.getPlayerHistory(request.user!.id);
    return reply.status(200).send(formatSuccess({ history }, request.requestId));
  });

  fastify.get('/games/:gameId/history', async (request, reply) => {
    const { gameId } = GameIdParamSchema.parse(request.params);
    const history = await historyService.getRoundHistory(gameId);
    return reply.status(200).send(formatSuccess({ history }, request.requestId));
  });
};
