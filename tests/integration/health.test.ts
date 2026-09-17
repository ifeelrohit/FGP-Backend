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

  it('GET /ready should return subsystems health report', async () => {
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
  });
});
