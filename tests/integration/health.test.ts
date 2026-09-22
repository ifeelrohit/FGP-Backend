import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app/app.ts';

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

  it('GET /ready should return 503 unready when PostgreSQL is unreachable', async () => {
    const originalMode = process.env.REPOSITORY_MODE;
    delete process.env.REPOSITORY_MODE;

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    // When DB is unreachable on localhost:5432, /ready MUST return 503
    expect(response.statusCode).toBe(503);
    const json = response.json();
    expect(json.status).toBe('unready');
    expect(json.subsystems.database.connected).toBe(false);
    expect(json.subsystems.gameEngines.registered).toBe(18);
    await app.close();

    if (originalMode) {
      process.env.REPOSITORY_MODE = originalMode;
    }
  });

  it('GET /ready should return 200 ready when running with explicit memory adapter in non-production', async () => {
    process.env.REPOSITORY_MODE = 'memory';

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.status).toBe('ready');
    expect(json.subsystems.gameEngines.registered).toBe(18);
    await app.close();

    delete process.env.REPOSITORY_MODE;
  });
});
