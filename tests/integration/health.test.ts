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

  it('GET /ready should return 200 ready when PostgreSQL is reachable and all 18 engines are registered', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.status).toBe('ready');
    expect(json.subsystems.database.connected).toBe(true);
    expect(json.subsystems.gameEngines.registered).toBe(18);
    expect(json.subsystems.gameEngines.ready).toBe(true);
    await app.close();
  });

  it('GET /ready should return 503 unready when PostgreSQL is unreachable', async () => {
    // Point to unreachable database host/port
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54399/unreachable_db?connect_timeout=1';

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

    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });
});
