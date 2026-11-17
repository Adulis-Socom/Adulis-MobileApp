// INF-CLOSE-01 (ON-003, review B M3): the mobile app's own Babel output requires @babel/runtime helpers, so
// @adulis/mobile must declare @babel/runtime. pnpm's .bin shims add node_modules/.pnpm/node_modules to
// NODE_PATH, which hides a missing declaration from every `pnpm test` run (CI included). This resolves the
// helper from apps/mobile in a child process WITHOUT NODE_PATH -- the strict path -- so removing the
// declaration fails here instead of only in a direct `node .../jest.js` run.
//
// PLAT-HARD-01 (IC01-005, review B M2): the packages mobile consumes as TypeScript source (locale, tokens,
// api-client) also go through mobile's Jest Babel, and none declares @babel/runtime. Their output requires
// no helper today, so none needs it. The second test runs mobile's real Jest transform over their sources
// and fails the day a helper appears that does not resolve from that package without NODE_PATH; the fix is
// then `pnpm add @babel/runtime@<mobile's exact pin> --filter <pkg>` in its own packages/* PR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const mobile = join(repo, 'apps', 'mobile');

/** The specifiers that do NOT resolve from `fromDir` in a child process without NODE_PATH. */
function unresolvedStrict(fromDir, specifiers) {
  if (specifiers.length === 0) return [];
  const env = { ...process.env };
  delete env.NODE_PATH;
  const script = `const out=[];for(const s of ${JSON.stringify(specifiers)}){try{require.resolve(s,{paths:[${JSON.stringify(fromDir)}]})}catch{out.push(s)}}process.stdout.write(JSON.stringify(out))`;
  const r = spawnSync(process.execPath, ['-e', script], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('@babel/runtime resolves from apps/mobile without NODE_PATH', () => {
  const env = { ...process.env };
  delete env.NODE_PATH;
  const r = spawnSync(process.execPath, ['-e', `process.stdout.write(require.resolve('@babel/runtime/helpers/interopRequireDefault', { paths: [${JSON.stringify(mobile)}] }))`], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, `not resolvable from apps/mobile without NODE_PATH (declare @babel/runtime in apps/mobile/package.json): ${r.stderr}`);
  assert.match(r.stdout, /@babel[\\/]runtime[\\/]helpers[\\/]interopRequireDefault/);
});

test('source packages: every @babel/runtime helper in their mobile Jest output resolves without NODE_PATH', async (t) => {
  // Mobile's real transform: jest-expo's babel-jest with the options its preset computes for apps/mobile.
  const req = createRequire(join(mobile, 'package.json'));
  const preset = req(req.resolve('jest-expo/jest-preset'));
  const [babelJestPath, babelOpts] = preset.transform[Object.keys(preset.transform).find((k) => k.includes('[jt]sx'))];
  const babelJest = req(babelJestPath);
  const transformer = (babelJest.default ?? babelJest).createTransformer(babelOpts);
  const helpersIn = (code, filename) => {
    const out = transformer.process(code, filename, { config: { cwd: mobile, rootDir: mobile }, configString: '{}', instrument: false, cacheFS: new Map(), transformerConfig: babelOpts });
    return [...new Set([...out.code.matchAll(/require\(["'](@babel\/runtime\/[^"']+)["']\)/g)].map((m) => m[1]))];
  };

  await t.test('the scan is live: helper code at a packages/* path gets helpers the strict path cannot see', () => {
    const probe = join(repo, 'packages', 'locale', 'src', '__probe__.ts'); // a filename only, never written
    const helpers = helpersIn('import x from "./y"; export async function f() { const [a] = await x(); return a; }', probe);
    assert.ok(helpers.length > 0, 'mobile Babel no longer emits bare @babel/runtime requires: re-evaluate this guard (IC01-005)');
    // From ops/scripts (no package, and the root declares no @babel/runtime) they resolve only through NODE_PATH.
    assert.notDeepEqual(unresolvedStrict(join(repo, 'ops', 'scripts'), helpers), [], 'the strict child still sees NODE_PATH, or the repository root now provides @babel/runtime');
  });

  for (const pkg of ['locale', 'tokens', 'api-client']) {
    await t.test(`@adulis/${pkg}`, () => {
      const src = join(repo, 'packages', pkg, 'src');
      // Recursive: a helper in src/sub/ ships too. .d.ts files hold types only and never load at run time.
      const files = readdirSync(src, { recursive: true }).filter((f) => /\.(ts|tsx|js|jsx)$/.test(f) && !f.endsWith('.d.ts'));
      assert.ok(files.length > 0, `no sources found in ${src}`);
      const helpers = [...new Set(files.flatMap((f) => helpersIn(readFileSync(join(src, f), 'utf8'), join(src, f))))];
      assert.deepEqual(unresolvedStrict(src, helpers), [], `@adulis/${pkg}'s mobile Babel output requires helpers that do not resolve without NODE_PATH: run \`pnpm add @babel/runtime@<apps/mobile's exact pin> --filter @adulis/${pkg}\` in its own packages/* PR`);
    });
  }
});
