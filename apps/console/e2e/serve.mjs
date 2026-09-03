/**
 * e2e/serve.mjs -- serves the BUILT console for the harness.
 *
 * The artifact under test is `dist`, not the dev server: Vite's dev server
 * transforms modules on demand and serves a different bundle from the one a
 * seller receives, and two of C-3's three defects were in what the build
 * produced rather than in what the source said.
 *
 * It replays the production `_headers` policy, exactly as `boot-smoke` does --
 * a CSP that breaks a screen is a defect of that screen, and a harness that
 * serves the app without its policy would never see it.
 *
 * EXCEPT connect-src, WHICH IS DERIVED, NOT REPLAYED (T11 Phase 2). The
 * production policy names the production API origin; the build under test is
 * pointed at a local one. The first version replayed the production directive
 * verbatim, so the built console could not make a single API call under its
 * own harness -- every fetch refused by connect-src before it left the
 * browser -- and the suite only ever went green against something else
 * serving the port. A POLICY HARDCODED IN ONE FILE AND AN ORIGIN CONFIGURED
 * IN ANOTHER WILL DRIFT, AND THE DRIFT IS SILENT: so the directive is rebuilt
 * here from E2E_API_BASE_URL, the same value the gate hands the build as
 * VITE_API_BASE_URL. Same shape as production ('self' plus exactly one API
 * origin); only the origin token differs, and both come from one variable.
 *
 * SPA fallback: any path that is not a file is `index.html`, because
 * `/s/:id/orders` is a route rather than a directory.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, '..', 'dist');
const PORT = Number(process.argv[2] ?? 5173);

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

/**
 * The API origin under test -- the SAME configuration the build consumed.
 * The gate exports it; the default matches the recipe in
 * apps/console/CLAUDE.md so a by-hand run behaves like the dev loop.
 */
const API_ORIGIN = new URL(process.env['E2E_API_BASE_URL'] ?? 'http://localhost:3000').origin;
// T20 S4: the media origin the browser PUTs to and renders from. Same
// derive-not-replay discipline as the API origin -- one variable, injected
// into BOTH connect-src (the PUT) and img-src (the render), so the harness
// serves a policy the real upload can pass. serve.mjs rewriting one origin
// on a single-origin assumption was the drift T18's recon named.
const MEDIA_ORIGIN = new URL(process.env['E2E_MEDIA_ORIGIN'] ?? 'http://localhost:9100').origin;

/** The `/*` block of dist/_headers -- the policy the seller's browser gets. */
const headers = (() => {
  const f = path.join(DIST, '_headers');
  if (!existsSync(f)) return {};
  const out = {};
  let inGlob = false;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (/^\/\*/.test(line)) { inGlob = true; continue; }
    if (!inGlob) continue;
    const m = line.match(/^\s{2}([A-Za-z-]+):\s*(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  const csp = out['Content-Security-Policy'];
  if (csp) {
    // Derive, do not replay -- see the header. Everything but connect-src is
    // the production policy byte for byte.
    out['Content-Security-Policy'] = csp
      .replace(/connect-src [^;]+/, "connect-src 'self' " + API_ORIGIN + ' ' + MEDIA_ORIGIN)
      .replace(/img-src [^;]+/, "img-src 'self' " + MEDIA_ORIGIN + ' blob:');
  }
  return out;
})();

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('apps/console/dist/index.html is missing. Build the console first.');
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://console.invalid');
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  let file = path.resolve(DIST, rel);
  if (!file.startsWith(path.resolve(DIST)) || !existsSync(file)) file = path.join(DIST, 'index.html');
  res.writeHead(200, { ...headers, 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(PORT, () =>
  console.log(
    `console dist on :${PORT} -- connect-src derived for ${API_ORIGIN}; ` +
      `CSP: ${headers['Content-Security-Policy'] ? 'on' : 'ABSENT (no dist/_headers)'}`,
  ),
);
