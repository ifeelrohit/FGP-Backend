// ==============================================================================
// FGP-Backend HTTP Server Entry Point & Process Lifecycle
// Host: 0.0.0.0, Port: 3000, graceful signal handling (SIGTERM, SIGINT)
// ==============================================================================

import { buildApp } from './app.ts';
import { config } from './config.ts';
import { logger } from '../infrastructure/logging/logger.ts';
import { disconnectDatabase } from '../infrastructure/database/prisma.ts';

export async function startServer(): Promise<void> {
  try {
    const app = await buildApp();

    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(
      {
        port: config.PORT,
        host: config.HOST,
        address,
        nodeEnv: config.NODE_ENV,
      },
      'FGP Authoritative Backend server running successfully'
    );

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received termination signal. Commencing graceful shutdown...');
      try {
        await app.close();
        await disconnectDatabase();
        logger.info('FGP-Backend shutdown completed cleanly');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start FGP backend server');
    process.exit(1);
  }
}
