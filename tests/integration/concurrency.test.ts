import { describe, it, expect, beforeEach } from 'vitest';
import { roundService } from '../../src/modules/rounds/roundService.ts';
import { settlementService } from '../../src/modules/settlements/settlementService.ts';
import { ledgerService } from '../../src/modules/ledger/ledgerService.ts';
import { setRepositories, createInMemoryRepositories } from '../../src/infrastructure/repositories/index.ts';
import { ConflictError, InsufficientBalanceError } from '../../src/shared/errors/index.ts';

describe('Concurrency & Invariant Integrity Test Suite', () => {
  const userId = 'concurrent-test-player-001';

  beforeEach(async () => {
    setRepositories(createInMemoryRepositories());
    // Initial balance: 10,000
    await ledgerService.getBalance(userId);
  });

  it('Scenario 1: simultaneous duplicate entry requests with identical idempotencyKey produce exactly 1 entry and 1 debit', async () => {
    const round = await roundService.createRound('dice');
    const idempotencyKey = 'idemp-concurrent-entry-001';

    // Dispatch 5 simultaneous entry submissions with the exact same idempotencyKey
    const promises = Array.from({ length: 5 }).map(() =>
      settlementService.submitEntry({
        userId,
        gameId: 'dice',
        roundId: round.id,
        entryAmount: 200,
        payload: { target: 4 },
        idempotencyKey,
      })
    );

    const results = await Promise.all(promises);

    // All results must refer to the exact same entry ID
    const firstId = results[0].entryId;
    for (const res of results) {
      expect(res.entryId).toBe(firstId);
      expect(res.status).toBe('CONFIRMED');
    }

    // Invariant: exactly 1 entry in ledger, balance deducted exactly once (10000 - 200 = 9800)
    const balance = await ledgerService.getBalance(userId);
    expect(balance.balance).toBe(9800);

    const txs = await ledgerService.listTransactions(userId);
    const entryTxs = txs.filter((t) => t.type === 'ENTRY');
    expect(entryTxs).toHaveLength(1);
    expect(entryTxs[0].amount).toBe(200);
  });

  it('Scenario 2: simultaneous settlement requests for the same entry produce exactly 1 reward disbursement', async () => {
    const round = await roundService.createRound('dice');
    const entry = await settlementService.submitEntry({
      userId,
      gameId: 'dice',
      roundId: round.id,
      entryAmount: 100,
      payload: { target: 4 },
      idempotencyKey: 'entry-settle-race-01',
    });

    const balanceAfterEntry = (await ledgerService.getBalance(userId)).balance;
    expect(balanceAfterEntry).toBe(9900);

    // 5 concurrent settlement requests for the exact same entryId
    const { getRepositories } = await import('../../src/infrastructure/repositories/index.ts');
    const settlementRepo = getRepositories().settlementRepo;

    const results = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        settlementRepo.settleEntryWithReward({
          userId,
          entryId: entry.entryId,
          status: 'WON',
          payoutMultiplier: 2.0,
          rewardAmount: 200,
          outcome: { rolled: 4 },
          idempotencyKey: 'settle-race-key-01',
        })
      )
    );

    // All results must refer to the exact same settlement ID
    const firstSettlementId = results[0].settlement.id;
    for (const res of results) {
      expect(res.settlement.id).toBe(firstSettlementId);
    }

    // Exactly one isIdempotent: false, others are true
    const nonIdempotent = results.filter((r) => !r.isIdempotent);
    expect(nonIdempotent).toHaveLength(1);

    // Verify ledger has at most 1 REWARD transaction for this entry, balance received at most 1 reward
    const txs = await ledgerService.listTransactions(userId);
    const rewardTxs = txs.filter((t) => t.type === 'REWARD');

    expect(rewardTxs).toHaveLength(1);
    expect(rewardTxs[0].amount).toBe(200);
    const finalBalance = (await ledgerService.getBalance(userId)).balance;
    expect(finalBalance).toBe(9900 + 200);
  });

  it('Scenario 3: simultaneous cashout requests for the same crash entry produce exactly 1 cashout settlement and no duplicate reward', async () => {
    const round = await roundService.createRound('crash');
    const entry = await settlementService.submitEntry({
      userId,
      gameId: 'crash',
      roundId: round.id,
      entryAmount: 500,
      payload: { autoCashoutMultiplier: 10.0 },
      idempotencyKey: 'crash-entry-race-01',
    });

    const balanceAfterEntry = (await ledgerService.getBalance(userId)).balance;
    expect(balanceAfterEntry).toBe(9500);

    // 5 simultaneous cashout requests
    const receipts = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        settlementService.cashoutCrash({
          userId,
          entryId: entry.entryId,
        })
      )
    );

    // All receipts must be for the same settlement
    const firstReceipt = receipts[0];
    for (const r of receipts) {
      expect(r.settlementId).toBe(firstReceipt.settlementId);
      expect(r.status).toBe('SETTLED');
      expect(r.rewardAmount).toBe(firstReceipt.rewardAmount);
      expect(r.balanceAfter).toBe(firstReceipt.balanceAfter);
    }

    // Verify ledger: exactly one REWARD transaction
    const txs = await ledgerService.listTransactions(userId);
    const rewardTxs = txs.filter((t) => t.type === 'REWARD');
    expect(rewardTxs).toHaveLength(1);
    expect(rewardTxs[0].amount).toBe(firstReceipt.rewardAmount);

    const finalBalance = (await ledgerService.getBalance(userId)).balance;
    expect(finalBalance).toBe(9500 + firstReceipt.rewardAmount);
  });

  it('Scenario 4: duplicate idempotency keys across concurrent ledger transactions return the single existing mutation', async () => {
    const idempotencyKey = 'shared-idemp-key-999';

    // 10 concurrent debit requests with the same idempotency key
    const txs = await Promise.all(
      Array.from({ length: 10 }).map(() =>
        ledgerService.recordTransaction({
          userId,
          type: 'ENTRY',
          amount: 300,
          idempotencyKey,
        })
      )
    );

    // All must have the exact same transaction ID
    const firstId = txs[0].id;
    for (const tx of txs) {
      expect(tx.id).toBe(firstId);
      expect(tx.balanceAfter).toBe(9700);
    }

    const currentBal = (await ledgerService.getBalance(userId)).balance;
    expect(currentBal).toBe(9700);
  });

  it('Scenario 5: concurrent balance debits exceeding account balance enforce atomic balance integrity with no negative balance', async () => {
    // Initial balance is 10,000.
    // Attempt 15 concurrent debits of 1,000 each (total 15,000 > 10,000).
    const attempts = Array.from({ length: 15 }).map(async (_, index) => {
      try {
        await ledgerService.recordTransaction({
          userId,
          type: 'ENTRY',
          amount: 1000,
          idempotencyKey: `debit-overdraw-${index}`,
        });
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    const outcomes = await Promise.all(attempts);

    const successes = outcomes.filter((o) => o.success);
    const failures = outcomes.filter((o) => !o.success);

    // Exactly 10 must succeed and 5 must fail with InsufficientBalanceError
    expect(successes).toHaveLength(10);
    expect(failures).toHaveLength(5);
    for (const f of failures) {
      expect(f.error).toMatch(/Insufficient virtual credits/);
    }

    // Invariant: Balance must be exactly 0, never negative
    const finalBalance = await ledgerService.getBalance(userId);
    expect(finalBalance.balance).toBe(0);
    expect(finalBalance.balance).toBeGreaterThanOrEqual(0);
  });
});
