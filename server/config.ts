import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().default('dev_insecure_session_secret_at_least_32_chars_long'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  STORAGE_DIR: z.string().default(path.resolve('uploads')),
  DATA_DIR: z.string().default(path.resolve('data')),
  TRUSTED_PROXY: z.string().default('loopback'),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (!data.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DATABASE_URL is required in production',
        path: ['DATABASE_URL'],
      });
    }
    if (!data.SESSION_SECRET || data.SESSION_SECRET.length < 32 || data.SESSION_SECRET.includes('dev_insecure')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SESSION_SECRET must be set to a secure string of at least 32 characters in production',
        path: ['SESSION_SECRET'],
      });
    }
  }
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(overrides: Partial<Record<string, unknown>> = {}): AppConfig {
  const envData = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    HOST: process.env.HOST,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    STORAGE_DIR: process.env.STORAGE_DIR,
    DATA_DIR: process.env.DATA_DIR,
    TRUSTED_PROXY: process.env.TRUSTED_PROXY,
    ...overrides,
  };

  const result = configSchema.safeParse(envData);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid application configuration: ${issues}`);
  }

  return result.data;
}

export const config = loadConfig();

