// ==============================================================================
// FGP-Backend Real-Time Crash Engines (Crash & Space Crash)
// Section 19: Authoritative crash point, multiplier progression, and anti-cheat cashout
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
   * Generates a provably authoritative crash multiplier on the server
   * Multipliers range from 1.00x to 100.00x with 1% instant bust
   */
  public generateAuthoritativeCrashPoint(serverSeed?: string): number {
    const seed = serverSeed || crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
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

  public override resolveResult(context: GameActionContext): RoundResolution {
    const serverSeed = crypto.randomBytes(16).toString('hex');
    const crashPoint = this.generateAuthoritativeCrashPoint(serverSeed);

    const requestedCashout = Number(
      context.payload.cashoutMultiplier ?? context.payload.autoCashoutMultiplier ?? 1.5
    );

    // Cashout is only successful if requested multiplier is strictly <= authoritative crash point
    const won = requestedCashout > 1.0 && requestedCashout <= crashPoint;
    const payoutMultiplier = won ? requestedCashout : 0;
    const rewardAmount = won ? Math.floor(context.entryAmount * payoutMultiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: {
        crashPoint,
        requestedCashout,
        cashedOut: won,
        serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
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
