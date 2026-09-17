// ==============================================================================
// FGP-Backend Structured Logging (Pino)
// Strictly scrubs sensitive tokens, passwords, and secrets
// ==============================================================================

import pino from 'pino';
import { config } from '../../app/config.ts';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'token',
  'tokenHash',
  '*.password',
  '*.accessToken',
  '*.refreshToken',
];

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createChildLogger(requestId: string, moduleName?: string) {
  return logger.child({
    requestId,
    ...(moduleName ? { module: moduleName } : {}),
  });
}
