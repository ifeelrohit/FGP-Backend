// ==============================================================================
// IRoundRepository Interface
// Authoritative round engine persistence with strict state transitions
// ==============================================================================

import { RoundStatus } from '../../../shared/types/index.ts';

export interface GameRoundEntity {
  id: string;
  gameId: string;
  roundNumber: bigint;
  status: RoundStatus;
  configId?: string | null;
  configSnapshot?: Record<string, unknown> | null;
  serverSeedHash?: string | null;
  serverSeed?: string | null;
  crashPoint?: number | null;
  scheduledAt: Date;
  openedAt?: Date | null;
  lockedAt?: Date | null;
  declaredAt?: Date | null;
  settledAt?: Date | null;
  completedAt?: Date | null;
  result?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateRoundDto {
  gameId: string;
  configId?: string;
  configSnapshot?: Record<string, unknown>;
  serverSeedHash?: string;
  serverSeed?: string;
  crashPoint?: number;
  scheduledAt?: Date;
}

export interface IRoundRepository {
  findById(id: string): Promise<GameRoundEntity | null>;
  getActiveRound(gameId: string): Promise<GameRoundEntity | null>;
  createRound(dto: CreateRoundDto): Promise<GameRoundEntity>;
  transitionStatus(
    id: string,
    targetStatus: RoundStatus,
    result?: Record<string, unknown>
  ): Promise<GameRoundEntity>;
  listRounds(gameId?: string, limit?: number): Promise<GameRoundEntity[]>;
}
