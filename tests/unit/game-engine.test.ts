import { describe, it, expect } from 'vitest';
import { engineRegistry } from '../../src/game-engine/engineRegistry.ts';
import { VALID_GAME_IDS } from '../../src/shared/constants/games.ts';

describe('Authoritative Game Engine Registry & Resolution', () => {
  it('should have exactly 18 registered authoritative game engines', () => {
    const engines = engineRegistry.getAllEngines();
    expect(engines.length).toBe(18);

    for (const gameId of VALID_GAME_IDS) {
      const engine = engineRegistry.get(gameId);
      expect(engine).toBeDefined();
      expect(engine?.gameId).toBe(gameId);
    }
  });

  it('Color Prediction engine should resolve server-authoritative outcome', () => {
    const engine = engineRegistry.get('color_pred')!;
    const res = engine.resolveResult({
      userId: 'usr-1',
      gameId: 'color_pred',
      entryAmount: 100,
      config: {},
      payload: { color: 'RED' },
    });

    expect(res.gameId).toBe('color_pred');
    expect(res.outcome.luckyNumber).toBeDefined();
    expect(res.outcome.winningColor).toMatch(/^(RED|GREEN|VIOLET)$/);
    expect(typeof res.won).toBe('boolean');
    if (res.won) {
      expect(res.rewardAmount).toBeGreaterThan(0);
    } else {
      expect(res.rewardAmount).toBe(0);
    }
  });

  it('Crash engine should generate authoritative crash point >= 1.00', () => {
    const engine = engineRegistry.get('crash') as any;
    const serverSeed = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const crashPoint = engine.generateAuthoritativeCrashPoint(serverSeed);
    expect(crashPoint).toBeGreaterThanOrEqual(1.0);

    const res = engine.resolveResult(
      {
        userId: 'usr-1',
        gameId: 'crash',
        entryAmount: 50,
        config: {},
        payload: { autoCashoutMultiplier: 1.5 },
      },
      {
        crashPoint,
        serverSeed,
      }
    );

    expect(res.gameId).toBe('crash');
    expect(Number(res.outcome.crashPoint)).toBeGreaterThanOrEqual(1.0);
    expect(res.outcome.serverSeedHash).toBeDefined();
  });

  it('Mines engine should resolve mine placements and hit detection', () => {
    const engine = engineRegistry.get('mines')!;
    const res = engine.resolveResult({
      userId: 'usr-1',
      gameId: 'mines',
      entryAmount: 50,
      config: {},
      payload: { mineCount: 3, tiles: [0, 1] },
    });

    expect(res.gameId).toBe('mines');
    expect(Array.isArray(res.outcome.mineIndices)).toBe(true);
    expect((res.outcome.mineIndices as number[]).length).toBe(3);
  });
});
