#!/usr/bin/env node
/**
 * `pnpm verify:contract` — ADU-REPO-01 v1.2 §5.1, made executable.
 *
 *   "The generated document must emit /v1 IN ITS PATH KEYS. NestJS
 *    setGlobalPrefix('v1') alone does not do this — it prefixes the routes and
 *    the Swagger document keeps the unprefixed paths, which produces a spec that
 *    serves correctly from the real API and 404s against every mocked path.
 *    Configure the document so the prefix appears in `paths`, and ASSERT IT IN
 *    THE CI JOB THAT GENERATES THE CONTRACT."
 *
 * The failure this catches is the worst shape available: the real API works, the
 * generated types look right, and every front-end workstream developing against
 * the mock gets 404 on every route. Nothing is broken until someone tries to use
 * the thing the seam exists to provide.
 *
 * Demonstrated rather than assumed. Against a probe spec whose path key was
 * `/v1/bootstrap`, Prism served 200 at `/v1/bootstrap` and 404 at `/bootstrap`;
 * Prism serves what the path keys say and ignores a `servers[].url` prefix. So
 * the prefix has to be in the keys, and the base URL is an origin and nothing
 * more — which is what `resolveApiBaseUrl` in `@adulis/api-client` enforces from
 * the other end.
 *
 * INERT TODAY, AND LOUDLY SO. There is no producer until Tier 3, so the gate
 * exits 0 with an explanation when the contract is absent. Failing on a file
 * nobody can currently generate would teach everyone to skip the check — the same
 * reasoning that keeps the pre-A3.5 documents out of verify-docs-ascii's
 * enforced set. The day the producer lands, this fires without anyone
 * remembering to add it.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const CONTRACT = path.join(root, 'contracts', 'openapi.json');

let raw;
try {
  raw = await readFile(CONTRACT, 'utf8');
} catch {
  console.log(`
  SKIP  contracts/openapi.json does not exist yet.

        There is no producer until Tier 3: apps/api carries no @nestjs/swagger,
        no OpenAPI entrypoint, and apps/api/src/main.ts sets no global prefix.
        ADU-REPO-01 v1.2 S11.1 states this as the honest position rather than a
        gap to be closed by hand.

        This gate is therefore INERT, not passing. It fires the day the contract
        lands, without anyone having to remember to add it.
`);
  process.exit(0);
}

const fail = (lines) => {
  console.error(`\nFAIL  contracts/openapi.json\n`);
  for (const l of lines) console.error(`      ${l}`);
  console.error('');
  process.exit(1);
};

let doc;
try {
  doc = JSON.parse(raw);
} catch (e) {
  fail(['is not valid JSON.', String(e.message)]);
}

if (!doc.openapi || typeof doc.openapi !== 'string') {
  fail(['carries no "openapi" version field. This is not an OpenAPI document.']);
}
if (!doc.paths || typeof doc.paths !== 'object') {
  fail(['carries no "paths" object.']);
}

const keys = Object.keys(doc.paths);
if (keys.length === 0) {
  fail(['declares no paths. A contract that describes nothing serves nothing.']);
}

const unprefixed = keys.filter((p) => !p.startsWith('/v1'));

console.log(`\nADU-REPO-01 v1.2 S5.1 - the contract\n`);
console.log(`  openapi ${doc.openapi} - ${keys.length} path key(s)`);

if (unprefixed.length > 0) {
  fail([
    `${unprefixed.length} of ${keys.length} path keys do not begin with /v1:`,
    '',
    ...unprefixed.slice(0, 12).map((p) => `    ${p}`),
    ...(unprefixed.length > 12 ? [`    ... and ${unprefixed.length - 12} more`] : []),
    '',
    'NestJS setGlobalPrefix("v1") alone produces exactly this: it prefixes the',
    'ROUTES and leaves the Swagger document keys unprefixed. The result serves',
    'correctly from the real API and 404s against every mocked path, so it looks',
    'right everywhere except the one place the seam exists to serve.',
    '',
    'Prism ignores a servers[].url prefix - it serves what the path keys say.',
    'Put /v1 in the keys. The base URL stays an origin and nothing more, which',
    'is what resolveApiBaseUrl in @adulis/api-client enforces from the far end.',
  ]);
}

// A servers[] entry carrying /v1 as well would produce /v1/v1/... at every
// client that concatenates. Prism ignores it, so this is a warning about the
// real API rather than the mock - but it is the same doubling S5.1 names.
const doubled = (doc.servers ?? [])
  .map((s) => (typeof s?.url === 'string' ? s.url : ''))
  .filter((u) => /\/v1\/?$/.test(u));

if (doubled.length > 0) {
  fail([
    'servers[].url also carries /v1, and the path keys already do:',
    '',
    ...doubled.map((u) => `    ${u}`),
    '',
    'A client that concatenates a server URL with a path key would request',
    '/v1/v1/... - the doubling ADU-REPO-01 v1.2 S5.1 rules against. The prefix',
    'belongs in exactly one place, and that place is the path keys.',
  ]);
}

console.log(`  PASS  every path key begins with /v1`);
console.log(`  PASS  no servers[].url doubles the prefix\n`);
