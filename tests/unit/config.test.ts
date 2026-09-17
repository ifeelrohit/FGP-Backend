import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/app/config.ts';

describe('Environment Configuration', () => {
  it('should load default configuration values safely', () => {
    const config = loadConfig();
    expect(typeof config.PORT).toBe('number');
    expect(config.PORT).toBeGreaterThanOrEqual(1024);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(config.DEFAULT_DEMO_CREDITS).toBe(10000);
    expect(config.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(16);
  });
});
