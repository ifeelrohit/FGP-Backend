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

  describe('Production JWT Secret Validation', () => {
    const validSecret = 'valid_production_secret_key_minimum_32_characters_long_12345';

    it('should reject production when access secret is missing (uses fallback)', () => {
      const parsed = ConfigSchema.safeParse({
        NODE_ENV: 'production',
        JWT_REFRESH_SECRET: validSecret,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message);
        expect(issues.some((m) => m.includes('JWT_ACCESS_SECRET'))).toBe(true);
      }
    });

    it('should reject production when refresh secret is missing (uses fallback)', () => {
      const parsed = ConfigSchema.safeParse({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: validSecret,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message);
        expect(issues.some((m) => m.includes('JWT_REFRESH_SECRET'))).toBe(true);
      }
    });

    it('should reject production when development fallback secret is explicitly passed', () => {
      const parsed = ConfigSchema.safeParse({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'fgp_development_jwt_access_secret_key_change_in_production_min_32_chars',
        JWT_REFRESH_SECRET: validSecret,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message);
        expect(issues.some((m) => m.includes('development fallback'))).toBe(true);
      }
    });

    it('should reject production when secret is shorter than 32 characters', () => {
      const parsed = ConfigSchema.safeParse({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'sixteen_chars_ok',
        JWT_REFRESH_SECRET: validSecret,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message);
        expect(issues.some((m) => m.includes('at least 32 characters'))).toBe(true);
      }
    });

    it('should accept production when both secrets are explicitly supplied and >= 32 chars', () => {
      const parsed = ConfigSchema.safeParse({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'prod_custom_access_secret_min_32_chars_12345',
        JWT_REFRESH_SECRET: 'prod_custom_refresh_secret_min_32_chars_12345',
      });
      expect(parsed.success).toBe(true);
    });

    it('should allow development and test environments to use fallback secrets', () => {
      const devParsed = ConfigSchema.safeParse({ NODE_ENV: 'development' });
      expect(devParsed.success).toBe(true);

      const testParsed = ConfigSchema.safeParse({ NODE_ENV: 'test' });
      expect(testParsed.success).toBe(true);
    });
  });
});

