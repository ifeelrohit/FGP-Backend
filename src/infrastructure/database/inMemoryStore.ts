// ==============================================================================
// FGP-Backend In-Memory Foundation Store
// Provides local zero-dependency transactional repository storage for Phase 03
// test suites and standalone environments without live PostgreSQL
// ==============================================================================

import {
  UserRole,
  UserStatus,
  RoundStatus,
  ConfigStatus,
  TransactionType,
} from '../../shared/types/index.ts';
import { GAME_CATALOG } from '../../shared/constants/games.ts';

export interface StoredUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface StoredVirtualAccount {
  id: string;
  userId: string;
  balance: number;
  lockedBalance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredTransaction {
  id: string;
  accountId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface StoredGameRound {
  id: string;
  gameId: string;
  roundNumber: number;
  status: RoundStatus;
  configId?: string;
  scheduledAt: Date;
  openedAt?: Date;
  lockedAt?: Date;
  declaredAt?: Date;
  settledAt?: Date;
  completedAt?: Date;
  result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface StoredGameConfig {
  id: string;
  gameId: string;
  version: number;
  status: ConfigStatus;
  generalConfig: Record<string, unknown>;
  entryConfig: Record<string, unknown>;
  timingConfig: Record<string, unknown>;
  ruleConfig: Record<string, unknown>;
  rewardConfig: Record<string, unknown>;
  displayConfig: Record<string, unknown>;
  operationalConfig: Record<string, unknown>;
  publishedBy?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredAuditLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  requestId?: string;
  createdAt: Date;
}

export interface StoredAnnouncement {
  id: string;
  title: string;
  content: string;
  targetRole?: UserRole;
  priority: number;
  isActive: boolean;
  publishedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class InMemoryStore {
  public users = new Map<string, StoredUser>();
  public refreshTokens = new Map<string, StoredRefreshToken>();
  public accounts = new Map<string, StoredVirtualAccount>();
  public transactions: StoredTransaction[] = [];
  public rounds = new Map<string, StoredGameRound>();
  public configurations = new Map<string, StoredGameConfig>();
  public auditLogs: StoredAuditLog[] = [];
  public announcements = new Map<string, StoredAnnouncement>();

  constructor() {
    this.seedDefaults();
  }

  public seedDefaults() {
    // Seed initial active configurations for all 18 games
    for (const game of GAME_CATALOG) {
      const configId = `cfg-${game.id}-v1`;
      this.configurations.set(configId, {
        id: configId,
        gameId: game.id,
        version: 1,
        status: 'ACTIVE',
        generalConfig: { name: game.name, category: game.category },
        entryConfig: { minEntry: game.minEntry, maxEntry: game.maxEntry },
        timingConfig: { roundIntervalSeconds: 30, lockBeforeSeconds: 5 },
        ruleConfig: { defaultMultiplier: game.defaultMultiplier },
        rewardConfig: { payoutRatio: 0.98 },
        displayConfig: { theme: 'default', animated: true },
        operationalConfig: { maintenance: false, enabled: true },
        publishedBy: 'system-bootstrap',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Seed an initial announcement
    const annId = 'ann-welcome-01';
    this.announcements.set(annId, {
      id: annId,
      title: 'Welcome to FGP (Fantasy Gaming Platform)',
      content: 'Authoritative backend Phase 03 active. Demo/virtual credits enabled.',
      priority: 10,
      isActive: true,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public reset() {
    this.users.clear();
    this.refreshTokens.clear();
    this.accounts.clear();
    this.transactions = [];
    this.rounds.clear();
    this.configurations.clear();
    this.auditLogs = [];
    this.announcements.clear();
    this.seedDefaults();
  }
}

export const inMemoryStore = new InMemoryStore();
