#!/usr/bin/env node
/**
 * THE GATE LIST. One list, run by two callers.
 *
 * Work Order T6 S5.1: "The fix is not to add the missing step to
 * `ci:local`. It is to stop maintaining two lists."
 *
 * Before this file there were two. Root `package.json`'s `ci:local` ran
 * eight things; `.github/workflows/ci.yml` ran eighteen. Nothing compared
 * them, so the difference was invisible until a push failed on a gate no
 * local run had -- which is exactly how T5 shipped a stale
 * `contracts/openapi.json`: an `@ApiOperation` summary changed, `ci:local`
 * went green, and CI failed on a step `ci:local` did not have.
 *
 * A green local run that means less than a green CI run is worse than no
 * local run at all, because it is trusted.
 *
 * ------------------------------------------------------------------------
 * WHAT IS HERE AND WHAT IS NOT.
 *
 * This file holds the GATES -- the things that can fail because the code is
 * wrong. It does not hold SETUP: checking out, installing node and pnpm,
 * creating the four extensions, giving the runtime roles a LOGIN password.
 * Those differ legitimately between a GitHub service container and a
 * developer's docker-compose, they are environment rather than judgement,
 * and CI still owns them.
 *
 * The boundary test is: if it can fail because a person wrote something
 * wrong, it belongs in this list.
 *
 * ------------------------------------------------------------------------
 * THE ONE PARAMETER.
 *
 * CI scopes typecheck, build and test to the packages that changed plus
 * their dependents (ADU-REPO-01 S7). A developer wants the whole thing.
 * That is a real difference and it is expressed ONCE, as
 * ADULIS_SCOPE_FILTER, rather than as two lists that happen to differ in
 * three rows. Unset -- the local default -- means no scoping.
 *
 * ADU-REPO-01 S11.2's two foot-guns travel with it, in CI's own comments:
 * fetch-depth 0, or `origin/main` is not a ref and NOTHING is selected; and
 * `!adulis-platform`, because the workspace root is selectable and its
 * scripts are `pnpm -r`, so a filtered run re-enters unfiltered.
 *
 * ------------------------------------------------------------------------
 * REQUIRES A DATABASE. Always did: `pnpm test` runs twenty integration
 * suites that open a real pg.Pool and THROW rather than skip when
 * DATABASE_URL is unset. The belief that `ci:local` was database-free was
 * how the database gates stayed out of it.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scope = process.env['ADULIS_SCOPE_FILTER'] ?? '';

/**
 * NODE_ENV=development IS DROPPED, and this is the first thing this file
 * had to decide.
 *
 * `.env` carries NODE_ENV=development because that is what `pnpm dev`
 * wants, and this script loads `.env` for DATABASE_URL. Vite selects
 * React's build from NODE_ENV, so a gate run that inherited it produced a
 * DEVELOPMENT console bundle and failed the very gate that exists to catch
 * a development console bundle -- every time, for every developer, on a
 * machine where nothing was wrong.
 *
 * CI never sets NODE_ENV, so the gate passes there. A gate that fails
 * locally and passes in CI, for reasons that are not the code, is a gate
 * people learn to skip -- and the whole point of this file is that a local
 * run means what a CI run means.
 *
 * So: a build must be EXPLICIT about its environment, not inherit a dev
 * server's. Unset is what CI has, unset is what the gates get. Jest sets
 * its own NODE_ENV=test, and assertFakeIsPermitted only refuses
 * 'production', so nothing else notices.
 *
 * NODE_ENV=production is NOT dropped: if someone sets that deliberately,
 * they mean it, and the fake-adapter guard should refuse to start.
 */
if (process.env['NODE_ENV'] === 'development') {
  delete process.env['NODE_ENV'];
  console.log(
    'note: NODE_ENV=development came from .env and was dropped for this run.\n' +
      '      A build must not inherit a dev server environment; CI has it unset.',
  );
}

/** `pnpm <script>`, scoped where CI would scope it. */
const pnpm = (script, { scoped = false } = {}) =>
  scoped && scope
    ? ['pnpm', '--filter', scope, '--filter', '!adulis-platform', script]
    : ['pnpm', script];

/**
 * The two console build-output gates inspect apps/console/dist -- which a
 * SCOPED run legitimately never produces when the diff selects nothing the
 * console depends on (found by PR #22, the first PR since the T6
 * convergence to touch only db/ops/api: the Build gate correctly skipped
 * @adulis/console and `no-unsafe-eval` then failed on the missing dist -- register
 * D-93). Under a scope filter, an absent dist means "not selected" and the
 * gate passes WITH A NOTE; unscoped (every local run), an absent dist is
 * still a hard fail, because an unscoped build always produces one.
 */
function consoleDistAbsent(p) {
  if (existsSync(p)) return null;
  return scope
    ? { ok: true, detail: `console not selected by the scope filter (${p} absent); asserted on every run that builds it` }
    : { ok: false, detail: `${p} is absent - build first` };
}

/**
 * Section 16: "'unsafe-eval' absent from output." The console's CSP is
 * script-src 'self' with no nonce and no 'unsafe-inline' (S3.9), and an
 * eval-based build would silently require loosening it.
 */
function assertNoUnsafeEval() {
  const dist = path.join(root, 'apps', 'console', 'dist');
  const absent = consoleDistAbsent(dist);
  if (absent) return absent;
  const hits = grepDir(dist, 'unsafe-eval');
  return hits.length === 0
    ? { ok: true, detail: 'absent from the console build output' }
    : { ok: false, detail: `found in ${hits.length} file(s): ${hits.slice(0, 3).join(', ')}` };
}

/**
 * The console must ship React's PRODUCTION build. Vite selects it from
 * NODE_ENV, so an ambient NODE_ENV=development -- which is what .env.example
 * carries, and what sourcing .env into a shell sets -- silently doubles the
 * bundle and ships development warnings to sellers on the metered low-end
 * connections S23 names as the binding performance constraint. A check
 * rather than a convention, because the build succeeds either way.
 */
/**
 * D-93 AGAIN, AND THIS TIME BEFORE IT SHIPPED. The first version of this gate
 * was a plain `cmd` entry shelling straight at verify-boot-smoke.mjs, whose
 * first statement exits 1 on an absent dist. Under a SCOPED run -- which is
 * what CI does, ADULIS_SCOPE_FILTER in ci.yml -- a backend-only PR correctly
 * does not select @adulis/console, dist is gitignored and therefore absent,
 * and this gate would have failed a PR with nothing wrong with it.
 *
 * That is exactly D-93: "a red that teaches people the gate lies, which is
 * the exact failure class the one-list convergence exists to prevent." The
 * two console gates above already route through consoleDistAbsent(); a third
 * console gate that did not was a regression of a registered defect,
 * introduced by the branch that added it. Caught by an adversarial pass
 * before merge (D-137).
 *
 * Unscoped -- every local `pnpm ci:local` -- an absent dist is still a hard
 * fail, because an unscoped build always produces one.
 */
function assertConsoleBoots() {
  const dist = path.join(root, 'apps', 'console', 'dist');
  const absent = consoleDistAbsent(path.join(dist, 'index.html'));
  if (absent) return absent;
  return run(['pnpm', 'verify:boot-smoke'])
    ? { ok: true, detail: 'the built console mounted under the production _headers policy' }
    : { ok: false, detail: 'see the gate output above' };
}

function assertProductionReact() {
  const assets = path.join(root, 'apps', 'console', 'dist', 'assets');
  const absent = consoleDistAbsent(assets);
  if (absent) return absent;
  const hits = grepDir(assets, 'Each child in a list');
  return hits.length === 0
    ? { ok: true, detail: 'production React build' }
    : { ok: false, detail: 'development-only React warnings present - NODE_ENV was development' };
}

function grepDir(dir, needle) {
  const hits = [];
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath ?? entry.path ?? dir, entry.name);
    try {
      if (readFileSync(full, 'utf8').includes(needle)) hits.push(path.relative(root, full));
    } catch {
      // binary or unreadable: not a text match
    }
  }
  return hits;
}

/**
 * The seam's equality check. CI regenerates the contract and demands the
 * committed copy be byte-identical: a hand-edited spec (a lie with
 * authority) and a code change that forgot to regenerate are the same
 * failure, caught in the same breath.
 *
 * `git diff HEAD` rather than `git diff`, deliberately: CI works from a
 * fresh checkout where staged and unstaged do not differ, and comparing
 * against the COMMIT is what makes a local run mean the same thing. A
 * regenerated-but-only-staged contract is still uncommitted, and CI would
 * still fail on it.
 */
const CONTRACT_PATHS = ['contracts/', 'packages/api-client/src/schema.d.ts'];

/**
 * WHICH GATES CAN GO GREEN WHILE THEIR SUBJECT EMPTIES (T8-C S1).
 *
 * A comparator asserts that two forms AGREE. That is not the same as asserting
 * what they agree ABOUT, and the difference decides whether a gate can be
 * defeated by editing both sides:
 *
 *   EXPOSED -- the expected side is a document or a fixture a person edits
 *   directly. Delete a row from both and they agree perfectly at n-1. This was
 *   true of verify:deferred-values until a pinned count was added, and it is
 *   the same shape as D-121, where the HUMAN-REQUIRED class lived in the file
 *   the translation pass rewrites.
 *
 *   NOT EXPOSED -- the expected side is the LIVE DATABASE. A table cannot
 *   leave check 14, nor a type check 16, without a migration, and migrations
 *   are append-only after merge and loud. Nothing a person edits in passing
 *   can shrink the set.
 *
 * So: a gate whose expected side is a document or fixture needs a pinned
 * count, held where neither form can reach it, beside the ruling that fixes
 * the number. verify:permission-doc already had one (42 permissions, 139
 * grants, six per-role totals, eight step-up codes by name) and survived the
 * same attack.
 *
 * CITE A GATE BY ITS `id`, NEVER BY ITS POSITION (T8-C S3).
 *
 * Positions are not stable and the instability is silent: `mt-keys` had to be
 * APPENDED rather than slotted beside the console gates precisely because
 * inserting it would have renumbered five live citations, one of them inside
 * a governed document this repository does not edit. So the list is
 * append-only to protect numbers that should never have been written down.
 *
 * Names do not have that problem. `pnpm gates --list` prints them, every
 * citation converted in T8-C S3 now uses them, and the numbering stays an
 * implementation detail of an array. The list is still append-only -- the
 * governed documents that cite positions have not been reissued -- but
 * nothing new should add to that debt.
 */
const GATES = [
  { id: 'typecheck', title: 'Typecheck (strict, no exceptions)', cmd: pnpm('typecheck', { scoped: true }) },
  { id: 'lint', title: 'Lint', cmd: ['pnpm', 'lint'] },
  { id: 'deps', title: 'Dependency rules (ADU-REPO-01 S4)', cmd: ['pnpm', 'verify:deps'] },
  { id: 'deps-fires', title: 'The dependency rules actually fire', cmd: ['pnpm', 'verify:deps-fires'] },
  { id: 'contract-prefix', title: 'The contract carries /v1 in its path keys', cmd: ['pnpm', 'verify:contract'] },
  { id: 'error-locale', title: 'Every error code exists in both locale catalogues', cmd: ['pnpm', 'verify:error-locale'] },
  { id: 'build', title: 'Build', cmd: pnpm('build', { scoped: true }) },
  { id: 'extensions', title: 'The four extensions (Tier 0 gate)', cmd: ['pnpm', 'db:verify-extensions'] },
  { id: 'migrate', title: 'Migrations apply', cmd: ['pnpm', 'db:migrate'] },
  { id: 'worker-schema', title: 'The worker queue schema is installed', cmd: ['pnpm', 'worker:install'] },
  { id: 'test', title: 'Test', cmd: pnpm('test', { scoped: true }) },
  /**
   * THE CALLER DECLARES THE ENVIRONMENT, because the script now refuses to
   * guess. db:determinism DROPs and re-CREATEs two databases, so under T9
   * S3.3 it validates NODE_ENV against a closed set and refuses if unset --
   * and CI deliberately leaves NODE_ENV unset (see the note at the top of
   * this file: an inherited NODE_ENV=development ships a development console
   * bundle). Both rules are right; what was missing was anyone SAYING which
   * environment a CI gate run is. It is `test`, and it is said here.
   */
  { id: 'determinism', title: 'Migrations are deterministic', cmd: ['pnpm', 'db:determinism'], env: { NODE_ENV: 'test' } },
  { id: 'permission-doc', title: 'The permission matrix agrees with its own generated SQL', cmd: ['pnpm', 'verify:permission-doc'] },
  { id: 'docs-ascii', title: 'A3.5 - governed specifications are ASCII', cmd: ['pnpm', 'verify:docs-ascii'] },
  { id: 'appendix-c', title: 'Appendix C - sixteen checks', cmd: ['pnpm', 'db:check'] },
  // NOT a seventeenth db/checks file: db-check.mjs exits 2 on any count but
  // sixteen (a governed set), and its loader would count a check-*.mjs
  // dropped there whether or not anything referenced it.
  { id: 'deferred-values', title: 'ADU-VAL-01 S1.1 - three forms agree, deferred values are nullable', cmd: ['pnpm', 'verify:deferred-values'] },
  { id: 'no-unsafe-eval', title: "'unsafe-eval' absent from the console build", fn: assertNoUnsafeEval },
  { id: 'production-react', title: 'The console shipped React production', fn: assertProductionReact },
  {
    id: 'contract-current',
    title: 'The contract is CI-authored and current',
    steps: [
      ['pnpm', 'generate:openapi'],
      ['pnpm', 'generate:api-client'],
      ['git', 'diff', '--exit-code', 'HEAD', '--', ...CONTRACT_PATHS],
    ],
  },

  /**
   * APPENDED, NOT INSERTED, and that is the finding rather than the fix.
   *
   * Slotting this in beside the other console gates renumbered five live
   * references -- including ADU-RUL-03 S5.2's own "Gates 17 and 18 inspect
   * the bundle", in a governed document this repository does not edit. A list
   * whose positions are cited elsewhere is append-only in practice, whatever
   * its shape suggests.
   *
   * Nothing in CI touched MT-KEYS.md, so it drifted from en.ts silently --
   * and did, inside one work order. It also carries the HUMAN-REQUIRED gate
   * (ADU-RUL-03 S4), a rule about what may NOT be machine-translated, which
   * is exactly the kind of rule that wants a machine to check it.
   */
  { id: 'mt-keys', title: 'The translation work list is current and the HUMAN-REQUIRED gate holds', cmd: ['pnpm', 'verify:mt-keys'] },

  /**
   * APPENDED, like mt-keys above it, and for the same reason: positions in
   * this list are cited elsewhere, so the list is append-only in practice
   * whatever its shape suggests. `boot-smoke` belongs beside `no-unsafe-eval`
   * and `production-react` by subject and is at the end by rule.
   *
   * It is the only gate that RUNS the console rather than reading it. The two
   * console gates above grep the bundle as text, and a bundle that throws
   * before React mounts is textually perfect -- T7 Phase 5 shipped one, and
   * the review that caught it did so by loading the page. This gate loads it,
   * under the production _headers policy, and asserts #root has children.
   */
  { id: 'boot-smoke', title: 'The built console actually mounts in a browser', fn: assertConsoleBoots },

  /**
   * APPENDED, like the two before it. ADU-CON-02 v3.2 S16 now states the rule
   * this list has followed since mt-keys: the gate list is append-only and
   * gates are cited by NAME -- "a number is a reference that breaks silently
   * when the list moves; a name is one that breaks loudly or not at all."
   *
   * ADU-DB-01 v1.13's appendices are GENERATED from db/checks/fixtures/ and
   * from pg_class. Three revisions running, that document announced an
   * appendix correction and did not perform it, and every one stayed green
   * because checks 14 and 16 read the fixtures and NOTHING READ THE DOCUMENT.
   * This is the gate that makes a fourth impossible.
   */
  { id: 'appendix', title: 'ADU-DB-01 Appendix A and B agree with what generated them', cmd: ['pnpm', 'verify:appendix'] },

  /**
   * APPENDED, and its POSITION AFTER `test` is the point rather than an
   * accident of the append-only rule. `session_replication_role = replica`
   * suppresses the constraint triggers that implement referential integrity,
   * so a teardown using it to defeat an append-only guard also defeats
   * ON DELETE CASCADE -- and raises nothing. The violation exists and the
   * database will never mention it, so the only way to know is to ask after
   * the suite has run.
   *
   * The class was fixed at T7 in ten suites and D-128's fix reintroduced it in
   * an eleventh. Ten edits are not a rule: fixing a class in N places does
   * nothing about the N+1th, because nothing carries the reasoning to a change
   * nobody had written yet.
   */
  { id: 'orphan-sweep', title: 'No orphaned rows against any FK into core.seller', cmd: ['pnpm', 'verify:orphan-sweep'] },

  /**
   * APPENDED. `boot-smoke` asserts the console STARTS; this asserts it WORKS.
   *
   * C-3 landed without a harness and T9's three defects are the argument --
   * a link that navigated back to Home, a provider nothing read, a state that
   * could not fire, and none of them found by reading the diff. Every console
   * verification through C-3 was a browser driven once, by hand, on the day
   * the screen was built: that proves the screen worked, not that it keeps
   * working.
   *
   * IT IS THE MOST EXPENSIVE GATE IN THIS LIST, and knowingly. It resets the
   * database, rebuilds the console with a base URL, starts the API and drives
   * a real browser. Cheaper shapes were available and each drops the thing
   * that makes it worth having: a mocked API tests the mock, an unbuilt
   * console tests the dev server's bundle rather than the seller's, and a
   * seeded session tests the screens without testing that a seller can reach
   * them.
   *
   * Its sign-in lives in ONE helper (`e2e/helpers/session.ts`) because
   * ADU-AUTH-01 v2.6 is under evaluation: when the mechanism is ruled, one
   * function changes and no test does.
   */
  /*
   * env for the same reason db:determinism carries one, found the same way a
   * work order later (T11): gates.mjs strips NODE_ENV=development on purpose,
   * CI never sets one, and verify-console-e2e's D-142 guard refuses an unset
   * NODE_ENV -- so without this entry the gate exits 2 on EVERY CI run, while
   * passing locally because `pnpm verify:console-e2e` re-loads `.env`. A gate
   * red everywhere it matters and green on the one machine that already knows
   * the answer.
   */
  { id: 'console-e2e', title: 'The console works against the real API on a reset database', cmd: ['pnpm', 'verify:console-e2e'], env: { NODE_ENV: 'test' } },

  /**
   * APPENDED, by the rule ADU-CON-02 v3.2 S16 now states: this list is
   * append-only and gates are cited by NAME.
   *
   * Migration 0043 transcribes ADU-AUTH-01 v2.6's delivery layer -- five
   * enums, a table, market columns -- and until this gate NOTHING COMPARED
   * THE MIGRATION TO THE DOCUMENT. "The migration is the only witness to
   * itself" (T13): a dropped value or a renamed status would have shipped
   * green. This reads the live schema and the installed document and compares
   * them both ways.
   *
   * It ASSERTS ITS OWN PARSE FIRST (T14 S6): a gate that finds nothing
   * compares an empty set to an empty set and goes green on the day the
   * document changes shape, which is the defect class this repository is
   * built around. Proven red from both sides -- a value removed from the
   * document, a value removed from the database -- and its own self-check
   * caught a fence-index bug in this file before it ever compared anything.
   */
  { id: 'transcription', title: 'Migration 0043 agrees with ADU-AUTH-01 v2.6 (both ways, self-checked)', cmd: ['pnpm', 'verify:transcription'] },];

if (process.argv.includes('--list')) {
  for (const g of GATES) console.log(`${g.id.padEnd(18)} ${g.title}`);
  process.exit(0);
}

const only = process.argv.indexOf('--only');
const wanted = only === -1 ? null : new Set((process.argv[only + 1] ?? '').split(','));

function run(cmd, extraEnv) {
  const r = spawnSync(cmd[0], cmd.slice(1), {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  });
  return r.status === 0;
}

console.log(
  `\nAdulis gates - ${GATES.length} of them, one list (ops/scripts/gates.mjs)` +
    (scope ? `\nscope: ${scope}` : '\nscope: none (full run)') +
    '\n',
);

let n = 0;
for (const gate of GATES) {
  if (wanted && !wanted.has(gate.id)) continue;
  n += 1;
  console.log(`\n--- [${String(n).padStart(2, '0')}] ${gate.title} -------------------------`);
  let ok;
  if (gate.fn) {
    const r = gate.fn();
    ok = r.ok;
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.detail}`);
  } else if (gate.steps) {
    ok = gate.steps.every((s) => run(s));
  } else {
    ok = run(gate.cmd, gate.env);
  }
  if (!ok) {
    console.error(`\nFAIL  gate '${gate.id}' (${gate.title}).`);
    console.error(
      gate.id === 'contract-current'
        ? '      The committed contract does not match what the code generates.\n' +
            '      Run: pnpm generate:openapi && pnpm generate:api-client, then COMMIT the result.\n' +
            '      contracts/openapi.json is tracked and CI-authored: a hand-edited spec is a lie with authority.'
        : '      Red on any; there is no skip label (ADU-CON-02 S16).',
    );
    process.exit(1);
  }
}

console.log(`\nPASS  all ${n} gates.\n`);
