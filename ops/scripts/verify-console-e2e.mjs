#!/usr/bin/env node
/**
 * ops/scripts/verify-console-e2e.mjs -- gate `console-e2e`.
 *
 * The console harness, owed at C-3, built at T10, and REBUILT AT T11 after
 * its own adversarial pass proved it was not testing what it claimed to test.
 * It runs Playwright against the BUILT console and the REAL API, on a
 * database reset immediately before.
 *
 * ==========================================================================
 * THE INVARIANT THIS FILE NOW ENFORCES (T11 Phase 1)
 * ==========================================================================
 * THE HARNESS PROVES THE IDENTITY OF THE ARTIFACT UNDER TEST, NOT ITS
 * LIVENESS. T10's version proved liveness -- a port answered, a health check
 * was ok -- and sixteen tests went green against an artifact that was not the
 * one built here: the gate ran a stale API once (D-160), and the built
 * console, under the CSP its own server replayed, could not reach the API at
 * all, so whatever the tests drove was never the built console.
 *
 * Identity is now carried in-band, twice:
 *
 *   THE CONSOLE: a BUILD ID minted below, stamped into the page by the build
 *   (index.html's data-build-id), asserted by the suite's FIRST test against
 *   the page the server actually served. A stale server, a previous bundle,
 *   a reused dev server -- all fail by name before any product test runs.
 *
 *   THE API: a BOOT MARKER minted below, passed to the child as
 *   ADULIS_BOOT_MARKER, echoed by /healthz, asserted here after startup.
 *   /healthz answering proves that AN api is up; the marker proves it is the
 *   process THIS gate spawned. (The rebuild and early-exit detection below
 *   narrow the window; they do not close it -- a stale process that answers
 *   the port makes the spawned child die on EADDRINUSE and everything after
 *   that is theatre. The marker closes it.)
 *
 * Port guards remain on BOTH ports -- refuse to start when anything already
 * listens -- as the first line. Two independent controls; neither trusted
 * alone.
 *
 * ==========================================================================
 * IT IS DESTRUCTIVE, SO IT ASSERTS ITS ENVIRONMENT
 * ==========================================================================
 * `pnpm db:reset` drops ten schemas. D-142's ruling covers this exactly: any
 * script that drops, truncates or purges validates NODE_ENV against a closed
 * set and refuses if it is unset. Duplicated rather than imported, per the
 * same ruling. NOTE: under `pnpm gates` / CI this arrives as NODE_ENV=test
 * from the gate's own env entry in gates.mjs -- without that entry, CI (which
 * sets no NODE_ENV and has no .env) fails this guard on every run, which is
 * exactly what T10 shipped.
 */
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const DESTRUCTIVE_ENVS = ['development', 'test'];
if (!DESTRUCTIVE_ENVS.includes(process.env.NODE_ENV ?? '')) {
  console.error(
    `FAIL  NODE_ENV is ${process.env.NODE_ENV ? `'${process.env.NODE_ENV}'` : 'unset'}; ` +
      `this gate runs only under ${DESTRUCTIVE_ENVS.join(' or ')}.`,
  );
  console.error('      It resets the database before driving the console, so it refuses an');
  console.error('      environment it cannot name (D-142).');
  process.exit(2);
}

const API_PORT = Number(process.env['E2E_API_PORT'] ?? 3000);
const API_BASE = `http://localhost:${API_PORT}`;
const CONSOLE_PORT = Number(process.env['E2E_CONSOLE_PORT'] ?? 5173);
const CONSOLE_ORIGIN = `http://localhost:${CONSOLE_PORT}`;

/** This run's identity. Minted fresh; nothing stale can know either value. */
const BUILD_ID = randomUUID();
const BOOT_MARKER = randomUUID();

const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts });

const die = (msg, code = 1) => {
  console.error(`\nFAIL  ${msg}\n`);
  process.exit(code);
};

/** True when something answers HTTP on the port -- ANY response, even a 404. */
const answers = (base) =>
  fetch(base, { redirect: 'manual' }).then(() => true).catch(() => false);

/*
 * NAMED, EARLY. The API child below is spawned as bare `node dist/main.js`
 * with this process's env -- it loads no .env of its own (D-99). Run this
 * script without DATABASE_URL and the API comes up, answers /healthz 503
 * db:down for thirty seconds, and the old message said "did not answer" --
 * a wrong diagnosis pointing at the wrong component. (Placed after the
 * helpers: `die` is a const, and a guard that would itself throw a TDZ
 * ReferenceError exactly when it fires is not a guard.)
 */
if (!process.env['DATABASE_URL']) {
  die(
    'DATABASE_URL is not set. The spawned API reads no .env of its own (D-99), so it\n' +
      '      would start, report db:down, and this gate would time out with a message\n' +
      '      about the wrong thing. Run via `pnpm verify:console-e2e` (which loads .env)\n' +
      '      or export DATABASE_URL.',
  );
}

/*
 * T20 S4 -- REAL OBJECT STORAGE IS AS MANDATORY AS POSTGRES NOW. The media
 * arms drive a real browser PUT against a real bucket; with the fake bound
 * they would fail with a message about the wrong thing (OBJECT_NOT_UPLOADED
 * from an adapter whose map only tests can populate). Named early, like the
 * DATABASE_URL check above, and probed so a stopped container dies as
 * 'MinIO is not answering' rather than as a red media test.
 */
const R2_KEYS = ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_MEDIA_BUCKET','R2_EVIDENCE_BUCKET','R2_MEDIA_PUBLIC_ORIGIN'];
const missingR2 = R2_KEYS.filter((k) => !process.env[k]);
if (missingR2.length) {
  die('object storage is not configured: ' + missingR2.join(', ') + ' unset.' +
      ' The media arms need real storage (MinIO: docker compose up -d).' +
      ' Run via pnpm verify:console-e2e (which loads .env) or export the six R2_* values.');
}
const MEDIA_ORIGIN = new URL(process.env['R2_MEDIA_PUBLIC_ORIGIN']).origin;
{
  const up = await fetch(MEDIA_ORIGIN + '/minio/health/live').then((r) => r.ok).catch(() => false);
  if (!up) {
    die('MinIO is not answering at ' + MEDIA_ORIGIN + ' (R2_MEDIA_PUBLIC_ORIGIN).' +
        ' Start it: docker compose up -d  -- the adulis-minio service.');
  }
}

console.log('\nConsole e2e -- the built console, the real API, a reset database');
console.log(`   build id ${BUILD_ID}\n`);

/*
 * PORT GUARDS FIRST, both ports, before any expensive step. /healthz
 * answering proves that AN api is up, not that THIS one is (D-160); the same
 * sentence holds for the console port, where the first version reused
 * whatever was listening and the whole T10 suite went green against it.
 */
for (const [name, base] of [['api', API_BASE], ['console', CONSOLE_ORIGIN]]) {
  if (await answers(base)) {
    die(
      `something is already listening on the ${name} port (${base}).\n` +
        '      This gate starts its own processes and asserts their identity; a\n' +
        '      pre-existing listener is a stale run, a dev server, or another\n' +
        '      program, and testing it proves nothing about this build. Stop it\n' +
        '      and run this again.',
    );
  }
}

/*
 * THE API IS REBUILT, NOT ASSUMED (D-160's first half). The first version
 * checked dist/main.js EXISTED and ran whatever was in it, while rebuilding
 * the console two steps below -- so run directly after an API edit, it drove
 * a NEW console against an OLD API, and the failure read as a product defect.
 */
console.log('-- build the api ----------------------------------------------');
if (sh('pnpm', ['--filter', '@adulis/api', 'build']).status !== 0) {
  die('the api build failed');
}
if (!existsSync(path.join(root, 'apps', 'api', 'dist', 'main.js'))) {
  die('apps/api/dist/main.js is missing after a successful build.');
}

console.log('\n-- reset ------------------------------------------------------');
if (sh('pnpm', ['db:reset']).status !== 0) die('db:reset failed');

/**
 * THE CONSOLE IS REBUILT WITH A BASE URL (D-138: a build without one throws
 * before fetch and talks to nothing) AND WITH NODE_ENV=production, EXPLICITLY.
 *
 * T11 Phase 2: the first version passed `{ ...process.env }`, and in the only
 * environment its own guard permits, that carries NODE_ENV=development --
 * which Vite folds into the define, selecting React's DEVELOPMENT build:
 * 611,928 bytes against 370,308, the artifact the `production-react` gate
 * exists to reject, produced by the gate meant to test the shipping one. The
 * env below is what the real deployment build gets, plus this run's identity.
 */
console.log('\n-- build the console against the API ---------------------------');
if (sh('pnpm', ['--filter', '@adulis/console', 'build'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    VITE_API_BASE_URL: API_BASE,
    VITE_BUILD_ID: BUILD_ID,
  },
}).status !== 0) {
  die('the console build failed');
}

/*
 * PROVE WHAT WAS JUST BUILT, before anything serves it.
 *
 * 1. Not a development bundle -- the same marker assertProductionReact greps
 *    for ('Each child in a list', a dev-only React warning). Checked HERE as
 *    well as at gate `production-react`, because that gate checks whatever
 *    dist holds at ITS position in the list, and this gate just overwrote it.
 * 2. The dist actually carries this run's build id -- catches a build that
 *    did not substitute (wrong Vite config, wrong env plumbing) before the
 *    identity test would, with a message about the build rather than the
 *    server.
 */
const assets = path.join(root, 'apps', 'console', 'dist', 'assets');
for (const entry of readdirSync(assets, { withFileTypes: true, recursive: true })) {
  if (!entry.isFile()) continue;
  const full = path.join(entry.parentPath ?? assets, entry.name);
  let text = '';
  try { text = readFileSync(full, 'utf8'); } catch { continue; }
  if (text.includes('Each child in a list')) {
    die(
      `the console build under test is a DEVELOPMENT bundle (${path.relative(root, full)} ` +
        'carries development-only React warnings). NODE_ENV leaked into the build. ' +
        'This gate must test the artifact that ships, and this is not it.',
    );
  }
}
const builtHtml = readFileSync(path.join(root, 'apps', 'console', 'dist', 'index.html'), 'utf8');
if (!builtHtml.includes(`data-build-id="${BUILD_ID}"`)) {
  const m = builtHtml.match(/data-build-id="([^"]*)"/);
  die(
    `the built index.html does not carry this run's build id ${BUILD_ID} ` +
      `(found: ${m ? m[1] : 'no data-build-id attribute at all'}). ` +
      'The identity chain is broken at the BUILD, so nothing downstream can prove ' +
      'what it is testing.',
  );
}
console.log(`   production bundle confirmed; dist stamped ${BUILD_ID}`);

/* -- the API, with the environment its dev SMS adapter needs --------------- */
console.log('\n-- api --------------------------------------------------------');
const api = spawn('node', ['dist/main.js'], {
  cwd: path.join(root, 'apps', 'api'),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'development',
    CONSOLE_ORIGIN,
    PORT: String(API_PORT),
    ADULIS_BOOT_MARKER: BOOT_MARKER,
  },
});
let apiLog = '';
api.stdout.on('data', (d) => { apiLog += d; });
api.stderr.on('data', (d) => { apiLog += d; });

const stopApi = () => { try { api.kill(); } catch { /* already gone */ } };
process.on('exit', stopApi);
process.on('SIGINT', () => { stopApi(); process.exit(130); });

// If the child exits before /healthz answers, stop waiting: report the exit,
// not a 30-second timeout about nothing (D-160).
let apiExited = null;
api.on('exit', (code, signal) => { apiExited = signal ?? code ?? 0; });

let lastHealth = 'no response at all';
const healthy = await (async () => {
  for (let i = 0; i < 60; i += 1) {
    if (apiExited !== null) return false;
    try {
      const r = await fetch(`${API_BASE}/healthz`);
      if (r.ok) return true;
      // Answering and unhealthy are different from silent -- say which.
      lastHealth = `${r.status} ${await r.text().catch(() => '')}`.slice(0, 200);
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
})();
if (!healthy) {
  stopApi();
  console.error(apiLog.slice(-2000));
  die(
    apiExited !== null
      ? `the API exited (${apiExited}) before answering /healthz`
      : `the API did not go healthy within 30s (last /healthz: ${lastHealth})`,
  );
}

/*
 * IDENTITY, not liveness: the /healthz that just answered must be the process
 * this gate spawned, proven by the marker only that process was given.
 */
const health = await fetch(`${API_BASE}/healthz`).then((r) => r.json()).catch(() => null);
if (health?.boot_marker !== BOOT_MARKER) {
  stopApi();
  die(
    `the process answering ${API_BASE}/healthz is NOT the one this gate spawned ` +
      `(boot_marker: expected ${BOOT_MARKER}, got ${health?.boot_marker ?? 'none'}). ` +
      'A stale or foreign API is on the port; nothing it says is about this build.',
  );
}
console.log(`   api listening on ${API_BASE}, boot marker verified, CONSOLE_ORIGIN=${CONSOLE_ORIGIN}`);

/* -- drive it -------------------------------------------------------------- */
console.log('\n-- playwright -------------------------------------------------');
const run = sh('pnpm', ['--filter', '@adulis/console', 'exec', 'playwright', 'test'], {
  env: {
    ...process.env,
    E2E_API_BASE_URL: API_BASE,
    E2E_CONSOLE_PORT: String(CONSOLE_PORT),
    E2E_EXPECT_BUILD_ID: BUILD_ID,
    // T20 S4: one variable feeds the served CSP's connect-src AND img-src
    // (serve.mjs derives both), the same discipline as the API origin.
    E2E_MEDIA_ORIGIN: MEDIA_ORIGIN,
  },
});
stopApi();

if (run.status !== 0) {
  console.error('\n--- the API said, while that ran: ---');
  console.error(apiLog.slice(-2000));
  die('the console e2e suite failed');
}

/*
 * LEAVE THE DATABASE AS WE FOUND IT.
 *
 * This gate resets BEFORE it drives, which makes its own run honest but says
 * nothing about the next one. The suite now signs a seller UP for real
 * (zz-beta-walk), so every green run used to leave behind an account, a
 * seller, a product and a variant that no later run cleans up -- and in
 * ci:local the API `test` gate runs BEFORE this one, so it inherits whatever
 * the PREVIOUS console-e2e left. Fifteen runs of the T17 walk grew that into
 * seventy-three failing API tests that had nothing to do with any code change:
 * the purest kind of wasted afternoon, and the sort of thing that gets blamed
 * on the last commit.
 *
 * Only on success. A FAILED run dies above with the database intact, because
 * the state a failure happened in is the evidence.
 */
if (sh('pnpm', ['db:reset']).status !== 0) die('db:reset (teardown) failed');

console.log(`\nPASS  the console works against the real API on a reset database (build ${BUILD_ID}).\n`);
