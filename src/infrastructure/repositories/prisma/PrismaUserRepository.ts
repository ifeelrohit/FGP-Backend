// ==============================================================================
// PrismaUserRepository Implementation
// Authoritative PostgreSQL user identity persistence with atomic account creation
// ==============================================================================

import { prisma } from '../../database/prisma.ts';
import {
  IUserRepository,
  UserEntity,
  CreateUserDto,
} from '../interfaces/IUserRepository.ts';
import { UserRole, UserStatus } from '../../../shared/types/index.ts';

export class PrismaUserRepository implements IUserRepository {
  public async findById(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? this.mapToEntity(user) : null;
  }

  public async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? this.mapToEntity(user) : null;
  }

  public async findByUsername(username: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { username } });
    return user ? this.mapToEntity(user) : null;
  }

  public async createWithInitialCredits(
    dto: CreateUserDto,
    initialCredits: number
  ): Promise<{ user: UserEntity; accountId: string }> {
    return await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          ...(dto.id ? { id: dto.id } : {}),
          email: dto.email,
          username: dto.username,
          passwordHash: dto.passwordHash,
          role: dto.role || 'PLAYER',
          status: dto.status || 'ACTIVE',
        },
      });

      // 2. Create Virtual Credit Account
      const account = await tx.virtualCreditAccount.create({
        data: {
          userId: user.id,
          balance: initialCredits,
          currency: 'DEMO_CREDIT',
        },
      });

      // 3. Create Welcome Bonus Ledger Transaction
      await tx.ledgerTransaction.create({
        data: {
          accountId: account.id,
          type: 'CREDIT',
          amount: initialCredits,
          balanceBefore: 0,
          balanceAfter: initialCredits,
          referenceType: 'WELCOME_BONUS',
          referenceId: user.id,
          idempotencyKey: `welcome-${user.id}`,
          metadata: { note: 'Initial simulated demo credits allocated' },
        },
      });

      return {
        user: this.mapToEntity(user),
        accountId: account.id,
      };
    });
  }

  public async updateStatus(id: string, status: UserStatus): Promise<UserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: { status },
    });
    return this.mapToEntity(user);
  }

  public async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  public async listAll(): Promise<UserEntity[]> {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map(this.mapToEntity);
  }

  private mapToEntity(row: any): UserEntity {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.passwordHash,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastLoginAt: row.lastLoginAt,
    };
  }
}
