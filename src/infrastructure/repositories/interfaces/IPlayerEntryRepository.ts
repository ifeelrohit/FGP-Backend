// ==============================================================================
// IPlayerEntryRepository & ISettlementRepository Interfaces
// Durable player entry tracking and atomic settlement coordination
// ==============================================================================

import { EntryStatus, SettlementStatus } from '../../../shared/types/index.ts';

export interface PlayerEntryEntity {
  id: string;
  userId: string;
  gameId: string;
  roundId: string;
  entryAmount: number;
  payload: Record<string, unknown>;
  status: EntryStatus;
  idempotencyKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlayerEntryDto {
  userId: string;
  gameId: string;
  roundId: string;
  entryAmount: number;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface SettlementEntity {
  id: string;
  entryId: string;
  roundId: string;
  userId: string;
  gameId: string;
  status: SettlementStatus;
  payoutMultiplier: number;
  rewardAmount: number;
  outcome?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  settledAt: Date;
}

export interface CreateSettlementDto {
  entryId: string;
  roundId: string;
  userId: string;
  gameId: string;
  status: SettlementStatus;
  payoutMultiplier: number;
  rewardAmount: number;
  outcome?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface CreateEntryWithDebitParams {
  userId: string;
  gameId: string;
  roundId: string;
  entryAmount: number;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateEntryWithDebitResult {
  entry: PlayerEntryEntity;
  balanceBefore: number;
  balanceAfter: number;
  transactionId: string;
  isIdempotent: boolean;
}

export interface SettleEntryWithRewardParams {
  userId: string;
  entryId: string;
  status: SettlementStatus;
  payoutMultiplier: number;
  rewardAmount: number;
  outcome?: Record<string, unknown>;
  referenceType?: string;
  idempotencyKey?: string;
}

export interface SettleEntryWithRewardResult {
  settlement: SettlementEntity;
  balanceBefore?: number;
  balanceAfter?: number;
  transactionId?: string;
  isIdempotent: boolean;
}

export interface IPlayerEntryRepository {
  create(dto: CreatePlayerEntryDto): Promise<PlayerEntryEntity>;
  createEntryWithDebit(params: CreateEntryWithDebitParams): Promise<CreateEntryWithDebitResult>;
  findById(id: string): Promise<PlayerEntryEntity | null>;
  findByIdempotencyKey(key: string): Promise<PlayerEntryEntity | null>;
  findByRoundAndUser(roundId: string, userId: string): Promise<PlayerEntryEntity[]>;
  updateStatus(id: string, status: EntryStatus): Promise<PlayerEntryEntity>;
}

export interface ISettlementRepository {
  create(dto: CreateSettlementDto): Promise<SettlementEntity>;
  settleEntryWithReward(params: SettleEntryWithRewardParams): Promise<SettleEntryWithRewardResult>;
  findByEntryId(entryId: string): Promise<SettlementEntity | null>;
  listByRoundId(roundId: string): Promise<SettlementEntity[]>;
  listByUserId(userId: string, limit?: number): Promise<SettlementEntity[]>;
}
