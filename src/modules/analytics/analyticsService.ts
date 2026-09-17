// ==============================================================================
// FGP-Backend Analytics & Operational Dashboard Service
// Authoritative operational metrics derived from platform data
// ==============================================================================

import { inMemoryStore } from '../../infrastructure/database/inMemoryStore.ts';
import { GAME_CATALOG } from '../../shared/constants/games.ts';

export interface DashboardMetrics {
  totalUsers: number;
  activePlayers: number;
  totalRounds: number;
  totalEntries: number;
  totalCreditsEntered: number;
  totalCreditsRewarded: number;
  netVirtualMargin: number;
  gameStats: Array<{
    gameId: string;
    gameName: string;
    category: string;
    roundsCount: number;
    entriesCount: number;
    creditsEntered: number;
  }>;
}

export class AnalyticsService {
  public async getDashboardMetrics(): Promise<DashboardMetrics> {
    const totalUsers = inMemoryStore.users.size;
    const activePlayers = Array.from(inMemoryStore.users.values()).filter((u) => u.status === 'ACTIVE').length;
    const totalRounds = inMemoryStore.rounds.size;

    let totalEntries = 0;
    let totalCreditsEntered = 0;
    let totalCreditsRewarded = 0;

    const gameEntriesCount = new Map<string, number>();
    const gameVolume = new Map<string, number>();

    for (const tx of inMemoryStore.transactions) {
      if (tx.type === 'ENTRY') {
        totalEntries++;
        totalCreditsEntered += tx.amount;
        const gId = String(tx.metadata?.gameId || '');
        if (gId) {
          gameEntriesCount.set(gId, (gameEntriesCount.get(gId) || 0) + 1);
          gameVolume.set(gId, (gameVolume.get(gId) || 0) + tx.amount);
        }
      } else if (tx.type === 'REWARD') {
        totalCreditsRewarded += tx.amount;
      }
    }

    const gameStats = GAME_CATALOG.map((g) => {
      const rounds = Array.from(inMemoryStore.rounds.values()).filter((r) => r.gameId === g.id).length;
      return {
        gameId: g.id,
        gameName: g.name,
        category: g.category,
        roundsCount: rounds,
        entriesCount: gameEntriesCount.get(g.id) || 0,
        creditsEntered: Math.round((gameVolume.get(g.id) || 0) * 100) / 100,
      };
    });

    return {
      totalUsers,
      activePlayers,
      totalRounds,
      totalEntries,
      totalCreditsEntered: Math.round(totalCreditsEntered * 100) / 100,
      totalCreditsRewarded: Math.round(totalCreditsRewarded * 100) / 100,
      netVirtualMargin: Math.round((totalCreditsEntered - totalCreditsRewarded) * 100) / 100,
      gameStats,
    };
  }
}

export const analyticsService = new AnalyticsService();
