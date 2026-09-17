// ==============================================================================
// FGP-Backend Prisma Database Infrastructure
// Connection checking, resilience, and lifecycle management
// ==============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../logging/logger.ts';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    prismaInstance.$on('error' as never, (e: unknown) => {
      logger.error({ err: e }, 'Prisma database client encountered an error');
    });
  }
  return prismaInstance;
}

export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const client = getPrismaClient();
    // Execute low-overhead query to verify connection
    await client.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return { connected: true, latencyMs };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    logger.warn({ error: errorMessage }, 'Database connection check failed');
    return { connected: false, error: errorMessage };
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    logger.info('Database client disconnected gracefully');
  }
}
