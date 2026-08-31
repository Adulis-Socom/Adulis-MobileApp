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
}).listen(PORT, () => console.log(`console dist on :${PORT}`));
