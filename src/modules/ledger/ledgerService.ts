// ==============================================================================
// FGP-Backend Virtual Credit Ledger Service
// Authoritative append-only virtual credit accounting via durable repository
// ==============================================================================

import { getRepositories } from '../../infrastructure/repositories/index.ts';
import {
  IVirtualCreditRepository,
  ILedgerRepository,
  LedgerTransactionEntity,
  VirtualCreditAccountEntity,
} from '../../infrastructure/repositories/interfaces/IVirtualCreditRepository.ts';
import { BadRequestError, NotFoundError } from '../../shared/errors/index.ts';
import { TransactionType } from '../../shared/types/index.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export class LedgerService {
  private get creditRepo(): IVirtualCreditRepository {
    return getRepositories().virtualCreditRepo;
  }

  private get ledgerRepo(): ILedgerRepository {
    return getRepositories().ledgerRepo;
  }

  public async getAccountByUserId(userId: string): Promise<VirtualCreditAccountEntity> {
    let account = await this.creditRepo.findByUserId(userId);
    if (!account) {
      account = await this.creditRepo.createAccount(userId, 10000.0);
    }
    return account;
  }

  public async getBalance(userId: string): Promise<{
    balance: number;
    lockedBalance: number;
    currency: string;
  }> {
    const account = await this.getAccountByUserId(userId);
    return {
      balance: account.balance,
      lockedBalance: account.lockedBalance,
      currency: account.currency,
    };
  }

  public async recordTransaction(params: {
    userId: string;
    type: TransactionType;
    amount: number;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerTransactionEntity> {
    const { userId, type, amount, referenceType, referenceId, idempotencyKey, metadata } = params;

    if (amount <= 0 && type !== 'ADJUSTMENT') {
      throw new BadRequestError('Transaction amount must be strictly greater than zero');
    }

    // Ensure account exists
    await this.getAccountByUserId(userId);

    // Atomically execute balance mutation and ledger record creation
    const transaction = await this.ledgerRepo.executeTransaction({
      userId,
      type,
      amount,
      referenceType,
      referenceId,
      idempotencyKey,
      metadata,
    });

    // Emit domain event
    eventBus.publish('CREDIT_TRANSACTION_CREATED', {
      transactionId: transaction.id,
      userId,
      type,
      amount,
      balanceAfter: transaction.balanceAfter,
    });

    return transaction;
  }

  public async listTransactions(userId: string, limit = 50): Promise<LedgerTransactionEntity[]> {
    return this.ledgerRepo.listTransactionsByUserId(userId, limit);
  }

  public async adminAdjust(params: {
    actorId: string;
    userId: string;
    amount: number;
    reason: string;
    idempotencyKey?: string;
  }): Promise<LedgerTransactionEntity> {
    const userAccount = await this.getAccountByUserId(params.userId);
    if (!userAccount) {
      throw new NotFoundError(`Virtual credit account for user ${params.userId} not found`);
    }

    return this.recordTransaction({
      userId: params.userId,
      type: 'ADJUSTMENT',
      amount: params.amount,
      referenceType: 'ADMIN_MANUAL_ADJUSTMENT',
      referenceId: params.actorId,
      idempotencyKey: params.idempotencyKey,
      metadata: {
        actorId: params.actorId,
        reason: params.reason,
      },
    });
  }
}

export const ledgerService = new LedgerService();
