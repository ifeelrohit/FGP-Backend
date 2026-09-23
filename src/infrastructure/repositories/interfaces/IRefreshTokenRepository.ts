// ==============================================================================
// IRefreshTokenRepository Interface
// Authoritative persistence contract for hashed refresh tokens & revocation
// ==============================================================================

export interface RefreshTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface CreateRefreshTokenDto {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface IRefreshTokenRepository {
  create(dto: CreateRefreshTokenDto): Promise<RefreshTokenEntity>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null>;
  revokeByTokenHash(tokenHash: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<void>;
}
