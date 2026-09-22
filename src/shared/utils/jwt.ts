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
