// ==============================================================================
// FGP-Backend History Service
// Historical queries for player gaming sessions and round outcomes
// ==============================================================================

import { inMemoryStore, StoredGameRound, StoredTransaction } from '../../infrastructure/database/inMemoryStore.ts';

export class HistoryService {
  public async getPlayerHistory(userId: string, limit = 50): Promise<StoredTransaction[]> {
    return inMemoryStore.transactions
      .filter((t) => t.userId === userId && (t.type === 'ENTRY' || t.type === 'REWARD'))
      .slice(-limit)
      .reverse();
  }

  public async getRoundHistory(gameId: string, limit = 20): Promise<StoredGameRound[]> {
    return Array.from(inMemoryStore.rounds.values())
      .filter((r) => r.gameId === gameId && (r.status === 'COMPLETED' || r.status === 'RESULT_DECLARED'))
      .slice(-limit)
      .reverse();
  }
}

export const historyService = new HistoryService();
