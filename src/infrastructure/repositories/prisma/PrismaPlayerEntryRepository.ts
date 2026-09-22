// ==============================================================================
// PrismaPlayerEntryRepository & PrismaSettlementRepository Implementation
// Durable PostgreSQL records for entries and authoritative settlements
// ==============================================================================

import { prisma } from '../../database/prisma.ts';
import {
  IPlayerEntryRepository,
  ISettlementRepository,
  PlayerEntryEntity,
  CreatePlayerEntryDto,
  SettlementEntity,
  CreateSettlementDto,
} from '../interfaces/IPlayerEntryRepository.ts';
import { EntryStatus, SettlementStatus } from '../../../shared/types/index.ts';

export class PrismaPlayerEntryRepository implements IPlayerEntryRepository {
  public async create(dto: CreatePlayerEntryDto): Promise<PlayerEntryEntity> {
    if (dto.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(dto.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const row = await prisma.playerEntry.create({
      data: {
        userId: dto.userId,
        gameId: dto.gameId,
        roundId: dto.roundId,
        entryAmount: dto.entryAmount,
        payload: dto.payload as any,
        status: 'CONFIRMED',
        idempotencyKey: dto.idempotencyKey,
      },
    });

    return this.mapEntry(row);
  }

  public async findById(id: string): Promise<PlayerEntryEntity | null> {
    const row = await prisma.playerEntry.findUnique({ where: { id } });
    return row ? this.mapEntry(row) : null;
  }

  public async findByIdempotencyKey(key: string): Promise<PlayerEntryEntity | null> {
    const row = await prisma.playerEntry.findUnique({ where: { idempotencyKey: key } });
    return row ? this.mapEntry(row) : null;
  }

  public async findByRoundAndUser(roundId: string, userId: string): Promise<PlayerEntryEntity[]> {
    const rows = await prisma.playerEntry.findMany({
      where: { roundId, userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.mapEntry);
  }

  public async updateStatus(id: string, status: EntryStatus): Promise<PlayerEntryEntity> {
    const row = await prisma.playerEntry.update({
      where: { id },
      data: { status },
    });
    return this.mapEntry(row);
  }

  private mapEntry(row: any): PlayerEntryEntity {
    return {
      id: row.id,
      userId: row.userId,
      gameId: row.gameId,
      roundId: row.roundId,
      entryAmount: Number(row.entryAmount),
      payload: row.payload as Record<string, unknown>,
      status: row.status as EntryStatus,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export class PrismaSettlementRepository implements ISettlementRepository {
  public async create(dto: CreateSettlementDto): Promise<SettlementEntity> {
    const row = await prisma.settlement.create({
      data: {
        entryId: dto.entryId,
        roundId: dto.roundId,
        userId: dto.userId,
        gameId: dto.gameId,
        status: dto.status,
        payoutMultiplier: dto.payoutMultiplier,
        rewardAmount: dto.rewardAmount,
        outcome: (dto.outcome || {}) as any,
      },
    });

    return this.mapSettlement(row);
  }

  public async findByEntryId(entryId: string): Promise<SettlementEntity | null> {
    const row = await prisma.settlement.findUnique({ where: { entryId } });
    return row ? this.mapSettlement(row) : null;
  }

  public async listByRoundId(roundId: string): Promise<SettlementEntity[]> {
    const rows = await prisma.settlement.findMany({
      where: { roundId },
      orderBy: { settledAt: 'desc' },
    });
    return rows.map(this.mapSettlement);
  }

  public async listByUserId(userId: string, limit: number = 50): Promise<SettlementEntity[]> {
    const rows = await prisma.settlement.findMany({
      where: { userId },
      orderBy: { settledAt: 'desc' },
      take: limit,
    });
    return rows.map(this.mapSettlement);
  }

  private mapSettlement(row: any): SettlementEntity {
    return {
      id: row.id,
      entryId: row.entryId,
      roundId: row.roundId,
      userId: row.userId,
      gameId: row.gameId,
      status: row.status as SettlementStatus,
      payoutMultiplier: Number(row.payoutMultiplier),
      rewardAmount: Number(row.rewardAmount),
      outcome: row.outcome as Record<string, unknown> | null,
      settledAt: row.settledAt,
    };
  }
}
