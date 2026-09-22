// ==============================================================================
// FGP-Backend Round Lifecycle Service
// Strict round state machine:
// SCHEDULED -> OPEN -> LOCKED -> RESULT_PENDING -> RESULT_DECLARED -> SETTLED -> COMPLETED
// Configuration snapshotting and round-bound crash point commitment
// ==============================================================================

import crypto from 'node:crypto';
import { getRepositories } from '../../infrastructure/repositories/index.ts';
import {
  IRoundRepository,
  GameRoundEntity,
} from '../../infrastructure/repositories/interfaces/IRoundRepository.ts';
import { configService } from '../configurations/configService.ts';
import { BadRequestError, NotFoundError, RoundLifecycleError } from '../../shared/errors/index.ts';
import { RoundStatus } from '../../shared/types/index.ts';
import { isValidRoundTransition } from '../../shared/constants/rounds.ts';
import { eventBus } from '../../infrastructure/events/eventBus.ts';

export class RoundService {
  private get repo(): IRoundRepository {
    return getRepositories().roundRepo;
  }

  public async getRoundById(roundId: string): Promise<GameRoundEntity> {
    const round = await this.repo.findById(roundId);
    if (!round) {
      throw new NotFoundError(`Round '${roundId}' not found`);
    }
    return round;
  }

  public async getActiveRound(gameId: string): Promise<GameRoundEntity | null> {
    return this.repo.getActiveRound(gameId);
  }

  public async createRound(gameId: string): Promise<GameRoundEntity> {
    const existingActive = await this.getActiveRound(gameId);
    if (existingActive) {
      return existingActive;
    }

    // 1. Snapshot the exact active configuration version
    let configId: string | undefined;
    let configSnapshot: Record<string, unknown> | undefined;
    try {
      const activeConfig = await configService.getActiveConfig(gameId);
      configId = activeConfig.id;
      configSnapshot = {
        version: activeConfig.version,
        generalConfig: activeConfig.generalConfig,
        entryConfig: activeConfig.entryConfig,
        timingConfig: activeConfig.timingConfig,
        ruleConfig: activeConfig.ruleConfig,
        rewardConfig: activeConfig.rewardConfig,
      };
    } catch {
      // Use default fallback snapshot if not yet seeded
      configSnapshot = { version: 1, note: 'Default genesis configuration snapshot' };
    }

    // 2. Generate provably-fair commitment seeds
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

    // 3. For crash games, calculate the single authoritative crash point at round creation
    let crashPoint: number | undefined;
    if (gameId === 'crash' || gameId === 'space_crash') {
      const hashNum = parseInt(serverSeed.slice(0, 8), 16);
      // House edge 4%, crash distribution
      if (hashNum % 25 === 0) {
        crashPoint = 1.0; // Instant bust (4% chance)
      } else {
        const rawMultiplier = 1.01 + ((hashNum % 10000) / 10000) * 15;
        crashPoint = Math.round(rawMultiplier * 100) / 100;
      }
    }

    // 4. Persist the round in SCHEDULED state
    const scheduledRound = await this.repo.createRound({
      gameId,
      configId,
      configSnapshot,
      serverSeedHash,
      serverSeed,
      crashPoint,
      scheduledAt: new Date(),
    });

    // 5. Transition to OPEN state
    const openRound = await this.repo.transitionStatus(scheduledRound.id, 'OPEN');

    eventBus.publish('ROUND_OPENED', {
      roundId: openRound.id,
      gameId: openRound.gameId,
      roundNumber: Number(openRound.roundNumber),
      serverSeedHash,
      status: 'OPEN',
    });

    return openRound;
  }

  public async transitionRoundStatus(
    roundId: string,
    targetStatus: RoundStatus,
    result?: Record<string, unknown>
  ): Promise<GameRoundEntity> {
    const round = await this.getRoundById(roundId);

    if (!isValidRoundTransition(round.status, targetStatus)) {
      throw new RoundLifecycleError(
        `Invalid round lifecycle transition from '${round.status}' to '${targetStatus}'. Strict lifecycle: SCHEDULED -> OPEN -> LOCKED -> RESULT_PENDING -> RESULT_DECLARED -> SETTLED -> COMPLETED`
      );
    }

    const updated = await this.repo.transitionStatus(roundId, targetStatus, result);

    if (targetStatus === 'LOCKED') {
      eventBus.publish('ROUND_LOCKED', { roundId, gameId: updated.gameId });
    } else if (targetStatus === 'RESULT_DECLARED') {
      eventBus.publish('RESULT_DECLARED', {
        roundId,
        gameId: updated.gameId,
        result: updated.result,
        serverSeed: updated.serverSeed, // Reveal server seed upon result declaration
      });
    } else if (targetStatus === 'SETTLED') {
      eventBus.publish('ROUND_SETTLED', { roundId, gameId: updated.gameId });
    } else if (targetStatus === 'COMPLETED') {
      eventBus.publish('ROUND_COMPLETED', { roundId, gameId: updated.gameId });
    }

    return updated;
  }

  public async declareResult(
    roundId: string,
    result: Record<string, unknown>
  ): Promise<GameRoundEntity> {
    const round = await this.getRoundById(roundId);

    // Enforce strict progression: OPEN -> LOCKED -> RESULT_PENDING -> RESULT_DECLARED
    if (round.status === 'OPEN') {
      await this.transitionRoundStatus(roundId, 'LOCKED');
    }

    const lockedRound = await this.getRoundById(roundId);
    if (lockedRound.status === 'LOCKED') {
      await this.transitionRoundStatus(roundId, 'RESULT_PENDING');
    }

    return this.transitionRoundStatus(roundId, 'RESULT_DECLARED', result);
  }

  public async listRounds(gameId?: string, limit = 20): Promise<GameRoundEntity[]> {
    return this.repo.listRounds(gameId, limit);
  }

  /**
   * Sanitizes round entity for public/player-facing exposure (P0-8).
   * Before RESULT_DECLARED, serverSeed (and crashPoint) are strictly confidential.
   * Only revealed once RESULT_DECLARED, SETTLED, or COMPLETED for provably fair verification.
   */
  public sanitizeRound(round: GameRoundEntity): GameRoundEntity {
    const isRevealed = ['RESULT_DECLARED', 'SETTLED', 'COMPLETED'].includes(round.status);
    if (isRevealed) {
      return round;
    }
    const sanitized = { ...round };
    delete (sanitized as { serverSeed?: string }).serverSeed;
    delete (sanitized as { crashPoint?: number | string }).crashPoint;
    return sanitized;
  }
}

export const roundService = new RoundService();
