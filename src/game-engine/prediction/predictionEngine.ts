// ==============================================================================
// FGP-Backend Prediction Game Engines
// Section 10: Authoritative server-side resolution driven by configuration snapshots
// ==============================================================================

import { BaseGameEngine } from '../core/baseEngine.ts';
import { GameActionContext, RoundResolution } from '../core/types.ts';

// ------------------------------------------------------------------------------
// 1. Color Prediction Engine ('color_pred')
// ------------------------------------------------------------------------------
export class ColorPredictionEngine extends BaseGameEngine {
  readonly gameId = 'color_pred';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    const maxNumber = ruleConfig.maxNumber ?? 9;
    const luckyNumber = this.generateSecureRandomInt(0, maxNumber);

    let color: 'RED' | 'GREEN' | 'VIOLET';
    if (luckyNumber === 0 || luckyNumber === 5) {
      color = 'VIOLET';
    } else if (luckyNumber % 2 === 1) {
      color = 'GREEN';
    } else {
      color = 'RED';
    }

    const playerChoice = String(context.payload.color || context.payload.selection).toUpperCase();
    const won = playerChoice === color;

    // Multipliers configured by admin configuration snapshot
    const violetMultiplier = rewardConfig.multipliers?.VIOLET ?? 4.5;
    const standardMultiplier = rewardConfig.multipliers?.STANDARD ?? 1.98;
    const multiplier = color === 'VIOLET' ? violetMultiplier : standardMultiplier;

    const rewardAmount = won ? Math.floor(context.entryAmount * multiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { luckyNumber, winningColor: color, playerChoice },
      payoutMultiplier: won ? multiplier : 0,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 2. Number Prediction Engine ('number_pred')
// ------------------------------------------------------------------------------
export class NumberPredictionEngine extends BaseGameEngine {
  readonly gameId = 'number_pred';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    const maxNumber = ruleConfig.maxNumber ?? 9;
    const outcomeNumber = this.generateSecureRandomInt(0, maxNumber);
    const playerNumber = Number(context.payload.number ?? context.payload.selection);
    const won = playerNumber === outcomeNumber;

    const multiplier = rewardConfig.multiplier ?? 9.0;
    const rewardAmount = won ? Math.floor(context.entryAmount * multiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { winningNumber: outcomeNumber, playerNumber },
      payoutMultiplier: won ? multiplier : 0,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 3. Odd / Even Engine ('odd_even')
// ------------------------------------------------------------------------------
export class OddEvenEngine extends BaseGameEngine {
  readonly gameId = 'odd_even';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    const maxRange = ruleConfig.maxRange ?? 100;
    const outcomeNumber = this.generateSecureRandomInt(1, maxRange);
    const isEven = outcomeNumber % 2 === 0;
    const actualParity = isEven ? 'EVEN' : 'ODD';
    const playerParity = String(context.payload.parity || context.payload.selection).toUpperCase();
    const won = playerParity === actualParity;

    const multiplier = rewardConfig.multiplier ?? 1.96;
    const rewardAmount = won ? Math.floor(context.entryAmount * multiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { outcomeNumber, winningParity: actualParity, playerChoice: playerParity },
      payoutMultiplier: won ? multiplier : 0,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 4. Hi-Lo Engine ('hi_lo')
// ------------------------------------------------------------------------------
export class HiLoEngine extends BaseGameEngine {
  readonly gameId = 'hi_lo';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    const maxRange = ruleConfig.maxRange ?? 100;
    const baseNumber = Number(context.payload.baseNumber ?? 50);
    const nextNumber = this.generateSecureRandomInt(1, maxRange);
    const direction = String(context.payload.direction || context.payload.selection).toUpperCase();

    let won = false;
    if (direction === 'HI' && nextNumber > baseNumber) won = true;
    if (direction === 'LO' && nextNumber < baseNumber) won = true;

    const multiplier = rewardConfig.multiplier ?? 1.95;
    const rewardAmount = won ? Math.floor(context.entryAmount * multiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { baseNumber, nextNumber, direction, tie: nextNumber === baseNumber },
      payoutMultiplier: won ? multiplier : 0,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 5. Classic Dice Engine ('dice')
// ------------------------------------------------------------------------------
export class DiceEngine extends BaseGameEngine {
  readonly gameId = 'dice';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    const houseEdge = rewardConfig.houseEdge ?? 0.02;
    const roll = this.generateSecureRandomInt(0, 9999) / 100; // 0.00 to 99.99
    const target = Number(context.payload.target ?? 50.0);
    const condition = String(context.payload.condition || 'ROLL_UNDER').toUpperCase();

    const won = condition === 'ROLL_UNDER' ? roll < target : roll > target;
    const winProbability = condition === 'ROLL_UNDER' ? target / 100 : (100 - target) / 100;
    const rtp = 1 - houseEdge;
    const multiplier = Math.max(1.01, Math.floor((rtp / winProbability) * 100) / 100);
    const rewardAmount = won ? Math.floor(context.entryAmount * multiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { roll, target, condition },
      payoutMultiplier: won ? multiplier : 0,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 6. Number Wheel Engine ('number_wheel')
// ------------------------------------------------------------------------------
export class NumberWheelEngine extends BaseGameEngine {
  readonly gameId = 'number_wheel';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    // Sectors can be driven by configuration
    const sectors: number[] = rewardConfig.sectors || [1, 2, 1, 5, 1, 2, 1, 10, 1, 2, 1, 20];
    const winningSectorIndex = this.generateSecureRandomInt(0, sectors.length - 1);
    const sectorMultiplier = sectors[winningSectorIndex];

    const selectedMultiplier = Number(context.payload.multiplier ?? context.payload.selection ?? 2);
    const won = selectedMultiplier === sectorMultiplier;
    const rewardAmount = won ? Math.floor(context.entryAmount * sectorMultiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { sectorIndex: winningSectorIndex, winningMultiplier: sectorMultiplier, selectedMultiplier },
      payoutMultiplier: won ? sectorMultiplier : 0,
      won,
      rewardAmount,
    };
  }
}
