// ==============================================================================
// FGP-Backend Game Configuration Service
// Section 13: Immutable versioned configurations with multi-step publishing lifecycle
// DRAFT -> VALIDATE -> PREVIEW -> APPROVE -> PUBLISH -> ACTIVE
// ==============================================================================

import crypto from 'node:crypto';
import { inMemoryStore, StoredGameConfig } from '../../infrastructure/database/inMemoryStore.ts';
import { BadRequestError, NotFoundError } from '../../shared/errors/index.ts';
import { ConfigStatus } from '../../shared/types/index.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export class ConfigService {
  public async getActiveConfig(gameId: string): Promise<StoredGameConfig> {
    const configs = Array.from(inMemoryStore.configurations.values())
      .filter((c) => c.gameId === gameId && c.status === 'ACTIVE')
      .sort((a, b) => b.version - a.version);

    if (configs.length > 0) return configs[0];

    throw new NotFoundError(`No active configuration found for game '${gameId}'`);
  }

  public async listVersions(gameId: string): Promise<StoredGameConfig[]> {
    return Array.from(inMemoryStore.configurations.values())
      .filter((c) => c.gameId === gameId)
      .sort((a, b) => b.version - a.version);
  }

  public async createDraft(params: {
    gameId: string;
    generalConfig?: Record<string, unknown>;
    entryConfig?: Record<string, unknown>;
    timingConfig?: Record<string, unknown>;
    ruleConfig?: Record<string, unknown>;
    rewardConfig?: Record<string, unknown>;
    displayConfig?: Record<string, unknown>;
    operationalConfig?: Record<string, unknown>;
  }): Promise<StoredGameConfig> {
    const existing = await this.listVersions(params.gameId);
    const nextVersion = existing.length > 0 ? Math.max(...existing.map((e) => e.version)) + 1 : 1;

    const baseConfig = existing.length > 0 ? existing[0] : null;

    const draftId = `cfg-${params.gameId}-v${nextVersion}`;
    const newConfig: StoredGameConfig = {
      id: draftId,
      gameId: params.gameId,
      version: nextVersion,
      status: 'DRAFT',
      generalConfig: params.generalConfig || baseConfig?.generalConfig || {},
      entryConfig: params.entryConfig || baseConfig?.entryConfig || {},
      timingConfig: params.timingConfig || baseConfig?.timingConfig || {},
      ruleConfig: params.ruleConfig || baseConfig?.ruleConfig || {},
      rewardConfig: params.rewardConfig || baseConfig?.rewardConfig || {},
      displayConfig: params.displayConfig || baseConfig?.displayConfig || {},
      operationalConfig: params.operationalConfig || baseConfig?.operationalConfig || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryStore.configurations.set(draftId, newConfig);
    return newConfig;
  }

  public async transitionStatus(
    configId: string,
    targetStatus: ConfigStatus,
    actorId?: string
  ): Promise<StoredGameConfig> {
    const config = inMemoryStore.configurations.get(configId);
    if (!config) {
      throw new NotFoundError(`Configuration '${configId}' not found`);
    }

    // Validate lifecycle progression
    const validTransitions: Record<ConfigStatus, ConfigStatus[]> = {
      DRAFT: ['VALIDATE'],
      VALIDATE: ['PREVIEW', 'DRAFT'],
      PREVIEW: ['APPROVE', 'DRAFT'],
      APPROVE: ['PUBLISH', 'DRAFT'],
      PUBLISH: ['ACTIVE'],
      ACTIVE: [],
    };

    const allowed = validTransitions[config.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid configuration lifecycle transition from ${config.status} to ${targetStatus}`
      );
    }

    // If publishing/activating, archive prior active version
    if (targetStatus === 'PUBLISH' || targetStatus === 'ACTIVE') {
      config.status = 'ACTIVE';
      config.publishedBy = actorId || 'admin';
      config.publishedAt = new Date();

      // Deactivate previous active configurations for this game
      for (const other of inMemoryStore.configurations.values()) {
        if (other.gameId === config.gameId && other.id !== config.id && other.status === 'ACTIVE') {
          other.status = 'PUBLISH'; // archived published state
        }
      }

      eventBus.publish('GAME_CONFIGURATION_PUBLISHED', {
        gameId: config.gameId,
        configId: config.id,
        version: config.version,
        publishedBy: actorId,
      });
    } else {
      config.status = targetStatus;
    }

    config.updatedAt = new Date();
    return config;
  }

  public async rollback(gameId: string, targetVersion: number, actorId?: string): Promise<StoredGameConfig> {
    const versions = await this.listVersions(gameId);
    const targetConfig = versions.find((v) => v.version === targetVersion);
    if (!targetConfig) {
      throw new NotFoundError(`Version ${targetVersion} of game ${gameId} configuration does not exist`);
    }

    // Rollback creates a NEW active configuration version rather than mutating history
    const nextVersion = Math.max(...versions.map((v) => v.version)) + 1;
    const rollbackId = `cfg-${gameId}-v${nextVersion}-rb`;

    const newConfig: StoredGameConfig = {
      id: rollbackId,
      gameId,
      version: nextVersion,
      status: 'ACTIVE',
      generalConfig: { ...targetConfig.generalConfig },
      entryConfig: { ...targetConfig.entryConfig },
      timingConfig: { ...targetConfig.timingConfig },
      ruleConfig: { ...targetConfig.ruleConfig },
      rewardConfig: { ...targetConfig.rewardConfig },
      displayConfig: { ...targetConfig.displayConfig },
      operationalConfig: { ...targetConfig.operationalConfig },
      publishedBy: actorId || 'system-rollback',
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryStore.configurations.set(rollbackId, newConfig);

    // Deactivate previous active config
    for (const other of inMemoryStore.configurations.values()) {
      if (other.gameId === gameId && other.id !== rollbackId && other.status === 'ACTIVE') {
        other.status = 'PUBLISH';
      }
    }

    eventBus.publish('GAME_CONFIGURATION_PUBLISHED', {
      gameId,
      configId: rollbackId,
      version: nextVersion,
      rolledBackFromVersion: targetVersion,
      publishedBy: actorId,
    });

    return newConfig;
  }
}

export const configService = new ConfigService();
