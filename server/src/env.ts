import { z } from 'zod';

const EnvZ = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (a Postgres connection string)'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters (use openssl rand -hex 32)'),
  PUBLIC_URL: z.string().url().optional(),
  ROSTER_MODE: z.enum(['tribute', 'original']).default('tribute'),
  FAST_NIGHT: z.string().optional(),
  TEST_SEED: z.coerce.number().int().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  TURN_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof EnvZ> & { fastNight: boolean; smtpEnabled: boolean; isProd: boolean };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = EnvZ.safeParse(source);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${lines}\nSee .env.example for every variable.`);
  }
  const e = r.data;
  if (e.NODE_ENV === 'production' && !e.PUBLIC_URL) throw new Error('Invalid environment:\n  - PUBLIC_URL is required in production');
  return {
    ...e,
    TEST_SEED: e.NODE_ENV === 'production' ? undefined : e.TEST_SEED,
    fastNight: e.FAST_NIGHT === '1',
    smtpEnabled: Boolean(e.SMTP_HOST && e.SMTP_PORT && e.MAIL_FROM),
    isProd: e.NODE_ENV === 'production',
  };
}
