import { describe, it, expect, beforeEach } from 'vitest';
import { roundService } from '../../src/modules/rounds/roundService.ts';
import { settlementService } from '../../src/modules/settlements/settlementService.ts';
import { configService } from '../../src/modules/configurations/configService.ts';
import { setRepositories, createInMemoryRepositories } from '../../src/infrastructure/repositories/index.ts';
import { RoundLifecycleError, ConflictError } from '../../src/shared/errors/index.ts';

describe('Authoritative Lifecycle & Engine Integration Flow', () => {
  beforeEach(() => {
    setRepositories(createInMemoryRepositories());
  });

  describe('Round State Machine & Lifecycle Guardrails', () => {
    it('should complete linear progression: SCHEDULED -> OPEN -> LOCKED -> RESULT_PENDING -> RESULT_DECLARED -> SETTLED -> COMPLETED', async () => {
      // 1. Create round
      const round = await roundService.createRound('color_pred');
      expect(round.status).toBe('OPEN');

      // 2. Transition OPEN -> LOCKED
      const locked = await roundService.transitionRoundStatus(round.id, 'LOCKED', { reason: 'Locking bets' });
      expect(locked.status).toBe('LOCKED');

      // 3. Forbid skipping directly to RESULT_DECLARED
      await expect(
        roundService.transitionRoundStatus(round.id, 'RESULT_DECLARED', { reason: 'Illegal skip' })
      ).rejects.toThrow(RoundLifecycleError);

      // 4. Valid transition LOCKED -> RESULT_PENDING
      const pending = await roundService.transitionRoundStatus(round.id, 'RESULT_PENDING', { reason: 'Awaiting RNG' });
      expect(pending.status).toBe('RESULT_PENDING');

      // 5. Valid transition RESULT_PENDING -> RESULT_DECLARED
      const declared = await roundService.transitionRoundStatus(round.id, 'RESULT_DECLARED', { reason: 'Outcome determined' });
      expect(declared.status).toBe('RESULT_DECLARED');

      // 6. Valid transition RESULT_DECLARED -> SETTLED
      const settled = await roundService.transitionRoundStatus(round.id, 'SETTLED', { reason: 'Payouts disbursed' });
      expect(settled.status).toBe('SETTLED');

      // 7. Valid transition SETTLED -> COMPLETED
      const completed = await roundService.transitionRoundStatus(round.id, 'COMPLETED', { reason: 'Round closed' });
      expect(completed.status).toBe('COMPLETED');
    });

    it('should reject entries when round is not in OPEN state', async () => {
      const round = await roundService.createRound('dice');
      await roundService.transitionRoundStatus(round.id, 'LOCKED');

      await expect(
        settlementService.submitEntry({
          userId: 'test-player-001',
          gameId: 'dice',
          roundId: round.id,
          entryAmount: 100,
          payload: { target: 4 },
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Real-Time Crash Entry & Authoritative Cashout', () => {
    it('should register entry in OPEN round and execute authoritative cashout', async () => {
      const round = await roundService.createRound('crash');
      expect(round.status).toBe('OPEN');

      // Submit player entry
      const entry = await settlementService.submitEntry({
        userId: 'test-player-crash-01',
        gameId: 'crash',
        roundId: round.id,
        entryAmount: 100,
        payload: { autoCashoutMultiplier: 5.0 },
      });

      expect(entry.status).toBe('CONFIRMED');
      expect(entry.entryAmount).toBe(100);

      // Execute cashout
      const receipt = await settlementService.cashoutCrash({
        userId: 'test-player-crash-01',
        entryId: entry.entryId,
      });

      expect(receipt.gameId).toBe('crash');
      expect(receipt.status).toBe('SETTLED');
      expect(receipt.rewardAmount).toBeGreaterThanOrEqual(100);

      // Repeated cashout must be idempotent: returns existing settlement without duplicate reward
      const duplicateReceipt = await settlementService.cashoutCrash({
        userId: 'test-player-crash-01',
        entryId: entry.entryId,
      });

      expect(duplicateReceipt.status).toBe('SETTLED');
      expect(duplicateReceipt.rewardAmount).toBe(receipt.rewardAmount);
      expect(duplicateReceipt.balanceAfter).toBe(receipt.balanceAfter);
    });
  });

  describe('Configuration Immutability & Rollback Flow', () => {
    it('should draft, approve, publish, and rollback game configuration', async () => {
      const gameId = 'roulette';
      const initial = await configService.getActiveConfig(gameId);
      expect(initial.version).toBe(1);

      // Create draft version 2
      const draft = await configService.createDraft({
        gameId,
        generalConfig: { name: 'European Roulette V2' },
        entryConfig: { minEntry: 20 },
      });
      expect(draft.version).toBe(2);
      expect(draft.status).toBe('DRAFT');

      // Progress through lifecycle: DRAFT -> VALIDATE -> PREVIEW -> APPROVE -> PUBLISH -> ACTIVE
      await configService.transitionStatus(draft.id, 'VALIDATE', 'admin-1');
      await configService.transitionStatus(draft.id, 'PREVIEW', 'admin-1');
      await configService.transitionStatus(draft.id, 'APPROVE', 'admin-1');
      await configService.transitionStatus(draft.id, 'PUBLISH', 'admin-1');
      const activeV2 = await configService.transitionStatus(draft.id, 'ACTIVE', 'admin-1');
      expect(activeV2.status).toBe('ACTIVE');

      // Active config should now be version 2
      const currentActive = await configService.getActiveConfig(gameId);
      expect(currentActive.version).toBe(2);

      // Rollback to version 1
      const rolledBack = await configService.rollback(gameId, 1, 'admin-1');
      expect(rolledBack.version).toBe(3);
      expect(rolledBack.status).toBe('ACTIVE');
    });
  });
});
