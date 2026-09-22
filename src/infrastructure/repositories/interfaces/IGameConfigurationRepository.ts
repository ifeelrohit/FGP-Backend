// ==============================================================================
// IGameConfigurationRepository Interface
// Immutable versioned configuration lifecycle with multi-stage publishing
// ==============================================================================

import { ConfigStatus } from '../../../shared/types/index.ts';

export interface GameConfigEntity {
  id: string;
  gameId: string;
  version: number;
  status: ConfigStatus;
  generalConfig: Record<string, unknown>;
  entryConfig: Record<string, unknown>;
  timingConfig: Record<string, unknown>;
  ruleConfig: Record<string, unknown>;
  rewardConfig: Record<string, unknown>;
  displayConfig: Record<string, unknown>;
  operationalConfig: Record<string, unknown>;
  publishedBy?: string | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConfigDraftDto {
  gameId: string;
  generalConfig?: Record<string, unknown>;
  entryConfig?: Record<string, unknown>;
  timingConfig?: Record<string, unknown>;
  ruleConfig?: Record<string, unknown>;
  rewardConfig?: Record<string, unknown>;
  displayConfig?: Record<string, unknown>;
  operationalConfig?: Record<string, unknown>;
}

export interface IGameConfigurationRepository {
  findById(id: string): Promise<GameConfigEntity | null>;
  getActiveConfig(gameId: string): Promise<GameConfigEntity | null>;
  listVersions(gameId: string): Promise<GameConfigEntity[]>;
  createDraft(dto: CreateConfigDraftDto): Promise<GameConfigEntity>;
  transitionStatus(configId: string, targetStatus: ConfigStatus, actorId?: string): Promise<GameConfigEntity>;
  rollback(gameId: string, targetVersion: number, actorId?: string): Promise<GameConfigEntity>;
  seedDefaultConfig(config: GameConfigEntity): Promise<void>;
}
