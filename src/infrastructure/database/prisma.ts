// ==============================================================================
// FGP-Backend Prisma Database Infrastructure
// Connection checking, resilience, and lifecycle management
// ==============================================================================

import net from 'node:net';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logging/logger.ts';

let prismaInstance: PrismaClient | null = null;
let cachedReachability: { reachable: boolean; timestamp: number } | null = null;
const CACHE_TTL_MS = 5000;

export async function isDatabaseReachable(forceRefresh = false, timeoutMs = 150): Promise<boolean> {
  const now = Date.now();
  if (!forceRefresh && cachedReachability && now - cachedReachability.timestamp < CACHE_TTL_MS) {
    return cachedReachability.reachable;
  }

  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fgp_backend?schema=public';
  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname || 'localhost';
    const port = parseInt(parsed.port || '5432', 10);

    const reachable = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.once('connect', () => {
        cleanup();
        resolve(true);
      });

      socket.once('timeout', () => {
        cleanup();
        resolve(false);
      });

      socket.once('error', () => {
        cleanup();
        resolve(false);
      });

      socket.connect(port, host);
    });

    cachedReachability = { reachable, timestamp: now };
    return reachable;
  } catch {
    cachedReachability = { reachable: false, timestamp: now };
    return false;
  }
}

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

export const prisma = getPrismaClient();

export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const reachable = await isDatabaseReachable(true);
  if (!reachable) {
    return {
      connected: false,
      error: 'PostgreSQL database server offline or unreachable',
    };
  }

  const start = Date.now();
  try {
    const client = getPrismaClient();
    // Execute low-overhead query to verify connection
    await client.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return { connected: true, latencyMs };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    logger.warn({ error: errorMessage }, 'Database connection query failed');
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
