// ==============================================================================
// FGP-Backend Virtual Credit Ledger Routes
// /api/v1/credits/balance, /api/v1/credits/transactions, /api/v1/admin/credits/adjust
// ==============================================================================

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ledgerService } from './ledgerService.ts';
import { auditService } from '../audit/auditService.ts';
import { formatSuccess } from '../../shared/utils/response.ts';
import { authenticate, requireRole } from '../../app/plugins/auth.ts';
import { AdminCreditAdjustmentSchema } from '../../shared/validation/index.ts';

export const ledgerRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get authenticated player balance
  fastify.get('/credits/balance', { preHandler: [authenticate] }, async (request, reply) => {
    const balance = await ledgerService.getBalance(request.user!.id);
    return reply.status(200).send(formatSuccess(balance, request.requestId));
  });

  // Get authenticated player transaction history
  fastify.get('/credits/transactions', { preHandler: [authenticate] }, async (request, reply) => {
    const transactions = await ledgerService.listTransactions(request.user!.id);
    return reply
      .status(200)
      .send(formatSuccess({ transactions, count: transactions.length }, request.requestId));
  });

  // Admin credit adjustment
  fastify.post(
    '/admin/credits/adjust',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'OPERATIONS_ADMIN')] },
    async (request, reply) => {
      const body = AdminCreditAdjustmentSchema.parse(request.body);

      const transaction = await ledgerService.adminAdjust({
        actorId: request.user!.id,
        userId: body.userId,
        amount: body.amount,
        reason: body.reason,
        idempotencyKey: body.idempotencyKey,
      });

      // Log administrative action
      await auditService.logAction({
        actorId: request.user!.id,
        action: 'ADMIN_CREDIT_ADJUSTMENT',
        targetType: 'USER_ACCOUNT',
        targetId: body.userId,
        reason: body.reason,
        metadata: { amount: body.amount, transactionId: transaction.id },
        requestId: request.requestId,
      });

      return reply.status(200).send(formatSuccess({ transaction }, request.requestId));
    }
  );
};
