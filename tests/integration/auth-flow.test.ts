import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { buildApp } from '../../src/app/app.ts';
import {
  resetRepositoriesToProduction,
  initializeRepositoryContainer,
  getRepositories,
} from '../../src/infrastructure/repositories/index.ts';
import { userService } from '../../src/modules/users/userService.ts';
import { config } from '../../src/app/config.ts';
import { parseDurationMs, verifyToken } from '../../src/shared/utils/jwt.ts';

describe('Integration: Authentication & User Flow', () => {
  beforeEach(async () => {
    resetRepositoriesToProduction();
    await initializeRepositoryContainer();
  });

  it('should register a player, log in, and access protected /me', async () => {
    const app = await buildApp();
    const testEmail = `player_${Date.now()}_1@example.com`;
    const testUser = `player_${Date.now().toString(36)}_1`;
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
    expect(regJson.data.user.role).toBe('PLAYER');

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

  it('should strictly reject public registration attempts with administrative roles', async () => {
    const app = await buildApp();

    const rolesToTest = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'CONFIGURATION_ADMIN', 'VIEWER'];
    for (const role of rolesToTest) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: `attacker_${role.toLowerCase()}@example.com`,
          username: `attacker_${role.toLowerCase()}`,
          password: 'StrongPass1234!',
          role,
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    }

    await app.close();
  });

  it('should reject duplicate email and duplicate username registrations', async () => {
    const app = await buildApp();
    const testEmail = `duptest_${Date.now()}@example.com`;
    const testUser = `duptest_${Date.now().toString(36)}`;
    const testPass = 'StrongPass1234!';

    // Register initial user
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: testEmail, username: testUser, password: testPass },
    });
    expect(res1.statusCode).toBe(201);

    // Duplicate email
    const resDupEmail = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: testEmail, username: `different_${Date.now()}`, password: testPass },
    });
    expect(resDupEmail.statusCode).toBe(409);
    expect(resDupEmail.json().error.message).toContain('email address already exists');

    // Duplicate username
    const resDupUser = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: `different_${Date.now()}@example.com`, username: testUser, password: testPass },
    });
    expect(resDupUser.statusCode).toBe(409);
    expect(resDupUser.json().error.message).toContain('username is already taken');

    await app.close();
  });

  it('should handle login status and credentials without information leaks', async () => {
    const app = await buildApp();
    const pass = 'CorrectPass1234!';
    const wrongPass = 'WrongPassword999!';

    // 1. ACTIVE user
    const activeEmail = `active_${Date.now()}@example.com`;
    const activeUser = `active_${Date.now().toString(36)}`;
    const regActive = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: activeEmail, username: activeUser, password: pass },
    });
    const activeUserId = regActive.json().data.user.id;

    // 2. SUSPENDED user
    const suspendedEmail = `susp_${Date.now()}@example.com`;
    const suspendedUser = `susp_${Date.now().toString(36)}`;
    const regSusp = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: suspendedEmail, username: suspendedUser, password: pass },
    });
    const suspUserId = regSusp.json().data.user.id;
    await userService.updateUserStatus(suspUserId, 'SUSPENDED');

    // 3. DISABLED user
    const disabledEmail = `dis_${Date.now()}@example.com`;
    const disabledUser = `dis_${Date.now().toString(36)}`;
    const regDis = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: disabledEmail, username: disabledUser, password: pass },
    });
    const disUserId = regDis.json().data.user.id;
    await userService.updateUserStatus(disUserId, 'DISABLED');

    // SCENARIO A: Invalid password + ACTIVE account -> Generic 401
    const resA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: activeEmail, password: wrongPass },
    });
    expect(resA.statusCode).toBe(401);
    expect(resA.json().error.message).toBe('Invalid email/username or password');

    // SCENARIO B: Invalid password + SUSPENDED account -> Identical Generic 401
    const resB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: suspendedEmail, password: wrongPass },
    });
    expect(resB.statusCode).toBe(401);
    expect(resB.json().error.message).toBe('Invalid email/username or password');

    // SCENARIO C: Invalid password + DISABLED account -> Identical Generic 401
    const resC = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: disabledEmail, password: wrongPass },
    });
    expect(resC.statusCode).toBe(401);
    expect(resC.json().error.message).toBe('Invalid email/username or password');

    // SCENARIO D: Non-existent account -> Identical Generic 401
    const resD = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: 'nonexistent@example.com', password: wrongPass },
    });
    expect(resD.statusCode).toBe(401);
    expect(resD.json().error.message).toBe('Invalid email/username or password');

    // SCENARIO E: Valid password + SUSPENDED account -> Inactive/Suspended 401
    const resE = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: suspendedEmail, password: pass },
    });
    expect(resE.statusCode).toBe(401);
    expect(resE.json().error.message).toBe('Your account is inactive or suspended');

    // SCENARIO F: Valid password + DISABLED account -> Inactive/Suspended 401
    const resF = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: disabledEmail, password: pass },
    });
    expect(resF.statusCode).toBe(401);
    expect(resF.json().error.message).toBe('Your account is inactive or suspended');

    // SCENARIO G: Valid password + ACTIVE account -> 200 Success
    const resG = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: activeEmail, password: pass },
    });
    expect(resG.statusCode).toBe(200);
    expect(resG.json().success).toBe(true);
    expect(resG.json().data.accessToken).toBeDefined();

    await app.close();
  });

  it('should enforce refresh token rotation and revoke all user tokens on reuse', async () => {
    const app = await buildApp();
    const email = `rotation_${Date.now()}@example.com`;
    const user = `rotation_${Date.now().toString(36)}`;
    const pass = 'StrongPass1234!';

    // 1. Register & Login -> creates Refresh Token A
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, username: user, password: pass },
    });
    expect(loginRes.statusCode).toBe(201);
    const tokenA = loginRes.json().data.refreshToken;
    expect(tokenA).toBeDefined();

    // 2. Refresh with Token A -> creates Token B and revokes Token A
    const refreshRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: tokenA },
    });
    expect(refreshRes1.statusCode).toBe(200);
    const tokenB = refreshRes1.json().data.refreshToken;
    expect(tokenB).toBeDefined();
    expect(tokenB).not.toBe(tokenA);

    // 3. Attempt to reuse already-revoked Token A -> Must fail with 401
    const reuseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: tokenA },
    });
    expect(reuseRes.statusCode).toBe(401);
    expect(reuseRes.json().error.message).toBe('Refresh token has been revoked');

    // 4. Because reuse was detected, Token B (and all other active tokens for that user) must now be revoked
    const refreshRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: tokenB },
    });
    expect(refreshRes2.statusCode).toBe(401);
    expect(refreshRes2.json().error.message).toBe('Refresh token has been revoked');

    await app.close();
  });

  it('should revoke refresh token upon logout', async () => {
    const app = await buildApp();
    const email = `logout_${Date.now()}@example.com`;
    const user = `logout_${Date.now().toString(36)}`;
    const pass = 'StrongPass1234!';

    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, username: user, password: pass },
    });
    const refreshToken = reg.json().data.refreshToken;

    // Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().data.loggedOut).toBe(true);

    // Attempt to refresh with logged-out token
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(401);

    await app.close();
  });

  it('should maintain consistent refresh token expiry between JWT claim and database', async () => {
    const app = await buildApp();
    const email = `expiry_${Date.now()}@example.com`;
    const user = `expiry_${Date.now().toString(36)}`;
    const pass = 'StrongPass1234!';

    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, username: user, password: pass },
    });
    const refreshToken = reg.json().data.refreshToken;

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenRepo = getRepositories().refreshTokenRepo;
    const stored = await tokenRepo.findByTokenHash(tokenHash);
    expect(stored).not.toBeNull();

    // Verify database expiresAt matches configured lifetime
    const expectedLifetimeMs = parseDurationMs(config.JWT_REFRESH_EXPIRES_IN);
    const expectedExpiryTime = Date.now() + expectedLifetimeMs;
    const diffMs = Math.abs(stored!.expiresAt.getTime() - expectedExpiryTime);
    expect(diffMs).toBeLessThan(5000);

    // Verify JWT exp claim matches database expiresAt within 2 seconds
    const decoded = verifyToken(refreshToken, config.JWT_REFRESH_SECRET, 'refresh');
    const jwtExpMs = (decoded as any).exp * 1000;
    expect(Math.abs(stored!.expiresAt.getTime() - jwtExpMs)).toBeLessThan(2000);

    await app.close();
  });

  it('should revoke all active refresh tokens and block access token when user is suspended or disabled', async () => {
    const app = await buildApp();
    const email = `status_revoke_${Date.now()}@example.com`;
    const user = `status_revoke_${Date.now().toString(36)}`;
    const pass = 'StrongPass1234!';

    // 1. Register & get tokens
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, username: user, password: pass },
    });
    const { accessToken, refreshToken, user: registeredUser } = reg.json().data;

    // 2. Access /me succeeds initially
    const me1 = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(me1.statusCode).toBe(200);

    // 3. Suspend user
    await userService.updateUserStatus(registeredUser.id, 'SUSPENDED');

    // 4. Access /me now fails even with unexpired access token
    const me2 = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(me2.statusCode).toBe(401);
    expect(me2.json().error.message).toContain('inactive');

    // 5. Attempting to refresh tokens fails because refresh tokens were revoked
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(401);

    await app.close();
  });

  it('should guarantee atomic status transition and revoke active refresh tokens during concurrent refresh requests', async () => {
    const app = await buildApp();
    const email = `concur_status_${Date.now()}@example.com`;
    const user = `concur_status_${Date.now().toString(36)}`;
    const pass = 'StrongPass1234!';

    // 1. Register
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, username: user, password: pass },
    });
    const registeredUser = reg.json().data.user;
    const token1 = reg.json().data.refreshToken;

    // 2. Obtain additional active refresh tokens (simulating multiple client sessions)
    const login2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: email, password: pass },
    });
    const token2 = login2.json().data.refreshToken;

    const login3 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: email, password: pass },
    });
    const token3 = login3.json().data.refreshToken;

    // 3. Fire concurrent operations: user suspension alongside multiple refresh attempts
    const operations = [
      userService.updateUserStatus(registeredUser.id, 'SUSPENDED'),
      app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refreshToken: token1 } }),
      app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refreshToken: token2 } }),
      app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refreshToken: token3 } }),
    ];

    const results = await Promise.all(operations);
    const updatedUser = results[0] as any;
    expect(updatedUser.status).toBe('SUSPENDED');

    // 4. Verify that subsequent refresh with any prior token is rejected
    for (const t of [token1, token2, token3]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: t },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().success).toBe(false);
    }

    // 5. Verify that login for suspended user fails with 401
    const postSuspendLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: email, password: pass },
    });
    expect(postSuspendLogin.statusCode).toBe(401);
    expect(postSuspendLogin.json().error.message).toContain('inactive or suspended');

    await app.close();
  });
});
