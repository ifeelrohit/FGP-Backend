// ==============================================================================
// PrismaRefreshTokenRepository Implementation
// Durable storage of hashed refresh tokens with explicit revocation
// ==============================================================================

import { prisma } from '../../database/prisma.ts';
import {
  IRefreshTokenRepository,
  RefreshTokenEntity,
  CreateRefreshTokenDto,
} from '../interfaces/IRefreshTokenRepository.ts';

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  public async create(dto: CreateRefreshTokenDto): Promise<RefreshTokenEntity> {
    try {
      const row = await prisma.refreshToken.create({
        data: {
          userId: dto.userId,
          tokenHash: dto.tokenHash,
          expiresAt: dto.expiresAt,
          userAgent: dto.userAgent,
          ipAddress: dto.ipAddress,
        },
      });
      return this.mapToEntity(row);
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint') || err?.message?.includes('duplicate key')) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const existing = await prisma.refreshToken.findUnique({
            where: { tokenHash: dto.tokenHash },
          });
          if (existing) {
            return this.mapToEntity(existing);
          }
          await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        }
      }
      throw err;
    }
  }

  public async findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    return row ? this.mapToEntity(row) : null;
  }

  public async revokeByTokenHash(tokenHash: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private mapToEntity(row: any): RefreshTokenEntity {
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
    };
  }
}
