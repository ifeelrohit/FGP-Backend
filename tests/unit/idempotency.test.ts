import { describe, it, expect, beforeEach } from 'vitest';
import { ledgerService } from '../../src/modules/ledger/ledgerService.ts';
import { inMemoryStore } from '../../src/infrastructure/database/inMemoryStore.ts';

describe('Transaction Idempotency Enforcement', () => {
  const testUserId = 'test-player-idempotency-01';

  beforeEach(() => {
    inMemoryStore.reset();
  });

  it('should return existing transaction on identical idempotencyKey', async () => {
    const key = 'req-unique-idemp-12345';

    const tx1 = await ledgerService.recordTransaction({
      userId: testUserId,
      type: 'ENTRY',
      amount: 100,
      idempotencyKey: key,
    });

    const tx2 = await ledgerService.recordTransaction({
      userId: testUserId,
      type: 'ENTRY',
      amount: 100,
      idempotencyKey: key,
    });

    expect(tx1.id).toBe(tx2.id);

    // Ensure balance was only deducted ONCE
    const bal = await ledgerService.getBalance(testUserId);
    expect(bal.balance).toBe(9900.0);
  });
});
