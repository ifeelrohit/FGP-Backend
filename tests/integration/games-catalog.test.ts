import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app/app.ts';

describe('Integration: Games Catalog & Action Execution', () => {
  it('GET /api/v1/games should list exactly 18 platform games', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/games',
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.count).toBe(18);
    expect(json.data.games.length).toBe(18);

    // Verify categories
    const categories = new Set(json.data.games.map((g: { category: string }) => g.category));
    expect(categories.has('PREDICTION')).toBe(true);
    expect(categories.has('CASINO')).toBe(true);
    expect(categories.has('REAL_TIME')).toBe(true);
    expect(categories.has('MINI_GAME')).toBe(true);

    await app.close();
  });

  it('GET /api/v1/games/:gameId should return game details', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/games/color_pred',
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.game.id).toBe('color_pred');
    expect(json.data.game.category).toBe('PREDICTION');
    expect(json.data.game.status).toBe('ACTIVE');

    await app.close();
  });
});
