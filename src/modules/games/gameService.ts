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
      const dbGame = await this.gameRepo.findById(g.id);
      const status: GameStatus = dbGame ? dbGame.status : 'ACTIVE';

      const activeCfg = await this.configRepo.getActiveConfig(g.id);
      const version = activeCfg ? activeCfg.version : 1;

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

    const dbGame = await this.gameRepo.findById(id);
    const status: GameStatus = dbGame ? dbGame.status : 'ACTIVE';

    const activeCfg = await this.configRepo.getActiveConfig(id);
    const version = activeCfg ? activeCfg.version : 1;

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

    await this.gameRepo.updateStatus(id, status);

    eventBus.publish('GAME_STATUS_CHANGED', {
      gameId: id,
      newStatus: status,
      actorId,
    });

    return this.getGameById(id);
  }
}

export const gameService = new GameService();
