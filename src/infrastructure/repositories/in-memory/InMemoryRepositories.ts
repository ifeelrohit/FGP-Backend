// ==============================================================================
// In-Memory Test Repositories Adapter
// Strictly for unit and isolated testing without requiring external PostgreSQL
// Implements the authoritative repository interfaces
// ==============================================================================

import crypto from 'node:crypto';
import {
  IUserRepository,
  UserEntity,
  CreateUserDto,
} from '../interfaces/IUserRepository.ts';
import {
  IRefreshTokenRepository,
  RefreshTokenEntity,
  CreateRefreshTokenDto,
} from '../interfaces/IRefreshTokenRepository.ts';
import {
  IVirtualCreditRepository,
  ILedgerRepository,
  VirtualCreditAccountEntity,
  LedgerTransactionEntity,
  RecordTransactionDto,
} from '../interfaces/IVirtualCreditRepository.ts';
import {
  IGameRepository,
  GameEntityData,
} from '../interfaces/IGameRepository.ts';
import {
  IGameConfigurationRepository,
  GameConfigEntity,
  CreateConfigDraftDto,
} from '../interfaces/IGameConfigurationRepository.ts';
import {
  IRoundRepository,
  GameRoundEntity,
  CreateRoundDto,
} from '../interfaces/IRoundRepository.ts';
import {
  IPlayerEntryRepository,
  ISettlementRepository,
  PlayerEntryEntity,
  CreatePlayerEntryDto,
  SettlementEntity,
  CreateSettlementDto,
} from '../interfaces/IPlayerEntryRepository.ts';
import {
  IAuditRepository,
  IAnnouncementRepository,
  AuditLogEntity,
  CreateAuditLogDto,
  AnnouncementEntity,
  CreateAnnouncementDto,
} from '../interfaces/IAuditRepository.ts';
import {
  UserRole,
  UserStatus,
  GameCategory,
  GameStatus,
  RoundStatus,
  ConfigStatus,
  TransactionType,
  EntryStatus,
  SettlementStatus,
} from '../../../shared/types/index.ts';
import { InsufficientBalanceError, NotFoundError, BadRequestError } from '../../../shared/errors/index.ts';
import { isValidRoundTransition } from '../../../shared/constants/rounds.ts';

export class InMemoryUserRepository implements IUserRepository {
  public users = new Map<string, UserEntity>();
  public virtualCreditRepo?: InMemoryVirtualCreditRepository;
  public ledgerRepo?: InMemoryLedgerRepository;

  public async findById(id: string): Promise<UserEntity | null> {
    return this.users.get(id) || null;
  }

  public async findByEmail(email: string): Promise<UserEntity | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  public async findByUsername(username: string): Promise<UserEntity | null> {
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === username.toLowerCase()) return u;
    }
    return null;
  }

  public async createWithInitialCredits(
    dto: CreateUserDto,
    initialCredits: number
  ): Promise<{ user: UserEntity; accountId: string }> {
    const id = crypto.randomUUID();
    const user: UserEntity = {
      id,
      email: dto.email,
      username: dto.username,
      passwordHash: dto.passwordHash,
      role: dto.role || 'PLAYER',
      status: dto.status || 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);

    let accountId = `acc-${id}`;
    if (this.virtualCreditRepo) {
      const acc = await this.virtualCreditRepo.createAccount(id, initialCredits);
      accountId = acc.id;
    }
    if (this.ledgerRepo) {
      await this.ledgerRepo.executeTransaction({
        userId: id,
        type: 'CREDIT',
        amount: initialCredits,
        referenceType: 'WELCOME_BONUS',
        referenceId: id,
        idempotencyKey: `welcome-${id}`,
        metadata: { note: 'Initial simulated demo credits allocated' },
      });
    }

    return { user, accountId };
  }

  public async updateStatus(id: string, status: UserStatus): Promise<UserEntity> {
    const user = this.users.get(id);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    user.status = status;
    user.updatedAt = new Date();
    return user;
  }

  public async updateLastLogin(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
    }
  }

  public async listAll(): Promise<UserEntity[]> {
    return Array.from(this.users.values());
  }

  public clear(): void {
    this.users.clear();
  }
}

export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  public tokens = new Map<string, RefreshTokenEntity>();

  public async create(dto: CreateRefreshTokenDto): Promise<RefreshTokenEntity> {
    const entity: RefreshTokenEntity = {
      id: crypto.randomUUID(),
      userId: dto.userId,
      tokenHash: dto.tokenHash,
      expiresAt: dto.expiresAt,
      createdAt: new Date(),
      userAgent: dto.userAgent,
      ipAddress: dto.ipAddress,
    };
    this.tokens.set(dto.tokenHash, entity);
    return entity;
  }

  public async findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    return this.tokens.get(tokenHash) || null;
  }

  public async revokeByTokenHash(tokenHash: string): Promise<void> {
    const t = this.tokens.get(tokenHash);
    if (t) t.revokedAt = new Date();
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    for (const t of this.tokens.values()) {
      if (t.userId === userId && !t.revokedAt) {
        t.revokedAt = new Date();
      }
    }
  }

  public clear(): void {
    this.tokens.clear();
  }
}

export class InMemoryVirtualCreditRepository implements IVirtualCreditRepository {
  public accounts = new Map<string, VirtualCreditAccountEntity>();

  public async findByUserId(userId: string): Promise<VirtualCreditAccountEntity | null> {
    for (const a of this.accounts.values()) {
      if (a.userId === userId) return a;
    }
    return null;
  }

  public async createAccount(
    userId: string,
    initialBalance: number = 10000
  ): Promise<VirtualCreditAccountEntity> {
    const entity: VirtualCreditAccountEntity = {
      id: `acc-${userId}`,
      userId,
      balance: initialBalance,
      lockedBalance: 0,
      currency: 'DEMO_CREDIT',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.accounts.set(entity.id, entity);
    return entity;
  }

  public clear(): void {
    this.accounts.clear();
  }
}

export class InMemoryLedgerRepository implements ILedgerRepository {
  public transactions: LedgerTransactionEntity[] = [];
  public creditRepo: InMemoryVirtualCreditRepository;

  constructor(creditRepo: InMemoryVirtualCreditRepository) {
    this.creditRepo = creditRepo;
  }

  public async findTransactionByIdempotencyKey(key: string): Promise<LedgerTransactionEntity | null> {
    const found = this.transactions.find((t) => t.idempotencyKey === key);
    return found || null;
  }

  public async executeTransaction(dto: RecordTransactionDto): Promise<LedgerTransactionEntity> {
    if (dto.idempotencyKey) {
      const existing = await this.findTransactionByIdempotencyKey(dto.idempotencyKey);
      if (existing) return existing;
    }

    const account = await this.creditRepo.findByUserId(dto.userId);
    if (!account) {
      throw new InsufficientBalanceError(`No virtual credit account found for user ${dto.userId}`);
    }

    const currentBalance = account.balance;
    let newBalance = currentBalance;

    if (dto.type === 'ENTRY') {
      if (currentBalance < dto.amount) {
        throw new InsufficientBalanceError(
          `Insufficient virtual credits: current balance is ${currentBalance.toFixed(2)}, entry requires ${dto.amount.toFixed(2)}`
        );
      }
      newBalance = currentBalance - dto.amount;
    } else if (dto.type === 'CREDIT' || dto.type === 'REWARD') {
      newBalance = currentBalance + dto.amount;
    } else if (dto.type === 'ADJUSTMENT' || dto.type === 'REVERSAL') {
      newBalance = currentBalance + dto.amount;
      if (newBalance < 0) {
        throw new InsufficientBalanceError(`Adjustment would cause negative balance: ${newBalance.toFixed(2)}`);
      }
    }

    account.balance = newBalance;
    account.updatedAt = new Date();

    const entity: LedgerTransactionEntity = {
      id: crypto.randomUUID(),
      accountId: account.id,
      type: dto.type,
      amount: dto.amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      idempotencyKey: dto.idempotencyKey,
      metadata: dto.metadata,
      createdAt: new Date(),
    };

    this.transactions.push(entity);
    return entity;
  }

  public async listTransactionsByUserId(userId: string, limit: number = 50): Promise<LedgerTransactionEntity[]> {
    const account = await this.creditRepo.findByUserId(userId);
    if (!account) return [];
    return this.transactions
      .filter((t) => t.accountId === account.id)
      .slice(-limit)
      .reverse();
  }

  public clear(): void {
    this.transactions = [];
  }
}

export class InMemoryGameRepository implements IGameRepository {
  public games = new Map<string, GameEntityData>();

  public async findById(id: string): Promise<GameEntityData | null> {
    return this.games.get(id) || null;
  }

  public async findByCode(code: string): Promise<GameEntityData | null> {
    for (const g of this.games.values()) {
      if (g.code === code) return g;
    }
    return null;
  }

  public async listAll(category?: GameCategory): Promise<GameEntityData[]> {
    let all = Array.from(this.games.values());
    if (category) all = all.filter((g) => g.category === category);
    return all;
  }

  public async updateStatus(id: string, status: GameStatus): Promise<GameEntityData> {
    const g = this.games.get(id);
    if (!g) throw new NotFoundError(`Game '${id}' not found`);
    g.status = status;
    g.updatedAt = new Date();
    return g;
  }

  public async seedCatalog(games: GameEntityData[]): Promise<void> {
    for (const g of games) {
      this.games.set(g.id, { ...g });
    }
  }

  public clear(): void {
    this.games.clear();
  }
}

export class InMemoryGameConfigurationRepository implements IGameConfigurationRepository {
  public configs = new Map<string, GameConfigEntity>();

  public async findById(id: string): Promise<GameConfigEntity | null> {
    return this.configs.get(id) || null;
  }

  public async getActiveConfig(gameId: string): Promise<GameConfigEntity | null> {
    const active = Array.from(this.configs.values())
      .filter((c) => c.gameId === gameId && c.status === 'ACTIVE')
      .sort((a, b) => b.version - a.version);
    return active.length > 0 ? active[0] : null;
  }

  public async listVersions(gameId: string): Promise<GameConfigEntity[]> {
    return Array.from(this.configs.values())
      .filter((c) => c.gameId === gameId)
      .sort((a, b) => b.version - a.version);
  }

  public async createDraft(dto: CreateConfigDraftDto): Promise<GameConfigEntity> {
    const existing = await this.listVersions(dto.gameId);
    const nextVersion = existing.length > 0 ? Math.max(...existing.map((e) => e.version)) + 1 : 1;
    const base = existing.length > 0 ? existing[0] : null;

    const id = `cfg-${dto.gameId}-v${nextVersion}`;
    const entity: GameConfigEntity = {
      id,
      gameId: dto.gameId,
      version: nextVersion,
      status: 'DRAFT',
      generalConfig: dto.generalConfig || base?.generalConfig || {},
      entryConfig: dto.entryConfig || base?.entryConfig || {},
      timingConfig: dto.timingConfig || base?.timingConfig || {},
      ruleConfig: dto.ruleConfig || base?.ruleConfig || {},
      rewardConfig: dto.rewardConfig || base?.rewardConfig || {},
      displayConfig: dto.displayConfig || base?.displayConfig || {},
      operationalConfig: dto.operationalConfig || base?.operationalConfig || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.configs.set(id, entity);
    return entity;
  }

  public async transitionStatus(
    configId: string,
    targetStatus: ConfigStatus,
    actorId?: string
  ): Promise<GameConfigEntity> {
    const current = this.configs.get(configId);
    if (!current) throw new NotFoundError(`Configuration '${configId}' not found`);

    const validTransitions: Record<ConfigStatus, ConfigStatus[]> = {
      DRAFT: ['VALIDATE'],
      VALIDATE: ['PREVIEW', 'DRAFT'],
      PREVIEW: ['APPROVE', 'DRAFT'],
      APPROVE: ['PUBLISH', 'DRAFT'],
      PUBLISH: ['ACTIVE'],
      ACTIVE: ['ARCHIVED'],
      ARCHIVED: [],
    };

    const allowed = validTransitions[current.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid configuration lifecycle transition from ${current.status} to ${targetStatus}`
      );
    }

    if (targetStatus === 'ACTIVE') {
      // Archive other active configurations
      for (const other of this.configs.values()) {
        if (other.gameId === current.gameId && other.id !== current.id && other.status === 'ACTIVE') {
          other.status = 'ARCHIVED';
          other.updatedAt = new Date();
        }
      }
      current.status = 'ACTIVE';
      current.publishedBy = actorId || 'admin';
      current.publishedAt = new Date();
    } else {
      current.status = targetStatus;
    }

    current.updatedAt = new Date();
    return current;
  }

  public async rollback(
    gameId: string,
    targetVersion: number,
    actorId?: string
  ): Promise<GameConfigEntity> {
    const versions = await this.listVersions(gameId);
    const target = versions.find((v) => v.version === targetVersion);
    if (!target) throw new NotFoundError(`Version ${targetVersion} of game '${gameId}' configuration not found`);

    const nextVersion = Math.max(...versions.map((v) => v.version)) + 1;
    const rollbackId = `cfg-${gameId}-v${nextVersion}-rb`;

    // Archive current active
    for (const other of this.configs.values()) {
      if (other.gameId === gameId && other.status === 'ACTIVE') {
        other.status = 'ARCHIVED';
      }
    }

    const newConfig: GameConfigEntity = {
      id: rollbackId,
      gameId,
      version: nextVersion,
      status: 'ACTIVE',
      generalConfig: { ...target.generalConfig },
      entryConfig: { ...target.entryConfig },
      timingConfig: { ...target.timingConfig },
      ruleConfig: { ...target.ruleConfig },
      rewardConfig: { ...target.rewardConfig },
      displayConfig: { ...target.displayConfig },
      operationalConfig: { ...target.operationalConfig },
      publishedBy: actorId || 'rollback-system',
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.configs.set(rollbackId, newConfig);
    return newConfig;
  }

  public async seedDefaultConfig(config: GameConfigEntity): Promise<void> {
    this.configs.set(config.id, { ...config });
  }

  public clear(): void {
    this.configs.clear();
  }
}

export class InMemoryRoundRepository implements IRoundRepository {
  public rounds = new Map<string, GameRoundEntity>();
  private roundCounters = new Map<string, bigint>();

  public async findById(id: string): Promise<GameRoundEntity | null> {
    return this.rounds.get(id) || null;
  }

  public async getActiveRound(gameId: string): Promise<GameRoundEntity | null> {
    const active = Array.from(this.rounds.values())
      .filter((r) => r.gameId === gameId && ['SCHEDULED', 'OPEN', 'LOCKED', 'RESULT_PENDING'].includes(r.status))
      .sort((a, b) => (b.roundNumber > a.roundNumber ? 1 : -1));
    return active.length > 0 ? active[0] : null;
  }

  public async createRound(dto: CreateRoundDto): Promise<GameRoundEntity> {
    const currentNum = this.roundCounters.get(dto.gameId) || 0n;
    const nextNum = currentNum + 1n;
    this.roundCounters.set(dto.gameId, nextNum);

    const id = `round-${dto.gameId}-${nextNum}`;
    const entity: GameRoundEntity = {
      id,
      gameId: dto.gameId,
      roundNumber: nextNum,
      status: 'SCHEDULED',
      configId: dto.configId,
      configSnapshot: dto.configSnapshot,
      serverSeedHash: dto.serverSeedHash,
      serverSeed: dto.serverSeed,
      crashPoint: dto.crashPoint,
      scheduledAt: dto.scheduledAt || new Date(),
    };

    this.rounds.set(id, entity);
    return entity;
  }

  public async transitionStatus(
    id: string,
    targetStatus: RoundStatus,
    result?: Record<string, unknown>
  ): Promise<GameRoundEntity> {
    const current = this.rounds.get(id);
    if (!current) throw new NotFoundError(`Round '${id}' not found`);

    if (!isValidRoundTransition(current.status, targetStatus)) {
      throw new BadRequestError(
        `Invalid round lifecycle transition from '${current.status}' to '${targetStatus}'`
      );
    }

    current.status = targetStatus;
    const now = new Date();
    if (targetStatus === 'OPEN') current.openedAt = now;
    if (targetStatus === 'LOCKED') current.lockedAt = now;
    if (targetStatus === 'RESULT_DECLARED') {
      current.declaredAt = now;
      if (result) current.result = result;
    }
    if (targetStatus === 'SETTLED') current.settledAt = now;
    if (targetStatus === 'COMPLETED') current.completedAt = now;

    return current;
  }

  public async listRounds(gameId?: string, limit: number = 20): Promise<GameRoundEntity[]> {
    let all = Array.from(this.rounds.values());
    if (gameId) all = all.filter((r) => r.gameId === gameId);
    return all.sort((a, b) => (b.roundNumber > a.roundNumber ? 1 : -1)).slice(0, limit);
  }

  public clear(): void {
    this.rounds.clear();
    this.roundCounters.clear();
  }
}

export class InMemoryPlayerEntryRepository implements IPlayerEntryRepository {
  public entries = new Map<string, PlayerEntryEntity>();

  public async create(dto: CreatePlayerEntryDto): Promise<PlayerEntryEntity> {
    if (dto.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(dto.idempotencyKey);
      if (existing) return existing;
    }

    const id = crypto.randomUUID();
    const entity: PlayerEntryEntity = {
      id,
      userId: dto.userId,
      gameId: dto.gameId,
      roundId: dto.roundId,
      entryAmount: dto.entryAmount,
      payload: dto.payload,
      status: 'CONFIRMED',
      idempotencyKey: dto.idempotencyKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.entries.set(id, entity);
    return entity;
  }

  public async findById(id: string): Promise<PlayerEntryEntity | null> {
    return this.entries.get(id) || null;
  }

  public async findByIdempotencyKey(key: string): Promise<PlayerEntryEntity | null> {
    for (const e of this.entries.values()) {
      if (e.idempotencyKey === key) return e;
    }
    return null;
  }

  public async findByRoundAndUser(roundId: string, userId: string): Promise<PlayerEntryEntity[]> {
    return Array.from(this.entries.values()).filter(
      (e) => e.roundId === roundId && e.userId === userId
    );
  }

  public async updateStatus(id: string, status: EntryStatus): Promise<PlayerEntryEntity> {
    const entry = this.entries.get(id);
    if (!entry) throw new NotFoundError(`Entry '${id}' not found`);
    entry.status = status;
    entry.updatedAt = new Date();
    return entry;
  }

  public clear(): void {
    this.entries.clear();
  }
}

export class InMemorySettlementRepository implements ISettlementRepository {
  public settlements = new Map<string, SettlementEntity>();

  public async create(dto: CreateSettlementDto): Promise<SettlementEntity> {
    const id = crypto.randomUUID();
    const entity: SettlementEntity = {
      id,
      entryId: dto.entryId,
      roundId: dto.roundId,
      userId: dto.userId,
      gameId: dto.gameId,
      status: dto.status,
      payoutMultiplier: dto.payoutMultiplier,
      rewardAmount: dto.rewardAmount,
      outcome: dto.outcome,
      settledAt: new Date(),
    };
    this.settlements.set(id, entity);
    return entity;
  }

  public async findByEntryId(entryId: string): Promise<SettlementEntity | null> {
    for (const s of this.settlements.values()) {
      if (s.entryId === entryId) return s;
    }
    return null;
  }

  public async listByRoundId(roundId: string): Promise<SettlementEntity[]> {
    return Array.from(this.settlements.values()).filter((s) => s.roundId === roundId);
  }

  public async listByUserId(userId: string, limit: number = 50): Promise<SettlementEntity[]> {
    return Array.from(this.settlements.values())
      .filter((s) => s.userId === userId)
      .slice(-limit)
      .reverse();
  }

  public clear(): void {
    this.settlements.clear();
  }
}

export class InMemoryAuditRepository implements IAuditRepository {
  public logs: AuditLogEntity[] = [];

  public async create(dto: CreateAuditLogDto): Promise<AuditLogEntity> {
    const entity: AuditLogEntity = {
      id: crypto.randomUUID(),
      actorId: dto.actorId,
      action: dto.action,
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: dto.reason,
      metadata: dto.metadata,
      ipAddress: dto.ipAddress,
      requestId: dto.requestId,
      createdAt: new Date(),
    };
    this.logs.push(entity);
    return entity;
  }

  public async list(limit: number = 50): Promise<AuditLogEntity[]> {
    return this.logs.slice(-limit).reverse();
  }

  public clear(): void {
    this.logs = [];
  }
}

export class InMemoryAnnouncementRepository implements IAnnouncementRepository {
  public announcements = new Map<string, AnnouncementEntity>();

  public async listActive(targetRole?: UserRole): Promise<AnnouncementEntity[]> {
    return Array.from(this.announcements.values()).filter((a) => {
      if (!a.isActive) return false;
      if (targetRole && a.targetRole && a.targetRole !== targetRole) return false;
      return true;
    });
  }

  public async create(dto: CreateAnnouncementDto): Promise<AnnouncementEntity> {
    const id = crypto.randomUUID();
    const entity: AnnouncementEntity = {
      id,
      title: dto.title,
      content: dto.content,
      targetRole: dto.targetRole,
      priority: dto.priority ?? 0,
      isActive: true,
      publishedAt: new Date(),
      expiresAt: dto.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.announcements.set(id, entity);
    return entity;
  }

  public async deactivate(id: string): Promise<void> {
    const ann = this.announcements.get(id);
    if (ann) ann.isActive = false;
  }

  public clear(): void {
    this.announcements.clear();
  }
}
