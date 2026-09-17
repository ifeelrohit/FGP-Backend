import { describe, it, expect } from 'vitest';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../../src/shared/utils/jwt.ts';

describe('JWT Token Utilities', () => {
  const mockSecret = 'test_secret_key_with_at_least_32_characters_1234';
  const mockUser = {
    id: 'usr-1234-uuid',
    email: 'player@example.com',
    username: 'TestPlayer',
    role: 'PLAYER' as const,
  };

  it('should issue valid access token with correct payload claims', () => {
    const token = generateAccessToken(mockUser, mockSecret, '1h');
    const decoded = verifyToken(token, mockSecret, 'access');

    expect(decoded.userId).toBe(mockUser.id);
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.username).toBe(mockUser.username);
    expect(decoded.role).toBe('PLAYER');
    expect(decoded.type).toBe('access');
  });

  it('should issue and verify refresh token', () => {
    const token = generateRefreshToken(mockUser, mockSecret, '7d');
    const decoded = verifyToken(token, mockSecret, 'refresh');

    expect(decoded.userId).toBe(mockUser.id);
    expect(decoded.type).toBe('refresh');
  });

  it('should reject mismatched expected token type', () => {
    const token = generateAccessToken(mockUser, mockSecret, '1h');
    expect(() => verifyToken(token, mockSecret, 'refresh')).toThrow();
  });
});
