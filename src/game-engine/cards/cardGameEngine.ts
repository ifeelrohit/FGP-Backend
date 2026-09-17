// ==============================================================================
// FGP-Backend Card Game Engines
// Authoritative Blackjack, Baccarat, and Rummy Hand Evaluation
// ==============================================================================

import { BaseGameEngine } from '../core/baseEngine.ts';
import { GameActionContext, RoundResolution } from '../core/types.ts';
import { Card, createStandardDeck, shuffleDeck } from './deck.ts';

// Helper to calculate blackjack hand value
function calculateBlackjackHand(cards: Card[]): number {
  let score = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++;
      score += 11;
    } else {
      score += card.value;
    }
  }

  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }

  return score;
}

// ------------------------------------------------------------------------------
// 10. Blackjack Engine ('blackjack')
// ------------------------------------------------------------------------------
export class BlackjackEngine extends BaseGameEngine {
  readonly gameId = 'blackjack';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const deck = shuffleDeck(createStandardDeck());
    const playerCards: Card[] = [deck.pop()!, deck.pop()!];
    const dealerCards: Card[] = [deck.pop()!, deck.pop()!];

    let playerScore = calculateBlackjackHand(playerCards);
    let dealerScore = calculateBlackjackHand(dealerCards);

    // Dealer hits to 17
    while (dealerScore < 17 && deck.length > 0) {
      dealerCards.push(deck.pop()!);
      dealerScore = calculateBlackjackHand(dealerCards);
    }

    const playerBust = playerScore > 21;
    const dealerBust = dealerScore > 21;
    const isNaturalBlackjack = playerCards.length === 2 && playerScore === 21;

    let won = false;
    let multiplier = 0;

    if (!playerBust) {
      if (dealerBust || playerScore > dealerScore) {
        won = true;
        multiplier = isNaturalBlackjack ? 2.5 : 2.0;
      } else if (playerScore === dealerScore) {
        // Push: refund entry
        multiplier = 1.0;
        won = true;
      }
    }

    const rewardAmount = Math.floor(context.entryAmount * multiplier * 100) / 100;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: {
        playerCards,
        dealerCards,
        playerScore,
        dealerScore,
        playerBust,
        dealerBust,
        isNaturalBlackjack,
      },
      payoutMultiplier: multiplier,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 11. Baccarat Engine ('baccarat')
// ------------------------------------------------------------------------------
export class BaccaratEngine extends BaseGameEngine {
  readonly gameId = 'baccarat';

  private baccaratCardValue(card: Card): number {
    if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 0;
    if (card.rank === 'A') return 1;
    return card.value;
  }

  private calculateBaccaratScore(cards: Card[]): number {
    const sum = cards.reduce((acc, c) => acc + this.baccaratCardValue(c), 0);
    return sum % 10;
  }

  public override resolveResult(context: GameActionContext): RoundResolution {
    const deck = shuffleDeck(createStandardDeck());
    const playerCards: Card[] = [deck.pop()!, deck.pop()!];
    const bankerCards: Card[] = [deck.pop()!, deck.pop()!];

    const playerScore = this.calculateBaccaratScore(playerCards);
    const bankerScore = this.calculateBaccaratScore(bankerCards);

    let winner: 'PLAYER' | 'BANKER' | 'TIE';
    if (playerScore > bankerScore) winner = 'PLAYER';
    else if (bankerScore > playerScore) winner = 'BANKER';
    else winner = 'TIE';

    const selectedSide = String(context.payload.betSide || 'PLAYER').toUpperCase();
    const won = selectedSide === winner;

    let multiplier = 0;
    if (won) {
      if (winner === 'PLAYER') multiplier = 2.0;
      else if (winner === 'BANKER') multiplier = 1.95; // 5% house commission
      else if (winner === 'TIE') multiplier = 9.0;
    }

    const rewardAmount = Math.floor(context.entryAmount * multiplier * 100) / 100;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: {
        playerCards,
        bankerCards,
        playerScore,
        bankerScore,
        winner,
        selectedSide,
      },
      payoutMultiplier: multiplier,
      won,
      rewardAmount,
    };
  }
}

// ------------------------------------------------------------------------------
// 12. Simulated Rummy Engine ('rummy')
// ------------------------------------------------------------------------------
export class RummyEngine extends BaseGameEngine {
  readonly gameId = 'rummy';

  public override resolveResult(context: GameActionContext): RoundResolution {
    const deck = shuffleDeck(createStandardDeck());
    // Deal 13 cards to simulated player hand
    const hand: Card[] = deck.slice(0, 13);
    const suitsCount = new Map<string, number>();

    for (const card of hand) {
      suitsCount.set(card.suit, (suitsCount.get(card.suit) || 0) + 1);
    }

    // Simplified server meld evaluation: checks suit distribution and pure sequence chances
    const hasLongSuit = Array.from(suitsCount.values()).some((cnt) => cnt >= 4);
    const scorePoints = this.generateSecureRandomInt(10, 80);
    const won = hasLongSuit && scorePoints < 40;
    const multiplier = won ? 2.0 : 0.0;
    const rewardAmount = Math.floor(context.entryAmount * multiplier * 100) / 100;

    return {
      roundId: context.roundId || `rnd-${Date.now()}`,
      gameId: this.gameId,
      outcome: { handCount: hand.length, scorePoints, hasLongSuit, suitsBreakdown: Object.fromEntries(suitsCount) },
      payoutMultiplier: multiplier,
      won,
      rewardAmount,
    };
  }
}
