// ==============================================================================
// PrismaRoundRepository Implementation
// Strict round lifecycle management and provably-fair commitment in PostgreSQL
// SCHEDULED -> OPEN -> LOCKED -> RESULT_PENDING -> RESULT_DECLARED -> SETTLED -> COMPLETED
// ==============================================================================

import { prisma } from '../../database/prisma.ts';
import {
  IRoundRepository,
  GameRoundEntity,
  CreateRoundDto,
} from '../interfaces/IRoundRepository.ts';
import { BadRequestError, NotFoundError } from '../../../shared/errors/index.ts';
import { RoundStatus } from '../../../shared/types/index.ts';
import { isValidRoundTransition } from '../../../shared/constants/rounds.ts';

export class PrismaRoundRepository implements IRoundRepository {
  public async findById(id: string): Promise<GameRoundEntity | null> {
    const row = await prisma.gameRound.findUnique({ where: { id } });
    return row ? this.mapToEntity(row) : null;
  }

  public async getActiveRound(gameId: string): Promise<GameRoundEntity | null> {
    const row = await prisma.gameRound.findFirst({
      where: {
        gameId,
        status: { in: ['SCHEDULED', 'OPEN', 'LOCKED', 'RESULT_PENDING'] },
      },
      orderBy: { roundNumber: 'desc' },
    });
    return row ? this.mapToEntity(row) : null;
  }

  public async createRound(dto: CreateRoundDto): Promise<GameRoundEntity> {
    const latest = await prisma.gameRound.findFirst({
      where: { gameId: dto.gameId },
      orderBy: { roundNumber: 'desc' },
    });

    const nextRoundNumber = latest ? latest.roundNumber + 1n : 1n;

    const row = await prisma.gameRound.create({
      data: {
        gameId: dto.gameId,
        roundNumber: nextRoundNumber,
        status: 'SCHEDULED',
        configId: dto.configId,
        configSnapshot: (dto.configSnapshot || {}) as any,
        serverSeedHash: dto.serverSeedHash,
        serverSeed: dto.serverSeed,
        crashPoint: dto.crashPoint ? dto.crashPoint : undefined,
        scheduledAt: dto.scheduledAt || new Date(),
      },
    });

    return this.mapToEntity(row);
  }

  public async transitionStatus(
    id: string,
    targetStatus: RoundStatus,
    result?: Record<string, unknown>
  ): Promise<GameRoundEntity> {
    const current = await this.findById(id);
    if (!current) {
      throw new NotFoundError(`Round '${id}' not found`);
    }

    if (!isValidRoundTransition(current.status, targetStatus)) {
      throw new BadRequestError(
        `Invalid round lifecycle transition from '${current.status}' to '${targetStatus}'`
      );
    }

    const updateData: any = {
      status: targetStatus,
    };

    const now = new Date();
    if (targetStatus === 'OPEN') {
      updateData.openedAt = now;
    } else if (targetStatus === 'LOCKED') {
      updateData.lockedAt = now;
    } else if (targetStatus === 'RESULT_DECLARED') {
      updateData.declaredAt = now;
      if (result) {
        updateData.result = result;
      }
    } else if (targetStatus === 'SETTLED') {
      updateData.settledAt = now;
    } else if (targetStatus === 'COMPLETED') {
      updateData.completedAt = now;
    }

    const updated = await prisma.gameRound.update({
      where: { id },
      data: updateData,
    });

    return this.mapToEntity(updated);
  }

  public async listRounds(gameId?: string, limit: number = 20): Promise<GameRoundEntity[]> {
    const rows = await prisma.gameRound.findMany({
      where: gameId ? { gameId } : undefined,
      orderBy: { roundNumber: 'desc' },
      take: limit,
    });
    return rows.map(this.mapToEntity);
  }

  private mapToEntity(row: any): GameRoundEntity {
    return {
      id: row.id,
      gameId: row.gameId,
      roundNumber: row.roundNumber,
      status: row.status as RoundStatus,
      configId: row.configId,
      configSnapshot: row.configSnapshot as Record<string, unknown> | null,
      serverSeedHash: row.serverSeedHash,
      serverSeed: row.serverSeed,
      crashPoint: row.crashPoint ? Number(row.crashPoint) : null,
      scheduledAt: row.scheduledAt,
      openedAt: row.openedAt,
      lockedAt: row.lockedAt,
      declaredAt: row.declaredAt,
      settledAt: row.settledAt,
      completedAt: row.completedAt,
      result: row.result as Record<string, unknown> | null,
      metadata: row.metadata as Record<string, unknown> | null,
    };
  }
}
