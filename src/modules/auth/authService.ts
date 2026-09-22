// ==============================================================================
// FGP-Backend Authentication Service
// Argon2 password hashing, JWT access & refresh token rotation, persistent DB revocation
// ==============================================================================

import crypto from 'node:crypto';
import { userService } from '../users/userService.ts';
import { hashPassword, verifyPassword } from '../../shared/utils/hash.ts';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../../shared/utils/jwt.ts';
import { getRepositories } from '../../infrastructure/repositories/index.ts';
import { IRefreshTokenRepository } from '../../infrastructure/repositories/interfaces/IRefreshTokenRepository.ts';
import { UserEntity } from '../../infrastructure/repositories/interfaces/IUserRepository.ts';
import {
  AuthenticationError,
  ConflictError,
} from '../../shared/errors/index.ts';
import { config } from '../../app/config.ts';
import { UserRole } from '../../shared/types/index.ts';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  };
}

export class AuthService {
  private get tokenRepo(): IRefreshTokenRepository {
    return getRepositories().refreshTokenRepo;
  }

  public async register(data: {
    email: string;
    username: string;
    password: string;
    role?: UserRole;
  }): Promise<AuthTokens> {
    const existingEmail = await userService.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError('A user with this email address already exists');
    }

    const existingUsername = await userService.findByUsername(data.username);
    if (existingUsername) {
      throw new ConflictError('This username is already taken');
    }

    const passwordHash = await hashPassword(data.password);
    const user = await userService.createUser({
      email: data.email,
      username: data.username,
      passwordHash,
      role: data.role || 'PLAYER',
    });

    return this.createTokensForUser(user);
  }

  public async login(
    loginId: string,
    plainPassword: string,
    context?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthTokens> {
    const user = await userService.findByLogin(loginId);
    if (!user) {
      throw new AuthenticationError('Invalid email/username or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('Your account is inactive or suspended');
    }

    const passwordValid = await verifyPassword(plainPassword, user.passwordHash);
    if (!passwordValid) {
      throw new AuthenticationError('Invalid email/username or password');
    }

    await userService.updateLastLogin(user.id);
    return this.createTokensForUser(user, context);
  }

  public async refreshTokens(rawRefreshToken: string): Promise<AuthTokens> {
    const payload = verifyToken(rawRefreshToken, config.JWT_REFRESH_SECRET, 'refresh');

    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const storedToken = await this.tokenRepo.findByTokenHash(tokenHash);

    if (!storedToken) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    if (storedToken.revokedAt) {
      throw new AuthenticationError('Refresh token has been revoked');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new AuthenticationError('Refresh token has expired');
    }

    const user = await userService.findById(payload.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new AuthenticationError('User no longer active or does not exist');
    }

    // Revoke old refresh token (token rotation pattern)
    await this.tokenRepo.revokeByTokenHash(tokenHash);

    // Issue and persist new refresh token
    return this.createTokensForUser(user);
  }

  public async logout(rawRefreshToken: string): Promise<void> {
    try {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      await this.tokenRepo.revokeByTokenHash(tokenHash);
    } catch {
      // Graceful no-op on malformed tokens
    }
  }

  public async verifyAccessToken(token: string): Promise<UserEntity> {
    const payload = verifyToken(token, config.JWT_ACCESS_SECRET, 'access');
    const user = await userService.findById(payload.userId);

    if (!user || user.status !== 'ACTIVE') {
      throw new AuthenticationError('User is not authorized or is inactive');
    }

    return user;
  }

  private async createTokensForUser(
    user: UserEntity,
    context?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthTokens> {
    const accessToken = generateAccessToken(user, config.JWT_ACCESS_SECRET, config.JWT_ACCESS_EXPIRES_IN);
    const refreshToken = generateRefreshToken(user, config.JWT_REFRESH_SECRET, config.JWT_REFRESH_EXPIRES_IN);

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.tokenRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    };
  }
}

export const authService = new AuthService();
