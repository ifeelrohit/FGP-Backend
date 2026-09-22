// ==============================================================================
// FGP-Backend Game Configuration Service
// Section 9: Immutable versioned configurations with multi-step publishing lifecycle
// DRAFT -> VALIDATE -> PREVIEW -> APPROVE -> PUBLISH -> ACTIVE -> ARCHIVED
// ==============================================================================

import { getRepositories } from '../../infrastructure/repositories/index.ts';
import {
  IGameConfigurationRepository,
  GameConfigEntity,
  CreateConfigDraftDto,
} from '../../infrastructure/repositories/interfaces/IGameConfigurationRepository.ts';
import { IAuditRepository } from '../../infrastructure/repositories/interfaces/IAuditRepository.ts';
import { NotFoundError } from '../../shared/errors/index.ts';
import { ConfigStatus } from '../../shared/types/index.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export class ConfigService {
  private get repo(): IGameConfigurationRepository {
    return getRepositories().configRepo;
  }

  private get auditRepo(): IAuditRepository {
    return getRepositories().auditRepo;
  }

  public async getActiveConfig(gameId: string): Promise<GameConfigEntity> {
    const config = await this.repo.getActiveConfig(gameId);
    if (!config) {
      throw new NotFoundError(`No active configuration found for game '${gameId}'`);
    }
    return config;
  }

  public async listVersions(gameId: string): Promise<GameConfigEntity[]> {
    return this.repo.listVersions(gameId);
  }

  public async createDraft(params: CreateConfigDraftDto): Promise<GameConfigEntity> {
    return this.repo.createDraft(params);
  }

  public async transitionStatus(
    configId: string,
    targetStatus: ConfigStatus,
    actorId?: string
  ): Promise<GameConfigEntity> {
    const updated = await this.repo.transitionStatus(configId, targetStatus, actorId);

    if (targetStatus === 'ACTIVE' || targetStatus === 'PUBLISH') {
      eventBus.publish('GAME_CONFIGURATION_PUBLISHED', {
        gameId: updated.gameId,
        configId: updated.id,
        version: updated.version,
        publishedBy: actorId,
      });

      await this.auditRepo.create({
        actorId: actorId || 'system',
        action: 'PUBLISH_CONFIGURATION',
        targetType: 'GAME_CONFIGURATION',
        targetId: updated.id,
        metadata: {
          gameId: updated.gameId,
          version: updated.version,
          status: updated.status,
        },
      });
    } else {
      await this.auditRepo.create({
        actorId: actorId || 'system',
        action: 'TRANSITION_CONFIGURATION',
        targetType: 'GAME_CONFIGURATION',
        targetId: updated.id,
        metadata: {
          gameId: updated.gameId,
          version: updated.version,
          targetStatus,
        },
      });
    }

    return updated;
  }

  public async rollback(
    gameId: string,
    targetVersion: number,
    actorId?: string
  ): Promise<GameConfigEntity> {
    const rolledBack = await this.repo.rollback(gameId, targetVersion, actorId);

    eventBus.publish('GAME_CONFIGURATION_PUBLISHED', {
      gameId,
      configId: rolledBack.id,
      version: rolledBack.version,
      rolledBackFromVersion: targetVersion,
      publishedBy: actorId,
    });

    await this.auditRepo.create({
      actorId: actorId || 'system',
      action: 'ROLLBACK_CONFIGURATION',
      targetType: 'GAME_CONFIGURATION',
      targetId: rolledBack.id,
      metadata: {
        gameId,
        newVersion: rolledBack.version,
        targetVersion,
      },
    });

    return rolledBack;
  }
}

export const configService = new ConfigService();
