import { z } from 'zod';

/**
 * Environment validation (ARC-BE-02). Each process parses ONLY what it uses and refuses to start on anything
 * invalid. Error messages name the variable and the rule, never the value: a URL carries a password.
 */

const pgUrl = z.url().refine((u) => /^postgres(ql)?:\/\//.test(u), 'must be a postgres:// URL');
const valkeyUrl = z.url().refine((u) => /^rediss?:\/\//.test(u), 'must be a redis:// or rediss:// URL');
const origin = z.url().refine((u) => new URL(u).origin === u, 'must be a bare origin, scheme://host[:port]');
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const base = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug']).default('info'),
  RELEASE: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/).default('unversioned'),
  SHUTDOWN_GRACE_MS: int(1_000, 60_000).default(10_000),
});

export const apiEnvSchema = base
  .extend({
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: int(1, 65_535).default(3000),
    DATABASE_URL: pgUrl,
    CACHE_VALKEY_URL: valkeyUrl,
    CONSOLE_ORIGIN: origin,
    OPERATOR_ORIGIN: origin.optional(),
    // Accept an X-Request-Id from a trusted gateway (OBS-01 S13). Off unless the deployment says so.
    TRUST_GATEWAY_REQUEST_ID: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  })
  .superRefine((e, ctx) => {
    const origins = [e.CONSOLE_ORIGIN, e.OPERATOR_ORIGIN].filter((o): o is string => o !== undefined);
    if (e.OPERATOR_ORIGIN !== undefined && e.OPERATOR_ORIGIN === e.CONSOLE_ORIGIN) {
      ctx.addIssue({ code: 'custom', path: ['OPERATOR_ORIGIN'], message: 'must differ from CONSOLE_ORIGIN (separate privileged origin)' });
    }
    if (e.NODE_ENV === 'production' && origins.some((o) => !o.startsWith('https://'))) {
      ctx.addIssue({ code: 'custom', path: ['CONSOLE_ORIGIN'], message: 'origins must be https in production' });
    }
  });

export const workerEnvSchema = base.extend({
  DATABASE_URL: pgUrl,
  QUEUE_VALKEY_URL: valkeyUrl,
  RELAY_BATCH_SIZE: int(1, 500).default(50),
  RELAY_INTERVAL_MS: int(50, 60_000).default(1_000),
  RELAY_LEASE_MS: int(1_000, 300_000).default(30_000),
  WORKER_CONCURRENCY: int(1, 32).default(1),
  HEALTH_LOG_INTERVAL_MS: int(5_000, 3_600_000).default(60_000),
  // reconcile_outbox (EVT-01 S23): how often, how stale before a delivery is examined, how many per pass, and how
  // many rematerialisations before a delivery becomes a dead letter.
  RECONCILE_INTERVAL_MS: int(1_000, 3_600_000).default(30_000),
  RECONCILE_STALE_MS: int(10_000, 86_400_000).default(300_000),
  RECONCILE_BATCH_SIZE: int(1, 1_000).default(100),
  RECONCILE_MAX_ATTEMPTS: int(1, 25).default(5),
});

export const migrateEnvSchema = z.object({ DATABASE_URL_MIGRATE: pgUrl });

export const bootstrapEnvSchema = z.object({
  DATABASE_URL_BOOTSTRAP: pgUrl,
  ADULIS_DB_MIGRATOR_PASSWORD: z.string().min(12),
  ADULIS_DB_API_PASSWORD: z.string().min(12),
  ADULIS_DB_WORKER_PASSWORD: z.string().min(12),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadEnv<S extends z.ZodType>(schema: S, source: NodeJS.ProcessEnv = process.env): z.infer<S> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`invalid environment: ${issues}`);
  }
  return parsed.data;
}
