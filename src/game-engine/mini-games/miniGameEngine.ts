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
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    const boardSize = ruleConfig.boardSize ?? 25;
    const defaultMines = ruleConfig.mineCount ?? 3;
    const mineCount = Math.min(boardSize - 1, Math.max(1, Number(context.payload.mineCount ?? defaultMines)));
    const selectedTiles = (Array.isArray(context.payload.tiles)
      ? (context.payload.tiles as number[])
      : [0, 1, 2]
    ).slice(0, boardSize);

    // Generate authoritative minefield driven by boardSize
    const mineIndices = new Set<number>();
    while (mineIndices.size < mineCount) {
      mineIndices.add(crypto.randomInt(0, boardSize));
    }

    const hitMine = selectedTiles.some((tile) => mineIndices.has(tile));
    const won = !hitMine && selectedTiles.length > 0;

    // Multiplier scales with gems revealed driven by rewardConfig.gemMultiplierFactor
    const gemFactor = rewardConfig.gemMultiplierFactor ?? 0.35;
    const multiplier = won ? Math.floor((1.0 + selectedTiles.length * gemFactor) * 100) / 100 : 0;
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
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    const defaultRows = ruleConfig.rows ?? 8;
    const rows = Math.min(16, Math.max(8, Number(context.payload.rows ?? defaultRows)));
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
    // Multipliers symmetrical: center is ~base, edges scale with exponent and factor
    const baseMult = rewardConfig.baseMultiplier ?? 0.5;
    const exp = rewardConfig.exponent ?? 1.8;
    const scale = rewardConfig.scaleFactor ?? 0.4;
    const distanceFromCenter = Math.abs(binIndex - rows / 2);
    const multiplier = Math.floor((baseMult + Math.pow(distanceFromCenter, exp) * scale) * 100) / 100;
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
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    const pumps = Math.max(1, Number(context.payload.pumps ?? 3));
    // Server decides authoritative pop limit driven by ruleConfig pop range
    const minPop = ruleConfig.minPopRange ?? 2;
    const maxPop = ruleConfig.maxPopRange ?? 12;
    const popAtPump = this.generateSecureRandomInt(minPop, maxPop);
    const popped = pumps >= popAtPump;
    const won = !popped;

    const pumpRate = rewardConfig.pumpMultiplierRate ?? 0.25;
    const multiplier = won ? Math.floor((1.0 + pumps * pumpRate) * 100) / 100 : 0;
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
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    const maxSteps = ruleConfig.maxSteps ?? 10;
    const steps = Math.min(maxSteps, Math.max(1, Number(context.payload.steps ?? 3)));
    const trapStep = this.generateSecureRandomInt(2, maxSteps + 1);
    const fell = steps >= trapStep;
    const won = !fell;

    const stepRate = rewardConfig.stepMultiplierRate ?? 0.4;
    const multiplier = won ? Math.floor((1.0 + steps * stepRate) * 100) / 100 : 0;
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
