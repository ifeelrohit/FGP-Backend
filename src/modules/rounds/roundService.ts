// ==============================================================================
// FGP-Backend Round Lifecycle Service
// Section 21: Authoritative state machine:
// SCHEDULED -> OPEN -> LOCKED -> RESULT_PENDING -> RESULT_DECLARED -> SETTLED -> COMPLETED
// ==============================================================================

import crypto from 'node:crypto';
import { inMemoryStore, StoredGameRound } from '../../infrastructure/database/inMemoryStore.ts';
import { ConflictError, NotFoundError } from '../../shared/errors/index.ts';
import { RoundStatus } from '../../shared/types/index.ts';
import { isValidRoundTransition } from '../../shared/constants/rounds.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export class RoundService {
  public async getRoundById(roundId: string): Promise<StoredGameRound> {
    const round = inMemoryStore.rounds.get(roundId);
    if (!round) {
      throw new NotFoundError(`Round '${roundId}' not found`);
    }
    return round;
  }

  public async getActiveRound(gameId: string): Promise<StoredGameRound | null> {
    const activeStates: RoundStatus[] = ['OPEN', 'LOCKED', 'RESULT_PENDING'];
    for (const round of inMemoryStore.rounds.values()) {
      if (round.gameId === gameId && activeStates.includes(round.status)) {
        return round;
      }
    }
    return null;
  }

  public async createRound(gameId: string, configId?: string): Promise<StoredGameRound> {
    const existingActive = await this.getActiveRound(gameId);
    if (existingActive) {
      return existingActive;
    }

    const allRoundsForGame = Array.from(inMemoryStore.rounds.values()).filter((r) => r.gameId === gameId);
    const roundNumber = allRoundsForGame.length + 1;
    const roundId = `rnd-${gameId}-${Date.now()}`;

    const newRound: StoredGameRound = {
      id: roundId,
      gameId,
      roundNumber,
      status: 'OPEN',
      configId,
      scheduledAt: new Date(),
      openedAt: new Date(),
      metadata: { serverSeed: crypto.randomBytes(16).toString('hex') },
    };

    inMemoryStore.rounds.set(roundId, newRound);

    eventBus.publish('ROUND_OPENED', {
      roundId,
      gameId,
      roundNumber,
      status: 'OPEN',
    });

    return newRound;
  }

  public async transitionRoundStatus(
    roundId: string,
    targetStatus: RoundStatus,
    reason?: string
  ): Promise<StoredGameRound> {
    const round = await this.getRoundById(roundId);

    if (!isValidRoundTransition(round.status, targetStatus)) {
      throw new ConflictError(
        `Invalid round status transition from '${round.status}' to '${targetStatus}'`
      );
    }

    round.status = targetStatus;

    if (targetStatus === 'LOCKED') {
      round.lockedAt = new Date();
      eventBus.publish('ROUND_LOCKED', { roundId, gameId: round.gameId });
    } else if (targetStatus === 'RESULT_DECLARED') {
      round.declaredAt = new Date();
      eventBus.publish('RESULT_DECLARED', { roundId, gameId: round.gameId, result: round.result });
    } else if (targetStatus === 'SETTLED') {
      round.settledAt = new Date();
      eventBus.publish('ROUND_SETTLED', { roundId, gameId: round.gameId });
    } else if (targetStatus === 'COMPLETED') {
      round.completedAt = new Date();
    }

    if (reason) {
      round.metadata = { ...round.metadata, lastTransitionReason: reason };
    }

    return round;
  }

  public async declareResult(
    roundId: string,
    result: Record<string, unknown>
  ): Promise<StoredGameRound> {
    const round = await this.getRoundById(roundId);

    // If currently OPEN, lock first
    if (round.status === 'OPEN') {
      await this.transitionRoundStatus(roundId, 'LOCKED');
    }

    round.result = result;
    return this.transitionRoundStatus(roundId, 'RESULT_DECLARED');
  }

  public async listRounds(gameId?: string, limit = 20): Promise<StoredGameRound[]> {
    return Array.from(inMemoryStore.rounds.values())
      .filter((r) => !gameId || r.gameId === gameId)
      .slice(-limit)
      .reverse();
  }
}

export const roundService = new RoundService();
