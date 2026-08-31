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
if (!existsSync(path.join(root, 'apps', 'api', 'dist', 'main.js'))) {
  die('apps/api/dist/main.js is missing. This gate runs after `build`.');
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

const healthy = await (async () => {
  for (let i = 0; i < 60; i += 1) {
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
