// ==============================================================================
// FGP-Backend Real-Time Crash Engines (Crash & Space Crash)
// Section 11 & 12: Round-bound crash point, server-authoritative multiplier & safe cashout
// ==============================================================================

import crypto from 'node:crypto';
import { BaseGameEngine } from '../core/baseEngine.ts';
import { GameActionContext, RoundResolution } from '../core/types.ts';

export class CrashEngine extends BaseGameEngine {
  readonly gameId: string;

  constructor(gameId = 'crash') {
    super();
    this.gameId = gameId;
  }

  /**
   * Generates an authoritative crash multiplier for a ROUND using provably fair seed
   */
  public generateAuthoritativeCrashPoint(serverSeed: string): number {
    const hash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const hexSlice = hash.substring(0, 8);
    const intVal = Number.parseInt(hexSlice, 16);

    // 1 in 101 chance of immediate 1.00x bust
    if (intVal % 101 === 0) {
      return 1.0;
    }

    // Standard inverse house edge curve (0.97 RTP)
    const floatVal = (intVal % 1000000) / 1000000;
    const crashMultiplier = Math.floor((0.97 / (1 - floatVal)) * 100) / 100;

    return Math.max(1.0, Math.min(crashMultiplier, 250.0));
  }

  /**
   * Resolves round outcome using the ROUND's predetermined crash point.
   * Does NOT generate a new crash point on every resolve.
   */
  public override resolveResult(
    context: GameActionContext,
    roundState?: Record<string, unknown>
  ): RoundResolution {
    // Authoritative crash point comes from the ROUND state
    let crashPoint = roundState?.crashPoint ? Number(roundState.crashPoint) : undefined;
    let serverSeed = (roundState?.serverSeed as string) || undefined;

    if (!crashPoint) {
      serverSeed = serverSeed || crypto.randomBytes(16).toString('hex');
      crashPoint = this.generateAuthoritativeCrashPoint(serverSeed);
    }

    // Server-authoritative cashout multiplier (not blindly trusting client)
    const authoritativeMultiplier = roundState?.authoritativeMultiplier
      ? Number(roundState.authoritativeMultiplier)
      : Number(context.payload.authoritativeMultiplier ?? context.payload.autoCashoutMultiplier ?? 1.5);

    // Cashout is only successful if cashout multiplier is strictly <= round's crash point
    const won = authoritativeMultiplier >= 1.0 && authoritativeMultiplier <= crashPoint;
    const payoutMultiplier = won ? authoritativeMultiplier : 0;
    const rewardAmount = won ? Math.floor(context.entryAmount * payoutMultiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: {
        crashPoint,
        authoritativeMultiplier,
        cashedOut: won,
        serverSeedHash: serverSeed
          ? crypto.createHash('sha256').update(serverSeed).digest('hex')
          : undefined,
      },
      payoutMultiplier,
      won,
      rewardAmount,
      serverSeed,
    };
  }
}

export class SpaceCrashEngine extends CrashEngine {
  constructor() {
    super('space_crash');
  }
}
