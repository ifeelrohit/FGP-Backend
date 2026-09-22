// ==============================================================================
// IVirtualCreditRepository & ILedgerRepository Interfaces
// Durable append-only transaction ledger & balance operations
// ==============================================================================

import { TransactionType } from '../../../shared/types/index.ts';

export interface VirtualCreditAccountEntity {
  id: string;
  userId: string;
  balance: number;
  lockedBalance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerTransactionEntity {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface RecordTransactionDto {
  userId: string;
  type: TransactionType;
  amount: number;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface IVirtualCreditRepository {
  findByUserId(userId: string): Promise<VirtualCreditAccountEntity | null>;
  createAccount(userId: string, initialBalance?: number): Promise<VirtualCreditAccountEntity>;
}

export interface ILedgerRepository {
  executeTransaction(dto: RecordTransactionDto): Promise<LedgerTransactionEntity>;
  findTransactionByIdempotencyKey(key: string): Promise<LedgerTransactionEntity | null>;
  listTransactionsByUserId(userId: string, limit?: number): Promise<LedgerTransactionEntity[]>;
}
