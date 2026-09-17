// ==============================================================================
// FGP-Backend Round Lifecycle Constants & Transition Graph
// Section 21: SCHEDULED → OPEN → LOCKED → RESULT_PENDING → RESULT_DECLARED → SETTLED → COMPLETED
// ==============================================================================

import { RoundStatus } from '../types/index.ts';

export const ROUND_LIFECYCLE_ORDER: RoundStatus[] = [
  'SCHEDULED',
  'OPEN',
  'LOCKED',
  'RESULT_PENDING',
  'RESULT_DECLARED',
  'SETTLED',
  'COMPLETED',
];

export const VALID_ROUND_TRANSITIONS: Record<RoundStatus, RoundStatus[]> = {
  SCHEDULED: ['OPEN'],
  OPEN: ['LOCKED'],
  LOCKED: ['RESULT_PENDING', 'RESULT_DECLARED'],
  RESULT_PENDING: ['RESULT_DECLARED'],
  RESULT_DECLARED: ['SETTLED'],
  SETTLED: ['COMPLETED'],
  COMPLETED: [],
};

export function isValidRoundTransition(from: RoundStatus, to: RoundStatus): boolean {
  const allowedNext = VALID_ROUND_TRANSITIONS[from];
  return allowedNext ? allowedNext.includes(to) : false;
}
