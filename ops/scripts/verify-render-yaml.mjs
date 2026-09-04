/**
 * verify-render-yaml.mjs -- the gate that makes an UNAPPLIED blueprint honest
 * (T23 Phase 4, gate `render-yaml`).
 *
 * D-80 kept `ops/render.yaml` out of the repository for seventeen orders with
 * one argument, and it is a good argument: "inventing a render.yaml that has
 * never been applied would be a file that looks authoritative and has never
 * been true." T23 Phase 1 looked for a Render account to verify against, found
 * no credentials, and parked. So the file lands unapplied, and this is what
 * stops it becoming the thing D-80 feared.
 *
 * WHAT THIS GATE CAN CHECK, and it is more than it sounds: every claim the
 * blueprint makes ABOUT THIS REPOSITORY. Those are the claims that ROT --
 * between the day the file is written and the day somebody applies it, a
 * script gets renamed, a route moves, a new required variable appears, and the
 * blueprint keeps saying the old thing with total confidence.
 *
 *   1. Every pnpm/node command it runs exists in the package that owns it.
 *   2. The health check path is a route the API actually serves.
 *   3. The pre-deploy runs BOTH db:migrate and worker:install (D-52).
 *   4. Every variable .env.example declares is declared for the API.
 *   5. No secret has a literal value here, and NODE_ENV is in the closed set.
 *   6. Every `fromService` names a service this file defines.
 *
 * WHAT IT CANNOT CHECK, stated rather than implied: whether Render accepts the
 * schema, whether the plans exist, whether the region is available, or whether
 * any of it boots. Only applying it answers those, and until someone does, the
 * file's first line says so.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const BLUEPRINT = path.join(ROOT, 'ops', 'render.yaml');

let failed = 0;
const fail = (m) => {
  console.error(`  FAIL  ${m}`);
  failed += 1;
};
const pass = (m) => console.log(`  PASS  ${m}`);

const raw = readFileSync(BLUEPRINT, 'utf8');
const doc = parse(raw);
const services = doc.services ?? [];
const api = services.find((s) => s.type === 'web' && s.name.endsWith('-api'));
const worker = services.find((s) => s.type === 'worker');
const consoleSite = services.find((s) => s.runtime === 'static');

if (!api || !worker || !consoleSite) {
  fail('the blueprint must define an api web service, a worker and a static console');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 0. IT STILL SAYS IT HAS NEVER BEEN APPLIED.
//
// Not decoration. The moment this file is applied that sentence becomes false,
// and a file whose first paragraph is false is worse than one with no
// paragraph. Deleting the line is how the person who applied it says so, and
// this gate is what makes the deletion a deliberate act rather than a drift.
// ---------------------------------------------------------------------------
if (raw.includes('THIS FILE HAS NEVER BEEN APPLIED')) {
  pass('the blueprint still declares itself unapplied');
} else {
  console.log('  NOTE  the "never been applied" declaration is gone -- someone applied it.');
  console.log('        Nothing here can confirm that. If it is not true, put the line back.');
}

// ---------------------------------------------------------------------------
// 1. EVERY COMMAND EXISTS.
//
// The failure this catches is a renamed script: `worker:install` becomes
// `db:install-worker` in a tidy-up, every test stays green, and the next
// deploy runs a worker with no tables (D-52) -- which boots, logs healthy, and
// fails on its first task.
// ---------------------------------------------------------------------------
const rootScripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;

function checkCommands(label, ...commands) {
  for (const cmd of commands.filter(Boolean)) {
    for (const m of cmd.matchAll(/pnpm (?:--filter \S+ )?([a-z][a-z0-9:-]*)/g)) {
      const script = m[1];
      // `pnpm install` and `pnpm --filter X build` are resolved per package.
      if (script === 'install') continue;
      if (cmd.includes(`--filter`) && ['build', 'start', 'test'].includes(script)) continue;
      if (!rootScripts[script]) {
        fail(`${label} runs \`pnpm ${script}\`, which is not a script in the root package.json`);
      }
    }
    for (const m of cmd.matchAll(/node (\S+\.js)/g)) {
      // dist/ paths only exist after a build, so the SOURCE is what is checked.
      const dist = m[1];
      const src = dist.replace(/\/dist\//, '/src/').replace(/\.js$/, '.ts');
      if (!existsSync(path.join(ROOT, src))) {
        fail(`${label} starts \`node ${dist}\`, but ${src} does not exist to build it from`);
      }
    }
  }
}
checkCommands('the api', api.buildCommand, api.preDeployCommand, api.startCommand);
checkCommands('the worker', worker.buildCommand, worker.startCommand);
checkCommands('the console', consoleSite.buildCommand);
if (!failed) pass('every script and entry point the blueprint names exists in the tree');

// ---------------------------------------------------------------------------
// 2. THE HEALTH CHECK IS A ROUTE THE API SERVES.
//
// If this path is wrong every instance is marked unhealthy and no deploy ever
// goes live -- which is D-79's failure exactly, found once already when
// /healthz answered 401 because it was missing @Public.
// ---------------------------------------------------------------------------
const healthSrc = readFileSync(path.join(ROOT, 'apps/api/src/health.controller.ts'), 'utf8');
const healthPath = api.healthCheckPath;
if (!healthSrc.includes(`@Get('${healthPath}')`)) {
  fail(`healthCheckPath is ${healthPath}, which health.controller.ts does not declare with @Get`);
} else if (!healthSrc.includes('@Public()')) {
  fail(`${healthPath} is not @Public, so it answers 401 to Render and no deploy would go live`);
} else {
  pass(`healthCheckPath ${healthPath} is a @Public route the API serves (D-79)`);
}

// ---------------------------------------------------------------------------
// 3. THE PRE-DEPLOY RUNS BOTH STEPS (D-52), AND ONLY THE API RUNS THEM.
// ---------------------------------------------------------------------------
const pre = api.preDeployCommand ?? '';
if (!pre.includes('db:migrate')) fail('the API pre-deploy does not run db:migrate');
if (!pre.includes('worker:install')) {
  fail(
    'the API pre-deploy does not run worker:install. It is NOT part of db:migrate and ' +
      'cannot be (D-52): a worker without its tables boots, logs healthy, and fails on ' +
      'its first task.',
  );
}
if (worker.preDeployCommand) {
  fail('the worker declares a preDeployCommand; two services migrating race each other');
}
if (pre.includes('db:migrate') && pre.includes('worker:install') && !worker.preDeployCommand) {
  pass('pre-deploy runs db:migrate and worker:install, from one service only (D-52)');
}

// ---------------------------------------------------------------------------
// 4. EVERY VARIABLE THE API NEEDS IS DECLARED.
//
// .env.example is the contract for what this platform reads. A variable added
// there and forgotten here is a service that starts and then throws on the
// first request that needs it -- or worse, takes a permissive default.
// ---------------------------------------------------------------------------
const declared = new Set((api.envVars ?? []).map((v) => v.key));
const envExample = readFileSync(path.join(ROOT, '.env.example'), 'utf8');
const wanted = [...envExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
// VITE_* is the console's, not the API's; it is checked against the static site.
const apiWanted = wanted.filter((k) => !k.startsWith('VITE_'));
const missing = apiWanted.filter((k) => !declared.has(k));
if (missing.length) {
  fail(`the API declares no value for: ${missing.join(', ')} (each is in .env.example)`);
} else {
  pass(`all ${apiWanted.length} API variables from .env.example are declared`);
}
for (const k of wanted.filter((x) => x.startsWith('VITE_'))) {
  if (!(consoleSite.envVars ?? []).some((v) => v.key === k)) {
    fail(`the console declares no ${k}, which .env.example says the build needs`);
  }
}

// ---------------------------------------------------------------------------
// 5. NO SECRET CARRIES A LITERAL VALUE, AND NODE_ENV IS IN THE CLOSED SET.
//
// SR-8 scanned seventy-five commits for a secret in a commit. This is the same
// check pointed at the one file most likely to acquire one, because a
// blueprint is where "just paste the key in for now" happens.
// ---------------------------------------------------------------------------
const SECRETISH = /(KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL)/;
for (const s of services) {
  for (const v of s.envVars ?? []) {
    if (SECRETISH.test(v.key) && Object.hasOwn(v, 'value')) {
      fail(`${s.name}.${v.key} carries a literal value; a secret belongs in sync:false`);
    }
  }
}
const nodeEnvs = readFileSync(path.join(ROOT, 'apps/api/src/common/env.ts'), 'utf8');
const closedSet = [...(/export const NODE_ENVS = \[([^\]]+)\]/.exec(nodeEnvs)?.[1] ?? '').matchAll(
  /'([a-z]+)'/g,
)].map((m) => m[1]);
for (const s of [api, worker]) {
  const declaredEnv = (s.envVars ?? []).find((v) => v.key === 'NODE_ENV')?.value;
  if (!closedSet.includes(String(declaredEnv))) {
    fail(
      `${s.name} sets NODE_ENV=${declaredEnv}, which is not in the closed set ` +
        `(${closedSet.join(', ')}). The process refuses to start rather than guess.`,
    );
  }
}
if ((consoleSite.envVars ?? []).some((v) => v.key === 'NODE_ENV')) {
  fail(
    'the static console declares NODE_ENV. Vite picks React\'s DEVELOPMENT build from it, ' +
      'which the `production-react` gate fails on -- and which ships development warnings ' +
      'to sellers on metered connections.',
  );
}

// ---------------------------------------------------------------------------
// 6. EVERY CROSS-REFERENCE RESOLVES.
// ---------------------------------------------------------------------------
const names = new Set(services.map((s) => s.name));
for (const s of services) {
  for (const v of s.envVars ?? []) {
    const from = v.fromService?.name;
    if (from && !names.has(from)) {
      fail(`${s.name}.${v.key} reads from service '${from}', which this blueprint does not define`);
    }
  }
}

console.log('');
console.log('  NOTE  This gate checks what the blueprint claims about THIS REPOSITORY.');
console.log('        It cannot check that Render accepts the schema, that the plans and');
console.log('        region exist, or that any of it boots. Only applying it answers those.');

if (failed) {
  console.error(`\nFAIL  ops/render.yaml: ${failed} claim(s) the repository contradicts.`);
  process.exit(1);
}
console.log('\nPASS  ops/render.yaml agrees with the repository it deploys.');
