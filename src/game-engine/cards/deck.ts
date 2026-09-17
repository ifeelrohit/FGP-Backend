// ==============================================================================
// FGP-Backend 52-Card Standard Deck & Card Utilities
// Cryptographically shuffled server-side deck
// ==============================================================================

import crypto from 'node:crypto';

export type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES';
export type CardRank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export interface Card {
  suit: Suit;
  rank: CardRank;
  value: number; // base blackjack value
}

const SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
const RANKS: CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createStandardDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      let value = Number.parseInt(rank, 10);
      if (['J', 'Q', 'K'].includes(rank)) value = 10;
      if (rank === 'A') value = 11;
      deck.push({ suit, rank, value });
    }
  }
  return deck;
}

// Fisher-Yates shuffle with cryptographic random values
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
