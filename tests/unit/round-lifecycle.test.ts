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

  describe('P0-8: Server Seed Security & Provably Fair Commitment', () => {
    it('should conceal serverSeed and crashPoint before RESULT_DECLARED', async () => {
      const { roundService } = await import('../../src/modules/rounds/roundService.ts');
      const testRound: any = {
        id: 'round-123',
        gameId: 'crash',
        status: 'OPEN',
        serverSeed: 'super-secret-seed-12345',
        serverSeedHash: 'hash-of-super-secret-seed',
        crashPoint: 3.45,
      };

      const sanitizedOpen = roundService.sanitizeRound(testRound);
      expect(sanitizedOpen.serverSeed).toBeUndefined();
      expect(sanitizedOpen.crashPoint).toBeUndefined();
      expect(sanitizedOpen.serverSeedHash).toBe('hash-of-super-secret-seed');

      const lockedRound = { ...testRound, status: 'LOCKED' };
      const sanitizedLocked = roundService.sanitizeRound(lockedRound);
      expect(sanitizedLocked.serverSeed).toBeUndefined();
      expect(sanitizedLocked.crashPoint).toBeUndefined();

      const pendingRound = { ...testRound, status: 'RESULT_PENDING' };
      const sanitizedPending = roundService.sanitizeRound(pendingRound);
      expect(sanitizedPending.serverSeed).toBeUndefined();
      expect(sanitizedPending.crashPoint).toBeUndefined();
    });

    it('should reveal serverSeed and crashPoint once RESULT_DECLARED, SETTLED, or COMPLETED', async () => {
      const { roundService } = await import('../../src/modules/rounds/roundService.ts');
      const testRound: any = {
        id: 'round-123',
        gameId: 'crash',
        status: 'RESULT_DECLARED',
        serverSeed: 'super-secret-seed-12345',
        serverSeedHash: 'hash-of-super-secret-seed',
        crashPoint: 3.45,
      };

      const sanitizedDeclared = roundService.sanitizeRound(testRound);
      expect(sanitizedDeclared.serverSeed).toBe('super-secret-seed-12345');
      expect(sanitizedDeclared.crashPoint).toBe(3.45);

      const settledRound = { ...testRound, status: 'SETTLED' };
      const sanitizedSettled = roundService.sanitizeRound(settledRound);
      expect(sanitizedSettled.serverSeed).toBe('super-secret-seed-12345');

      const completedRound = { ...testRound, status: 'COMPLETED' };
      const sanitizedCompleted = roundService.sanitizeRound(completedRound);
      expect(sanitizedCompleted.serverSeed).toBe('super-secret-seed-12345');
    });
  });
});
