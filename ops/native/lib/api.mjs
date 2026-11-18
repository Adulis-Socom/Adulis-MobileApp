// Starting and stopping the test API. The API is built from a checkout whose HEAD is the commit the
// operator named, by this harness, every time; it is started with an explicit environment (never
// inherited, never read from an env file) and stopped only by the pid, creation time and command line
// recorded when it was started. There is no stop-by-port.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertTarget, Refused } from './guard.mjs';
import { apiAppName, apiEnvProblems, tokens } from './identity.mjs';
import { writeManifest } from './manifest.mjs';

const SHA_RE = /^[0-9a-f]{40}$/;

/**
 * The checkout must be the commit the operator verified, with a clean tracked tree, and must
 * contain the current origin/dev (a checkout behind dev builds a stale API). `git(args)` resolves
 * to { status, stdout }.
 */
export async function provenanceProblems(checkout, sha, git) {
  const p = [];
  if (!SHA_RE.test(`${sha}`)) return [`--sha must be a full 40-hex commit id, got '${sha}'`];
  const head = await git(['rev-parse', 'HEAD']);
  if (head.status !== 0) return [`${checkout} is not a git checkout`];
  if (head.stdout.trim() !== sha)
    p.push(`checkout HEAD ${head.stdout.trim()} is not the expected commit ${sha}`);
  const dirty = await git(['status', '--porcelain', '--untracked-files=no']);
  if (dirty.status !== 0 || dirty.stdout.trim() !== '')
    p.push(
      'the checkout has uncommitted changes to tracked files (or its status could not be read)',
    );
  const anc = await git(['merge-base', '--is-ancestor', 'origin/dev', 'HEAD']);
  if (anc.status !== 0)
    p.push(
      'origin/dev is not an ancestor of HEAD: the checkout is behind dev (fetch and rebase) or origin/dev is unknown',
    );
  return p;
}

export const newBootMarker = (m) => `native.${m.run}.${randomBytes(4).toString('hex')}`;

/** The complete environment of the API child. Pure; checked with apiEnvProblems before use. */
export function buildApiEnv(m, { dir, bootMarker, host = process.env }) {
  const url = (user, pw, app) =>
    `postgres://${user}:${pw}@127.0.0.1:${m.ports.pg}/${m.db.name}?application_name=${app}`;
  const origin = `http://127.0.0.1:${m.ports.s3}`;
  const env = {
    NODE_ENV: 'development',
    PORT: `${m.ports.api}`,
    CONSOLE_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: url('adulis_app', m.secrets.app, apiAppName(m)),
    DATABASE_URL_JOBS: url('adulis_jobs', m.secrets.jobs, `adulis-native-${m.run8}-jobs`),
    R2_ACCOUNT_ID: origin,
    R2_ACCESS_KEY_ID: m.secrets.s3Key,
    R2_SECRET_ACCESS_KEY: m.secrets.s3Secret,
    R2_MEDIA_BUCKET: 'adulis-media',
    R2_EVIDENCE_BUCKET: 'adulis-evidence',
    R2_MEDIA_PUBLIC_ORIGIN: `${origin}/adulis-media`,
    // Per-run keys: hex of 32 bytes is used as the key itself.
    EVIDENCE_ENCRYPTION_KEY_V1: createHash('sha256').update(`evidence:${m.nonce}`).digest('hex'),
    PAYOUT_ENCRYPTION_KEY_V1: createHash('sha256').update(`payout:${m.nonce}`).digest('hex'),
    IDENTITY_HASH_KEY_V1: createHash('sha256').update(`identity:${m.nonce}`).digest('hex'),
    ADULIS_BOOT_MARKER: bootMarker,
    DEV_SMS_LOG: join(dir, 'dev-sms.log'),
  };
  // The few variables Windows needs to run node at all; nothing else is passed on.
  for (const k of ['SystemRoot', 'PATH', 'TEMP', 'TMP']) if (host[k]) env[k] = host[k];
  return env;
}

/**
 * Starts the API for a run that is `ready`. `io` supplies git, build, connects, spawnApi, proc,
 * fetch, docker and Client; every refusal happens before the build and before the process starts.
 */
export async function startApi(m, io, { checkout, sha, dir }) {
  if (m.state !== 'ready') throw new Refused(`the run is '${m.state}', not ready`);
  if (m.api) throw new Refused('this run already started an API; stop it first (api stop)');
  const prov = await provenanceProblems(checkout, sha, (a) => io.git(a, checkout));
  if (prov.length) throw new Refused(`refused: ${prov.join('; ')}`);
  // The port guard: anything already answering is a stale run, a developer's server or another program.
  if (await io.connects(m.ports.api))
    throw new Refused(`refused: something already listens on the API port ${m.ports.api}`);
  const bootMarker = newBootMarker(m);
  const env = buildApiEnv(m, { dir, bootMarker });
  const envProblems = apiEnvProblems(env, m);
  if (envProblems.length)
    throw new Refused(`refused: the API environment is not acceptable: ${envProblems.join('; ')}`);
  // The API is handed this run's credentials only after the stack itself has been proven.
  await assertTarget(m, 'STACK', io, { dir, states: ['ready'] });
  await io.build(checkout);
  // The build can take minutes: the checkout must still be the verified commit before it is run.
  const after = await provenanceProblems(checkout, sha, (a) => io.git(a, checkout));
  if (after.length) throw new Refused(`refused after the build: ${after.join('; ')}`);
  const main = join(checkout, 'apps', 'api', 'dist', 'main.js');
  const mainSha256 = createHash('sha256').update(readFileSync(main)).digest('hex');
  const child = io.spawnApi({
    node: io.node,
    main,
    cwd: join(checkout, 'apps', 'api'),
    env,
    log: join(dir, 'api.log'),
  });
  const info = await io.proc.info(child.pid);
  const next = {
    ...m,
    api: {
      pid: child.pid,
      createdAt: info.createdAt,
      node: io.node,
      main,
      bootMarker,
      checkout,
      sha,
      mainSha256,
    },
  };
  writeManifest(dir, next);
  try {
    // Identity, not liveness: wait for THIS marker, then prove the whole API chain.
    for (let i = 0; i < 60; i += 1) {
      const h = await io
        .fetch(`http://127.0.0.1:${m.ports.api}/healthz`, { signal: AbortSignal.timeout(5000) })
        .then((r) => r.json())
        .catch(() => null);
      if (h?.boot_marker === bootMarker) break;
      if (i === 59)
        throw new Error(
          "the API did not answer /healthz with this start's boot marker within 30 s",
        );
      await new Promise((r) => setTimeout(r, 500));
    }
    const verified = { ...next, api: { ...next.api, commandLine: info.commandLine } };
    await assertTarget(verified, 'API-WRITE', io, { dir, states: ['ready'] });
    writeManifest(dir, verified);
    return verified;
  } catch (e) {
    // Only the process this start created, and only after its identity matches the record.
    await stopApi(next, io, dir).catch(() => {});
    throw e;
  }
}

/** Stops the API only if the recorded pid still has the recorded creation time and command line. */
export async function stopApi(m, io, dir) {
  const rec = m.api;
  if (!rec) return { stopped: false, why: 'no API was started by this run' };
  const info = await io.proc.info(rec.pid);
  if (!info?.createdAt) {
    writeManifest(dir, { ...m, api: null });
    return { stopped: false, why: `process ${rec.pid} is not running` };
  }
  const t = tokens(info.commandLine);
  const same = (a, b) =>
    `${a}`.replaceAll('\\', '/').toLowerCase() === `${b}`.replaceAll('\\', '/').toLowerCase();
  if (
    info.createdAt !== rec.createdAt ||
    t.length !== 2 ||
    !same(t[0], rec.node) ||
    !same(t[1], rec.main)
  )
    throw new Refused(
      `refused: process ${rec.pid} is not the API this run started (creation time or command line differ); it was not stopped`,
    );
  io.proc.kill(rec.pid);
  writeManifest(dir, { ...m, api: null });
  return { stopped: true };
}
