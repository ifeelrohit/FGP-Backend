// ==============================================================================
// IGameRepository Interface
// Catalog management for the 18 authoritative platform games
// ==============================================================================

import { GameCategory, GameStatus } from '../../../shared/types/index.ts';

export interface GameEntityData {
  id: string;
  code: string;
  name: string;
  category: GameCategory;
  status: GameStatus;
  minEntry: number;
  maxEntry: number;
  defaultMultiplier: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGameRepository {
  findById(id: string): Promise<GameEntityData | null>;
  findByCode(code: string): Promise<GameEntityData | null>;
  listAll(category?: GameCategory): Promise<GameEntityData[]>;
  updateStatus(id: string, status: GameStatus): Promise<GameEntityData>;
  seedCatalog(games: GameEntityData[]): Promise<void>;
}
