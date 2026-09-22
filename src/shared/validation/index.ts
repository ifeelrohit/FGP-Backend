// ==============================================================================
// FGP-Backend Validation Schemas (Zod)
// Strictly enforces runtime contracts, fail-fast on malformed payloads
// ==============================================================================

import { z } from 'zod';
import { VALID_GAME_IDS } from '../constants/games.ts';
import { ROUND_LIFECYCLE_ORDER } from '../constants/rounds.ts';

// ------------------------------------------------------------------------------
// Auth Schemas
// ------------------------------------------------------------------------------

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address format'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username must only contain letters, numbers, underscores, and hyphens'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters'),
  role: z.enum(['PLAYER', 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONFIGURATION_ADMIN', 'VIEWER']).optional(),
});

export const LoginSchema = z.object({
  login: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ------------------------------------------------------------------------------
// Game & Action Schemas
// ------------------------------------------------------------------------------

export const GameIdParamSchema = z.object({
  gameId: z.string().refine((val) => VALID_GAME_IDS.includes(val), {
    message: 'Invalid game ID. Must match one of the 18 authoritative platform games.',
  }),
});

export const RoundIdParamSchema = z.object({
  roundId: z.string().min(1, 'Round ID is required'),
});

export const GameActionSchema = z.object({
  gameId: z.string().refine((val) => VALID_GAME_IDS.includes(val)),
  roundId: z.string().optional(),
  actionType: z.string().min(1),
  entryAmount: z.number().positive('Virtual credit entry amount must be positive'),
  payload: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().optional(),
});

// ------------------------------------------------------------------------------
// Prediction Game Action
// ------------------------------------------------------------------------------

export const PredictionSubmissionSchema = z.object({
  gameId: z.enum(['color_pred', 'number_pred', 'odd_even', 'hi_lo', 'dice', 'number_wheel']),
  roundId: z.string().optional(),
  selection: z.union([z.string(), z.number()]),
  entryAmount: z.number().positive().min(10, 'Minimum virtual credit entry is 10'),
  idempotencyKey: z.string().optional(),
});

// ------------------------------------------------------------------------------
// Real-time Action (Crash / Space Crash)
// ------------------------------------------------------------------------------

export const CrashEntrySchema = z.object({
  gameId: z.enum(['crash', 'space_crash']),
  entryAmount: z.number().positive().min(20, 'Minimum entry is 20 virtual credits'),
  autoCashoutMultiplier: z.number().min(1.01).max(1000).optional(),
  idempotencyKey: z.string().optional(),
});

export const CashoutActionSchema = z.object({
  gameId: z.enum(['crash', 'space_crash']).optional(),
  roundId: z.string().optional(),
  entryId: z.string().optional(),
  clientMultiplier: z.number().positive().optional(),
  idempotencyKey: z.string().optional(),
});

// ------------------------------------------------------------------------------
// Casino / Mini-Game Action
// ------------------------------------------------------------------------------

export const CasinoSpinSchema = z.object({
  gameId: z.enum(['spin_wheel', 'slot_machine', 'roulette', 'blackjack', 'baccarat', 'rummy']),
  entryAmount: z.number().positive(),
  options: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().optional(),
});

export const MiniGameActionSchema = z.object({
  gameId: z.enum(['mines', 'plinko', 'balloon', 'step_path']),
  entryAmount: z.number().positive(),
  action: z.string(),
  step: z.number().int().nonnegative().optional(),
  idempotencyKey: z.string().optional(),
});

// ------------------------------------------------------------------------------
// Round Lifecycle Transition
// ------------------------------------------------------------------------------

export const RoundTransitionSchema = z.object({
  targetStatus: z.enum(ROUND_LIFECYCLE_ORDER as [string, ...string[]]),
  reason: z.string().optional(),
});

// ------------------------------------------------------------------------------
// Configuration Management
// ------------------------------------------------------------------------------

export const ConfigDraftSchema = z.object({
  gameId: z.string().refine((val) => VALID_GAME_IDS.includes(val)),
  generalConfig: z.record(z.string(), z.unknown()).default({}),
  entryConfig: z.record(z.string(), z.unknown()).default({}),
  timingConfig: z.record(z.string(), z.unknown()).default({}),
  ruleConfig: z.record(z.string(), z.unknown()).default({}),
  rewardConfig: z.record(z.string(), z.unknown()).default({}),
  displayConfig: z.record(z.string(), z.unknown()).default({}),
  operationalConfig: z.record(z.string(), z.unknown()).default({}),
});

// ------------------------------------------------------------------------------
// Virtual Credit Admin Adjustment
// ------------------------------------------------------------------------------

export const AdminCreditAdjustmentSchema = z.object({
  userId: z.string().uuid('Invalid user UUID'),
  amount: z.number().refine((val) => val !== 0, { message: 'Adjustment amount cannot be zero' }),
  reason: z.string().min(5, 'A clear reason for adjustment is required for audit'),
  idempotencyKey: z.string().optional(),
});

// ------------------------------------------------------------------------------
// Announcements
// ------------------------------------------------------------------------------

export const AnnouncementCreateSchema = z.object({
  title: z.string().min(3).max(120),
  content: z.string().min(5).max(2000),
  targetRole: z.enum(['PLAYER', 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONFIGURATION_ADMIN', 'VIEWER']).optional(),
  priority: z.number().int().default(0),
});
