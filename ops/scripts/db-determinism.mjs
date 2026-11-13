#!/usr/bin/env node
/**
 * `pnpm db:determinism` — ADU-CON-02 v3.0 section 16:
 * "migrations applied twice to empty DBs, schema dumps diffed".
 *
 * Catches a migration whose EFFECT on the schema is not reproducible: an
 * ordering that depends on the clock, a name derived from a sequence, anything
 * that makes two clean environments diverge. Every environment converging on the
 * same schema is the entire premise of a migration runner, and it is not true by
 * construction — it is true until someone writes `now()` into a DDL default.
 *
 * ONE TRAP, RECORDED SO IT IS NOT REDISCOVERED. pg_dump 17 emits a per-run
 * random token on `\restrict` / `\unrestrict` lines. A naive `diff` of two dumps
 * therefore ALWAYS reports a difference, on any schema, forever — a check that
 * fails on correct input teaches people to ignore it. Lines beginning with a
 * backslash are psql meta-commands rather than schema, and are excluded.
 *
 * A DESTRUCTIVE SCRIPT ASSERTS ITS ENVIRONMENT (T9 S3.3, D-133) AND ITS TARGET
 * (WO-INFRA-015A). It DROPs and CREATEs databases with `docker exec`, so the
 * container is never assumed: ADULIS_PG_CONTAINER must name it (test-db.sh env
 * exports it; CI passes its service container), and lib/disposable-db.mjs must
 * prove it is the disposable server DATABASE_URL_MIGRATE reaches before the
 * first statement. There used to be a default container name, and it was the
 * persistent development server's.
 *
 * No entry-point test on purpose: this file always runs, and the logic it runs
 * is the tested lib/determinism.mjs.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { runDeterminism } from './lib/determinism.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let signal = null;
for (const sig of ['SIGINT', 'SIGTERM'])
  process.on(sig, () => {
    if (!signal) console.error(`\n${sig}: stopping after the current step; the scratch databases are dropped first`);
    signal ??= sig;
  });

process.exitCode = await runDeterminism({
  env: process.env,
  docker: (args) => spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }),
  migrate: (url) =>
    spawnSync(
      process.execPath,
      ['node_modules/node-pg-migrate/bin/node-pg-migrate.js', '-d', 'DETERMINISM_URL', '-m', 'db/migrations', '-j', 'sql', 'up'],
      { cwd: root, encoding: 'utf8', env: { ...process.env, DETERMINISM_URL: url } },
    ),
  Client: pg.Client,
  interrupted: () => signal,
  suffix: () => randomBytes(4).toString('hex'),
  out: (l) => console.log(l),
  err: (l) => console.error(l),
});
