#!/usr/bin/env node
/**
 * ops/scripts/verify-console-e2e.mjs -- gate `console-e2e`.
 *
 * The console harness, owed at C-3 and built at T10. It runs Playwright
 * against the BUILT console and the REAL API, on a database reset immediately
 * before -- which is what makes a readiness assertion mean anything, because a
 * seller's readiness rows are a function of what is in the database.
 *
 * ==========================================================================
 * IT IS DESTRUCTIVE, SO IT ASSERTS ITS ENVIRONMENT
 * ==========================================================================
 * `pnpm db:reset` drops ten schemas. D-142's ruling covers this exactly: any
 * script that drops, truncates or purges validates NODE_ENV against a closed
 * set and refuses if it is unset. Duplicated rather than imported, per the
 * same ruling -- the coupling D-107 avoided is real, and it is not worth an
 * unguarded reset.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts });

const die = (msg, code = 1) => {
  console.error(`\nFAIL  ${msg}\n`);
  process.exit(code);
};

console.log('\nConsole e2e -- the built console, the real API, a reset database\n');

/* -- 1. the artifact under test ------------------------------------------- */
/*
 * THE API IS REBUILT HERE, and the first version of this gate did not do it.
 *
 * It checked that `dist/main.js` EXISTED and ran whatever was in it, while
 * rebuilding the console two steps below. That asymmetry is a check that does
 * not check: inside `ci:local` the `build` gate runs first so dist is fresh,
 * but run directly -- which is how anyone works on a console change -- it
 * drives a NEW console against an OLD API.
 *
 * It cost a real diagnosis on its first outing. C-4's list rendered
 * "undefined items" and no confirmation clock, and both readings were correct
 * for the binary that was running: `line_count` and `payment_sla_deadline`
 * had been added to orders.service.ts minutes earlier and compiled into
 * nothing. The failure was indistinguishable from a product defect, which is
 * the expensive kind of wrong answer for a gate to give.
 *
 * A rebuild costs seconds. A gate that tests a stale artifact costs an hour
 * of looking in the wrong file, and it is the same class as D-132: a check
 * whose PASS meant less than its message claimed.
 */
console.log('-- build the api ----------------------------------------------');
if (sh('pnpm', ['--filter', '@adulis/api', 'build']).status !== 0) {
  die('the api build failed');
}
if (!existsSync(path.join(root, 'apps', 'api', 'dist', 'main.js'))) {
  die('apps/api/dist/main.js is missing after a successful build.');
}

console.log('-- reset ------------------------------------------------------');
if (sh('pnpm', ['db:reset']).status !== 0) die('db:reset failed');

/**
 * THE CONSOLE IS REBUILT WITH A BASE URL, and that is not incidental. D-138:
 * every other build in this repository omits VITE_API_BASE_URL, so
 * `resolveApiBaseUrl` throws before `fetch` and the console never reaches the
 * API at all -- which is why `boot-smoke` measures zero CSP violations and
 * cannot exercise `connect-src`. A harness built the same way would drive a
 * console that talks to nothing.
 */
console.log('\n-- build the console against the API ---------------------------');
if (sh('pnpm', ['--filter', '@adulis/console', 'build'], {
  env: { ...process.env, VITE_API_BASE_URL: API_BASE },
}).status !== 0) {
  die('the console build failed');
}

/* -- 2. the API, with the environment its dev SMS adapter needs ----------- */
console.log('\n-- api --------------------------------------------------------');

/*
 * THE PORT MUST BE FREE, AND THIS CHECK EXISTS BECAUSE ITS ABSENCE COST AN
 * AFTERNOON.
 *
 * The gate spawns an API and then waits for /healthz to answer. But /healthz
 * answering proves that AN api is up -- not that THIS one is. With a stale
 * process already holding the port (a dev server, a previous run that was
 * interrupted between spawn and kill), the child dies instantly on
 * EADDRINUSE, the health check succeeds against the ZOMBIE, and the whole
 * suite runs against whatever binary that process was built from.
 *
 * That is what happened on C-4's first run: seven tests failed, the console
 * showed "undefined items" and no confirmation clock, and both were true
 * readings of an API compiled before those fields existed. Every symptom
 * pointed at the screens. The gate was green about being up and wrong about
 * what was up -- the same shape as D-132, where the check ran and the answer
 * meant nothing.
 *
 * So: refuse to start if anything is already listening, and name what to do.
 * A gate that silently tests someone else's process is worse than one that
 * will not start.
 */
const portTaken = await fetch(`${API_BASE}/healthz`).then(() => true).catch(() => false);
if (portTaken) {
  die(
    `something is already listening on ${API_BASE}.\n` +
      '      This gate starts its own API and would otherwise test THAT process\n' +
      '      instead -- a stale binary answering /healthz looks exactly like a\n' +
      '      healthy start. Stop the other server and run this again.',
  );
}

const api = spawn('node', ['dist/main.js'], {
  cwd: path.join(root, 'apps', 'api'),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development', CONSOLE_ORIGIN, PORT: String(API_PORT) },
});
let apiLog = '';
api.stdout.on('data', (d) => { apiLog += d; });
api.stderr.on('data', (d) => { apiLog += d; });

const stopApi = () => { try { api.kill(); } catch { /* already gone */ } };
process.on('exit', stopApi);
process.on('SIGINT', () => { stopApi(); process.exit(130); });

// The other half of the same lesson: if the child exits before /healthz
// answers, stop waiting for it. Without this the loop spends 30 seconds
// polling for a process that is already dead, then reports a timeout rather
// than the exit code and the stderr that say exactly what went wrong.
let apiExited = null;
api.on('exit', (code, signal) => { apiExited = signal ?? code ?? 0; });

const healthy = await (async () => {
  for (let i = 0; i < 60; i += 1) {
    if (apiExited !== null) return false;
    try {
      const r = await fetch(`${API_BASE}/healthz`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
})();
if (!healthy) {
  stopApi();
  console.error(apiLog.slice(-2000));
  die(`the API did not answer ${API_BASE}/healthz within 30s`);
}
console.log(`   api listening on ${API_BASE}, CONSOLE_ORIGIN=${CONSOLE_ORIGIN}`);

/* -- 3. drive it ---------------------------------------------------------- */
console.log('\n-- playwright -------------------------------------------------');
const run = sh('pnpm', ['--filter', '@adulis/console', 'exec', 'playwright', 'test'], {
  env: { ...process.env, E2E_API_BASE_URL: API_BASE, E2E_CONSOLE_PORT: String(CONSOLE_PORT) },
});
stopApi();

if (run.status !== 0) {
  console.error('\n--- the API said, while that ran: ---');
  console.error(apiLog.slice(-2000));
  die('the console e2e suite failed');
}

console.log('\nPASS  the console works against the real API on a reset database.\n');
