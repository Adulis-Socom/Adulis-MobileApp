#!/usr/bin/env node
/**
 * `pnpm verify:retired` (ARC-BE-06): proves the ACTIVE replacement workspace carries none of the retired
 * architecture. Historical documentation and the archived surface (docs/, the archive tags; the archived Mobile
 * runtime lives only at tag recovery/legacy-dev-20261125) are NOT active code and are not scanned; they are listed as classified at the end.
 * Comments are stripped before scanning code, so a sentence saying "no Reservation" is not a finding.
 * Every detector is first run against a planted sample, so a detector that cannot fire fails the gate.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const failures = [];
const passes = [];
const check = (label, findings) => (findings.length ? findings.forEach((f) => failures.push(`${label}: ${f}`)) : passes.push(label));

// ---------- detectors (pure functions over text) --------------------------------------------------------
const RETIRED_PACKAGES = ['express', '@nestjs/platform-express', '@types/express', 'kysely', 'kysely-codegen', 'graphile-worker', 'node-pg-migrate', 'supertest'];
const RETIRED_CODE = /reservation|payout|handoff|payment_?evidence|paymentEvidence|graphile|kysely|node-pg-migrate|\bexpress\b|seller_?payment_?confirm|refund|surcharge/i;
const RETIRED_SQL_OBJECT = /\bcreate\s+(?:table|type|view|materialized\s+view|function)\s+(?:if\s+not\s+exists\s+)?[\w."]*(?:reservation|order|payment|payout|handoff|evidence|refund|ledger|purchase|payout)/i;
const RETIRED_ROUTE = /reservation|\/orders?\b|payment|payout|handoff|evidence|refund|purchase|checkout\/(?:submit|pay)/i;
const RETIRED_COPY = /reservation|reserved|payment|payout|handoff|refund|place (?:an |your )?order|checkout|purchase/i;

const stripSql = (t) => t.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const depsOf = (pkg) => Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies });
const lockPackages = (lock) => [...lock.matchAll(/^ {2}'?((?:@[\w.-]+\/)?[\w.-]+)@[^:\s]+'?:\s*$/gm)].map((m) => m[1]);

const selfTests = [
  ['manifest detector', () => depsOf({ dependencies: { kysely: '1' } }).some((d) => RETIRED_PACKAGES.includes(d))],
  ['lockfile detector', () => lockPackages("packages:\n\n  graphile-worker@0.17.3:\n    resolution: x\n").includes('graphile-worker')],
  ['code detector ignores comments', () => !RETIRED_CODE.test(stripTs('// no Reservation here\nconst a = 1;')) && RETIRED_CODE.test(stripTs('const reservationId = 1;'))],
  ['SQL object detector', () => RETIRED_SQL_OBJECT.test(stripSql('-- ok\nCREATE TABLE core.reservation (id int);')) && !RETIRED_SQL_OBJECT.test(stripSql('-- no reservation\nselect 1 order by 1;'))],
  ['route detector', () => RETIRED_ROUTE.test('/v1/reservations') && !RETIRED_ROUTE.test('/healthz')],
  ['copy detector', () => RETIRED_COPY.test('Your payment was received') && !RETIRED_COPY.test('Sign in to continue.')],
];
check('detectors fire on planted samples', selfTests.filter(([, ok]) => !ok()).map(([name]) => `${name} did not behave`));

// ---------- 1. the active workspace boundary ----------------------------------------------------------
const workspace = read('pnpm-workspace.yaml');
const members = [...workspace.matchAll(/^\s*-\s*'([^']+)'/gm)].map((m) => m[1]).sort();
check('workspace members are exactly apps/api, apps/console (SC-FE-01), apps/mobile (L2-00B, lane branch) and packages/*', JSON.stringify(members) === JSON.stringify(['apps/api', 'apps/console', 'apps/mobile', 'packages/*']) ? [] : [`members: ${members.join(', ')}`]);

const activePackageDirs = ['.', 'apps/api', 'apps/console', 'apps/mobile', ...readdirSync(path.join(root, 'packages')).map((p) => `packages/${p}`)].filter((d) => existsSync(path.join(root, d, 'package.json')));

// ---------- 2. dependencies (manifests and lockfile) --------------------------------------------------
check(
  'no retired runtime dependency in any active manifest',
  activePackageDirs.flatMap((d) => depsOf(JSON.parse(read(`${d}/package.json`))).filter((dep) => RETIRED_PACKAGES.includes(dep)).map((dep) => `${d}/package.json -> ${dep}`)),
);
const lock = existsSync(path.join(root, 'pnpm-lock.yaml')) ? read('pnpm-lock.yaml') : '';
check('no retired runtime package resolved in pnpm-lock.yaml', lock ? [...new Set(lockPackages(lock).filter((p) => RETIRED_PACKAGES.includes(p)))] : ['pnpm-lock.yaml missing']);
const rootScripts = JSON.stringify(JSON.parse(read('package.json')).scripts);
check('root scripts reach no legacy tooling', /node-pg-migrate|migration-guard|graphile|gates\.mjs|seed\.mjs|mock-api/.test(rootScripts) ? ['root package.json scripts reference legacy tooling'] : []);

// ---------- 3. active source, migrations, worker registrations ----------------------------------------
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'coverage'].includes(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const activeFiles = ['apps/api', 'packages', 'ops/rebuild', 'contracts'].flatMap((d) => walk(path.join(root, d)));
// The guards that NAME the retired markers in order to refuse them are the only files allowed to.
const GUARD_FILES = new Set(['apps/api/src/db/target-guard.ts', 'apps/api/test/lineage.int.ts', 'ops/rebuild/verify-retired-absence.mjs', 'ops/rebuild/disposable-db.sh', 'ops/rebuild/disposable-db.test.sh', 'apps/api/src/openapi/openapi.spec.ts', 'apps/api/test/roles-and-rls.int.ts', 'apps/api/src/platform/platform.spec.ts', 'packages/api-client/test/exports.test-d.ts']);
const codeFiles = activeFiles.filter((f) => /\.(ts|mjs|cjs|js)$/.test(f) && !GUARD_FILES.has(rel(f)) && !f.endsWith('schema.d.ts'));
check('no retired model, runtime or adapter in active code (comments stripped)', codeFiles.filter((f) => RETIRED_CODE.test(stripTs(readFileSync(f, 'utf8')))).map(rel));
const sqlFiles = activeFiles.filter((f) => f.endsWith('.sql'));
check('no retired or placeholder table/type/function in the replacement lineage', sqlFiles.filter((f) => RETIRED_SQL_OBJECT.test(stripSql(readFileSync(f, 'utf8')))).map(rel));
check('no legacy migration chain or manifest', ['db/migrations', 'db/checks', 'db/init', 'ops/migrations.manifest.json', 'docker-compose.yml', 'apps/api/src/jobs'].filter((p) => existsSync(path.join(root, p))));
const journal = JSON.parse(read('apps/api/db/migrations/meta/_journal.json'));
const tags = journal.entries.map((e) => e.tag);
check('migration journal is the replacement lineage only', [
  ...(tags[0] === '0000_platform_foundation' ? [] : [`lineage starts at ${tags[0]}, not 0000_platform_foundation`]),
  ...tags.filter((t, i) => !/^\d{4}_[a-z0-9_]+$/.test(t) || tags.indexOf(t) !== i || !t.startsWith(String(i).padStart(4, '0'))),
]);
const registry = stripTs(read('apps/api/src/events/registry.ts'));
check('production event and consumer registries activate nothing at foundation', /PRODUCTION_EVENTS[^=]*=\s*\[\s*\]/.test(registry) && /PRODUCTION_CONSUMERS[^=]*=\s*\[\s*\]/.test(registry) ? [] : ['a production event or consumer is registered']);

// ---------- 4. generated contract and routes ----------------------------------------------------------
if (existsSync(path.join(root, 'contracts/openapi.json'))) {
  const paths = Object.keys(JSON.parse(read('contracts/openapi.json')).paths ?? {});
  check('no retired or transactional route in the generated contract', paths.filter((p) => RETIRED_ROUTE.test(p)));
  check('generated contract holds only implemented foundation routes', paths.filter((p) => !['/livez', '/healthz'].includes(p) && !p.startsWith('/v1/')));
} else {
  failures.push('generated contract: contracts/openapi.json is missing (run pnpm verify:contract in CI and commit its output)');
}

// ---------- 5. fixtures and release exclusion ---------------------------------------------------------
check('no fixture directory in the active workspace', activeFiles.filter((f) => /[\\/]fixtures?[\\/]/.test(f)).map(rel));
const build = JSON.parse(read('apps/api/tsconfig.build.json'));
check('API release build excludes tests and specs', ['test', 'src/**/*.spec.ts'].filter((x) => !(build.exclude ?? []).includes(x)).map((x) => `tsconfig.build.json does not exclude ${x}`));

// ---------- 6. locale --------------------------------------------------------------------------------
const localeText = ['packages/locale/src/en.ts', 'packages/locale/src/en.console.ts'].map((p) => stripTs(read(p))).join('\n');
check('no obsolete transactional copy in the English catalogue', [...localeText.matchAll(/'([^']+)':\s*'([^']*)'/g)].filter((m) => RETIRED_COPY.test(m[1]) || RETIRED_COPY.test(m[2])).map((m) => m[1]));

// ---------- 7. environment isolation ------------------------------------------------------------------
check(
  'no active file targets the legacy database (adulis-postgres, host 5434) except the guards that refuse it',
  activeFiles.filter((f) => !GUARD_FILES.has(rel(f)) && /\.(ts|mjs|js|sh|json|ya?ml|sql)$/.test(f) && /adulis-postgres|:5434\b|adulis-platform_adulis-pgdata/.test(readFileSync(f, 'utf8'))).map(rel),
);

// ---------- report ------------------------------------------------------------------------------------
for (const p of passes) console.log(`  PASS  ${p}`);
for (const f of failures) console.log(`  FAIL  ${f}`);
console.log('\nClassified, not scanned (not part of the replacement build):');
console.log('  MOBILE            apps/mobile is a workspace member on the Lane 2 branch since L2-00B (a clean walking skeleton): manifests and lockfile are scanned here; its own release scan is apps/mobile/scripts/verify-release.mjs. The archived runtime lives at tag recovery/legacy-dev-20261125 only');
  console.log('  CONSOLE           apps/console is a workspace member since SC-FE-01: manifests and lockfile are scanned here; its own release scan is apps/console/scripts/verify-release.mjs');
console.log('  HISTORICAL        docs/, ops/native, ops/load, ops/provider-verify, ops/runbooks, ops/render.yaml, _staging, _superseded');
console.log('  ARCHIVE REFS      tags recovery/legacy-dev-20261125, recovery/pr-191-482938f, recovery/pr-188-3e1d09b, dev-baseline-rebuild-20261125');
if (failures.length) {
  console.log(`\nverify:retired: ${failures.length} finding(s)`);
  process.exit(1);
}
console.log(`\nverify:retired: ok (${passes.length} checks)`);
