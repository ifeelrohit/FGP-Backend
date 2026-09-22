// ==============================================================================
// FGP-Backend Settlement & Game Action Service
// Sections 10-14: Durable PlayerEntry, authoritative resolution, idempotent settlement,
// round-bound crash point evaluation & transactional ledger integration
// ==============================================================================

import { getRepositories } from '../../infrastructure/repositories/index.ts';
import {
  IPlayerEntryRepository,
  ISettlementRepository,
  PlayerEntryEntity,
  SettlementEntity,
} from '../../infrastructure/repositories/interfaces/IPlayerEntryRepository.ts';
import { IRoundRepository } from '../../infrastructure/repositories/interfaces/IRoundRepository.ts';
import { roundService } from '../rounds/roundService.ts';
import { ledgerService } from '../ledger/ledgerService.ts';
import { engineRegistry } from '../../game-engine/engineRegistry.ts';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/index.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export interface PlayerEntryReceipt {
  id?: string;
  entryId: string;
  roundId: string;
  gameId: string;
  userId: string;
  status?: string;
  entryAmount: number;
  balanceAfter: number;
  createdAt: string;
}

export interface SettlementReceipt {
  id?: string;
  entryId?: string;
  roundId: string;
  gameId: string;
  status?: string;
  settlementStatus?: string;
  won: boolean;
  payoutMultiplier: number;
  rewardAmount: number;
  balanceAfter: number;
  outcome: Record<string, unknown>;
  settledAt: string;
}

export class SettlementService {
  private get entryRepo(): IPlayerEntryRepository {
    return getRepositories().entryRepo;
  }

  private get settlementRepo(): ISettlementRepository {
    return getRepositories().settlementRepo;
  }

  private get roundRepo(): IRoundRepository {
    return getRepositories().roundRepo;
  }

  /**
   * Submits a player's entry into an active round.
   * Atomically debits the virtual ledger and persists a durable PlayerEntry.
   */
  public async submitEntry(params: {
    userId: string;
    gameId: string;
    roundId?: string;
    entryAmount: number;
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<PlayerEntryReceipt> {
    const { userId, gameId, entryAmount, payload = {}, idempotencyKey } = params;

    // 1. Resolve or create active round
    let round = params.roundId
      ? await roundService.getRoundById(params.roundId)
      : await roundService.getActiveRound(gameId);

    if (!round) {
      round = await roundService.createRound(gameId);
    }

    if (round.status !== 'OPEN') {
      throw new ConflictError(
        `Round '${round.id}' is in status '${round.status}'. Entries are only accepted when round is OPEN.`
      );
    }

    // 2. Submit entry atomically with debit
    const result = await this.entryRepo.createEntryWithDebit({
      userId,
      gameId,
      roundId: round.id,
      entryAmount,
      payload,
      idempotencyKey,
      metadata: { gameId, roundId: round.id, payload },
    });

    if (!result.isIdempotent) {
      eventBus.publish('PLAYER_ENTRY_CREATED', {
        entryId: result.entry.id,
        roundId: round.id,
        gameId,
        userId,
        entryAmount,
        transactionId: result.transactionId,
      });
    }

    return {
      id: result.entry.id,
      entryId: result.entry.id,
      roundId: round.id,
      gameId,
      userId,
      status: result.entry.status,
      entryAmount,
      balanceAfter: result.balanceAfter,
      createdAt: result.entry.createdAt.toISOString(),
    };
  }

  /**
   * Cashout for real-time crash games (Section 12):
   * References active entry, server evaluates authoritative multiplier against the round's single crash point.
   */
  public async cashoutCrash(params: {
    userId: string;
    entryId: string;
    idempotencyKey?: string;
  }): Promise<SettlementReceipt> {
    const { userId, entryId, idempotencyKey } = params;

    // 1. Idempotency check on settlement
    const existingSettlement = await this.settlementRepo.findByEntryId(entryId);
    if (existingSettlement) {
      const balance = await ledgerService.getBalance(userId);
      return {
        entryId: existingSettlement.entryId,
        roundId: existingSettlement.roundId,
        gameId: existingSettlement.gameId,
        status: 'SETTLED',
        settlementStatus: existingSettlement.status,
        won: existingSettlement.status === 'WON',
        payoutMultiplier: existingSettlement.payoutMultiplier,
        rewardAmount: existingSettlement.rewardAmount,
        balanceAfter: balance.balance,
        outcome: (existingSettlement.outcome || {}) as Record<string, unknown>,
        settledAt: existingSettlement.settledAt.toISOString(),
      };
    }

    // 2. Retrieve entry and round
    const entry = await this.entryRepo.findById(entryId);
    if (!entry) {
      throw new NotFoundError(`Player entry '${entryId}' not found`);
    }

    if (entry.userId !== userId) {
      throw new BadRequestError('Entry does not belong to the requesting player');
    }

    const round = await roundService.getRoundById(entry.roundId);
    if (round.status !== 'OPEN' && round.status !== 'LOCKED') {
      throw new ConflictError(`Round '${round.id}' is '${round.status}', cashout is not possible.`);
    }

    const crashPoint = round.crashPoint ? Number(round.crashPoint) : 1.5;

    // 3. Server determines the authoritative current multiplier based on elapsed time since round opened
    const openedTime = round.openedAt ? new Date(round.openedAt).getTime() : Date.now();
    const elapsedSeconds = Math.max(0, (Date.now() - openedTime) / 1000);
    // Multiplier grows exponentially: 1.01 * e^(0.06 * t)
    const currentMultiplier = Math.round(Math.pow(Math.E, 0.06 * elapsedSeconds) * 100) / 100;

    // Check if auto-cashout was configured in entry payload
    const autoCashout = entry.payload?.autoCashoutMultiplier ? Number(entry.payload.autoCashoutMultiplier) : undefined;
    const cashoutMultiplier = (autoCashout && autoCashout <= currentMultiplier) ? autoCashout : currentMultiplier;

    // 4. Determine win/loss against the round's single authoritative crash point
    const won = cashoutMultiplier <= crashPoint;
    const payoutMultiplier = won ? cashoutMultiplier : 0;
    const rewardAmount = won ? Math.floor(entry.entryAmount * payoutMultiplier * 100) / 100 : 0;

    // 5. Atomically settle entry and credit reward (if won) in a single transaction
    const settleResult = await this.settlementRepo.settleEntryWithReward({
      userId,
      entryId: entry.id,
      status: won ? 'WON' : 'LOST',
      payoutMultiplier,
      rewardAmount,
      outcome: {
        crashPoint,
        authoritativeMultiplier: currentMultiplier,
        cashoutMultiplier,
        won,
      },
      referenceType: 'CRASH_CASHOUT_REWARD',
      idempotencyKey,
    });

    return {
      entryId: settleResult.settlement.entryId,
      roundId: settleResult.settlement.roundId,
      gameId: settleResult.settlement.gameId,
      status: 'SETTLED',
      settlementStatus: settleResult.settlement.status,
      won,
      payoutMultiplier,
      rewardAmount,
      balanceAfter: settleResult.balanceAfter ?? 0,
      outcome: (settleResult.settlement.outcome || {}) as Record<string, unknown>,
      settledAt: settleResult.settlement.settledAt.toISOString(),
    };
  }

  /**
   * On-demand game resolution (prediction, casino, mini-games):
   * Submits entry, loads engine with round configuration snapshot, computes outcome,
   * credits reward (if won), and saves durable settlement.
   */
  public async executeGameAction(params: {
    userId: string;
    gameId: string;
    roundId?: string;
    entryAmount: number;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<SettlementReceipt> {
    const { userId, gameId, entryAmount, payload, idempotencyKey } = params;

    const engine = engineRegistry.get(gameId);
    if (!engine) {
      throw new NotFoundError(`No authoritative game engine registered for game '${gameId}'`);
    }

    // 1. Submit entry (atomically debits balance and creates PlayerEntry)
    const entryReceipt = await this.submitEntry({
      userId,
      gameId,
      roundId: params.roundId,
      entryAmount,
      payload,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}-entry` : undefined,
    });

    const round = await roundService.getRoundById(entryReceipt.roundId);
    const configSnapshot = round.configSnapshot || {};

    // 2. Validate action against engine rules using config snapshot
    const validation = engine.validateAction({
      userId,
      gameId,
      roundId: round.id,
      entryAmount,
      config: configSnapshot,
      payload,
    });

    if (!validation.valid) {
      throw new BadRequestError(validation.error || 'Game action failed validation');
    }

    // 3. Server-authoritative resolution using round's configuration snapshot and round state
    const resolution = engine.resolveResult(
      {
        userId,
        gameId,
        roundId: round.id,
        entryAmount,
        config: configSnapshot,
        payload,
      },
      {
        crashPoint: round.crashPoint,
        serverSeed: round.serverSeed,
      }
    );

    // 4. Atomically settle entry and credit reward (if won) in a single transaction
    const settleResult = await this.settlementRepo.settleEntryWithReward({
      userId,
      entryId: entryReceipt.entryId,
      status: resolution.won ? 'WON' : 'LOST',
      payoutMultiplier: resolution.payoutMultiplier,
      rewardAmount: resolution.rewardAmount,
      outcome: resolution.outcome,
      referenceType: 'GAME_ROUND_REWARD',
      idempotencyKey: idempotencyKey ? `${idempotencyKey}-settle` : undefined,
    });

    // 5. Complete round lifecycle strictly:
    // OPEN -> LOCKED -> RESULT_PENDING -> RESULT_DECLARED -> SETTLED -> COMPLETED
    await roundService.declareResult(round.id, resolution.outcome);
    await roundService.transitionRoundStatus(round.id, 'SETTLED');
    await roundService.transitionRoundStatus(round.id, 'COMPLETED');

    return {
      entryId: entryReceipt.entryId,
      roundId: round.id,
      gameId,
      won: resolution.won,
      payoutMultiplier: resolution.payoutMultiplier,
      rewardAmount: resolution.rewardAmount,
      balanceAfter: settleResult.balanceAfter ?? entryReceipt.balanceAfter,
      outcome: resolution.outcome,
      settledAt: settleResult.settlement.settledAt.toISOString(),
    };
  }
}

export const settlementService = new SettlementService();
