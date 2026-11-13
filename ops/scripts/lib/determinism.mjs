// The flow of `pnpm db:determinism` (ADU-CON-02 v3.0 section 16), with its dependencies injected so
// the refusal and failure paths are unit-tested without a database (disposable-db.test.mjs).
//
// WO-INFRA-015A: the scratch databases are created, migrated, dumped and dropped ONLY on the server
// checkContainerTarget() proved to be disposable, and only through the container ID it returned, so
// a failed or interrupted run cannot clean up somewhere else. An interrupt stops the run at the next
// step, the scratch databases are still dropped, and the run never reports a pass. A drop that fails,
// or a scratch database still present afterwards, fails the run.
import { checkContainerTarget } from './disposable-db.mjs';

const DESTRUCTIVE_ENVS = ['development', 'test'];
// Exit status of a Windows console program ended by Ctrl+C (STATUS_CONTROL_C_EXIT), as minio-migrate.
const CTRL_C_EXIT = new Set([3221225786, -1073741510]);

/**
 * deps: env, docker(args) -> { status, stdout, stderr, error }, migrate(url) -> { status, stdout,
 * stderr }, Client (pg), interrupted() -> signal name or null, suffix() -> 8 hex chars, out, err.
 * Returns the exit code: 0 pass, 1 fail or refused, 2 could not check, 130 interrupted.
 */
export async function runDeterminism({ env, docker, migrate, Client, interrupted, suffix, out, err }) {
  if (!DESTRUCTIVE_ENVS.includes(env.NODE_ENV ?? '')) {
    err(
      `FAIL  NODE_ENV is ${env.NODE_ENV ? `'${env.NODE_ENV}'` : 'unset'}; this script runs only under ${DESTRUCTIVE_ENVS.join(' or ')}.`,
    );
    err('      It DROPs and re-CREATEs two databases, so it refuses an environment it cannot name.');
    return 2;
  }
  const target = await checkContainerTarget({
    container: env.ADULIS_PG_CONTAINER,
    adminUrl: env.DATABASE_URL_MIGRATE,
    docker,
    Client,
  });
  if (!target.ok) {
    err(`FAIL  refusing to create or drop any database:\n  - ${target.problems.join('\n  - ')}`);
    return target.code;
  }
  out(`  PASS  ${target.name} is the disposable server DATABASE_URL_MIGRATE reaches; scratch databases go there only`);

  const tag = suffix();
  if (!/^[0-9a-f]{8}$/.test(tag)) {
    err('FAIL  the scratch-database suffix is not 8 hex characters');
    return 2;
  }
  const dbs = [`adulis_det_a_${tag}`, `adulis_det_b_${tag}`];
  const psql = (sqlText) =>
    docker(['exec', target.id, 'psql', '-U', target.user, '-d', 'postgres', '-AtX', '-v', 'ON_ERROR_STOP=1', '-c', sqlText]);
  const stopped = (why) => Object.assign(new Error(`interrupted by ${why}`), { interrupted: true });
  const must = (r, what) => {
    // spawnSync's own errors first: an output overflow (ENOBUFS) or timeout also kills the child
    // with SIGTERM, which is not an interrupt (PHASE-002B-01 review).
    if (r.error) throw new Error(`${what} failed: ${r.error.message}`);
    // A child ended by a signal is an interrupt (a terminal Ctrl+C reaches it too), never a pass.
    if (r.signal) throw stopped(`${r.signal} (during ${what})`);
    // On Windows a console Ctrl+C ends the child with STATUS_CONTROL_C_EXIT and no signal (review).
    if (CTRL_C_EXIT.has(r.status)) throw stopped(`Ctrl+C (during ${what})`);
    if (r.status !== 0)
      throw new Error(`${what} failed: ${`${r.error?.message ?? r.stderr ?? ''}`.trim().slice(-500)}`);
    return `${r.stdout ?? ''}`;
  };
  // Signal handlers run only when the event loop turns, and every step here is synchronous: give it
  // one full turn before reading the flag, or a SIGINT/SIGTERM is seen only after the run.
  const step = async () => {
    await new Promise((r) => setImmediate(() => setImmediate(r)));
    const sig = interrupted();
    if (sig) throw stopped(sig);
  };
  // WITH (FORCE): a migration child killed mid-run can leave its session open for a moment.
  const drop = (d) => psql(`DROP DATABASE IF EXISTS ${d} WITH (FORCE)`);

  let code = 0;
  try {
    for (const d of dbs) {
      await step();
      must(drop(d), `dropping ${d}`);
      must(psql(`CREATE DATABASE ${d}`), `creating ${d}`);
      await step();
      const url = new URL(env.DATABASE_URL_MIGRATE);
      url.pathname = `/${d}`;
      must(migrate(url.href), `migrations against ${d}`);
    }
    await step();
    const lines = dbs.map((d) =>
      must(
        docker(['exec', target.id, 'pg_dump', '-U', target.user, '-d', d, '--schema-only', '--no-owner', '--no-privileges']),
        `pg_dump of ${d}`,
      )
        .split('\n')
        // pg_dump 17 writes a per-run random token on `\restrict` lines: meta-commands, not schema.
        .filter((l) => !l.startsWith('\\')),
    );
    await step();
    const [a, b] = lines;
    // A floor: two empty dumps are identical too (migrations that ran nothing). Review, PHASE-002B-01.
    if (!a.some((l) => l.startsWith('CREATE TABLE')))
      throw new Error(`the schema dump of ${dbs[0]} holds no CREATE TABLE: the migrations did not build the schema`);
    if (a.length === b.length && a.every((l, i) => l === b[i])) {
      out(`PASS  two clean databases converge on an identical schema (${a.length} lines compared).`);
    } else {
      code = 1;
      err('FAIL  migrations are not deterministic. First differences:');
      let shown = 0;
      for (let i = 0; i < Math.max(a.length, b.length) && shown < 12; i += 1) {
        if (a[i] !== b[i]) {
          err(`  ${i + 1}\n    A: ${a[i] ?? '<absent>'}\n    B: ${b[i] ?? '<absent>'}`);
          shown += 1;
        }
      }
    }
  } catch (e) {
    code = e.interrupted ? 130 : 1;
    err(`FAIL  ${e.message}${e.interrupted ? ': stopped; dropping the scratch databases' : ''}`);
  } finally {
    // Same container ID as above: never another server. Every drop is attempted, then checked.
    const left = [];
    for (const d of dbs) {
      const r = drop(d);
      if (r.error || r.status !== 0) left.push(d);
    }
    const listed = psql(`SELECT datname FROM pg_database WHERE datname IN ('${dbs.join("','")}')`);
    if (listed.error || listed.status !== 0) left.push('(could not list the remaining databases)');
    else for (const d of `${listed.stdout}`.split('\n').map((s) => s.trim()).filter(Boolean)) if (!left.includes(d)) left.push(d);
    if (left.length) {
      err(`FAIL  cleanup: scratch database(s) left on ${target.name}: ${left.join(', ')}. Drop them by hand there.`);
      if (code === 0) code = 1;
    }
  }
  await new Promise((r) => setImmediate(() => setImmediate(r)));
  if (code === 0 && interrupted()) {
    err('FAIL  interrupted at the end: not reported as a pass');
    code = 130;
  }
  return code;
}
