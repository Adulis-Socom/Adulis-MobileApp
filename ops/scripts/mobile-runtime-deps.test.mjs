// INF-CLOSE-01 (ON-003, review B M3): the mobile app's own Babel output requires @babel/runtime helpers, so
// @adulis/mobile must declare @babel/runtime. pnpm's .bin shims add node_modules/.pnpm/node_modules to
// NODE_PATH, which hides a missing declaration from every `pnpm test` run (CI included). This resolves the
// helper from apps/mobile in a child process WITHOUT NODE_PATH -- the strict path -- so removing the
// declaration fails here instead of only in a direct `node .../jest.js` run.
// The workspace packages consumed as source (locale, tokens, api-client) have the same latent gap; that is
// a separate packages/* change (review B M2), not checked here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const mobile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'mobile');

test('@babel/runtime resolves from apps/mobile without NODE_PATH', () => {
  const env = { ...process.env };
  delete env.NODE_PATH;
  const r = spawnSync(process.execPath, ['-e', `process.stdout.write(require.resolve('@babel/runtime/helpers/interopRequireDefault', { paths: [${JSON.stringify(mobile)}] }))`], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, `not resolvable from apps/mobile without NODE_PATH (declare @babel/runtime in apps/mobile/package.json): ${r.stderr}`);
  assert.match(r.stdout, /@babel[\\/]runtime[\\/]helpers[\\/]interopRequireDefault/);
});
