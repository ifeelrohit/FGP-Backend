// ==============================================================================
// FGP-Backend Virtual Credit Ledger Constants
// Section 23: Virtual / Demo credits only. Immutable accounting entries.
// ==============================================================================

import { TransactionType } from '../types/index.ts';

export const TRANSACTION_TYPES: Record<TransactionType, TransactionType> = {
  CREDIT: 'CREDIT',
  ENTRY: 'ENTRY',
  REWARD: 'REWARD',
  REVERSAL: 'REVERSAL',
  ADJUSTMENT: 'ADJUSTMENT',
};

// Determines sign contribution to player balance
export function getTransactionDelta(type: TransactionType, amount: number): number {
  switch (type) {
    case 'CREDIT':
    case 'REWARD':
      return Math.abs(amount);
    case 'ENTRY':
      return -Math.abs(amount);
    case 'REVERSAL':
      // Reversing an entry refunds positive balance; reversing reward deducts
      return amount;
    case 'ADJUSTMENT':
      // Admin adjustment can be positive or negative
      return amount;
    default:
      return 0;
  }
}
