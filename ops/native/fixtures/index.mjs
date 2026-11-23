// Synthetic fixtures for the run's own database. Every set is generated data (no real person's
// number or name), written only through a channel bound to the run's PostgreSQL container by its
// full id, in ONE transaction whose first statement re-asserts the server, database and run
// identity: if the identity differs at that moment the transaction raises and nothing is written.
import { createHash } from 'node:crypto';
import { assertTarget } from '../lib/guard.mjs';
import { runValue } from '../lib/identity.mjs';
import { writeManifest } from '../lib/manifest.mjs';
import { catalogueSets } from './catalogue.mjs';

const uuid = (seed) => {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
/** Run-unique and not derivable from the run id alone (it includes the nonce). */
export const canaryDeviceId = (m) => uuid(`native-canary:${m.run}:${m.nonce}`);

// A set conflicts with another when both create the same seller handle or other unique value.
export const SETS = {
  baseline: {
    conflicts: [],
    sql: (m) => `
INSERT INTO core.account (id, phone_e164, market_id, status, age_declared_over_18)
  SELECT '${uuid(`baseline-account:${m.run}`)}', '+251900000901', id, 'ACTIVE', true
    FROM core.market WHERE activation_state = 'ACTIVE' ORDER BY created_at LIMIT 1;
-- No market on purpose: the API canary places this device in a market, which only the API can do.
INSERT INTO core.device (id, platform) VALUES ('${canaryDeviceId(m)}', 'ANDROID');
INSERT INTO core.category (id, code) VALUES ('${uuid(`baseline-category:${m.run}`)}', 'fixture-crafts');
`,
  },
  ...catalogueSets(uuid),
};

/** Raises unless the session is on this run's server, database and run setting. */
export const guardSql = (m) => `
DO $guard$ BEGIN
  IF (SELECT system_identifier::text FROM pg_control_system()) IS DISTINCT FROM '${m.db.systemId}'
     OR current_database() IS DISTINCT FROM '${m.db.name}'
     OR coalesce((SELECT substr(s, length('adulis.native_run=') + 1)
                    FROM pg_db_role_setting r, unnest(r.setconfig) s
                   WHERE r.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
                     AND r.setrole = 0 AND starts_with(s, 'adulis.native_run=') LIMIT 1), '') IS DISTINCT FROM '${runValue(m)}'
  THEN RAISE EXCEPTION 'native run identity mismatch: nothing was written';
  END IF;
END $guard$;
`;

/** Runs `sql` in the run's database after the DB-WRITE checks, in one transaction behind guardSql. */
export async function execGuarded(m, io, sql, { dir, states = ['ready'] } = {}) {
  await assertTarget(m, 'DB-WRITE', io, { dir, states });
  const r = await io.docker(
    [
      'exec',
      '-i',
      m.containers.postgres.id,
      'psql',
      '-U',
      m.db.user,
      '-d',
      m.db.name,
      '-v',
      'ON_ERROR_STOP=1',
      '--single-transaction',
      '-q',
      '-f',
      '-',
    ],
    { input: `${guardSql(m)}\n${sql}` },
  );
  if (r.error || r.status !== 0)
    throw new Error(
      `the guarded statement failed (nothing was written): ${`${r.stderr || r.error?.message}`.trim().slice(-300)}`,
    );
  return r;
}

export async function loadSet(m, io, name, { dir }) {
  const set = Object.hasOwn(SETS, name) ? SETS[name] : undefined;
  if (!set)
    throw new Error(`unknown fixture set '${name}' (known: ${Object.keys(SETS).join(', ')})`);
  if (m.fixtures.includes(name))
    throw new Error(`fixture set '${name}' is already loaded in this run`);
  const missing = (set.requires ?? []).find((x) => !m.fixtures.includes(x));
  if (missing)
    throw new Error(`fixture set '${name}' requires '${missing}' to be loaded first in this run`);
  const clash = m.fixtures.find(
    (x) => set.conflicts.includes(x) || SETS[x]?.conflicts.includes(name),
  );
  if (clash)
    throw new Error(`fixture set '${name}' cannot share a stack with '${clash}': use a fresh run`);
  await execGuarded(m, io, set.sql(m), { dir });
  const next = { ...m, fixtures: [...m.fixtures, name] };
  writeManifest(dir, next);
  return next;
}
