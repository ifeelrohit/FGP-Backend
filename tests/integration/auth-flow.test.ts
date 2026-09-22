import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/app/app.ts';
import { setRepositories, createInMemoryRepositories } from '../../src/infrastructure/repositories/index.ts';

describe('Integration: Authentication & User Flow', () => {
  beforeEach(() => {
    setRepositories(createInMemoryRepositories());
  });

  it('should register a player, log in, and access protected /me', async () => {
    const app = await buildApp();
    const testEmail = `player_${Date.now()}@example.com`;
    const testUser = `player_${Date.now().toString(36)}`;
    const testPass = 'StrongPass1234!';

    // 1. Register
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: testEmail,
        username: testUser,
        password: testPass,
      },
    });

    expect(regRes.statusCode).toBe(201);
    const regJson = regRes.json();
    expect(regJson.success).toBe(true);
    expect(regJson.data.accessToken).toBeDefined();
    expect(regJson.data.user.email).toBe(testEmail);

    // 2. Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        login: testEmail,
        password: testPass,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginJson = loginRes.json();
    expect(loginJson.success).toBe(true);
    const accessToken = loginJson.data.accessToken;

    // 3. Access /api/v1/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const meJson = meRes.json();
    expect(meJson.data.user.email).toBe(testEmail);
    expect(meJson.data.user.role).toBe('PLAYER');

    // 4. Access without token should be 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
    });
    expect(unauthRes.statusCode).toBe(401);

    await app.close();
  });
});
