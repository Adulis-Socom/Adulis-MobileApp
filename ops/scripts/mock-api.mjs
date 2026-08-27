#!/usr/bin/env node
/**
 * `pnpm mock:api` — ADU-REPO-01 §5.1's third guarantee.
 *
 *   "Every client develops against the Prism mock and flips a base URL when the
 *    endpoint lands. No front-end workstream is ever blocked on the backend."
 *
 * That guarantee is only real if the mock starts from a fresh clone, which is why
 * `contracts/openapi.json` is a tracked file written by CI rather than an ignored
 * build artefact. This wrapper exists so that when it is missing — which it is
 * today — the failure explains itself instead of surfacing as an ENOENT from a
 * tool the reader did not invoke.
 */

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const CONTRACT = path.join(root, 'contracts', 'openapi.json');
const PORT = process.env.MOCK_API_PORT ?? '4010';

try {
  await access(CONTRACT);
} catch {
  console.error(`
  The mock cannot start: contracts/openapi.json does not exist yet.

  Nothing publishes the contract at present:
    - apps/api carries no @nestjs/swagger and no OpenAPI entrypoint
    - .github/workflows/ci.yml gates the OpenAPI publish on Tier 3
    - apps/api/src/main.ts sets no global /v1 prefix, and ADU-API-01 writes
      every route as /v1/... - the prefix has to reach the contract's own
      "paths" keys, because Prism ignores one carried in servers[].url and
      would 404 on every mocked route

  This is a known, reported gap in ADU-REPO-01 §11: steps 2 and 3 create the
  seam, and the seam has no producer until the backend publishes a first spec.

  DO NOT hand-write contracts/openapi.json to get past this. Root CLAUDE.md:
  "a hand-edited spec is a lie with authority" - every client would then be
  typed against a contract the server does not implement, and nothing would
  fail until runtime.
`);
  process.exit(1);
}

// Pinned at 5.14.2 in the root devDependencies. Every @stoplight/prism-cli from
// 5.15.7 declares engines.node >= 24 and this repo is Node 22 (.nvmrc, root
// engines), so a routine `pnpm up --latest` would silently break the mock for
// every front-end workstream. `pnpm exec` resolves from node_modules/.bin and
// does NOT auto-install, so an undeclared prism is a hard command-not-found
// rather than a quiet upgrade - which is why the pin has to be a real dependency
// and not a comment claiming one.
//
// Static mode, not --dynamic: json-schema-faker fills additional properties and
// produces lorem for formatted strings, so --dynamic returns fields that are not
// in the schema at all. Static honours `example:` from @ApiProperty, which keeps
// mock realism under the contract's control rather than a faker's.
const args = ['prism', 'mock', CONTRACT, '--port', PORT, '--host', '127.0.0.1'];
console.log(`  prism mock contracts/openapi.json -> http://127.0.0.1:${PORT}\n`);

const child = spawn('pnpm', ['exec', ...args], { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 0));
