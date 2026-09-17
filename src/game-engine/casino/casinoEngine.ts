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
    // 8 wheel slices with multipliers [0.5x, 1.2x, 2.0x, 0x, 1.5x, 3.0x, 0.8x, 5.0x]
    const slices = [
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
    // 5 distinct symbols with weighted payout
    const symbols = ['CHERRY', 'LEMON', 'BELL', 'BAR', 'SEVEN'];
    const r1 = symbols[this.generateSecureRandomInt(0, symbols.length - 1)];
    const r2 = symbols[this.generateSecureRandomInt(0, symbols.length - 1)];
    const r3 = symbols[this.generateSecureRandomInt(0, symbols.length - 1)];

    let multiplier = 0;
    if (r1 === r2 && r2 === r3) {
      // Three of a kind
      if (r1 === 'SEVEN') multiplier = 50.0;
      else if (r1 === 'BAR') multiplier = 20.0;
      else if (r1 === 'BELL') multiplier = 10.0;
      else if (r1 === 'LEMON') multiplier = 5.0;
      else multiplier = 3.0; // CHERRY
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      // Two matching
      multiplier = 1.5;
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
      multiplier = 2.0;
    } else if (betType === 'BLACK' && isBlack) {
      won = true;
      multiplier = 2.0;
    } else if (betType === 'EVEN' && isEven) {
      won = true;
      multiplier = 2.0;
    } else if (betType === 'ODD' && winningNumber !== 0 && !isEven) {
      won = true;
      multiplier = 2.0;
    } else if (betType === 'STRAIGHT' && Number(betValue) === winningNumber) {
      won = true;
      multiplier = 36.0;
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
