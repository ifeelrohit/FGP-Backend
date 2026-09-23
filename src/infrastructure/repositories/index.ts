// ==============================================================================
// Repository Container & Factory
// Authoritative Dependency Injection Provider for PostgreSQL Repositories
// Production uses PostgreSQL / Prisma; Tests use in-memory adapters.
// ==============================================================================

import { IUserRepository } from './interfaces/IUserRepository.ts';
import { IRefreshTokenRepository } from './interfaces/IRefreshTokenRepository.ts';
import { IVirtualCreditRepository, ILedgerRepository } from './interfaces/IVirtualCreditRepository.ts';
import { IGameRepository } from './interfaces/IGameRepository.ts';
import { IGameConfigurationRepository } from './interfaces/IGameConfigurationRepository.ts';
import { IRoundRepository } from './interfaces/IRoundRepository.ts';
import { IPlayerEntryRepository, ISettlementRepository } from './interfaces/IPlayerEntryRepository.ts';
import { IAuditRepository, IAnnouncementRepository } from './interfaces/IAuditRepository.ts';

import { PrismaUserRepository } from './prisma/PrismaUserRepository.ts';
import { PrismaRefreshTokenRepository } from './prisma/PrismaRefreshTokenRepository.ts';
import { PrismaVirtualCreditRepository, PrismaLedgerRepository } from './prisma/PrismaLedgerRepository.ts';
import { PrismaGameRepository } from './prisma/PrismaGameRepository.ts';
import { PrismaGameConfigurationRepository } from './prisma/PrismaGameConfigurationRepository.ts';
import { PrismaRoundRepository } from './prisma/PrismaRoundRepository.ts';
import { PrismaPlayerEntryRepository, PrismaSettlementRepository } from './prisma/PrismaPlayerEntryRepository.ts';
import { PrismaAuditRepository, PrismaAnnouncementRepository } from './prisma/PrismaAuditRepository.ts';

import {
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
  InMemoryVirtualCreditRepository,
  InMemoryLedgerRepository,
  InMemoryGameRepository,
  InMemoryGameConfigurationRepository,
  InMemoryRoundRepository,
  InMemoryPlayerEntryRepository,
  InMemorySettlementRepository,
  InMemoryAuditRepository,
  InMemoryAnnouncementRepository,
} from './in-memory/InMemoryRepositories.ts';

import { GAME_CATALOG } from '../../shared/constants/games.ts';
import { logger } from '../logging/logger.ts';
import { isDatabaseReachable } from '../database/prisma.ts';

export interface RepositoryContainer {
  userRepo: IUserRepository;
  refreshTokenRepo: IRefreshTokenRepository;
  virtualCreditRepo: IVirtualCreditRepository;
  ledgerRepo: ILedgerRepository;
  gameRepo: IGameRepository;
  configRepo: IGameConfigurationRepository;
  roundRepo: IRoundRepository;
  entryRepo: IPlayerEntryRepository;
  settlementRepo: ISettlementRepository;
  auditRepo: IAuditRepository;
  announcementRepo: IAnnouncementRepository;
}

// Production Prisma-backed instance (Authoritative PostgreSQL)
const prismaVirtualCreditRepo = new PrismaVirtualCreditRepository();
const prismaLedgerRepo = new PrismaLedgerRepository();

const productionContainer: RepositoryContainer = {
  userRepo: new PrismaUserRepository(),
  refreshTokenRepo: new PrismaRefreshTokenRepository(),
  virtualCreditRepo: prismaVirtualCreditRepo,
  ledgerRepo: prismaLedgerRepo,
  gameRepo: new PrismaGameRepository(),
  configRepo: new PrismaGameConfigurationRepository(),
  roundRepo: new PrismaRoundRepository(),
  entryRepo: new PrismaPlayerEntryRepository(),
  settlementRepo: new PrismaSettlementRepository(),
  auditRepo: new PrismaAuditRepository(),
  announcementRepo: new PrismaAnnouncementRepository(),
};

// Authoritative production container (Default for both production and development)
let activeContainer: RepositoryContainer = productionContainer;
let hasCustomRepositories = false;

export async function initializeRepositoryContainer(): Promise<RepositoryContainer> {
  const isExplicitMemoryMode = process.env.REPOSITORY_MODE === 'memory';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && isExplicitMemoryMode) {
    throw new Error(
      'FATAL: REPOSITORY_MODE=memory is strictly forbidden in production. Production must use PostgreSQL / Prisma repositories.'
    );
  }

  if (hasCustomRepositories) {
    return activeContainer;
  }

  if (isExplicitMemoryMode) {
    activeContainer = createInMemoryRepositories();
    logger.warn('Running with explicit REPOSITORY_MODE=memory test adapter (non-production only)');
    return activeContainer;
  }

  // In non-production environments, check PostgreSQL reachability:
  // If PostgreSQL is offline/unreachable on localhost:5432, gracefully bind
  // the in-memory repository container so that the application, game catalog,
  // and operations function reliably without unhandled connection errors.
  if (!isProduction) {
    const isReachable = await isDatabaseReachable(true, 150);
    if (!isReachable) {
      activeContainer = createInMemoryRepositories();
      logger.warn(
        'PostgreSQL database server offline or unreachable in local environment. Initializing self-contained in-memory repositories.'
      );
      return activeContainer;
    }
  }

  // Authoritative PostgreSQL (Prisma) repository mode
  activeContainer = productionContainer;
  logger.info('Configured with authoritative PostgreSQL (Prisma) repositories');
  return activeContainer;
}

export function getRepositories(): RepositoryContainer {
  return activeContainer;
}

export function setRepositories(container: RepositoryContainer): void {
  activeContainer = container;
  hasCustomRepositories = true;
}

export function resetRepositoriesToProduction(): void {
  activeContainer = productionContainer;
  hasCustomRepositories = false;
}

export function createInMemoryRepositories(): RepositoryContainer {
  const userRepo = new InMemoryUserRepository();
  const refreshTokenRepo = new InMemoryRefreshTokenRepository();
  const virtualCreditRepo = new InMemoryVirtualCreditRepository();
  const ledgerRepo = new InMemoryLedgerRepository(virtualCreditRepo);
  userRepo.virtualCreditRepo = virtualCreditRepo;
  userRepo.ledgerRepo = ledgerRepo;

  const gameRepo = new InMemoryGameRepository();
  const configRepo = new InMemoryGameConfigurationRepository();
  const roundRepo = new InMemoryRoundRepository();
  const entryRepo = new InMemoryPlayerEntryRepository(virtualCreditRepo, ledgerRepo, roundRepo);
  const settlementRepo = new InMemorySettlementRepository(virtualCreditRepo, ledgerRepo, roundRepo, entryRepo);
  const auditRepo = new InMemoryAuditRepository();
  const announcementRepo = new InMemoryAnnouncementRepository();

  // Pre-seed demo player for seamless instant client interaction
  const demoUserId = 'usr-player-demo-main';
  const demoPasswordHash = '$argon2id$v=19$m=19456,p=1,t=2$1R6UIpk/n12zga1SmFzKYQ$aqyOMPoKESxNqmaGLRTNIo7+FXgxuA8fEta76pzwkD0';
  userRepo.users.set(demoUserId, {
    id: demoUserId,
    email: 'demo_player@fgp.local',
    username: 'demo_player',
    passwordHash: demoPasswordHash,
    role: 'PLAYER',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  virtualCreditRepo.accounts.set(`acc-${demoUserId}`, {
    id: `acc-${demoUserId}`,
    userId: demoUserId,
    balance: 10000.0,
    lockedBalance: 0,
    currency: 'DEMO_CREDIT',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Pre-seed catalog games and active default configurations
  for (const game of GAME_CATALOG) {
    gameRepo.games.set(game.id, {
      id: game.id,
      code: game.id,
      name: game.name,
      category: game.category,
      status: 'ACTIVE',
      minEntry: 10.0,
      maxEntry: 10000.0,
      defaultMultiplier: 1.98,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const cfgId = `cfg-${game.id}-v1`;
    configRepo.configs.set(cfgId, {
      id: cfgId,
      gameId: game.id,
      version: 1,
      status: 'ACTIVE',
      generalConfig: {
        name: game.name,
        category: game.category,
        enabled: true,
      },
      entryConfig: {
        minEntry: 10.0,
        maxEntry: 5000.0,
        defaultEntry: 50.0,
      },
      timingConfig: {
        roundDurationSeconds: 30,
        bettingLockWindowSeconds: 5,
        resultDeclarationDelaySeconds: 3,
        settlementDelaySeconds: 2,
      },
      ruleConfig: {
        maxNumber: 9,
        deckCount: 6,
        mineCount: 3,
        provablyFair: true,
      },
      rewardConfig: {
        houseEdge: 0.03,
        multipliers: {
          STANDARD: 1.98,
          RED: 1.98,
          GREEN: 1.98,
          VIOLET: 4.5,
        },
      },
      displayConfig: {
        theme: 'dark',
      },
      operationalConfig: {
        maxConcurrentRounds: 1,
        autoRestartRound: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Pre-seed initial announcement
  announcementRepo.announcements.set('ann-welcome', {
    id: 'ann-welcome',
    title: 'Welcome to FGP Platform Phase 03',
    content: 'All games authoritative with virtual demo credits.',
    priority: 1,
    isActive: true,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    userRepo,
    refreshTokenRepo,
    virtualCreditRepo,
    ledgerRepo,
    gameRepo,
    configRepo,
    roundRepo,
    entryRepo,
    settlementRepo,
    auditRepo,
    announcementRepo,
  };
}
