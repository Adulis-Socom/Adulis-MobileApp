import 'reflect-metadata';
import { createApp } from './app';
import { apiEnvSchema, loadEnv } from './config/env';
import { createPool } from './db/client';
import { assertReplacementTarget, TargetRefused } from './db/target-guard';
import { createLogger, errorFields } from './platform/logging';
import { RebuildableCache } from './platform/valkey';

/**
 * The API process entry (ARC-BE-02). Refuses to start on invalid configuration, a database that is not the
 * replacement lineage, or a superuser/BYPASSRLS role. SIGTERM: stop accepting, drain in-flight requests,
 * close PostgreSQL and Valkey, exit; a hard deadline stops a hung drain (DEPLOY-01 S28).
 */
async function main(): Promise<void> {
  const env = loadEnv(apiEnvSchema);
  const logger = createLogger({ service: 'adulis-api', level: env.LOG_LEVEL, release: env.RELEASE });
  try {
    const pool = createPool(env.DATABASE_URL, 'adulis-api', 10);
    pool.on('error', (err) => logger.error({ ...errorFields(err, env.NODE_ENV === 'production') }, 'idle database client error'));
    await assertReplacementTarget(pool, env.DATABASE_URL, { stage: 'runtime' });
    const cache = RebuildableCache.connect(env.CACHE_VALKEY_URL, logger);
    await cache.init();
    const app = await createApp({ env, logger, pool, cache });
    const stop = (): void => {
      setTimeout(() => process.exit(1), env.SHUTDOWN_GRACE_MS).unref(); // a hung drain still ends
      app.close().then(
        () => process.exit(0), // stopped accepting, drained in-flight requests, closed PostgreSQL and Valkey
        (err: unknown) => {
          logger.error({ ...errorFields(err, env.NODE_ENV === 'production') }, 'shutdown failed');
          process.exit(1);
        },
      );
    };
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    await app.listen({ host: env.HOST, port: env.PORT });
    logger.info({ module: 'main' }, 'api listening');
  } catch (err) {
    logger.fatal({ ...errorFields(err, env.NODE_ENV === 'production') }, err instanceof TargetRefused ? err.message : 'api cannot start');
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`api cannot start: ${err instanceof Error ? err.message : 'unknown'}\n`);
  process.exit(1);
});
