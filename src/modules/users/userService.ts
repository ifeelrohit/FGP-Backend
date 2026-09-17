// ==============================================================================
// FGP-Backend User Service
// User lifecycle, resolution, and status management
// ==============================================================================

import crypto from 'node:crypto';
import { inMemoryStore, StoredUser } from '../../infrastructure/database/inMemoryStore.ts';
import { NotFoundError } from '../../shared/errors/index.ts';
import { UserRole, UserStatus } from '../../shared/types/index.ts';

export class UserService {
  public async createUser(data: {
    email: string;
    username: string;
    passwordHash: string;
    role?: UserRole;
  }): Promise<StoredUser> {
    const id = crypto.randomUUID();
    const newUser: StoredUser = {
      id,
      email: data.email.toLowerCase(),
      username: data.username,
      passwordHash: data.passwordHash,
      role: data.role || 'PLAYER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryStore.users.set(id, newUser);

    // Automatically provision initial virtual credit account for new user
    const accountId = crypto.randomUUID();
    inMemoryStore.accounts.set(accountId, {
      id: accountId,
      userId: id,
      balance: 10000.0,
      lockedBalance: 0.0,
      currency: 'DEMO_CREDIT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Record initial welcome demo credit in ledger
    inMemoryStore.transactions.push({
      id: crypto.randomUUID(),
      accountId,
      userId: id,
      type: 'CREDIT',
      amount: 10000.0,
      balanceBefore: 0.0,
      balanceAfter: 10000.0,
      referenceType: 'WELCOME_BONUS',
      referenceId: 'genesis',
      metadata: { note: 'Initial simulated player balance' },
      createdAt: new Date(),
    });

    return newUser;
  }

  public async findById(id: string): Promise<StoredUser | null> {
    return inMemoryStore.users.get(id) || null;
  }

  public async findByEmail(email: string): Promise<StoredUser | null> {
    const normalized = email.toLowerCase();
    for (const user of inMemoryStore.users.values()) {
      if (user.email.toLowerCase() === normalized) return user;
    }
    return null;
  }

  public async findByUsername(username: string): Promise<StoredUser | null> {
    for (const user of inMemoryStore.users.values()) {
      if (user.username.toLowerCase() === username.toLowerCase()) return user;
    }
    return null;
  }

  public async findByLogin(login: string): Promise<StoredUser | null> {
    if (login.includes('@')) {
      return this.findByEmail(login);
    }
    return this.findByUsername(login);
  }

  public async updateLastLogin(id: string): Promise<void> {
    const user = inMemoryStore.users.get(id);
    if (user) {
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
    }
  }

  public async updateUserStatus(id: string, status: UserStatus): Promise<StoredUser> {
    const user = inMemoryStore.users.get(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    user.status = status;
    user.updatedAt = new Date();
    return user;
  }

  public async listUsers(): Promise<StoredUser[]> {
    return Array.from(inMemoryStore.users.values());
  }
}

export const userService = new UserService();
