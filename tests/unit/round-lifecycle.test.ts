import { describe, it, expect } from 'vitest';
import { isValidRoundTransition } from '../../src/shared/constants/rounds.ts';

describe('Round Lifecycle State Machine', () => {
  it('should allow valid linear transitions through RESULT_PENDING', () => {
    expect(isValidRoundTransition('SCHEDULED', 'OPEN')).toBe(true);
    expect(isValidRoundTransition('OPEN', 'LOCKED')).toBe(true);
    expect(isValidRoundTransition('LOCKED', 'RESULT_PENDING')).toBe(true);
    expect(isValidRoundTransition('RESULT_PENDING', 'RESULT_DECLARED')).toBe(true);
    expect(isValidRoundTransition('RESULT_DECLARED', 'SETTLED')).toBe(true);
    expect(isValidRoundTransition('SETTLED', 'COMPLETED')).toBe(true);
  });

  it('should strictly forbid jumping directly from LOCKED to RESULT_DECLARED without RESULT_PENDING', () => {
    expect(isValidRoundTransition('LOCKED', 'RESULT_DECLARED')).toBe(false);
  });

  it('should reject invalid non-linear transitions', () => {
    expect(isValidRoundTransition('SCHEDULED', 'LOCKED')).toBe(false);
    expect(isValidRoundTransition('SCHEDULED', 'SETTLED')).toBe(false);
    expect(isValidRoundTransition('OPEN', 'SETTLED')).toBe(false);
    expect(isValidRoundTransition('OPEN', 'COMPLETED')).toBe(false);
    expect(isValidRoundTransition('COMPLETED', 'OPEN')).toBe(false);
    expect(isValidRoundTransition('SETTLED', 'OPEN')).toBe(false);
  });
});
