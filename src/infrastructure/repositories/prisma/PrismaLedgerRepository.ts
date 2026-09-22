// ==============================================================================
// PrismaVirtualCreditRepository & PrismaLedgerRepository
// Durable append-only PostgreSQL ledger with transactional concurrency protection
// ==============================================================================

import { prisma } from '../../database/prisma.ts';
import { Prisma } from '@prisma/client';
import {
  IVirtualCreditRepository,
  ILedgerRepository,
  VirtualCreditAccountEntity,
  LedgerTransactionEntity,
  RecordTransactionDto,
} from '../interfaces/IVirtualCreditRepository.ts';
import { InsufficientBalanceError, ConflictError } from '../../../shared/errors/index.ts';
import { TransactionType } from '../../../shared/types/index.ts';

export class PrismaVirtualCreditRepository implements IVirtualCreditRepository {
  public async findByUserId(userId: string): Promise<VirtualCreditAccountEntity | null> {
    const row = await prisma.virtualCreditAccount.findUnique({
      where: { userId },
    });
    return row ? this.mapAccount(row) : null;
  }

  public async createAccount(
    userId: string,
    initialBalance: number = 10000
  ): Promise<VirtualCreditAccountEntity> {
    const row = await prisma.virtualCreditAccount.create({
      data: {
        userId,
        balance: initialBalance,
        currency: 'DEMO_CREDIT',
      },
    });
    return this.mapAccount(row);
  }

  private mapAccount(row: any): VirtualCreditAccountEntity {
    return {
      id: row.id,
      userId: row.userId,
      balance: Number(row.balance),
      lockedBalance: Number(row.lockedBalance),
      currency: row.currency,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export class PrismaLedgerRepository implements ILedgerRepository {
  public async findTransactionByIdempotencyKey(key: string): Promise<LedgerTransactionEntity | null> {
    const row = await prisma.ledgerTransaction.findUnique({
      where: { idempotencyKey: key },
    });
    return row ? this.mapTransaction(row) : null;
  }

  public async executeTransaction(dto: RecordTransactionDto): Promise<LedgerTransactionEntity> {
    // Check idempotency first if key provided
    if (dto.idempotencyKey) {
      const existing = await this.findTransactionByIdempotencyKey(dto.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    return await prisma.$transaction(async (tx) => {
      // Find the user's account
      const account = await tx.virtualCreditAccount.findUnique({
        where: { userId: dto.userId },
      });

      if (!account) {
        throw new InsufficientBalanceError(`No virtual credit account found for user ${dto.userId}`);
      }

      const currentBalance = Number(account.balance);
      let newBalance = currentBalance;

      if (dto.type === 'ENTRY') {
        if (currentBalance < dto.amount) {
          throw new InsufficientBalanceError(
            `Insufficient virtual credits: current balance is ${currentBalance.toFixed(2)}, entry requires ${dto.amount.toFixed(2)}`
          );
        }
        newBalance = currentBalance - dto.amount;
      } else if (dto.type === 'CREDIT' || dto.type === 'REWARD') {
        newBalance = currentBalance + dto.amount;
      } else if (dto.type === 'ADJUSTMENT' || dto.type === 'REVERSAL') {
        newBalance = currentBalance + dto.amount;
        if (newBalance < 0) {
          throw new InsufficientBalanceError(
            `Adjustment would cause negative balance: ${newBalance.toFixed(2)}`
          );
        }
      }

      // Update account balance
      await tx.virtualCreditAccount.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });

      // Insert append-only immutable ledger record
      const ledgerRow = await tx.ledgerTransaction.create({
        data: {
          accountId: account.id,
          type: dto.type,
          amount: dto.amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          idempotencyKey: dto.idempotencyKey,
          metadata: (dto.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      return this.mapTransaction(ledgerRow);
    });
  }

  public async listTransactionsByUserId(
    userId: string,
    limit: number = 50
  ): Promise<LedgerTransactionEntity[]> {
    const account = await prisma.virtualCreditAccount.findUnique({
      where: { userId },
    });

    if (!account) return [];

    const rows = await prisma.ledgerTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map(this.mapTransaction);
  }

  private mapTransaction(row: any): LedgerTransactionEntity {
    return {
      id: row.id,
      accountId: row.accountId,
      type: row.type as TransactionType,
      amount: Number(row.amount),
      balanceBefore: Number(row.balanceBefore),
      balanceAfter: Number(row.balanceAfter),
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      idempotencyKey: row.idempotencyKey,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
    };
  }
}
