// ==============================================================================
// PrismaGameConfigurationRepository Implementation
// Immutable versioned configuration lifecycle in PostgreSQL
// DRAFT -> VALIDATE -> PREVIEW -> APPROVE -> PUBLISH -> ACTIVE -> ARCHIVED
// ==============================================================================

import { prisma } from '../../database/prisma.ts';
import {
  IGameConfigurationRepository,
  GameConfigEntity,
  CreateConfigDraftDto,
} from '../interfaces/IGameConfigurationRepository.ts';
import { BadRequestError, NotFoundError } from '../../../shared/errors/index.ts';
import { ConfigStatus } from '../../../shared/types/index.ts';

export class PrismaGameConfigurationRepository implements IGameConfigurationRepository {
  public async findById(id: string): Promise<GameConfigEntity | null> {
    const row = await prisma.gameConfiguration.findUnique({ where: { id } });
    return row ? this.mapToEntity(row) : null;
  }

  public async getActiveConfig(gameId: string): Promise<GameConfigEntity | null> {
    const row = await prisma.gameConfiguration.findFirst({
      where: { gameId, status: 'ACTIVE' },
      orderBy: { version: 'desc' },
    });
    return row ? this.mapToEntity(row) : null;
  }

  public async listVersions(gameId: string): Promise<GameConfigEntity[]> {
    const rows = await prisma.gameConfiguration.findMany({
      where: { gameId },
      orderBy: { version: 'desc' },
    });
    return rows.map(this.mapToEntity);
  }

  public async createDraft(dto: CreateConfigDraftDto): Promise<GameConfigEntity> {
    const existing = await this.listVersions(dto.gameId);
    const nextVersion = existing.length > 0 ? Math.max(...existing.map((e) => e.version)) + 1 : 1;
    const base = existing.length > 0 ? existing[0] : null;

    const row = await prisma.gameConfiguration.create({
      data: {
        gameId: dto.gameId,
        version: nextVersion,
        status: 'DRAFT',
        generalConfig: (dto.generalConfig || base?.generalConfig || {}) as any,
        entryConfig: (dto.entryConfig || base?.entryConfig || {}) as any,
        timingConfig: (dto.timingConfig || base?.timingConfig || {}) as any,
        ruleConfig: (dto.ruleConfig || base?.ruleConfig || {}) as any,
        rewardConfig: (dto.rewardConfig || base?.rewardConfig || {}) as any,
        displayConfig: (dto.displayConfig || base?.displayConfig || {}) as any,
        operationalConfig: (dto.operationalConfig || base?.operationalConfig || {}) as any,
      },
    });

    return this.mapToEntity(row);
  }

  public async transitionStatus(
    configId: string,
    targetStatus: ConfigStatus,
    actorId?: string
  ): Promise<GameConfigEntity> {
    const current = await this.findById(configId);
    if (!current) {
      throw new NotFoundError(`Configuration '${configId}' not found`);
    }

    const validTransitions: Record<ConfigStatus, ConfigStatus[]> = {
      DRAFT: ['VALIDATE'],
      VALIDATE: ['PREVIEW', 'DRAFT'],
      PREVIEW: ['APPROVE', 'DRAFT'],
      APPROVE: ['PUBLISH', 'DRAFT'],
      PUBLISH: ['ACTIVE'],
      ACTIVE: ['ARCHIVED'],
      ARCHIVED: [],
    };

    const allowed = validTransitions[current.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid configuration lifecycle transition from ${current.status} to ${targetStatus}`
      );
    }

    if (targetStatus === 'ACTIVE') {
      return await prisma.$transaction(async (tx) => {
        // Archive any existing ACTIVE configurations for this game
        await tx.gameConfiguration.updateMany({
          where: { gameId: current.gameId, status: 'ACTIVE', id: { not: current.id } },
          data: { status: 'ARCHIVED' },
        });

        // Activate the new version
        const updated = await tx.gameConfiguration.update({
          where: { id: current.id },
          data: {
            status: 'ACTIVE',
            publishedBy: actorId || 'admin',
            publishedAt: new Date(),
          },
        });

        return this.mapToEntity(updated);
      });
    }

    const updated = await prisma.gameConfiguration.update({
      where: { id: current.id },
      data: { status: targetStatus },
    });

    return this.mapToEntity(updated);
  }

  public async rollback(
    gameId: string,
    targetVersion: number,
    actorId?: string
  ): Promise<GameConfigEntity> {
    const versions = await this.listVersions(gameId);
    const target = versions.find((v) => v.version === targetVersion);
    if (!target) {
      throw new NotFoundError(`Version ${targetVersion} of game '${gameId}' configuration not found`);
    }

    const nextVersion = Math.max(...versions.map((v) => v.version)) + 1;

    return await prisma.$transaction(async (tx) => {
      // Archive current active configuration
      await tx.gameConfiguration.updateMany({
        where: { gameId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });

      // Create a new ACTIVE version copying targetVersion data
      const created = await tx.gameConfiguration.create({
        data: {
          gameId,
          version: nextVersion,
          status: 'ACTIVE',
          generalConfig: target.generalConfig as any,
          entryConfig: target.entryConfig as any,
          timingConfig: target.timingConfig as any,
          ruleConfig: target.ruleConfig as any,
          rewardConfig: target.rewardConfig as any,
          displayConfig: target.displayConfig as any,
          operationalConfig: target.operationalConfig as any,
          publishedBy: actorId || 'rollback-system',
          publishedAt: new Date(),
        },
      });

      return this.mapToEntity(created);
    });
  }

  public async seedDefaultConfig(config: GameConfigEntity): Promise<void> {
    await prisma.gameConfiguration.upsert({
      where: {
        gameId_version: {
          gameId: config.gameId,
          version: config.version,
        },
      },
      update: {},
      create: {
        id: config.id,
        gameId: config.gameId,
        version: config.version,
        status: config.status,
        generalConfig: config.generalConfig as any,
        entryConfig: config.entryConfig as any,
        timingConfig: config.timingConfig as any,
        ruleConfig: config.ruleConfig as any,
        rewardConfig: config.rewardConfig as any,
        displayConfig: config.displayConfig as any,
        operationalConfig: config.operationalConfig as any,
        publishedBy: config.publishedBy,
        publishedAt: config.publishedAt,
      },
    });
  }

  private mapToEntity(row: any): GameConfigEntity {
    return {
      id: row.id,
      gameId: row.gameId,
      version: row.version,
      status: row.status as ConfigStatus,
      generalConfig: row.generalConfig as Record<string, unknown>,
      entryConfig: row.entryConfig as Record<string, unknown>,
      timingConfig: row.timingConfig as Record<string, unknown>,
      ruleConfig: row.ruleConfig as Record<string, unknown>,
      rewardConfig: row.rewardConfig as Record<string, unknown>,
      displayConfig: row.displayConfig as Record<string, unknown>,
      operationalConfig: row.operationalConfig as Record<string, unknown>,
      publishedBy: row.publishedBy,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
