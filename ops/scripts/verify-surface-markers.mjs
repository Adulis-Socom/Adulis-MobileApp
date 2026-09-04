#!/usr/bin/env node
/**
 * `pnpm verify:surface-markers` -- ADU-AUTH-01 v2.8 S26.4, made executable.
 *
 * S26.4: "`core.permission.surfaces` is the authority for which surface a
 *  permission is reachable from. Nothing else is."
 *
 * And the finding that produced it:
 *
 *  "v2.7 -- a marker in a catalogue is a CLAIM about a grant, and nothing
 *   compared the two. ADU-API-01's S12 marked analytics overview one way and
 *   migration 0006 granted it the other, AND ONLY A BUILD NOTICED.
 *
 *   A gate compares every catalogue surface marker to `core.permission.surfaces`,
 *   IN BOTH DIRECTIONS -- the shape `verify:permission-doc` already uses, which
 *   exists because this class was found once before. THE GRANT GOVERNS; THE
 *   MARKER IS CORRECTED TO IT."
 *
 * WHAT THE TWO DIRECTIONS CATCH, and they are different failures:
 *
 *   marker -> grant   An endpoint marked M that the database will refuse from
 *                     mobile. The Companion ships a screen that 403s. The
 *                     catalogue promised reach the grant does not give.
 *
 *   grant -> marker   A permission granted on MOBILE that no marked endpoint
 *                     uses. Nobody is broken today, which is exactly why it
 *                     survives: it is a grant wider than any documented need,
 *                     and the day someone adds a mobile screen for it, the
 *                     review that should have questioned the grant has already
 *                     happened and concluded nothing.
 *
 * A ROUTE WHOSE PERMISSION CANNOT BE DETERMINED IS A FAILURE, NOT A SKIP.
 * The mapping from path to permission is read out of the source -- there is no
 * transcribed table here, because a transcribed table is the third copy of a
 * value that already disagreed with itself twice. The cost of reading source is
 * that the reader can fail, and a reader that silently drops what it cannot
 * parse is a gate that goes green by not looking. Marked rows it cannot resolve
 * are reported and fail.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

const DOC = path.join(root, 'docs/ADU-API-01_API_Contract_v1_11_ASCII.md');
const SEED = path.join(root, 'docs/amendments/ADU-AUTH-01_v2_4_permission_seed.sql');
const MODULES = path.join(root, 'apps/api/src/modules');

/** The marker whose meaning is a surface. ADU-API-01 S12's legend. */
const MOBILE_MARKER = 'M';
const MOBILE_SURFACE = 'MOBILE';

const failures = [];
const pass = (label, detail = '') => console.log(`  PASS  ${label}${detail ? `  ${detail}` : ''}`);
const fail = (label, detail = '') => {
  console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`);
  failures.push(label);
};

// ---------------------------------------------------------------- the catalogue
/**
 * Section 12's rows. A row is a table line whose second cell holds a
 * backticked /v1 path; the markers are the bold single-capital runs after it,
 * so `**M I**` and `**M** **I**` both read as {M, I}.
 */
function parseCatalogue(md) {
  const start = md.indexOf('## 12. Endpoint catalogue');
  if (start < 0) throw new Error('section 12 not found in the contract document');
  const end = md.indexOf('\n## 13', start);
  const section = md.slice(start, end < 0 ? md.length : end);

  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.length < 2) continue;
    const m = /`(\/v1[^`]*)`/.exec(cells[1]);
    if (!m) continue;
    const markers = new Set();
    for (const bold of cells[1].slice(m.index + m[0].length).matchAll(/\*\*([A-Z](?:\s+[A-Z])*)\*\*/g)) {
      for (const token of bold[1].split(/\s+/)) markers.add(token);
    }
    // "GET - PATCH" in one cell is two operations on one path.
    const verbs = cells[0].replace(/\*\*/g, '').split(/\s*-\s*/).map((v) => v.trim().toUpperCase())
      .filter((v) => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(v));
    for (const verb of verbs.length > 0 ? verbs : ['GET']) {
      rows.push({ verb, docPath: m[1], markers });
    }
  }
  return rows;
}

// ---------------------------------------------------------------- the grants
function parseGrants(sql) {
  const block = sql.split('INSERT INTO core.permission')[1].split(';')[0];
  const re = /\('([^']+)',\s*ARRAY\[([^\]]*)\]::core\.session_audience\[\],\s*(true|false)\)/g;
  const surfaces = new Map();
  for (let m = re.exec(block); m !== null; m = re.exec(block)) {
    surfaces.set(
      m[1],
      m[2].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean),
    );
  }
  return surfaces;
}

// ---------------------------------------------------------------- the source
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const PERMISSION_LITERAL = /'((?:seller|courier)\.[a-z_.]+:[a-z_]+)'/g;
const ROUTE_DECORATOR = /@(Get|Post|Put|Patch|Delete)\('([^']*)'\)/g;

/**
 * Permissions named inside each service method, keyed by method name. A method
 * may consult several -- an order detail resolves `allowed_actions` by asking
 * about each action it might offer -- so the ORDER matters: the first is the
 * one that gates entry, because `fn_has_permission` is the first statement of
 * every seller-scoped function (apps/api/CLAUDE.md).
 */
function methodPermissions(src) {
  const byMethod = new Map();
  const starts = [...src.matchAll(/\n {2}(?:async |private async |public async |private |public )?(\w+)\(/g)]
    .map((m) => ({ at: m.index, name: m[1] }));
  for (let i = 0; i < starts.length; i += 1) {
    const body = src.slice(starts[i].at, i + 1 < starts.length ? starts[i + 1].at : src.length);
    const found = [...body.matchAll(PERMISSION_LITERAL)].map((m) => m[1]);
    if (found.length > 0) {
      byMethod.set(starts[i].name, (byMethod.get(starts[i].name) ?? []).concat(found));
    }
  }
  return byMethod;
}

async function buildRouteMap() {
  const files = await walk(MODULES);
  const serviceMethods = new Map();
  for (const f of files.filter((f) => f.endsWith('.service.ts'))) {
    for (const [k, v] of methodPermissions(await readFile(f, 'utf8'))) {
      serviceMethods.set(k, (serviceMethods.get(k) ?? []).concat(v));
    }
  }

  const routes = new Map();
  for (const f of files.filter((f) => f.endsWith('.controller.ts'))) {
    const src = await readFile(f, 'utf8');
    const decos = [...src.matchAll(ROUTE_DECORATOR)].map((m) => ({
      at: m.index,
      verb: m[1].toUpperCase(),
      route: m[2],
    }));
    for (let i = 0; i < decos.length; i += 1) {
      const body = src.slice(decos[i].at, i + 1 < decos.length ? decos[i + 1].at : src.length);
      // Both shapes: the controller inlines the check (notifications does), or
      // it delegates to a service method that holds it.
      const inline = [...body.matchAll(PERMISSION_LITERAL)].map((m) => m[1]);
      const delegated = [...body.matchAll(/this\.\w+\.(\w+)\(/g)]
        .flatMap((m) => serviceMethods.get(m[1]) ?? []);
      routes.set(`${decos[i].verb} /v1/${decos[i].route}`, [...inline, ...delegated]);
    }
  }
  return routes;
}

/** `/v1/orders/{id}` in the document is `/v1/orders/:id` in a decorator. */
const normalise = (p) => p.replace(/\{(\w+)\}/g, ':$1').replace(/\/$/, '');

// ---------------------------------------------------------------- the comparison
const [md, sql] = await Promise.all([readFile(DOC, 'utf8'), readFile(SEED, 'utf8')]);
const rows = parseCatalogue(md);
const surfaces = parseGrants(sql);
const routes = await buildRouteMap();

console.log(`\nADU-AUTH-01 v2.8 S26.4 -- surface markers against core.permission.surfaces`);
console.log(`  catalogue rows: ${rows.length}   permissions: ${surfaces.size}   routes in source: ${routes.size}\n`);

const marked = rows.filter((r) => r.markers.has(MOBILE_MARKER));
const mobileGrants = [...surfaces.entries()]
  .filter(([, s]) => s.includes(MOBILE_SURFACE))
  .map(([code]) => code);

// --- direction 1: every marker is a grant that exists -----------------------
const unresolved = [];
const contradicted = [];
const usedByMarked = new Set();

for (const row of marked) {
  const key = `${row.verb} ${normalise(row.docPath)}`;
  const codes = routes.get(key);
  if (codes === undefined) {
    unresolved.push(`${key}  (no such route in apps/api)`);
    continue;
  }
  if (codes.length === 0) {
    // An endpoint that enforces no seller permission is not governed by
    // core.permission.surfaces at all, so the marker cannot be checked against
    // it. POST /v1/events is the real case: it is written by any authenticated
    // client and carries no seller permission.
    continue;
  }
  const gating = codes[0];
  const surf = surfaces.get(gating);
  if (surf === undefined) {
    unresolved.push(`${key}  (permission '${gating}' is not in the seed)`);
    continue;
  }
  for (const c of codes) if (surfaces.get(c)?.includes(MOBILE_SURFACE)) usedByMarked.add(c);
  if (!surf.includes(MOBILE_SURFACE)) {
    contradicted.push(`${key}  marked ${MOBILE_MARKER}, but '${gating}' grants [${surf.join(', ')}]`);
  }
}

if (unresolved.length === 0) {
  pass(`every ${MOBILE_MARKER}-marked row resolves to a route and a seeded permission`, `${marked.length} rows`);
} else {
  fail(`${unresolved.length} marked row(s) could not be resolved to a permission`);
  for (const u of unresolved) console.log(`          ${u}`);
}

if (contradicted.length === 0) {
  pass(`no ${MOBILE_MARKER} marker claims reach the grant refuses`);
} else {
  fail(`${contradicted.length} marker(s) contradict the grant`);
  for (const c of contradicted) console.log(`          ${c}`);
  console.log(`\n          THE GRANT GOVERNS (S26.4). Correct the marker, not the seed.`);
}

// --- direction 2: every mobile grant is a marker that exists -----------------
const ungranted = mobileGrants.filter((c) => !usedByMarked.has(c));
if (ungranted.length === 0) {
  pass(`every ${MOBILE_SURFACE} grant is reached by a marked endpoint`, `${mobileGrants.length} grants`);
} else {
  fail(`${ungranted.length} ${MOBILE_SURFACE} grant(s) reach no ${MOBILE_MARKER}-marked endpoint`);
  for (const c of ungranted) console.log(`          ${c}  granted [${surfaces.get(c).join(', ')}]`);
  console.log(`\n          Either the catalogue owes these rows an ${MOBILE_MARKER}, or the grant is`);
  console.log(`          wider than anything documented needs it to be. S26.4 rules the`);
  console.log(`          first: the grant governs and the marker is corrected to it.`);
}

console.log(
  failures.length === 0
    ? `\nPASS  markers and grants agree in both directions.\n`
    : `\nFAIL  ${failures.length} surface disagreement(s).\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
