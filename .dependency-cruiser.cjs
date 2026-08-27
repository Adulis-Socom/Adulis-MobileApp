/**
 * ADU-REPO-01 v1.0 §4 — the four dependency rules, enforced in CI rather than in
 * review. A rule that depends on someone noticing is a rule that holds until the
 * week someone is busy.
 *
 *   1. apps/*     MAY import from packages/*             (allowed — no rule needed)
 *   2. apps/*     MAY NEVER import from another apps/*   -> no-app-to-app
 *   3. packages/* MAY NEVER import from any apps/*       -> no-package-to-app
 *   4. packages/* may import other packages/*, acyclically -> no-circular
 *
 * Run: pnpm verify:deps
 *
 * ---------------------------------------------------------------------------
 * THREE OPTIONS BELOW ARE LOAD-BEARING. Changing any of them leaves the rules
 * present, the build green, and rule 2 half-dead. Each is proved by a fixture in
 * ops/scripts/verify-deps-fires.sh, which plants a violation and asserts it is
 * caught — because a rule nobody has ever seen fail is a rule nobody knows works.
 *
 *   tsPreCompilationDeps: true
 *       Without it, `import type { X } from '../../api/src/x'` is erased before
 *       dependency-cruiser sees it, and a type-only cross-app import is INVISIBLE.
 *       Types are exactly what a console developer reaches for first.
 *
 *   preserveSymlinks: false
 *       pnpm links workspace packages as symlinks. Left at true, a DECLARED
 *       `import '@adulis/api'` resolves to apps/console/node_modules/@adulis/api
 *       and never matches ^apps/api/, so rule 2 misses that spelling.
 *       NOT PROVEN BY THE FIXTURE, and the reason is worth stating rather than
 *       hiding: proving it needs @adulis/api DECLARED as a console dependency,
 *       which is the violation itself and is not something to add to package.json
 *       for a test. The fixture covers the UNDECLARED form instead, which is what
 *       someone actually types first, and not-to-unresolvable catches that. If a
 *       cross-app workspace dependency is ever legitimately declared, extend the
 *       fixture then.
 *
 *   no-import-into-dist
 *       `exclude` removes modules from the graph ENTIRELY, unlike `doNotFollow`,
 *       which keeps them as leaves. So excluding dist/ to avoid cruising built
 *       output also blinds no-app-to-app to an import that resolves into
 *       apps/<other>/dist — and because that import RESOLVES, not-to-unresolvable
 *       does not fire either. The dedicated rule below closes that hole, which is
 *       what makes the exclusion safe.
 *
 * ---------------------------------------------------------------------------
 * WHAT THESE RULES DO NOT CATCH, stated so nobody assumes total coverage.
 *
 * A dynamic import whose specifier is COMPUTED rather than literal —
 * `const p = '../../api/src/main'; import(p)` — is invisible to static analysis
 * and produces no violation. Verified, not assumed. Literal `import('...')` IS
 * caught, which covers the honest case; the computed form is deliberate evasion,
 * and a boundary check is not an adversary model. It is the reason rule 2 is also
 * carried in each app's `.claude/settings.json` deny list and, above all, in the
 * argument in root CLAUDE.md — the point is to stop the helpful accident, which
 * is what actually happens, not the determined bypass, which does not.
 *
 * Same for a Vite virtual module (`virtual:...`): it has no file on disk, so it
 * reports as unresolvable. If one is ever introduced, allow it explicitly here
 * rather than relaxing not-to-unresolvable, which is load-bearing for rule 2.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-app-to-app',
      comment:
        'ADU-REPO-01 rule 2. One app may never reach into another. The capture ' +
        'group in from.path is substituted into to.pathNot as $1, so ' +
        'apps/console -> apps/api fires while apps/console -> apps/console does ' +
        'not. Anything two apps share belongs in packages/, moved there ' +
        'deliberately and reviewed by both owners.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'no-package-to-app',
      comment:
        'ADU-REPO-01 rule 3. A shared package may never depend on an application. ' +
        'Dependencies point inward: apps -> packages, never back.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'no-circular',
      comment:
        'ADU-REPO-01 rule 4. packages/* may import each other, acyclically. ' +
        'Enforced across apps/ too — a cycle is a design error wherever it is.',
      severity: 'error',
      from: { path: '^(?:apps|packages)/' },
      to: { circular: true },
    },
    {
      name: 'no-import-into-dist',
      comment:
        'Reaching into a WORKSPACE package built output. doNotFollow keeps those ' +
        'files in the graph as leaves so this edge is still checkable, and this ' +
        'rule is what makes not cruising them safe. Import the source, or import ' +
        'the package by name. Scoped to ^(apps|packages)/<name>/dist/ on purpose: ' +
        'half the third-party ecosystem ships its entry point at dist/index.js, ' +
        'and an unscoped version failed on kysely, vite and typescript-eslint.',
      severity: 'error',
      from: { path: '^(?:apps|packages)/' },
      to: { path: '^(?:apps|packages)/[^/]+/dist/' },
    },
    {
      name: 'not-to-unresolvable',
      comment:
        'Load-bearing for rule 2, not hygiene. An undeclared `import "@adulis/api"` ' +
        'from the console resolves to nothing, so no-app-to-app would never see ' +
        'it. Making it an error means the cross-app import fails the build either ' +
        'way: declared (no-app-to-app) or undeclared (here).',
      severity: 'error',
      from: { path: '^(?:apps|packages)/' },
      to: { couldNotResolve: true },
    },
  ],

  options: {
    // doNotFollow, NOT exclude, and the difference is the whole reason
    // no-import-into-dist can work. `exclude` removes a module from the graph
    // ENTIRELY, so a dependency ON it disappears too and no rule can match it.
    // `doNotFollow` keeps it as a LEAF: the edge into it is still in the graph
    // and still rule-checkable, while its own contents are never cruised.
    //
    // Neither of these was a judgement call; the fixture in
    // ops/scripts/verify-deps-fires.sh settled both. With `exclude` here it
    // planted `import '../../api/dist/main.js'` and depcruise reported "no
    // dependency violations found" - a green build asserting a boundary that was
    // not there. With doNotFollow and an UNSCOPED dist rule, the clean tree then
    // failed on kysely, vite and typescript-eslint, which all ship their entry
    // point at dist/. Both were invisible until something planted the violation.
    doNotFollow: { path: ['node_modules', '(^|/)dist/', '(^|/)coverage/'] },

    // LOAD-BEARING. See the header.
    tsPreCompilationDeps: true,
    preserveSymlinks: false,

    moduleSystems: ['cjs', 'es6', 'tsd'],

    // No tsConfig key on purpose: there is no root tsconfig.json and no "paths"
    // alias in packages/config/tsconfig.base.json, apps/api/tsconfig.json or
    // apps/console/tsconfig.json, so plain node resolution is correct. If a path
    // alias is ever added it must live in the shared base, because a cruise reads
    // exactly one tsconfig.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['main', 'module'],
    },

    skipAnalysisNotInRules: true,
  },
};
