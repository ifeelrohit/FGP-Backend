// ==============================================================================
// FGP-Backend Strongly Typed Environment Configuration
// Validated with Zod at startup. Fails fast if required variables are missing or invalid.
// Never exposes secrets.
// ==============================================================================

import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env if present
dotenv.config();

export const DEV_FALLBACK_JWT_ACCESS_SECRET =
  'fgp_development_jwt_access_secret_key_change_in_production_min_32_chars';
export const DEV_FALLBACK_JWT_REFRESH_SECRET =
  'fgp_development_jwt_refresh_secret_key_change_in_production_min_32_chars';

export const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.number().default(3000),

    DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/fgp_backend?schema=public'),

    JWT_ACCESS_SECRET: z
      .string()
      .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters')
      .default(DEV_FALLBACK_JWT_ACCESS_SECRET),
    JWT_REFRESH_SECRET: z
      .string()
      .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters')
      .default(DEV_FALLBACK_JWT_REFRESH_SECRET),

    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    CORS_ORIGIN: z.string().default('*'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DEFAULT_DEMO_CREDITS: z.coerce.number().default(10000),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      // 1. Production Access Secret Validation
      if (!data.JWT_ACCESS_SECRET || data.JWT_ACCESS_SECRET === DEV_FALLBACK_JWT_ACCESS_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_ACCESS_SECRET'],
          message: 'In production, JWT_ACCESS_SECRET must be explicitly supplied and cannot use the development fallback value',
        });
      } else if (data.JWT_ACCESS_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_ACCESS_SECRET'],
          message: 'In production, JWT_ACCESS_SECRET must be at least 32 characters',
        });
      }

      // 2. Production Refresh Secret Validation
      if (!data.JWT_REFRESH_SECRET || data.JWT_REFRESH_SECRET === DEV_FALLBACK_JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message: 'In production, JWT_REFRESH_SECRET must be explicitly supplied and cannot use the development fallback value',
        });
      } else if (data.JWT_REFRESH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message: 'In production, JWT_REFRESH_SECRET must be at least 32 characters',
        });
      }
    }
  });

export type AppConfig = z.infer<typeof ConfigSchema>;

let parsedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (parsedConfig) return parsedConfig;

  // Platform constraint: Port 3000 is hardcoded by infrastructure reverse proxy.
  // Never override with container-level PORT environment variables.
  const envToParse = {
    ...process.env,
    PORT: 3000,
  };

  const result = ConfigSchema.safeParse(envToParse);

  if (!result.success) {
    const errorDetails = result.error.format();
    console.error('CRITICAL: Environment configuration validation failed:');
    console.error(JSON.stringify(errorDetails, null, 2));
    throw new Error('Invalid environment configuration. See startup logs.');
  }

  parsedConfig = result.data;
  return parsedConfig;
}

export const config = loadConfig();
