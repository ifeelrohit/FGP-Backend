// ==============================================================================
// FGP-Backend Authoritative PostgreSQL Database Seeder
// Seeds default roles, users, credit accounts, 18 games, active configurations,
// announcements, and initial rounds.
// ==============================================================================

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { GAME_CATALOG } from '../src/shared/constants/games.ts';
import { engineRegistry } from '../src/game-engine/engineRegistry.ts';
import { CrashEngine } from '../src/game-engine/realtime/crashEngine.ts';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Commencing authoritative database seed...');

  // 1. Seed System Users with Argon2-hashed credentials
  console.log('👤 Seeding default administrative and player accounts...');
  const defaultPasswordHash = await argon2.hash('AdminPass123!', {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const playerPasswordHash = await argon2.hash('PlayerPass123!', {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const usersToSeed = [
    {
      id: 'usr-super-admin-01',
      email: 'superadmin@fgp.local',
      username: 'superadmin',
      passwordHash: defaultPasswordHash,
      role: 'SUPER_ADMIN' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'usr-ops-admin-01',
      email: 'opsadmin@fgp.local',
      username: 'opsadmin',
      passwordHash: defaultPasswordHash,
      role: 'OPERATIONS_ADMIN' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'usr-config-admin-01',
      email: 'configadmin@fgp.local',
      username: 'configadmin',
      passwordHash: defaultPasswordHash,
      role: 'CONFIGURATION_ADMIN' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'usr-player-demo-01',
      email: 'player1@fgp.local',
      username: 'player1',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'usr-player-demo-02',
      email: 'player2@fgp.local',
      username: 'player2',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'concurrent-test-player-001',
      email: 'concurrent-player@fgp.local',
      username: 'concurrent_player',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'test-player-001',
      email: 'test-player-001@fgp.local',
      username: 'test_player_001',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'test-player-crash-01',
      email: 'test-player-crash-01@fgp.local',
      username: 'test_player_crash_01',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'concurrent-player-1a',
      email: 'concurrent-player-1a@fgp.local',
      username: 'concurrent_player_1a',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'concurrent-player-1',
      email: 'concurrent-player-1@fgp.local',
      username: 'concurrent_player_1',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'concurrent-player-2',
      email: 'concurrent-player-2@fgp.local',
      username: 'concurrent_player_2',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'concurrent-player-3',
      email: 'concurrent-player-3@fgp.local',
      username: 'concurrent_player_3',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'concurrent-player-4',
      email: 'concurrent-player-4@fgp.local',
      username: 'concurrent_player_4',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'concurrent-player-5',
      email: 'concurrent-player-5@fgp.local',
      username: 'concurrent_player_5',
      passwordHash: playerPasswordHash,
      role: 'PLAYER' as const,
      status: 'ACTIVE' as const,
    },
  ];

  for (const u of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        username: u.username,
        role: u.role,
        status: u.status,
      },
      create: u,
    });

    // Seed Virtual Credit Account
    const account = await prisma.virtualCreditAccount.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        id: `acc-${user.id}`,
        userId: user.id,
        balance: 10000.0,
        lockedBalance: 0.0,
        currency: 'DEMO_CREDIT',
      },
    });

    // Record welcome bonus transaction
    const existingTx = await prisma.ledgerTransaction.findFirst({
      where: { idempotencyKey: `seed-welcome-${user.id}` },
    });

    if (!existingTx) {
      await prisma.ledgerTransaction.create({
        data: {
          accountId: account.id,
          type: 'CREDIT',
          amount: 10000.0,
          balanceBefore: 0.0,
          balanceAfter: 10000.0,
          referenceType: 'WELCOME_BONUS',
          referenceId: 'genesis',
          idempotencyKey: `seed-welcome-${user.id}`,
          metadata: { note: 'Initial simulated player balance' },
        },
      });
    }
  }

  // 2. Seed all 18 games into the authoritative games table
  console.log('🎮 Seeding 18 authoritative platform games & configurations...');
  for (const game of GAME_CATALOG) {
    await prisma.gameEntity.upsert({
      where: { id: game.id },
      update: {
        code: game.id,
        name: game.name,
        category: game.category,
        status: 'ACTIVE',
      },
      create: {
        id: game.id,
        code: game.id,
        name: game.name,
        category: game.category,
        status: 'ACTIVE',
      },
    });

    // 3. Seed active configuration with all 7 configuration blocks
    const configId = `cfg-${game.id}-v1`;
    const existingConfig = await prisma.gameConfiguration.findUnique({
      where: { id: configId },
    });

    if (!existingConfig) {
      await prisma.gameConfiguration.create({
        data: {
          id: configId,
          gameId: game.id,
          version: 1,
          status: 'ACTIVE',
          generalConfig: {
            name: game.name,
            category: game.category,
            enabled: true,
            maintenanceMode: false,
          },
          entryConfig: {
            minEntry: 10.0,
            maxEntry: 5000.0,
            defaultEntry: 50.0,
            allowedIncrements: [10, 20, 50, 100, 500, 1000],
          },
          timingConfig: {
            roundDurationSeconds: 30,
            bettingLockWindowSeconds: 5,
            resultDeclarationDelaySeconds: 3,
            settlementDelaySeconds: 2,
          },
          ruleConfig: {
            maxNumber: 9,
            maxRange: 100,
            deckCount: 6,
            boardSize: 25,
            mineCount: 3,
            provablyFair: true,
          },
          rewardConfig: {
            houseEdge: 0.03,
            multipliers: {
              VIOLET: 4.5,
              STANDARD: 1.98,
              RED: 1.98,
              GREEN: 1.98,
            },
            maxPayoutMultiplier: 250.0,
          },
          displayConfig: {
            theme: 'dark',
            animationSpeed: 'normal',
            soundEffects: true,
            hapticFeedback: false,
          },
          operationalConfig: {
            maxConcurrentRounds: 1,
            autoRestartRound: true,
            monitoringAlertThreshold: 0.85,
          },
          publishedBy: 'genesis-seeder',
          publishedAt: new Date(),
        },
      });
    }

    // 4. Seed initial OPEN round for each game
    const existingRound = await prisma.gameRound.findFirst({
      where: { gameId: game.id, status: 'OPEN' },
    });

    if (!existingRound) {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
      const configSnapshot = {
        version: 1,
        generalConfig: {
          name: game.name,
          category: game.category,
          enabled: true,
          maintenanceMode: false,
        },
        entryConfig: {
          minEntry: 10.0,
          maxEntry: 5000.0,
          defaultEntry: 50.0,
          allowedIncrements: [10, 20, 50, 100, 500, 1000],
        },
        timingConfig: {
          roundDurationSeconds: 30,
          bettingLockWindowSeconds: 5,
          resultDeclarationDelaySeconds: 3,
          settlementDelaySeconds: 2,
        },
        ruleConfig: {
          maxNumber: 9,
          maxRange: 100,
          deckCount: 6,
          boardSize: 25,
          mineCount: 3,
          provablyFair: true,
        },
        rewardConfig: {
          houseEdge: 0.03,
          multipliers: {
            VIOLET: 4.5,
            STANDARD: 1.98,
            RED: 1.98,
            GREEN: 1.98,
          },
          maxPayoutMultiplier: 250.0,
        },
      };

      let crashPoint: number | null = null;
      if (game.id === 'crash' || game.id === 'space_crash') {
        const engine = engineRegistry.get(game.id) as CrashEngine | undefined;
        if (engine && typeof engine.generateAuthoritativeCrashPoint === 'function') {
          crashPoint = engine.generateAuthoritativeCrashPoint(serverSeed, configSnapshot);
        }
      }

      await prisma.gameRound.create({
        data: {
          id: `rnd-${game.id}-init`,
          gameId: game.id,
          roundNumber: 1n,
          status: 'OPEN',
          configId,
          configSnapshot,
          serverSeedHash,
          serverSeed,
          crashPoint,
          openedAt: new Date(),
        },
      });
    }
  }

  // 5. Seed initial Announcements
  console.log('📢 Seeding initial system announcement...');
  await prisma.announcement.upsert({
    where: { id: 'ann-system-welcome' },
    update: {},
    create: {
      id: 'ann-system-welcome',
      title: 'Welcome to FGP Platform Phase 03',
      content:
        'Welcome to the authoritative Fantasy Gaming Platform! All games operate on virtual demo credits in an enterprise-grade modular architecture.',
      priority: 10,
      isActive: true,
      publishedAt: new Date(),
    },
  });

  console.log('✅ Database seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
