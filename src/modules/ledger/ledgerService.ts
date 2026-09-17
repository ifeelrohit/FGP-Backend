// ==============================================================================
// FGP-Backend Virtual Credit Ledger Service
// Section 23: Virtual credits only. Immutable append-only accounting entries.
// ==============================================================================

import crypto from 'node:crypto';
import {
  inMemoryStore,
  StoredTransaction,
  StoredVirtualAccount,
} from '../../infrastructure/database/inMemoryStore.ts';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/index.ts';
import { TransactionType } from '../../shared/types/index.ts';
import { getTransactionDelta } from '../../shared/constants/ledger.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export class LedgerService {
  private processedIdempotencyKeys = new Set<string>();

  public async getAccountByUserId(userId: string): Promise<StoredVirtualAccount> {
    for (const acc of inMemoryStore.accounts.values()) {
      if (acc.userId === userId) return acc;
    }

    // Auto-provision if absent
    const newAcc: StoredVirtualAccount = {
      id: crypto.randomUUID(),
      userId,
      balance: 10000.0,
      lockedBalance: 0.0,
      currency: 'DEMO_CREDIT',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryStore.accounts.set(newAcc.id, newAcc);
    return newAcc;
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
  }): Promise<StoredTransaction> {
    const { userId, type, amount, referenceType, referenceId, idempotencyKey, metadata } = params;

    if (amount <= 0 && type !== 'ADJUSTMENT') {
      throw new BadRequestError('Transaction amount must be strictly greater than zero');
    }

    // Idempotency check: prevent duplicate credit debit or reward
    if (idempotencyKey) {
      if (this.processedIdempotencyKeys.has(idempotencyKey)) {
        const existing = inMemoryStore.transactions.find((t) => t.idempotencyKey === idempotencyKey);
        if (existing) return existing;
        throw new ConflictError(`Transaction with idempotency key '${idempotencyKey}' was already processed`);
      }
      this.processedIdempotencyKeys.add(idempotencyKey);
    }

    const account = await this.getAccountByUserId(userId);
    const delta = getTransactionDelta(type, amount);
    const balanceBefore = account.balance;
    const balanceAfter = Math.round((balanceBefore + delta) * 100) / 100;

    // Reject transaction if it causes negative balance
    if (balanceAfter < 0) {
      throw new BadRequestError(
        `Insufficient virtual credit balance. Current: ${balanceBefore}, required: ${Math.abs(delta)}`
      );
    }

    account.balance = balanceAfter;
    account.updatedAt = new Date();

    const transaction: StoredTransaction = {
      id: crypto.randomUUID(),
      accountId: account.id,
      userId,
      type,
      amount: Math.abs(amount),
      balanceBefore,
      balanceAfter,
      referenceType,
      referenceId,
      idempotencyKey,
      metadata,
      createdAt: new Date(),
    };

    inMemoryStore.transactions.push(transaction);

    // Emit domain event for real-time and audit listeners
    eventBus.publish('CREDIT_TRANSACTION_CREATED', {
      transactionId: transaction.id,
      userId,
      type,
      amount,
      balanceAfter,
    });

    return transaction;
  }

  public async listTransactions(userId: string, limit = 50): Promise<StoredTransaction[]> {
    return inMemoryStore.transactions
      .filter((t) => t.userId === userId)
      .slice(-limit)
      .reverse();
  }

  public async adminAdjust(params: {
    actorId: string;
    userId: string;
    amount: number;
    reason: string;
    idempotencyKey?: string;
  }): Promise<StoredTransaction> {
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
