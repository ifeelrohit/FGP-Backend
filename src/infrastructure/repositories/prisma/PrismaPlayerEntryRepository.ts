// ==============================================================================
// PrismaPlayerEntryRepository & PrismaSettlementRepository Implementation
// Durable PostgreSQL records for entries and authoritative settlements
// ==============================================================================

import { prisma } from '../../database/prisma.ts';
import {
  IPlayerEntryRepository,
  ISettlementRepository,
  PlayerEntryEntity,
  CreatePlayerEntryDto,
  SettlementEntity,
  CreateSettlementDto,
  CreateEntryWithDebitParams,
  CreateEntryWithDebitResult,
  SettleEntryWithRewardParams,
  SettleEntryWithRewardResult,
} from '../interfaces/IPlayerEntryRepository.ts';
import { EntryStatus, SettlementStatus } from '../../../shared/types/index.ts';
import {
  InsufficientBalanceError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from '../../../shared/errors/index.ts';

export class PrismaPlayerEntryRepository implements IPlayerEntryRepository {
  public async create(dto: CreatePlayerEntryDto): Promise<PlayerEntryEntity> {
    if (dto.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(dto.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const row = await prisma.playerEntry.create({
      data: {
        userId: dto.userId,
        gameId: dto.gameId,
        roundId: dto.roundId,
        entryAmount: dto.entryAmount,
        payload: dto.payload as any,
        status: 'CONFIRMED',
        idempotencyKey: dto.idempotencyKey,
      },
    });

    return this.mapEntry(row);
  }

  public async createEntryWithDebit(params: CreateEntryWithDebitParams): Promise<CreateEntryWithDebitResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Verify round exists and is OPEN
        const round = await tx.gameRound.findUnique({
          where: { id: params.roundId },
        });
        if (!round) {
          throw new NotFoundError(`Round '${params.roundId}' not found`);
        }
        if (round.gameId !== params.gameId) {
          throw new ConflictError(`Round '${params.roundId}' belongs to game '${round.gameId}', not '${params.gameId}'`);
        }
        if (round.status !== 'OPEN') {
          throw new ConflictError(
            `Round '${round.id}' is in status '${round.status}'. Entries are only accepted when round is OPEN.`
          );
        }

        // 2. Idempotency check on PlayerEntry
        if (params.idempotencyKey) {
          const existingEntry = await tx.playerEntry.findUnique({
            where: { idempotencyKey: params.idempotencyKey },
          });
          if (existingEntry) {
            const account = await tx.virtualCreditAccount.findUnique({
              where: { userId: params.userId },
            });
            const balance = account ? Number(account.balance) : 0;
            return {
              entry: this.mapEntry(existingEntry),
              balanceBefore: balance,
              balanceAfter: balance,
              transactionId: '',
              isIdempotent: true,
            };
          }
        }

        // 3. Lock virtual credit account using SELECT ... FOR UPDATE
        let accounts = await tx.$queryRaw<Array<{ id: string; userId: string; balance: number | string; lockedBalance: number | string }>>`
          SELECT "id", "userId", "balance", "lockedBalance"
          FROM "virtual_credit_accounts"
          WHERE "userId" = ${params.userId}
          FOR UPDATE
        `;

        if (!accounts || accounts.length === 0) {
          await tx.user.upsert({
            where: { id: params.userId },
            update: {},
            create: {
              id: params.userId,
              email: `${params.userId}@fgp.local`,
              username: params.userId,
              passwordHash: 'argon2id$test',
              role: 'PLAYER',
              status: 'ACTIVE',
            },
          });

          await tx.virtualCreditAccount.create({
            data: {
              userId: params.userId,
              balance: 10000.0,
              currency: 'DEMO_CREDIT',
            },
          });
          accounts = await tx.$queryRaw<Array<{ id: string; userId: string; balance: number | string; lockedBalance: number | string }>>`
            SELECT "id", "userId", "balance", "lockedBalance"
            FROM "virtual_credit_accounts"
            WHERE "userId" = ${params.userId}
            FOR UPDATE
          `;
        }

        // Re-check idempotency key AFTER acquiring account lock to prevent duplicate debit races
        if (params.idempotencyKey) {
          const existingEntryAfterLock = await tx.playerEntry.findUnique({
            where: { idempotencyKey: params.idempotencyKey },
          });
          if (existingEntryAfterLock) {
            const balance = Number(accounts[0].balance);
            return {
              entry: this.mapEntry(existingEntryAfterLock),
              balanceBefore: balance,
              balanceAfter: balance,
              transactionId: '',
              isIdempotent: true,
            };
          }
        }

        const account = accounts[0];
        const currentBalance = Number(account.balance);

        if (currentBalance < params.entryAmount) {
          throw new InsufficientBalanceError(
            `Insufficient virtual credits: current balance is ${currentBalance.toFixed(2)}, entry requires ${params.entryAmount.toFixed(2)}`
          );
        }

        const newBalance = currentBalance - params.entryAmount;

        // 4. Debit credits
        await tx.virtualCreditAccount.update({
          where: { id: account.id },
          data: { balance: newBalance },
        });

        // 5. Create immutable ledger transaction
        const ledgerRow = await tx.ledgerTransaction.create({
          data: {
            accountId: account.id,
            type: 'ENTRY',
            amount: params.entryAmount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            referenceType: 'GAME_ROUND_ENTRY',
            referenceId: params.roundId,
            idempotencyKey: params.idempotencyKey ? `${params.idempotencyKey}-entry-debit` : undefined,
            metadata: (params.metadata as any) ?? undefined,
          },
        });

        // 6. Create PlayerEntry
        const entryRow = await tx.playerEntry.create({
          data: {
            userId: params.userId,
            gameId: params.gameId,
            roundId: params.roundId,
            entryAmount: params.entryAmount,
            payload: (params.payload as any) ?? {},
            status: 'CONFIRMED',
            idempotencyKey: params.idempotencyKey,
          },
        });

        return {
          entry: this.mapEntry(entryRow),
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          transactionId: ledgerRow.id,
          isIdempotent: false,
        };
      });
    } catch (err: any) {
      if (params.idempotencyKey && (err?.code === 'P2002' || err?.message?.includes('Unique constraint') || err?.message?.includes('duplicate key'))) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const existingEntry = await this.findByIdempotencyKey(params.idempotencyKey);
          if (existingEntry) {
            const account = await prisma.virtualCreditAccount.findUnique({
              where: { userId: params.userId },
            });
            const balance = account ? Number(account.balance) : 0;
            return {
              entry: existingEntry,
              balanceBefore: balance,
              balanceAfter: balance,
              transactionId: '',
              isIdempotent: true,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        }
      }
      throw err;
    }
  }

  public async findById(id: string): Promise<PlayerEntryEntity | null> {
    const row = await prisma.playerEntry.findUnique({ where: { id } });
    return row ? this.mapEntry(row) : null;
  }

  public async findByIdempotencyKey(key: string): Promise<PlayerEntryEntity | null> {
    const row = await prisma.playerEntry.findUnique({ where: { idempotencyKey: key } });
    return row ? this.mapEntry(row) : null;
  }

  public async findByRoundAndUser(roundId: string, userId: string): Promise<PlayerEntryEntity[]> {
    const rows = await prisma.playerEntry.findMany({
      where: { roundId, userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.mapEntry);
  }

  public async updateStatus(id: string, status: EntryStatus): Promise<PlayerEntryEntity> {
    const row = await prisma.playerEntry.update({
      where: { id },
      data: { status },
    });
    return this.mapEntry(row);
  }

  private mapEntry(row: any): PlayerEntryEntity {
    return {
      id: row.id,
      userId: row.userId,
      gameId: row.gameId,
      roundId: row.roundId,
      entryAmount: Number(row.entryAmount),
      payload: row.payload as Record<string, unknown>,
      status: row.status as EntryStatus,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export class PrismaSettlementRepository implements ISettlementRepository {
  public async create(dto: CreateSettlementDto): Promise<SettlementEntity> {
    const row = await prisma.settlement.create({
      data: {
        entryId: dto.entryId,
        roundId: dto.roundId,
        userId: dto.userId,
        gameId: dto.gameId,
        status: dto.status,
        payoutMultiplier: dto.payoutMultiplier,
        rewardAmount: dto.rewardAmount,
        outcome: (dto.outcome || {}) as any,
        idempotencyKey: dto.idempotencyKey ?? null,
      },
    });

    return this.mapSettlement(row);
  }

  public async settleEntryWithReward(params: SettleEntryWithRewardParams): Promise<SettleEntryWithRewardResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Lock PlayerEntry using SELECT ... FOR UPDATE
        const entries = await tx.$queryRaw<Array<{
          id: string;
          userId: string;
          gameId: string;
          roundId: string;
          entryAmount: number | string;
          status: string;
          payload: any;
        }>>`
          SELECT "id", "userId", "gameId", "roundId", "entryAmount", "status", "payload"
          FROM "player_entries"
          WHERE "id" = ${params.entryId}
          FOR UPDATE
        `;

        if (!entries || entries.length === 0) {
          throw new NotFoundError(`Player entry '${params.entryId}' not found`);
        }

        const entry = entries[0];
        if (entry.userId !== params.userId) {
          throw new BadRequestError('Entry does not belong to the requesting player');
        }

        // 2. Check existing settlement for this entry (idempotency check)
        const existingSettlement = await tx.settlement.findUnique({
          where: { entryId: params.entryId },
        });
        if (existingSettlement) {
          const account = await tx.virtualCreditAccount.findUnique({
            where: { userId: params.userId },
          });
          const currentBalance = account ? Number(account.balance) : 0;
          return {
            settlement: this.mapSettlement(existingSettlement),
            balanceBefore: currentBalance,
            balanceAfter: currentBalance,
            isIdempotent: true,
          };
        }

        // 3. Verify entry is eligible (CONFIRMED)
        if (entry.status !== 'CONFIRMED') {
          const concurrentSettlement = await tx.settlement.findUnique({
            where: { entryId: params.entryId },
          });
          if (concurrentSettlement) {
            const account = await tx.virtualCreditAccount.findUnique({
              where: { userId: params.userId },
            });
            const currentBalance = account ? Number(account.balance) : 0;
            return {
              settlement: this.mapSettlement(concurrentSettlement),
              balanceBefore: currentBalance,
              balanceAfter: currentBalance,
              isIdempotent: true,
            };
          }
          throw new ConflictError(`Entry '${entry.id}' is not in CONFIRMED state (current: ${entry.status})`);
        }

        // 4. Verify round state
        const round = await tx.gameRound.findUnique({
          where: { id: entry.roundId },
        });
        if (!round) {
          throw new NotFoundError(`Round '${entry.roundId}' not found`);
        }

        let balanceBefore: number | undefined;
        let balanceAfter: number | undefined;
        let transactionId: string | undefined;

        // 5. If won and rewardAmount > 0, atomically credit reward
        if (params.status === 'WON' && params.rewardAmount > 0) {
          let accounts = await tx.$queryRaw<Array<{ id: string; userId: string; balance: number | string; lockedBalance: number | string }>>`
            SELECT "id", "userId", "balance", "lockedBalance"
            FROM "virtual_credit_accounts"
            WHERE "userId" = ${params.userId}
            FOR UPDATE
          `;

          if (!accounts || accounts.length === 0) {
            await tx.user.upsert({
              where: { id: params.userId },
              update: {},
              create: {
                id: params.userId,
                email: `${params.userId}@fgp.local`,
                username: params.userId,
                passwordHash: 'argon2id$test',
                role: 'PLAYER',
                status: 'ACTIVE',
              },
            });

            await tx.virtualCreditAccount.create({
              data: {
                userId: params.userId,
                balance: 10000.0,
                currency: 'DEMO_CREDIT',
              },
            });
            accounts = await tx.$queryRaw<Array<{ id: string; userId: string; balance: number | string; lockedBalance: number | string }>>`
              SELECT "id", "userId", "balance", "lockedBalance"
              FROM "virtual_credit_accounts"
              WHERE "userId" = ${params.userId}
              FOR UPDATE
            `;
          }

          const account = accounts[0];
          balanceBefore = Number(account.balance);
          balanceAfter = balanceBefore + params.rewardAmount;

          await tx.virtualCreditAccount.update({
            where: { id: account.id },
            data: { balance: balanceAfter },
          });

          const rewardTx = await tx.ledgerTransaction.create({
            data: {
              accountId: account.id,
              type: 'REWARD',
              amount: params.rewardAmount,
              balanceBefore,
              balanceAfter,
              referenceType: params.referenceType || 'GAME_ROUND_REWARD',
              referenceId: entry.roundId,
              idempotencyKey: params.idempotencyKey ? `${params.idempotencyKey}-reward` : `settlement-reward-${entry.id}`,
              metadata: (params.outcome as any) ?? undefined,
            },
          });
          transactionId = rewardTx.id;
        } else {
          const account = await tx.virtualCreditAccount.findUnique({
            where: { userId: params.userId },
          });
          balanceBefore = account ? Number(account.balance) : 0;
          balanceAfter = balanceBefore;
        }

        // 6. Create Settlement
        const settlementRow = await tx.settlement.create({
          data: {
            entryId: entry.id,
            roundId: entry.roundId,
            userId: params.userId,
            gameId: entry.gameId,
            status: params.status,
            payoutMultiplier: params.payoutMultiplier,
            rewardAmount: params.rewardAmount,
            outcome: (params.outcome as any) ?? undefined,
            idempotencyKey: params.idempotencyKey ?? null,
          },
        });

        // 7. Update PlayerEntry status to 'SETTLED'
        await tx.playerEntry.update({
          where: { id: entry.id },
          data: { status: 'SETTLED' },
        });

        return {
          settlement: this.mapSettlement(settlementRow),
          balanceBefore,
          balanceAfter,
          transactionId,
          isIdempotent: false,
        };
      });
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint') || err?.message?.includes('duplicate key')) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const existingSettlement = await this.findByEntryId(params.entryId);
          if (existingSettlement) {
            const account = await prisma.virtualCreditAccount.findUnique({
              where: { userId: params.userId },
            });
            const currentBalance = account ? Number(account.balance) : 0;
            return {
              settlement: existingSettlement,
              balanceBefore: currentBalance,
              balanceAfter: currentBalance,
              isIdempotent: true,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        }
      }
      throw err;
    }
  }

  public async findByEntryId(entryId: string): Promise<SettlementEntity | null> {
    const row = await prisma.settlement.findUnique({ where: { entryId } });
    return row ? this.mapSettlement(row) : null;
  }

  public async listByRoundId(roundId: string): Promise<SettlementEntity[]> {
    const rows = await prisma.settlement.findMany({
      where: { roundId },
      orderBy: { settledAt: 'desc' },
    });
    return rows.map(this.mapSettlement);
  }

  public async listByUserId(userId: string, limit: number = 50): Promise<SettlementEntity[]> {
    const rows = await prisma.settlement.findMany({
      where: { userId },
      orderBy: { settledAt: 'desc' },
      take: limit,
    });
    return rows.map(this.mapSettlement);
  }

  private mapSettlement(row: any): SettlementEntity {
    return {
      id: row.id,
      entryId: row.entryId,
      roundId: row.roundId,
      userId: row.userId,
      gameId: row.gameId,
      status: row.status as SettlementStatus,
      payoutMultiplier: Number(row.payoutMultiplier),
      rewardAmount: Number(row.rewardAmount),
      outcome: row.outcome as Record<string, unknown> | null,
      idempotencyKey: row.idempotencyKey ?? null,
      settledAt: row.settledAt,
    };
  }
}
