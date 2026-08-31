#!/usr/bin/env node
/**
 * ops/scripts/verify-boot-smoke.mjs -- gate `boot-smoke`.
 *
 * WHAT IT IS FOR. Gates `no-unsafe-eval` and `production-react` read the built
 * console as TEXT: they grep the bundle. Text is exactly what a bundle that
 * throws before React mounts looks fine in. T7 Phase 5 shipped one -- the
 * review that caught it did so by loading the page, not by reading it -- and
 * nothing in CI would have. This gate loads the built console in a real
 * browser and asserts it MOUNTED.
 *
 * IT SERVES THE REAL SECURITY HEADERS. apps/console/dist/_headers is the
 * production policy (ADU-CON-02 v3.1 S3.9), and the smoke server replays its
 * `/*` block verbatim. A CSP that breaks the console at LOAD time -- a
 * blocked script, style, font or worker -- is a boot failure, and this gate
 * catches it. Measured: zero violations.
 *
 * WHAT IT DOES NOT EXERCISE, and the first version of this comment got this
 * wrong (D-138). It said the console "makes no API call until a person acts".
 * It does: SessionProvider's mount effect calls `/bootstrap` and then
 * `/auth/sessions`, and its own comment reads "FIRST CALL, ALWAYS". The
 * reason no `connect-src` violation is measured is different and was
 * undisclosed -- CI builds without VITE_API_BASE_URL, so `apiBase()` throws
 * inside `resolveApiBaseUrl` BEFORE fetch is reached, the app converts it to
 * an ApiError('CONFIG'), and no request is ever attempted.
 *
 * So `connect-src` -- the one directive in this policy that constrains what
 * the console does at RUNTIME rather than at load -- is not tested here.
 * Saying so is the point: a gate that quietly benefits from a misconfiguration
 * it does not name is the class this repository keeps finding.
 *
 * THE ONE THING IT ADDS TO THE PAGE is `<script src="/__smoke.js">`, injected
 * after <head> so its handlers are installed before the deferred module
 * script runs. It is external, not inline, precisely so that it loads under
 * `script-src 'self'` -- instrumentation that needed the policy relaxed would
 * be testing a page nobody ships.
 *
 * WHAT IT DOES NOT PROVE, said plainly so the next reader does not overtrust
 * it. `#root` having children means React mounted SOMETHING -- an error
 * boundary rendering a failure message would satisfy it. It watches for
 * 2500 milliseconds, so a throw that happens later, or on a route it never
 * navigates to, is invisible. It is a boot test, not a test suite, and the
 * console still has no harness (owed at C-3).
 *
 * IT FAILS RATHER THAN SKIPS when no browser is found. A gate that goes green
 * on a machine that could not run it is the defect this repository has now
 * found at four separate gates (D-121, D-122, D-126, D-132).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(root, 'apps', 'console', 'dist');
const SETTLE_MS = 2500;

let failures = 0;
const fail = (m) => {
  console.error(`FAIL  ${m}`);
  failures += 1;
};
const pass = (m) => console.log(`PASS  ${m}`);

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('FAIL  apps/console/dist/index.html is missing. This gate runs after `build`.');
  process.exit(1);
}

/* -- find a browser ------------------------------------------------------ */
const CANDIDATES = [
  process.env.SMOKE_BROWSER,
  process.platform === 'win32' && 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  process.platform === 'win32' && 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/microsoft-edge',
].filter(Boolean);
const browser = CANDIDATES.find((c) => existsSync(c));
if (!browser) {
  console.error('FAIL  no headless browser found. Tried:');
  for (const c of CANDIDATES) console.error(`        ${c}`);
  console.error('      Set SMOKE_BROWSER to a Chromium binary. This gate does not skip:');
  console.error('      a console that cannot be loaded has not been shown to boot.');
  process.exit(1);
}

/* -- replay the production headers --------------------------------------- */
const headers = (() => {
  const out = {};
  let inGlob = false;
  for (const line of readFileSync(path.join(DIST, '_headers'), 'utf8').split(/\r?\n/)) {
    if (/^\/\*/.test(line)) {
      inGlob = true;
      continue;
    }
    if (!inGlob) continue;
    const m = line.match(/^\s{2}([A-Za-z-]+):\s*(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
})();
if (!headers['Content-Security-Policy']) {
  fail('_headers carries no Content-Security-Policy in its /* block; the smoke would test an unprotected page');
}

const PROBE = `
window.__smoke = { errors: [], rejections: [], csp: [] };
addEventListener('error', (e) => __smoke.errors.push(String((e && e.message) || e)));
addEventListener('unhandledrejection', (e) =>
  __smoke.rejections.push(String((e && e.reason && (e.reason.message || e.reason)) || e)));
document.addEventListener('securitypolicyviolation', (e) =>
  __smoke.csp.push(e.violatedDirective + ' <- ' + (e.blockedURI || '')));
setTimeout(() => {
  const el = document.getElementById('root');
  const out = document.createElement('pre');
  out.id = 'smoke-report';
  out.textContent = JSON.stringify({
    rootChildren: el ? el.children.length : -1,
    errors: __smoke.errors,
    rejections: __smoke.rejections,
    csp: __smoke.csp,
  });
  document.body.appendChild(out);
}, ${SETTLE_MS});
`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

let injectionFailed = false;
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://smoke.invalid');
  if (url.pathname === '/__smoke.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(PROBE);
    return;
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  let file = path.resolve(DIST, rel);
  // An SPA serves index.html for unknown routes; the containment check keeps a
  // traversal in the URL from reading outside dist.
  if (!file.startsWith(path.resolve(DIST)) || !existsSync(file)) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  const h = { ...headers, 'Content-Type': TYPES[ext] ?? 'application/octet-stream' };
  if (ext === '.html') {
    const raw = readFileSync(file, 'utf8');
    const html = raw.replace('<head>', '<head>\n    <script src="/__smoke.js"></script>');
    // If index.html ever stops carrying a literal `<head>`, the injection
    // becomes a no-op and the only symptom is a missing report -- a red with
    // the wrong explanation. Say the real reason once, here.
    if (html === raw) injectionFailed = true;
    res.writeHead(200, h);
    res.end(html);
    return;
  }
  res.writeHead(200, h);
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();

const tmp = mkdtempSync(path.join(os.tmpdir(), 'adulis-smoke-'));
const domFile = path.join(tmp, 'dom.html');
const fd = openSync(domFile, 'w');
const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${path.join(tmp, 'profile')}`,
  `--virtual-time-budget=${SETTLE_MS + 5500}`,
  '--dump-dom',
  `http://127.0.0.1:${port}/`,
];
/**
 * SPAWNED ASYNCHRONOUSLY, and that is not a style choice. The first version
 * used spawnSync, which blocks the event loop -- so the HTTP server three
 * lines above could not answer the browser this line launches. The browser
 * waited on a page that would never arrive and the gate failed with
 * ETIMEDOUT, which looks exactly like a broken console.
 *
 * stdout goes to a file rather than a pipe: on Windows a piped --dump-dom
 * truncates unpredictably, and a truncated DOM reads as a missing report.
 */
const r = await new Promise((resolve) => {
  const child = spawn(browser, args, { stdio: ['ignore', fd, 'ignore'] });
  const kill = setTimeout(() => {
    child.kill('SIGKILL');
    resolve({ error: new Error('the browser did not exit within 90s') });
  }, 90_000);
  child.on('error', (error) => {
    clearTimeout(kill);
    resolve({ error });
  });
  child.on('exit', () => {
    clearTimeout(kill);
    resolve({});
  });
});
closeSync(fd);
server.close();

const decodeEntities = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, String.fromCharCode(34))
    .replace(/&#039;/g, String.fromCharCode(39))
    .replace(/&amp;/g, '&');

if (r.error) {
  fail(`the browser did not run: ${r.error.message}`);
} else {
  const dom = readFileSync(domFile, 'utf8');
  const m = dom.match(/<pre id="smoke-report">([\s\S]*?)<\/pre>/);
  if (!m && injectionFailed) {
    fail('index.html carries no literal `<head>`, so the probe was never injected. Fix the injection, not the console.');
  } else if (!m) {
    fail('no smoke report in the DOM: the page never reached the probe. First 400 characters:');
    console.error(`      ${dom.slice(0, 400).replace(/\n/g, ' ')}`);
  } else {
    const rep = JSON.parse(decodeEntities(m[1]));
    if (rep.rootChildren < 1) {
      const what = rep.rootChildren === -1 ? 'no element at all' : `${rep.rootChildren} children`;
      fail(`#root has ${what}: the console did not mount`);
    } else {
      pass(`#root mounted with ${rep.rootChildren} child element(s)`);
    }
    for (const e of rep.errors) fail(`uncaught error: ${e}`);
    for (const e of rep.rejections) fail(`unhandled rejection: ${e}`);
    for (const e of rep.csp) fail(`CSP violation under the production policy: ${e}`);
    if (!rep.errors.length && !rep.rejections.length && !rep.csp.length) {
      pass('no uncaught error, no unhandled rejection, no CSP violation');
    }
  }
}

/**
 * The break flag must not be able to ship. main.tsx carries a module-scope
 * throw behind `import.meta.env.VITE_SMOKE_BREAK`, which exists so this gate
 * can be PROVEN to fire rather than trusted. Vite substitutes the value at
 * build time, so a normal build drops the branch entirely -- and this asserts
 * that, because a deliberate throw that can reach production would be a worse
 * defect than the one the flag proves.
 */
const assets = path.join(DIST, 'assets');
const bundles = existsSync(assets)
  ? readdirSync(assets)
      .filter((f) => f.endsWith('.js'))
      .map((f) => path.join(assets, f))
  : [];
if (!bundles.length) {
  fail('no .js in apps/console/dist/assets: nothing was checked for the break flag');
} else {
  const leaked = bundles.filter((b) => readFileSync(b, 'utf8').includes('VITE_SMOKE_BREAK'));
  if (leaked.length) {
    fail(`the smoke break flag survived into the bundle: ${leaked.map((b) => path.basename(b)).join(', ')}`);
  } else {
    pass(`the smoke break flag is compiled out of all ${bundles.length} shipped bundle(s)`);
  }
}

rmSync(tmp, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
