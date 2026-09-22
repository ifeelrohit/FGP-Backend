// ==============================================================================
// FGP-Backend Casino Game Engines
// Spin Wheel, Slot Machine, and European Roulette
// ==============================================================================

import { BaseGameEngine } from '../core/baseEngine.ts';
import { GameActionContext, RoundResolution } from '../core/types.ts';

// ------------------------------------------------------------------------------
// 7. Spin Wheel Engine ('spin_wheel')
// ------------------------------------------------------------------------------
export class SpinWheelEngine extends BaseGameEngine {
  readonly gameId = 'spin_wheel';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;
    // 8 wheel slices with multipliers, configurable via rewardConfig.slices
    const slices = rewardConfig.slices || [
      { label: '0.5x', multiplier: 0.5 },
      { label: '1.2x', multiplier: 1.2 },
      { label: '2.0x', multiplier: 2.0 },
      { label: '0x', multiplier: 0.0 },
      { label: '1.5x', multiplier: 1.5 },
      { label: '3.0x', multiplier: 3.0 },
      { label: '0.8x', multiplier: 0.8 },
      { label: '5.0x', multiplier: 5.0 },
    ];

    const sliceIndex = this.generateSecureRandomInt(0, slices.length - 1);
    const slice = slices[sliceIndex];
    const won = slice.multiplier > 0;
    const rewardAmount = Math.floor(context.entryAmount * slice.multiplier * 100) / 100;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { sliceIndex, label: slice.label, multiplier: slice.multiplier },
      payoutMultiplier: slice.multiplier,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 8. Slot Machine Engine ('slot_machine')
// ------------------------------------------------------------------------------
export class SlotMachineEngine extends BaseGameEngine {
  readonly gameId = 'slot_machine';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const ruleConfig = (context.config.ruleConfig || {}) as Record<string, any>;
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;

    // 5 distinct symbols with weighted payout driven by configuration
    const symbols = ruleConfig.symbols || ['CHERRY', 'LEMON', 'BELL', 'BAR', 'SEVEN'];
    const r1 = symbols[this.generateSecureRandomInt(0, symbols.length - 1)];
    const r2 = symbols[this.generateSecureRandomInt(0, symbols.length - 1)];
    const r3 = symbols[this.generateSecureRandomInt(0, symbols.length - 1)];

    const multMap = rewardConfig.multipliers || {};
    let multiplier = 0;
    if (r1 === r2 && r2 === r3) {
      // Three of a kind
      if (r1 === 'SEVEN') multiplier = multMap.SEVEN ?? 50.0;
      else if (r1 === 'BAR') multiplier = multMap.BAR ?? 20.0;
      else if (r1 === 'BELL') multiplier = multMap.BELL ?? 10.0;
      else if (r1 === 'LEMON') multiplier = multMap.LEMON ?? 5.0;
      else multiplier = multMap.CHERRY ?? 3.0;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      // Two matching
      multiplier = multMap.MATCH_TWO ?? 1.5;
    }

    const won = multiplier > 0;
    const rewardAmount = Math.floor(context.entryAmount * multiplier * 100) / 100;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { reels: [r1, r2, r3] },
      payoutMultiplier: multiplier,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 9. European Roulette Engine ('roulette')
// ------------------------------------------------------------------------------
export class RouletteEngine extends BaseGameEngine {
  readonly gameId = 'roulette';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const rewardConfig = (context.config.rewardConfig || {}) as Record<string, any>;
    const multMap = rewardConfig.multipliers || {};
    const straightMultiplier = multMap.STRAIGHT ?? 36.0;
    const parityMultiplier = multMap.PARITY ?? 2.0;
    const colorMultiplier = multMap.COLOR ?? 2.0;

    // 0 through 36
    const winningNumber = this.generateSecureRandomInt(0, 36);
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const isRed = redNumbers.includes(winningNumber);
    const isBlack = winningNumber !== 0 && !isRed;
    const isEven = winningNumber !== 0 && winningNumber % 2 === 0;

    const betType = String(context.payload.betType || 'RED').toUpperCase();
    const betValue = context.payload.betValue;

    let won = false;
    let multiplier = 0;

    if (betType === 'RED' && isRed) {
      won = true;
      multiplier = colorMultiplier;
    } else if (betType === 'BLACK' && isBlack) {
      won = true;
      multiplier = colorMultiplier;
    } else if (betType === 'EVEN' && isEven) {
      won = true;
      multiplier = parityMultiplier;
    } else if (betType === 'ODD' && winningNumber !== 0 && !isEven) {
      won = true;
      multiplier = parityMultiplier;
    } else if (betType === 'STRAIGHT' && Number(betValue) === winningNumber) {
      won = true;
      multiplier = straightMultiplier;
    }

    const rewardAmount = won ? Math.floor(context.entryAmount * multiplier * 100) / 100 : 0;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: {
        winningNumber,
        color: winningNumber === 0 ? 'GREEN' : isRed ? 'RED' : 'BLACK',
        betType,
        betValue,
      },
      payoutMultiplier: multiplier,
      won,
      rewardAmount,
    };
  }
}
