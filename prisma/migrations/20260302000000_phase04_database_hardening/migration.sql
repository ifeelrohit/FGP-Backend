-- ==============================================================================
-- Migration: 20260302000000_phase04_database_hardening
-- Phase 04: Database Audit & Hardening — Referential Integrity, Invariants & Indexes
-- ==============================================================================

-- 1. Alter Column Types & Defaults for Precision Alignment
ALTER TABLE "games" ALTER COLUMN "minEntry" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "games" ALTER COLUMN "minEntry" SET DEFAULT 10.0000;
ALTER TABLE "games" ALTER COLUMN "maxEntry" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "games" ALTER COLUMN "maxEntry" SET DEFAULT 10000.0000;
ALTER TABLE "games" ALTER COLUMN "defaultMultiplier" SET DEFAULT 1.9800;

ALTER TABLE "game_rounds" ALTER COLUMN "crashPoint" SET DATA TYPE DECIMAL(10,4);

ALTER TABLE "settlements" ALTER COLUMN "payoutMultiplier" SET DEFAULT 0.0000;
ALTER TABLE "settlements" ALTER COLUMN "rewardAmount" SET DEFAULT 0.0000;
ALTER TABLE "settlements" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- 2. Foreign Key Hardening (Historical Record Preservation & Referential Integrity)
-- GameRound -> GameConfiguration: ON DELETE RESTRICT (Preserves historical version linkage)
ALTER TABLE "game_rounds" DROP CONSTRAINT IF EXISTS "game_rounds_configId_fkey";
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_configId_fkey" 
  FOREIGN KEY ("configId") REFERENCES "game_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PlayerEntry -> User: ON DELETE RESTRICT (Preserves player financial & round participation records)
ALTER TABLE "player_entries" DROP CONSTRAINT IF EXISTS "player_entries_userId_fkey";
ALTER TABLE "player_entries" ADD CONSTRAINT "player_entries_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Settlement -> PlayerEntry: ON DELETE RESTRICT (Prevents deletion of settled entries)
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_entryId_fkey";
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_entryId_fkey" 
  FOREIGN KEY ("entryId") REFERENCES "player_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Settlement -> User: ON DELETE RESTRICT (Preserves settlement payouts and user ledger history)
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_userId_fkey";
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Settlement -> GameEntity: ON DELETE RESTRICT (Enforces game referential integrity on settlements)
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_gameId_fkey";
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_gameId_fkey" 
  FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Unique Constraints & Idempotency Persistence
CREATE UNIQUE INDEX IF NOT EXISTS "settlements_idempotencyKey_key" ON "settlements"("idempotencyKey");

-- 4. High-Performance Query & Audit Indexes
CREATE INDEX IF NOT EXISTS "users_createdAt_idx" ON "users"("createdAt");

CREATE INDEX IF NOT EXISTS "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");
CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

CREATE INDEX IF NOT EXISTS "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

CREATE INDEX IF NOT EXISTS "virtual_credit_accounts_currency_idx" ON "virtual_credit_accounts"("currency");

CREATE INDEX IF NOT EXISTS "ledger_transactions_accountId_createdAt_idx" ON "ledger_transactions"("accountId", "createdAt");
CREATE INDEX IF NOT EXISTS "ledger_transactions_referenceType_referenceId_idx" ON "ledger_transactions"("referenceType", "referenceId");

CREATE INDEX IF NOT EXISTS "games_category_status_idx" ON "games"("category", "status");
CREATE INDEX IF NOT EXISTS "games_status_idx" ON "games"("status");

CREATE INDEX IF NOT EXISTS "game_configurations_status_idx" ON "game_configurations"("status");
CREATE INDEX IF NOT EXISTS "game_configurations_publishedAt_idx" ON "game_configurations"("publishedAt");

CREATE INDEX IF NOT EXISTS "game_rounds_status_idx" ON "game_rounds"("status");
CREATE INDEX IF NOT EXISTS "game_rounds_configId_idx" ON "game_rounds"("configId");
CREATE INDEX IF NOT EXISTS "game_rounds_scheduledAt_idx" ON "game_rounds"("scheduledAt");
CREATE INDEX IF NOT EXISTS "game_rounds_openedAt_idx" ON "game_rounds"("openedAt");

CREATE INDEX IF NOT EXISTS "player_entries_userId_gameId_createdAt_idx" ON "player_entries"("userId", "gameId", "createdAt");
CREATE INDEX IF NOT EXISTS "player_entries_status_idx" ON "player_entries"("status");

CREATE INDEX IF NOT EXISTS "settlements_status_idx" ON "settlements"("status");
CREATE INDEX IF NOT EXISTS "settlements_settledAt_idx" ON "settlements"("settledAt");

CREATE INDEX IF NOT EXISTS "audit_logs_requestId_idx" ON "audit_logs"("requestId");

CREATE INDEX IF NOT EXISTS "announcements_targetRole_isActive_idx" ON "announcements"("targetRole", "isActive");
CREATE INDEX IF NOT EXISTS "announcements_expiresAt_idx" ON "announcements"("expiresAt");

-- 5. PostgreSQL Check Constraints (Database Invariant Hardening)
-- Invariant: Non-negative balance and locked balance
ALTER TABLE "virtual_credit_accounts" DROP CONSTRAINT IF EXISTS "virtual_credit_accounts_balance_check";
ALTER TABLE "virtual_credit_accounts" ADD CONSTRAINT "virtual_credit_accounts_balance_check" 
  CHECK ("balance" >= 0);

ALTER TABLE "virtual_credit_accounts" DROP CONSTRAINT IF EXISTS "virtual_credit_accounts_lockedBalance_check";
ALTER TABLE "virtual_credit_accounts" ADD CONSTRAINT "virtual_credit_accounts_lockedBalance_check" 
  CHECK ("lockedBalance" >= 0);

-- Invariant: Virtual credit only (Strict DEMO_CREDIT, no real money)
ALTER TABLE "virtual_credit_accounts" DROP CONSTRAINT IF EXISTS "virtual_credit_accounts_currency_check";
ALTER TABLE "virtual_credit_accounts" ADD CONSTRAINT "virtual_credit_accounts_currency_check" 
  CHECK ("currency" = 'DEMO_CREDIT');

-- Invariant: Ledger transaction amount must be non-negative
ALTER TABLE "ledger_transactions" DROP CONSTRAINT IF EXISTS "ledger_transactions_amount_check";
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_amount_check" 
  CHECK ("amount" >= 0);

-- Invariant: Player entry amounts must be strictly positive (> 0)
ALTER TABLE "player_entries" DROP CONSTRAINT IF EXISTS "player_entries_entryAmount_check";
ALTER TABLE "player_entries" ADD CONSTRAINT "player_entries_entryAmount_check" 
  CHECK ("entryAmount" > 0);

-- Invariant: Settlement reward amount and payout multiplier must be non-negative
ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_rewardAmount_check";
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_rewardAmount_check" 
  CHECK ("rewardAmount" >= 0);

ALTER TABLE "settlements" DROP CONSTRAINT IF EXISTS "settlements_payoutMultiplier_check";
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_payoutMultiplier_check" 
  CHECK ("payoutMultiplier" >= 0);

-- Invariant: Game entry bounds must be strictly valid (minEntry > 0 and maxEntry >= minEntry)
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_entry_range_check";
ALTER TABLE "games" ADD CONSTRAINT "games_entry_range_check" 
  CHECK ("minEntry" > 0 AND "maxEntry" >= "minEntry");
