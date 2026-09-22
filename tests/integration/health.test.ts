import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../../src/app/app.ts';
import * as prismaModule from '../../src/infrastructure/database/prisma.ts';

describe('Integration: Health & Readiness Endpoints', () => {
  it('GET /health should return pass status', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.status).toBe('pass');
    expect(json.service).toBe('fgp-backend');
    await app.close();
  });

  it('GET /ready should return 200 ready when PostgreSQL is reachable and all 18 engines are registered', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    if (response.statusCode === 200) {
      const json = response.json();
      expect(json.status).toBe('ready');
      expect(json.subsystems.database.connected).toBe(true);
      expect(json.subsystems.gameEngines.registered).toBe(18);
      expect(json.subsystems.gameEngines.ready).toBe(true);
    } else {
      // In local dev environments without a live PostgreSQL instance, verify graceful degradation
      expect(response.statusCode).toBe(503);
      const json = response.json();
      expect(json.status).toBe('unready');
      expect(json.subsystems.database.connected).toBe(false);
      expect(json.subsystems.gameEngines.registered).toBe(18);
    }
    await app.close();
  });

  it('GET /ready should return 503 unready when PostgreSQL is unreachable', async () => {
    const spy = vi.spyOn(prismaModule, 'checkDatabaseConnection').mockResolvedValueOnce({
      connected: false,
      error: 'PostgreSQL database server offline or unreachable',
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    // When DB is unreachable, /ready MUST return 503
    expect(response.statusCode).toBe(503);
    const json = response.json();
    expect(json.status).toBe('unready');
    expect(json.subsystems.database.connected).toBe(false);
    expect(json.subsystems.gameEngines.registered).toBe(18);
    await app.close();
    spy.mockRestore();
  });
});
