/**
 * check-environment.mjs -- what this environment can and cannot do, said out
 * loud (T23 Phase 5).
 *
 * THIS EXISTS BECAUSE OF ONE STEP. `core.operator_grant` has existed since
 * migration 05 with nothing granting from it, and it CANNOT be seeded: an
 * account is created by the ordinary phone-OTP path, so no migration can
 * reference one, and a grant is an audited decision about a person. Which
 * makes it the step that gets forgotten -- and its absence is SILENT. Nothing
 * errors. Identity verification, claim review and moderation simply queue
 * forever, because `verification.read_attestation` derives actor_role from a
 * table with no rows.
 *
 * A runbook line saying "do not forget this" is a rule that holds until the
 * week someone is busy. This is the same sentence, said by a command, against
 * the database that is actually there.
 *
 * EVERY FINDING NAMES WHAT IS BLOCKED, not what is missing. "0 operators" is a
 * fact nobody acts on; "no one can review an identity, so no seller can
 * publish" is the same fact with its consequence attached, and the consequence
 * is what makes someone fix it.
 *
 * IT PRINTS NO SECRET. Connection strings, keys and phone numbers never reach
 * this output -- it is meant to be pasted into a runbook log.
 *
 *   BLOCKER  the environment cannot do its job until this is fixed (exit 1)
 *   WARN     it works, but something a person expected is not true
 *   OK       checked, and true
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const connectionString = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
if (!connectionString) {
  console.error('FAIL  neither DATABASE_URL_MIGRATE nor DATABASE_URL is set.');
  process.exit(2);
}

const client = new pg.Client({ connectionString });
try {
  await client.connect();
} catch (err) {
  console.error(`FAIL  cannot connect: ${err.message}`);
  process.exit(2);
}

let blockers = 0;
let warnings = 0;
const ok = (m) => console.log(`  OK       ${m}`);
const warn = (m, why) => {
  warnings += 1;
  console.log(`  WARN     ${m}`);
  if (why) console.log(`           ${why}`);
};
const blocker = (m, why) => {
  blockers += 1;
  console.log(`  BLOCKER  ${m}`);
  if (why) console.log(`           ${why}`);
};

const one = async (sql, params = []) => (await client.query(sql, params)).rows[0];
const all = async (sql, params = []) => (await client.query(sql, params)).rows;

console.log('');
console.log('-- schema ---------------------------------------------------------');

const mig = await one(`SELECT count(*)::int AS n FROM public.pgmigrations`).catch(() => null);
if (!mig) {
  blocker('no migrations table: this database has never been migrated', 'Run: pnpm db:migrate');
} else {
  ok(`${mig.n} migrations applied`);
}

/*
 * THE LIST IS READ FROM THE FILE THAT OWNS IT, not transcribed.
 *
 * The first version of this check typed four names from memory and one of them
 * -- `citext` -- is not among them. It reported a BLOCKER against a healthy
 * database on its first run. A checklist that invents an item is worse than
 * no checklist: the next person either fixes something that was never wrong or
 * learns to skim the output.
 */
const required = [
  ...readFileSync(new URL('../../db/init/00-extensions.sql', import.meta.url), 'utf8').matchAll(
    /CREATE EXTENSION IF NOT EXISTS ([a-z_]+)/g,
  ),
].map((m) => m[1]);
const ext = await all(`SELECT extname FROM pg_extension WHERE extname = ANY($1)`, [required]);
const missingExt = required.filter((e) => !ext.some((r) => r.extname === e));
if (missingExt.length) {
  blocker(
    `extensions missing: ${missingExt.join(', ')}`,
    'Render does not run db/init/, so they are installed by hand. See ops/runbooks/deploy.md.',
  );
} else {
  ok(`all ${required.length} extensions installed: ${required.join(', ')}`);
}

console.log('');
console.log('-- the worker -----------------------------------------------------');

/*
 * D-52, AND ITS SYMPTOM IS THE REASON THIS CHECK IS HERE. `worker:install` is
 * not part of `db:migrate` and cannot be. A worker started without it BOOTS,
 * LOGS HEALTHY, and fails on its first task -- so the honest place to notice
 * is before anything is queued, not in a log nobody is reading.
 */
const jobsSchema = await one(
  `SELECT to_regclass('graphile_worker.migrations') IS NOT NULL
       OR to_regclass('jobs.migrations') IS NOT NULL AS installed`,
);
if (!jobsSchema?.installed) {
  blocker(
    'graphile-worker has no tables: `pnpm worker:install` has not run here',
    'The worker will boot, log healthy, and fail on its first task (D-52). ' +
      'Nothing expires, nothing is reconciled, and no seller sees a symptom for hours.',
  );
} else {
  ok('graphile-worker tables are installed');
}

const beat = await one(
  `SELECT beat_at, now() - beat_at AS age FROM jobs.worker_heartbeat`,
).catch(() => null);
if (!beat) {
  warn(
    'no worker heartbeat row: the worker has never run against this database',
    'Expected before the first deploy completes; a blocker if the worker is meant to be up.',
  );
} else {
  const stale = await one(
    `SELECT now() > beat_at + interval '15 minutes' AS stale FROM jobs.worker_heartbeat`,
  );
  if (stale?.stale) {
    warn(
      `the worker heartbeat is stale (last beat ${beat.beat_at.toISOString()})`,
      'The reservation clock is held by the worker. Its silence has no other symptom ' +
        'until a seller notices an order that never expired. /healthz says degraded.',
    );
  } else {
    ok(`the worker beat ${String(beat.age).split('.')[0]} ago`);
  }
}

console.log('');
console.log('-- markets --------------------------------------------------------');

const markets = await all(
  `SELECT code, activation_state::text AS state, otp_enabled,
          seller_registration_enabled, display_currency, display_timezone
     FROM core.market ORDER BY created_at`,
);
if (!markets.length) {
  blocker(
    'no market exists',
    'Bootstrap resolves a market for every anonymous caller. With none, nobody can ' +
      'even reach the sign-in screen.',
  );
}
for (const m of markets) {
  const bits = [`${m.code}`, m.state, m.display_currency, m.display_timezone];
  if (m.state !== 'ACTIVE') {
    blocker(
      `market ${m.code} is ${m.state}, so it issues no new OTP`,
      'S9.2: only ACTIVE markets receive ordinary new OTP issuance. Existing trade ' +
        'continues; nobody new gets in. See ops/runbooks/activate-market.md.',
    );
  } else if (!m.otp_enabled) {
    blocker(
      `market ${m.code} is ACTIVE but otp_enabled is false: no one can sign in`,
      'See ops/runbooks/activate-market.md.',
    );
  } else {
    ok(`market ${bits.join(' / ')}`);
  }
  if (!m.seller_registration_enabled) {
    /*
     * NOT A BLOCKER, AND SAYING SO IS THE POINT. The launch gate is green
     * BECAUSE this flag is false -- open seller signup while nothing about a
     * seller is measured is the thing it exists to prevent. An operator
     * reading this list must not "fix" it.
     */
    ok(`market ${m.code}: seller_registration_enabled is false, which is the intended state`);
  } else {
    warn(
      `market ${m.code} has seller_registration_enabled TRUE`,
      'The launch gate is green only while this is false. Turning it on is a founder ' +
        'decision with a gate attached, not a configuration tidy-up.',
    );
  }
}

console.log('');
console.log('-- operators ------------------------------------------------------');

/*
 * THE ONE THAT WILL BE FORGOTTEN.
 */
const grants = await all(
  `SELECT role::text AS role, count(*)::int AS n
     FROM core.operator_grant WHERE revoked_at IS NULL
    GROUP BY role ORDER BY role`,
);
if (!grants.length) {
  blocker(
    'there are NO operators in this environment',
    'This is silent: nothing errors and no log line appears. ' +
      'verification.read_attestation derives actor_role from core.operator_grant, so ' +
      'with no rows NOBODY CAN REVIEW AN IDENTITY -- and identity review is one of the ' +
      'ten publication-readiness items, so no seller can publish anything, ever. ' +
      'Claim review and the moderation queue fill the same way. ' +
      'Fix: ops/runbooks/grant-founder-operator.md, after the founder has signed in once.',
  );
} else {
  for (const g of grants) ok(`${g.n} live ${g.role} grant(s)`);
  if (!grants.some((g) => g.role === 'IDENTITY_REVIEWER' || g.role === 'ADMIN')) {
    blocker(
      'no IDENTITY_REVIEWER and no ADMIN',
      'Identity review accepts only those two roles, and it gates publication.',
    );
  }
}

console.log('');
console.log('-- who is here ----------------------------------------------------');

const counts = await one(
  `SELECT (SELECT count(*)::int FROM core.account) AS accounts,
          (SELECT count(*)::int FROM core.seller)  AS sellers,
          (SELECT count(*)::int FROM core."order") AS orders`,
);
ok(`${counts.accounts} account(s), ${counts.sellers} seller(s), ${counts.orders} order(s)`);

console.log('');
console.log('-- object storage -------------------------------------------------');

/*
 * NAMES ONLY, NEVER CREDENTIALS. A staging bucket pointed at production is a
 * data incident with no attacker in it, and the bucket NAME is the only part
 * of that configuration safe to print -- which is also why render.yaml puts
 * the environment in the name.
 */
for (const key of ['R2_MEDIA_BUCKET', 'R2_EVIDENCE_BUCKET']) {
  const v = process.env[key];
  if (!v) warn(`${key} is not set: media or evidence has nowhere to go`);
  else ok(`${key} = ${v}`);
}

await client.end();

console.log('');
if (blockers) {
  console.error(
    `FAIL  ${blockers} blocker(s), ${warnings} warning(s). ` +
      'This environment cannot do its job yet.',
  );
  process.exit(1);
}
console.log(`PASS  no blockers, ${warnings} warning(s).`);
