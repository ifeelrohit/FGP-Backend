// ==============================================================================
// FGP-Backend Game Catalog Service
// Section 14: 18 platform games catalog management, status and filtering
// ==============================================================================

import { GAME_CATALOG, GameMetadata, getGameMetadata } from '../../shared/constants/games.ts';
import { inMemoryStore } from '../../infrastructure/database/inMemoryStore.ts';
import { GameCategory, GameStatus } from '../../shared/types/index.ts';
import { NotFoundError } from '../../shared/errors/index.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export interface EnrichedGame extends GameMetadata {
  status: GameStatus;
  activeRoundId?: string;
  activeConfigVersion: number;
}

export class GameService {
  private gameStatuses = new Map<string, GameStatus>();

  constructor() {
    for (const game of GAME_CATALOG) {
      this.gameStatuses.set(game.id, 'ACTIVE');
    }
  }

  public listGames(category?: GameCategory): EnrichedGame[] {
    const list = GAME_CATALOG.filter((g) => !category || g.category === category);

    return list.map((g) => {
      const status = this.gameStatuses.get(g.id) || 'ACTIVE';
      const activeConfig = Array.from(inMemoryStore.configurations.values()).find(
        (c) => c.gameId === g.id && c.status === 'ACTIVE'
      );

      return {
        ...g,
        status,
        activeConfigVersion: activeConfig?.version || 1,
      };
    });
  }

  public getGameById(id: string): EnrichedGame {
    const metadata = getGameMetadata(id);
    if (!metadata) {
      throw new NotFoundError(`Game '${id}' not found in authoritative catalog`);
    }

    const status = this.gameStatuses.get(id) || 'ACTIVE';
    const activeConfig = Array.from(inMemoryStore.configurations.values()).find(
      (c) => c.gameId === id && c.status === 'ACTIVE'
    );

    return {
      ...metadata,
      status,
      activeConfigVersion: activeConfig?.version || 1,
    };
  }

  public updateGameStatus(id: string, status: GameStatus, actorId?: string): EnrichedGame {
    const metadata = getGameMetadata(id);
    if (!metadata) {
      throw new NotFoundError(`Game '${id}' not found in authoritative catalog`);
    }

    this.gameStatuses.set(id, status);

    eventBus.publish('GAME_STATUS_CHANGED', {
      gameId: id,
      newStatus: status,
      actorId,
    });

    return this.getGameById(id);
  }
}

export const gameService = new GameService();
