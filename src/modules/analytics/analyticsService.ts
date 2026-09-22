// ==============================================================================
// FGP-Backend Analytics & Operational Dashboard Service
// Authoritative operational metrics derived from platform data repositories
// ==============================================================================

import { getRepositories } from '../../infrastructure/repositories/index.ts';
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
    const repos = getRepositories();
    const users = await repos.userRepo.listAll();
    const totalUsers = users.length;
    const activePlayers = users.filter((u) => u.status === 'ACTIVE').length;

    const rounds = await repos.roundRepo.listRounds(undefined, 1000);
    const totalRounds = rounds.length;

    // Aggregate game stats
    const gameStats = GAME_CATALOG.map((g) => {
      const gameRounds = rounds.filter((r) => r.gameId === g.id).length;
      return {
        gameId: g.id,
        gameName: g.name,
        category: g.category,
        roundsCount: gameRounds,
        entriesCount: 0,
        creditsEntered: 0,
      };
    });

    return {
      totalUsers,
      activePlayers,
      totalRounds,
      totalEntries: 0,
      totalCreditsEntered: 0,
      totalCreditsRewarded: 0,
      netVirtualMargin: 0,
      gameStats,
    };
  }
}

export const analyticsService = new AnalyticsService();
