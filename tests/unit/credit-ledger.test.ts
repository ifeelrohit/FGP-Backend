import { describe, it, expect, beforeEach } from 'vitest';
import { ledgerService } from '../../src/modules/ledger/ledgerService.ts';
import { setRepositories, createInMemoryRepositories } from '../../src/infrastructure/repositories/index.ts';

describe('Virtual Credit Ledger & Balance Arithmetic', () => {
  const testUserId = 'test-player-uuid-001';

  beforeEach(() => {
    setRepositories(createInMemoryRepositories());
  });

  it('should initialize player account with 10,000 demo credits', async () => {
    const bal = await ledgerService.getBalance(testUserId);
    expect(bal.balance).toBe(10000.0);
    expect(bal.currency).toBe('DEMO_CREDIT');
  });

  it('should deduct entry credits and update balance', async () => {
    const tx = await ledgerService.recordTransaction({
      userId: testUserId,
      type: 'ENTRY',
      amount: 500,
    });

    expect(tx.balanceBefore).toBe(10000.0);
    expect(tx.balanceAfter).toBe(9500.0);
    expect(tx.type).toBe('ENTRY');

    const bal = await ledgerService.getBalance(testUserId);
    expect(bal.balance).toBe(9500.0);
  });

  it('should prevent negative balance', async () => {
    await expect(
      ledgerService.recordTransaction({
        userId: testUserId,
        type: 'ENTRY',
        amount: 20000,
      })
    ).rejects.toThrow(/Insufficient/);
  });

  it('should credit rewards correctly', async () => {
    await ledgerService.recordTransaction({
      userId: testUserId,
      type: 'REWARD',
      amount: 198.5,
    });

    const bal = await ledgerService.getBalance(testUserId);
    expect(bal.balance).toBe(10198.5);
  });
});
