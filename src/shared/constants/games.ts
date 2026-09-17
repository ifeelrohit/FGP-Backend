// ==============================================================================
// FGP-Backend Authoritative Game Catalog (Exactly 18 Games)
// Stable IDs preserving FGP-Player & FGP-Admin client compatibility
// ==============================================================================

import { GameCategory } from '../types/index.ts';

export interface GameMetadata {
  id: string;
  code: string;
  name: string;
  category: GameCategory;
  description: string;
  minEntry: number;
  maxEntry: number;
  defaultMultiplier: number;
  features: string[];
}

export const GAME_CATALOG: GameMetadata[] = [
  // ----------------------------------------------------------------------------
  // PREDICTION (6 Games)
  // ----------------------------------------------------------------------------
  {
    id: 'color_pred',
    code: 'COLOR_PRED',
    name: 'Color Prediction',
    category: 'PREDICTION',
    description: 'Predict the winning color (Red, Green, Violet) in periodic timed intervals.',
    minEntry: 10,
    maxEntry: 10000,
    defaultMultiplier: 1.98,
    features: ['timed_rounds', 'server_resolution', 'history_streak'],
  },
  {
    id: 'number_pred',
    code: 'NUMBER_PRED',
    name: 'Number Prediction',
    category: 'PREDICTION',
    description: 'High-reward direct prediction on 0-9 single digit outcome.',
    minEntry: 10,
    maxEntry: 5000,
    defaultMultiplier: 9.0,
    features: ['high_multiplier', 'server_rng', 'direct_match'],
  },
  {
    id: 'odd_even',
    code: 'ODD_EVEN',
    name: 'Odd / Even',
    category: 'PREDICTION',
    description: 'Binary parity prediction on authoritative round result number.',
    minEntry: 10,
    maxEntry: 20000,
    defaultMultiplier: 1.96,
    features: ['binary_choice', 'instant_settlement', 'fast_cycle'],
  },
  {
    id: 'hi_lo',
    code: 'HI_LO',
    name: 'Hi-Lo',
    category: 'PREDICTION',
    description: 'Predict whether the next card or number will be higher or lower.',
    minEntry: 10,
    maxEntry: 10000,
    defaultMultiplier: 1.95,
    features: ['streak_multiplier', 'cashout_anytime', 'server_authoritative'],
  },
  {
    id: 'dice',
    code: 'DICE',
    name: 'Classic Dice',
    category: 'PREDICTION',
    description: 'Adjustable win chance dice roll with transparent server verification.',
    minEntry: 10,
    maxEntry: 10000,
    defaultMultiplier: 2.0,
    features: ['slider_threshold', 'custom_risk', 'dynamic_multipliers'],
  },
  {
    id: 'number_wheel',
    code: 'NUMBER_WHEEL',
    name: 'Number Wheel',
    category: 'PREDICTION',
    description: 'Predict sector segments on a numbered rotating prediction wheel.',
    minEntry: 10,
    maxEntry: 10000,
    defaultMultiplier: 4.5,
    features: ['multi_segment', 'server_wheel_physics', 'scheduled_rounds'],
  },

  // ----------------------------------------------------------------------------
  // CASINO (6 Games)
  // ----------------------------------------------------------------------------
  {
    id: 'spin_wheel',
    code: 'SPIN_WHEEL',
    name: 'Spin Wheel',
    category: 'CASINO',
    description: 'Dynamic casino bonus spin wheel with variable weighted multiplier slices.',
    minEntry: 20,
    maxEntry: 5000,
    defaultMultiplier: 2.5,
    features: ['weighted_slices', 'bonus_zones', 'instant_animation_state'],
  },
  {
    id: 'slot_machine',
    code: 'SLOT_MACHINE',
    name: 'Slot Machine',
    category: 'CASINO',
    description: '3-reel simulated mechanical slot machine with line paytables.',
    minEntry: 10,
    maxEntry: 2500,
    defaultMultiplier: 5.0,
    features: ['paylines', 'wild_symbols', 'scatter_bonus'],
  },
  {
    id: 'roulette',
    code: 'ROULETTE',
    name: 'European Roulette',
    category: 'CASINO',
    description: 'Server-authoritative single-zero roulette with inside and outside wagers.',
    minEntry: 10,
    maxEntry: 50000,
    defaultMultiplier: 36.0,
    features: ['inside_outside_bets', 'single_zero', 'wheel_physics'],
  },
  {
    id: 'blackjack',
    code: 'BLACKJACK',
    name: 'Classic Blackjack',
    category: 'CASINO',
    description: 'Standard 52-card deck blackjack dealer vs player rules.',
    minEntry: 50,
    maxEntry: 25000,
    defaultMultiplier: 2.5,
    features: ['hit_stand_double', 'dealer_stands_soft_17', 'natural_blackjack_payout'],
  },
  {
    id: 'baccarat',
    code: 'BACCARAT',
    name: 'Punto Banco Baccarat',
    category: 'CASINO',
    description: 'Classic Banker, Player, and Tie simulated card contest.',
    minEntry: 50,
    maxEntry: 50000,
    defaultMultiplier: 1.95,
    features: ['third_card_rules', 'commission_tracking', 'roadmap_bead_plate'],
  },
  {
    id: 'rummy',
    code: 'RUMMY',
    name: 'Indian Rummy (Simulated)',
    category: 'CASINO',
    description: 'Simulated 13-card points rummy table with meld validations.',
    minEntry: 100,
    maxEntry: 10000,
    defaultMultiplier: 2.0,
    features: ['13_card_melds', 'points_scoring', 'turn_timers'],
  },

  // ----------------------------------------------------------------------------
  // REAL-TIME (2 Games)
  // ----------------------------------------------------------------------------
  {
    id: 'crash',
    code: 'CRASH',
    name: 'Crash Rocket',
    category: 'REAL_TIME',
    description: 'Real-time exponential multiplier flight with player manual/auto cashout.',
    minEntry: 20,
    maxEntry: 50000,
    defaultMultiplier: 1.0,
    features: ['realtime_ticks', 'broadcast_state', 'anti_cheat_cashout'],
  },
  {
    id: 'space_crash',
    code: 'SPACE_CRASH',
    name: 'Space Crash Orbit',
    category: 'REAL_TIME',
    description: 'Deep-space planetary trajectory crash game with dual bet cashouts.',
    minEntry: 20,
    maxEntry: 50000,
    defaultMultiplier: 1.0,
    features: ['dual_cashout', 'planetary_milestones', 'low_latency_ticks'],
  },

  // ----------------------------------------------------------------------------
  // MINI GAMES (4 Games)
  // ----------------------------------------------------------------------------
  {
    id: 'mines',
    code: 'MINES',
    name: 'Mines Grid',
    category: 'MINI_GAME',
    description: '5x5 grid uncovering diamonds while avoiding configured hidden mines.',
    minEntry: 10,
    maxEntry: 20000,
    defaultMultiplier: 1.15,
    features: ['custom_mine_count', 'progressive_cashout', 'server_minefield'],
  },
  {
    id: 'plinko',
    code: 'PLINKO',
    name: 'Plinko Board',
    category: 'MINI_GAME',
    description: 'Pyramid pegboard dropping balls into edge high-multiplier bins.',
    minEntry: 10,
    maxEntry: 10000,
    defaultMultiplier: 2.0,
    features: ['risk_levels', 'row_count_selection', 'physics_trajectory'],
  },
  {
    id: 'balloon',
    code: 'BALLOON',
    name: 'Balloon Pump',
    category: 'MINI_GAME',
    description: 'Inflate the virtual balloon to increase multiplier before it pops.',
    minEntry: 10,
    maxEntry: 15000,
    defaultMultiplier: 1.2,
    features: ['step_inflation', 'interactive_hold', 'instant_cashout'],
  },
  {
    id: 'step_path',
    code: 'STEP_PATH',
    name: 'Step Path',
    category: 'MINI_GAME',
    description: 'Cross the perilous suspended path tile by tile without falling.',
    minEntry: 10,
    maxEntry: 15000,
    defaultMultiplier: 1.4,
    features: ['lane_selection', 'step_multipliers', 'safety_checkpoints'],
  },
];

export const VALID_GAME_IDS = GAME_CATALOG.map((g) => g.id);

export function getGameMetadata(id: string): GameMetadata | undefined {
  return GAME_CATALOG.find((g) => g.id === id);
}
