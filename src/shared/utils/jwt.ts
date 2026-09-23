// ==============================================================================
// FGP-Backend JWT Utilities
// Sign and verify access & refresh tokens.
// Never logs tokens. Payload contains only minimal required claims.
// ==============================================================================

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../errors/index.ts';
import { JWTPayload, UserRole } from '../types/index.ts';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Parses standard duration strings (e.g., '15m', '7d', '24h', '60s') into milliseconds.
 * Ensures persisted token expiration exactly matches JWT expiration configuration.
 */
export function parseDurationMs(duration: string | number): number {
  if (typeof duration === 'number') {
    return duration * 1000;
  }
  const match = duration.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) {
    throw new Error(`Invalid duration string: ${duration}`);
  }
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();
  switch (unit) {
    case 's':
    case 'sec':
    case 'secs':
    case 'second':
    case 'seconds':
      return value * 1000;
    case 'm':
    case 'min':
    case 'mins':
    case 'minute':
    case 'minutes':
      return value * 60 * 1000;
    case 'h':
    case 'hr':
    case 'hrs':
    case 'hour':
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'd':
    case 'day':
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    case 'w':
    case 'wk':
    case 'wks':
    case 'week':
    case 'weeks':
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'ms':
    case 'millisecond':
    case 'milliseconds':
      return value;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
}

export function generateAccessToken(
  user: { id: string; email: string; username: string; role: UserRole },
  secret: string,
  expiresIn: string = '15m'
): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    type: 'access',
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export function generateRefreshToken(
  user: { id: string; email: string; username: string; role: UserRole },
  secret: string,
  expiresIn: string = '7d'
): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    type: 'refresh',
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string, secret: string, expectedType?: 'access' | 'refresh'): JWTPayload {
  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    if (expectedType && decoded.type !== expectedType) {
      throw new AuthenticationError(`Invalid token type. Expected ${expectedType}, got ${decoded.type}`);
    }
    return decoded;
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError('Invalid or expired authentication token');
  }
}
