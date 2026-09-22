// ==============================================================================
// FGP-Backend History Service
// Historical queries for player gaming sessions and round outcomes via repositories
// ==============================================================================

import { getRepositories } from '../../infrastructure/repositories/index.ts';
import { LedgerTransactionEntity } from '../../infrastructure/repositories/interfaces/IVirtualCreditRepository.ts';
import { GameRoundEntity } from '../../infrastructure/repositories/interfaces/IRoundRepository.ts';
import { SettlementEntity } from '../../infrastructure/repositories/interfaces/IPlayerEntryRepository.ts';

export class HistoryService {
  public async getPlayerHistory(userId: string, limit = 50): Promise<LedgerTransactionEntity[]> {
    const all = await getRepositories().ledgerRepo.listTransactionsByUserId(userId, limit * 2);
    return all.filter((t) => t.type === 'ENTRY' || t.type === 'REWARD').slice(0, limit);
  }

  public async getPlayerSettlements(userId: string, limit = 50): Promise<SettlementEntity[]> {
    return getRepositories().settlementRepo.listByUserId(userId, limit);
  }

  public async getRoundHistory(gameId: string, limit = 20): Promise<GameRoundEntity[]> {
    const rounds = await getRepositories().roundRepo.listRounds(gameId, limit * 2);
    return rounds.filter((r) => r.status === 'COMPLETED' || r.status === 'RESULT_DECLARED').slice(0, limit);
  }
}

export const historyService = new HistoryService();
