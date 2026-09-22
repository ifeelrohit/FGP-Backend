import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigSchema } from '../../src/app/config.ts';

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

  it('should validate LOG_LEVEL enum including silent and standard Pino levels', () => {
    const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
    for (const level of validLevels) {
      const parsed = ConfigSchema.safeParse({ LOG_LEVEL: level });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.LOG_LEVEL).toBe(level);
      }
    }

    const invalid = ConfigSchema.safeParse({ LOG_LEVEL: 'verbose' });
    expect(invalid.success).toBe(false);
  });

  it('should strictly reject insecure short JWT secrets', () => {
    const invalidSecret = ConfigSchema.safeParse({ JWT_ACCESS_SECRET: 'short' });
    expect(invalidSecret.success).toBe(false);
  });
});

