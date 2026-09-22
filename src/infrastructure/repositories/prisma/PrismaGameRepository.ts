// ==============================================================================
// PrismaGameRepository Implementation
// PostgreSQL persistence for the 18 authoritative game catalog items
// ==============================================================================

import { prisma } from '../../database/prisma.ts';
import {
  IGameRepository,
  GameEntityData,
} from '../interfaces/IGameRepository.ts';
import { GameCategory, GameStatus } from '../../../shared/types/index.ts';

export class PrismaGameRepository implements IGameRepository {
  public async findById(id: string): Promise<GameEntityData | null> {
    const row = await prisma.gameEntity.findUnique({ where: { id } });
    return row ? this.mapToEntity(row) : null;
  }

  public async findByCode(code: string): Promise<GameEntityData | null> {
    const row = await prisma.gameEntity.findUnique({ where: { code } });
    return row ? this.mapToEntity(row) : null;
  }

  public async listAll(category?: GameCategory): Promise<GameEntityData[]> {
    const rows = await prisma.gameEntity.findMany({
      where: category ? { category } : undefined,
      orderBy: { id: 'asc' },
    });
    return rows.map(this.mapToEntity);
  }

  public async updateStatus(id: string, status: GameStatus): Promise<GameEntityData> {
    const row = await prisma.gameEntity.update({
      where: { id },
      data: { status },
    });
    return this.mapToEntity(row);
  }

  public async seedCatalog(games: GameEntityData[]): Promise<void> {
    for (const g of games) {
      await prisma.gameEntity.upsert({
        where: { id: g.id },
        update: {
          name: g.name,
          category: g.category,
          minEntry: g.minEntry,
          maxEntry: g.maxEntry,
          defaultMultiplier: g.defaultMultiplier,
        },
        create: {
          id: g.id,
          code: g.code,
          name: g.name,
          category: g.category,
          status: g.status,
          minEntry: g.minEntry,
          maxEntry: g.maxEntry,
          defaultMultiplier: g.defaultMultiplier,
        },
      });
    }
  }

  private mapToEntity(row: any): GameEntityData {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category as GameCategory,
      status: row.status as GameStatus,
      minEntry: Number(row.minEntry),
      maxEntry: Number(row.maxEntry),
      defaultMultiplier: Number(row.defaultMultiplier),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
