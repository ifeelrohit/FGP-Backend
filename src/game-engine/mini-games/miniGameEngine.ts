// ==============================================================================
// FGP-Backend Mini-Game Engines (Mines, Plinko, Balloon, Step Path)
// Server-authoritative state, progressive multipliers, and obstacle placement
// ==============================================================================

import crypto from 'node:crypto';
import { BaseGameEngine } from '../core/baseEngine.ts';
import { GameActionContext, RoundResolution } from '../core/types.ts';

// ------------------------------------------------------------------------------
// 15. Mines Engine ('mines')
// ------------------------------------------------------------------------------
export class MinesEngine extends BaseGameEngine {
  readonly gameId = 'mines';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const mineCount = Math.min(24, Math.max(1, Number(context.payload.mineCount ?? 3)));
    const selectedTiles = (Array.isArray(context.payload.tiles)
      ? (context.payload.tiles as number[])
      : [0, 1, 2]
    ).slice(0, 25);

    // Generate authoritative 25-cell minefield
    const mineIndices = new Set<number>();
    while (mineIndices.size < mineCount) {
      mineIndices.add(crypto.randomInt(0, 25));
    }

    const hitMine = selectedTiles.some((tile) => mineIndices.has(tile));
    const won = !hitMine && selectedTiles.length > 0;

    // Multiplier scales with gems revealed
    const multiplier = won ? Math.floor((1.0 + selectedTiles.length * 0.35) * 100) / 100 : 0;
    const rewardAmount = won ? Math.floor(context.entryAmount * multiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: {
        totalMines: mineCount,
        mineIndices: Array.from(mineIndices),
        selectedTiles,
        hitMine,
      },
      payoutMultiplier: multiplier,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 16. Plinko Engine ('plinko')
// ------------------------------------------------------------------------------
export class PlinkoEngine extends BaseGameEngine {
  readonly gameId = 'plinko';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const rows = Math.min(16, Math.max(8, Number(context.payload.rows ?? 8)));
    // Simulates ball dropping down pins: each row ball bounces left (0) or right (1)
    let rightBounces = 0;
    const path: number[] = [];

    for (let i = 0; i < rows; i++) {
      const bounce = crypto.randomInt(0, 2);
      rightBounces += bounce;
      path.push(bounce);
    }

    // Bin index is total right bounces (0 to rows)
    const binIndex = rightBounces;
    // Multipliers symmetrical: center is ~0.5x, edges are up to 10x-29x
    const distanceFromCenter = Math.abs(binIndex - rows / 2);
    const multiplier = Math.floor((0.5 + Math.pow(distanceFromCenter, 1.8) * 0.4) * 100) / 100;
    const won = multiplier >= 1.0;
    const rewardAmount = Math.floor(context.entryAmount * multiplier * 100) / 100;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { rows, binIndex, path },
      payoutMultiplier: multiplier,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 17. Balloon Pump Engine ('balloon')
// ------------------------------------------------------------------------------
export class BalloonEngine extends BaseGameEngine {
  readonly gameId = 'balloon';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const pumps = Math.max(1, Number(context.payload.pumps ?? 3));
    // Server decides authoritative pop limit
    const popAtPump = this.generateSecureRandomInt(2, 12);
    const popped = pumps >= popAtPump;
    const won = !popped;

    const multiplier = won ? Math.floor((1.0 + pumps * 0.25) * 100) / 100 : 0;
    const rewardAmount = won ? Math.floor(context.entryAmount * multiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { requestedPumps: pumps, poppedAt: popAtPump, popped },
      payoutMultiplier: multiplier,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 18. Step Path Engine ('step_path')
// ------------------------------------------------------------------------------
export class StepPathEngine extends BaseGameEngine {
  readonly gameId = 'step_path';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const steps = Math.min(10, Math.max(1, Number(context.payload.steps ?? 3)));
    const trapStep = this.generateSecureRandomInt(2, 11);
    const fell = steps >= trapStep;
    const won = !fell;

    const multiplier = won ? Math.floor((1.0 + steps * 0.4) * 100) / 100 : 0;
    const rewardAmount = won ? Math.floor(context.entryAmount * multiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { stepsAttempted: steps, trapAt: trapStep, fell },
      payoutMultiplier: multiplier,
      won,
      rewardAmount,
    };
  }
}
