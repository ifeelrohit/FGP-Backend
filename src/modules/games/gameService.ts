// ==============================================================================
// FGP-Backend Game Catalog Service
// Authoritative 18 games catalog management via repository interfaces
// ==============================================================================

import { GAME_CATALOG, GameMetadata, getGameMetadata } from '../../shared/constants/games.ts';
import { getRepositories } from '../../infrastructure/repositories/index.ts';
import { IGameRepository } from '../../infrastructure/repositories/interfaces/IGameRepository.ts';
import { IGameConfigurationRepository } from '../../infrastructure/repositories/interfaces/IGameConfigurationRepository.ts';
import { GameCategory, GameStatus } from '../../shared/types/index.ts';
import { NotFoundError } from '../../shared/errors/index.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export interface EnrichedGame extends GameMetadata {
  status: GameStatus;
  activeRoundId?: string;
  activeConfigVersion: number;
}

export class GameService {
  private get gameRepo(): IGameRepository {
    return getRepositories().gameRepo;
  }

  private get configRepo(): IGameConfigurationRepository {
    return getRepositories().configRepo;
  }

  public async listGames(category?: GameCategory): Promise<EnrichedGame[]> {
    const list = GAME_CATALOG.filter((g) => !category || g.category === category);

    const enriched: EnrichedGame[] = [];
    for (const g of list) {
      let status: GameStatus = 'ACTIVE';
      try {
        const dbGame = await this.gameRepo.findById(g.id);
        if (dbGame) status = dbGame.status;
      } catch {
        // Fallback to active
      }

      let version = 1;
      try {
        const activeCfg = await this.configRepo.getActiveConfig(g.id);
        if (activeCfg) version = activeCfg.version;
      } catch {
        // Fallback to version 1
      }

      enriched.push({
        ...g,
        status,
        activeConfigVersion: version,
      });
    }

    return enriched;
  }

  public async getGameById(id: string): Promise<EnrichedGame> {
    const metadata = getGameMetadata(id);
    if (!metadata) {
      throw new NotFoundError(`Game '${id}' not found in authoritative catalog`);
    }

    let status: GameStatus = 'ACTIVE';
    try {
      const dbGame = await this.gameRepo.findById(id);
      if (dbGame) status = dbGame.status;
    } catch {
      // Fallback
    }

    let version = 1;
    try {
      const activeCfg = await this.configRepo.getActiveConfig(id);
      if (activeCfg) version = activeCfg.version;
    } catch {
      // Fallback
    }

    return {
      ...metadata,
      status,
      activeConfigVersion: version,
    };
  }

  public async updateGameStatus(id: string, status: GameStatus, actorId?: string): Promise<EnrichedGame> {
    const metadata = getGameMetadata(id);
    if (!metadata) {
      throw new NotFoundError(`Game '${id}' not found in authoritative catalog`);
    }

    try {
      await this.gameRepo.updateStatus(id, status);
    } catch {
      // Ignore if table not yet seeded
    }

    eventBus.publish('GAME_STATUS_CHANGED', {
      gameId: id,
      newStatus: status,
      actorId,
    });

    return this.getGameById(id);
  }
}

export const gameService = new GameService();
