# `apps/mobile` - the Adulis mobile app (clean replacement, rebuild-20261125)

**One application with three modes - Buyer, Seller Companion and Courier - not three apps** (founder decision).
Roles are relationships, not accounts: one ordinary Account, Operator is a separate identity and never a Mobile mode.
Mode switching never creates a second ordinary account and never re-authenticates.

> **This file describes the clean replacement only.** The archived Mobile runtime (WO-001..003, 258 source files, 102
> test files, the Maestro flows) is NOT in this tree. It is preserved at tag `recovery/legacy-dev-20261125` and on `dev`.
> Treat it as evidence: individual units return through MOB-FE-01's reuse decisions, one verified unit at a time. Never
> restore it wholesale, and never restore its API contracts or its financial models.

## Status: L2-MOBILE-01 (MOB-FE-01, 02, 02S, 03 implemented on stacked draft PRs; none accepted or merged)

What exists on these branches (L2-MOBILE-01 deliverables hold the evidence): the typed provisional ports and operation
registry (`src/contracts`, GAP-L2-01 / GAP-L2-02 / SC-BE-05S; **no hand-written DTO pretends to be the contract**), the session
manager with epoch, stamps and fail-closed credential deletion (`src/session`), server-authoritative mode eligibility, the
closed route table, route guard and deep links (`src/modes`), the AppGate and runtime (`src/gate`, `src/providers`), the
functional fixture world (`src/fixtures`), Buyer discovery, Stories and engagement screens, and the Mobile token adapter
(`src/ui/theme.ts`). User strings come from `@adulis/locale/mobile` first; keys it does not carry yet are PROVISIONAL in
`src/i18n/provisional.ts` and registered as request SR-L2M01-LOC-01 (delete an entry when the shared key lands).
`scripts/check-static-guarantees.mjs` (run by `pnpm test`) holds the absences: no Operator, Reservation, Handoff, payout,
paid Order, web storage, dark-mode switch, animation API or second fixture door.

Rules that are easy to break quietly here: a private query key must be rooted at `acct` or `guest` (`public` only for reads
anyone may make); a Story or Scene visibility change is the server's answer, never a client memory; likes belong to Scenes
only; no price, count, discount or stock number is ever computed on the device.

## Binding rules (cite, do not restate)

- Governance: `docs/amendments/REBUILD-2026-11-27-CONTROLLED-PARALLEL-EXECUTION.md` and
  `docs/rebuild/GOV-PARALLEL-01-EXECUTION-CONTROLS.md`. Fixture and release boundary:
  `docs/rebuild/GOV-06-FIXTURE-AND-RELEASE-BOUNDARY.md`. Authority order: `.claude/reference/DOCUMENT_AUTHORITY.md`.
- Imports: `@adulis/tokens`, `@adulis/api-client`, `@adulis/config` and **`@adulis/locale/mobile` only** (any other
  `@adulis/locale` specifier fails ESLint and `scripts/check-locale-imports.mjs`). Nothing under `apps/`
  (`dependency-cruiser`, `pnpm exec depcruise apps/mobile packages --config .dependency-cruiser.cjs`).
- **Shared resources are root-written** (RB27-D04): `packages/*`, `pnpm-workspace.yaml`, root `package.json`,
  `pnpm-lock.yaml`, `.github/**`, `.dependency-cruiser.cjs`, the generated contract and client. A Mobile session SUBMITS a
  change request in its report; it never edits them, and never hand-merges the lockfile.
- Never edit `contracts/openapi.json`, `packages/api-client/src/schema.d.ts`, `apps/api/db/migrations/**` or
  `apps/api/db/bootstrap.sql` (the launcher denies them for this workstream). Never read into or edit another `apps/*`.
- The generated contract holds `/livez` and `/healthz` only. **Every business operation is an app-local, typed,
  PROVISIONAL port** marked with its GAP id (GOV-06). Never hand-write a DTO that pretends to be the contract.
- English-first light theme. Amharic exists in the package but is gated until human review releases it.
- No payment, PSP, Seller payment confirmation, real paid Order, refund, surcharge, Reservation, handoff, payout, or
  background-removal behaviour. Checkout is Option A (review only) plus Option C (isolated, development-only simulation).
  No price, tier name or billing link anywhere in the bundle.

## The fixture seam (GOV-06) - the rule that is easiest to break quietly

- `src/transport/port.ts` types only. `src/transport/live.ts` fails closed (`UNAVAILABLE`, nothing sent, no fetch).
- `src/transport/select.ts` is **the only** file that may import `src/fixtures` (ESLint `no-restricted-imports` and the
  `no-mobile-fixture-import` dependency rule, each proved by `scripts/verify-deps-fires.sh`).
- The selector is one build-time expression, `__DEV__ && process.env.EXPO_PUBLIC_ADULIS_FIXTURES === 'on'`. Never a
  stored flag, a link parameter, a bootstrap value or an `expoConfig` value. No live-to-fixture fallback and none back.
- Fixtures: reserved `fx_` identifiers, no network (ESLint refuses `fetch`, `XMLHttpRequest`, `WebSocket`), nothing stored.
- **A false flag is not proof.** `pnpm --filter @adulis/mobile verify:release` exports the real release bundle with the
  flag set and scans every byte for the markers, with a development-format positive control and a planted-marker negative
  control. If the first mechanism ever fails that scan, investigate and consider the build-time constant alternative (M2,
  GOV-06 section 4); never weaken the scan.
- Internal demonstration routes are never files under `src/app/`: Expo Router bundles the whole directory.

## Commands

```
pnpm --filter @adulis/mobile typecheck
pnpm --filter @adulis/mobile lint            # --max-warnings 0
pnpm --filter @adulis/mobile test            # locale-import guard, then jest-expo
pnpm --filter @adulis/mobile build           # expo export (android) into dist/
pnpm --filter @adulis/mobile verify:release  # release export scan with its controls (slow: two exports)
pnpm exec depcruise apps/mobile packages --config .dependency-cruiser.cjs
bash apps/mobile/scripts/verify-deps-fires.sh
```

Heavy runs (installs, exports, emulators) go to GitHub Actions when the development machine has under 2 GB free RAM:
the verifier of record is the `Mobile (rebuild-20261125)` check. `android/` and `ios/` are generated and never committed.
App identity (founder decision D1): `com.adulis.app` on both platforms, Expo project `@naod61s-team/adulis`.

## What is NOT claimed by this skeleton

No native-device, accessibility or screenshot evidence; no iOS export (Android only in CI so far); no live authentication
(every live operation fails closed UNAVAILABLE); no photos (the media seam has no origin); no route rendered in a test; no
Amharic; no Impeccable review pass.
