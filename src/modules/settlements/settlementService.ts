// ==============================================================================
// FGP-Backend Settlement & Game Action Service
// Sections 21-23: Safe atomic entry debit, authoritative resolution, idempotent settlement
// ==============================================================================

import crypto from 'node:crypto';
import { roundService } from '../rounds/roundService.ts';
import { ledgerService } from '../ledger/ledgerService.ts';
import { configService } from '../configurations/configService.ts';
import { engineRegistry } from '../../game-engine/engineRegistry.ts';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/index.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export interface PlayerEntryReceipt {
  entryId: string;
  roundId: string;
  gameId: string;
  userId: string;
  entryAmount: number;
  balanceAfter: number;
  createdAt: string;
}

export interface SettlementReceipt {
  roundId: string;
  gameId: string;
  won: boolean;
  payoutMultiplier: number;
  rewardAmount: number;
  balanceAfter: number;
  outcome: Record<string, unknown>;
  settledAt: string;
}

export class SettlementService {
  private settledRounds = new Set<string>();

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

    // 1. Get or create active round
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

    // 2. Validate action against engine rules
    const validation = engine.validateAction({
      userId,
      gameId,
      roundId: round.id,
      entryAmount,
      config: {},
      payload,
    });

    if (!validation.valid) {
      throw new BadRequestError(validation.error || 'Game action failed validation');
    }

    // 3. Deduct entry amount from player virtual ledger (strictly atomic & checks for negative balance)
    const entryTx = await ledgerService.recordTransaction({
      userId,
      type: 'ENTRY',
      amount: entryAmount,
      referenceType: 'GAME_ROUND_ENTRY',
      referenceId: round.id,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}-debit` : undefined,
      metadata: { gameId, roundId: round.id, payload },
    });

    eventBus.publish('PLAYER_ENTRY_CREATED', {
      roundId: round.id,
      gameId,
      userId,
      entryAmount,
      transactionId: entryTx.id,
    });

    // 4. Server-authoritative resolution
    const resolution = engine.resolveResult({
      userId,
      gameId,
      roundId: round.id,
      entryAmount,
      config: {},
      payload,
    });

    // 5. If user won, credit rewards via ledger
    let finalBalance = entryTx.balanceAfter;
    if (resolution.won && resolution.rewardAmount > 0) {
      const rewardTx = await ledgerService.recordTransaction({
        userId,
        type: 'REWARD',
        amount: resolution.rewardAmount,
        referenceType: 'GAME_ROUND_REWARD',
        referenceId: round.id,
        idempotencyKey: idempotencyKey ? `${idempotencyKey}-reward` : undefined,
        metadata: {
          gameId,
          roundId: round.id,
          multiplier: resolution.payoutMultiplier,
          outcome: resolution.outcome,
        },
      });
      finalBalance = rewardTx.balanceAfter;
    }

    // 6. Complete round lifecycle if on-demand game
    await roundService.declareResult(round.id, resolution.outcome);
    await roundService.transitionRoundStatus(round.id, 'SETTLED');
    await roundService.transitionRoundStatus(round.id, 'COMPLETED');

    return {
      roundId: round.id,
      gameId,
      won: resolution.won,
      payoutMultiplier: resolution.payoutMultiplier,
      rewardAmount: resolution.rewardAmount,
      balanceAfter: finalBalance,
      outcome: resolution.outcome,
      settledAt: new Date().toISOString(),
    };
  }
}

export const settlementService = new SettlementService();
