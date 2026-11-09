# Adulis Overnight Issues -- 10 November 2026

## Batch baseline

- Starting branch: `discovery/wo-disc-001-scene-foundation`
- Starting SHA: `8706a6fa2353348ba3487234baa1aa2beb153b4b` (verified equal to `origin`, clean tree)
- Started from WO-DISC-001: yes (WO-DISC-001 reported BLOCKED on the ADU-DB-01 Appendix B mismatch, OVN-001)
- Work orders:
  - WO-DISC-001A
  - WO-DISC-002
  - WO-004A

## Morning Summary

### Work-order status
- WO-DISC-001A: COMPLETE (ADU-DB-01 v1.20 installed, `verify:appendix` green, WO-DISC-001 formally closed, API suite 698/698)
- WO-DISC-002: IN PROGRESS
- WO-004A: NOT STARTED (waits for WO-DISC-002)

### Highest-priority findings
- (filled in as the batch runs)

### Founder decisions required
- (filled in as the batch runs)

### Security issues
- (filled in as the batch runs)

### Governance/contract blockers
- OVN-001 ADU-DB-01 Appendix B behind the database after migration 0054: RESOLVED by ADU-DB-01 v1.20

### Existing baseline defects encountered
- OVN-020 `c1-onboarding` hard-coded date (2026-09-11), reproduced at `40a4dce`: RESOLVED by a test-only fix

### Recommended first action in the morning
- (filled in at the end)

## Issue Register

Severity is the severity when found; a fixed issue keeps it and changes only its status.
OVN-001 to OVN-019 are carried from `docs/discovery/WO-DISC-001-SCENE-DOMAIN-FOUNDATION.md`
section 22 (G-1 to G-20, related items consolidated); OVN-020 to OVN-022 are other carried items.

| ID | Work Order | Severity | Class | Status | Blocks | Finding | Evidence | Action Taken | Founder Decision Needed | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| OVN-001 | WO-DISC-001 (G-1) | HIGH | GOVERNANCE | RESOLVED | (was: WO-DISC-001 closure, so WO-DISC-002 and WO-004A) | ADU-DB-01 v1.19 Appendix B said `core` 90 / 116 tables; the database holds 94 / 120 after `0054_scene_posts.sql` | `pnpm verify:appendix` red in WO-DISC-001; green after v1.20 (120 tables, 71 enum types), `verify-appendix.mjs` unchanged | WO-DISC-001A installed ADU-DB-01 v1.20 (Appendix B regenerated counts, the four tables named, S30c), v1.19 superseded; WO-DISC-001 formally closed | No | Done |
| OVN-002 | WO-DISC-001 (G-2) | MEDIUM | CONTRACT_GAP | DEFERRED | None today; blocks the canonical Seller Scene RBAC | `seller.scene_posts:*` and `seller.content_media:manage` are not in the executable permission catalogue (42 codes, gate-pinned) | ADU-SCN-01 S13 vs migration 0006; WO-DISC-001 S11 | Temporary mapping: `seller.media:write` AND `seller.broadcasts:send` (exactly OWNER, ADMIN, CAMPAIGN_MANAGER, Console) | Yes, via WO-API-001C | Add the family in WO-API-001C and replace the mapping |
| OVN-003 | WO-DISC-001 (G-3) | MEDIUM | CONTRACT_GAP | FOUNDER_REVIEW_REQUIRED | None | No Scene error code: a blocked Scene publish reuses `PUBLICATION_BLOCKED`, whose English says "This product cannot be published yet"; stale `If-Match` uses `VALIDATION_FAILED` 409 + `slots.reason` because the taxonomy has no version-conflict code | ADU-API-01 S7.1 closed taxonomy; `packages/locale` | Precedent-following reuse, recorded | Yes: add Scene / version-conflict codes to ADU-API-01, or approve neutral wording | Add `SCENE_PUBLICATION_BLOCKED` and a version-conflict code in the next ADU-API-01 revision |
| OVN-004 | WO-DISC-001 (G-4) | MEDIUM | GOVERNANCE | FOUNDER_REVIEW_REQUIRED | None for current work | No transactional outbox (WRK-3) and the worker engine is open (K-3): Scene facts are `core.scene_post_transition` rows, re-evaluation is synchronous in the database, no consumers exist | WO-DISC-001 S9, S15 | Durable transition rows written in the same transaction | Yes: K-3 | Decide K-3, then add an outbox relay that reads the transition rows |
| OVN-005 | WO-DISC-001 (G-5) | LOW | OPEN_DESIGN_DECISION | DEFERRED | Scene carousel only | MEDIA-01 "bounded" carousel frames with no number | MEDIA-01 S186-188 | Primary image only | Yes: the carousel bound | Rule a number |
| OVN-006 | WO-DISC-001 (G-6) | LOW | IMPLEMENTATION_GAP | DEFERRED | Scene Explore hotspots | Hotspots need a versioned MediaPresentation, which does not exist | SCN-01 S22, S24; MEDIA-01 S429 | Not built; additive table later | No | Build with Scene Explore |
| OVN-007 | WO-DISC-001 (G-7) | LOW | OPEN_DESIGN_DECISION | DEFERRED | Scene archive/delete | Archive, restore and deletion not built; the registry has `scene_post.deleted` but the permission family has no delete code | registry vs AUTH-02 | ARCHIVED kept in the vocabulary | Yes: delete permission | Decide with OVN-002 |
| OVN-008 | WO-DISC-001 (G-8) | MEDIUM | IMPLEMENTATION_GAP | DEFERRED | Scene moderation | No Scene moderation enforcement and no SCENE report target (DSC-6); the public view is where the gate joins | `report_target_kind` (0001) | Recorded | No | Moderation work order |
| OVN-009 | WO-DISC-001 (G-9, G-19) | MEDIUM | IMPLEMENTATION_GAP | DEFERRED | None | Media readiness is a landed-object check only; no MediaAsset state; replaced/unattached uploads not purged; no rate limiting or outstanding-upload cap on Scene create/publish/upload signing (the repository has no throttler) | WO-DISC-001 S17, S21 | Recorded | No | Media lifecycle + throttling work order |
| OVN-010 | WO-DISC-001 (G-10) | LOW | CONTRACT_DRIFT | DEFERRED | None | Design-pack inconsistencies: `REMOVED` as a publication state (CATINV/CONSOLE) vs SCN/MOD; two private-reason names; `SCENE_PRODUCT_TAG_REQUIRED` vs `PRODUCT_TAG_REQUIRED`; EVT prose vs registry payload fields; two restoration notice texts; two PublicScenePost shapes | WO-DISC-001 S3 | Owning design + registry followed | Yes, at the next pack reconciliation | Reconcile the pack |
| OVN-011 | WO-DISC-001 (G-11) | MEDIUM | BUG | DEFERRED | None for Scenes | Catalogue: no central availability function; the storefront filters on `published_at`, and `fn_unpublish_product` never clears it, so an unpublished Product still lists on the public storefront | 0020:33-36; storefront.controller.ts | Scenes use `visibility`; reported, not changed | No | Catalogue fix work order |
| OVN-012 | WO-DISC-001 (G-12) | MEDIUM | BUG | NOT_REPRODUCED | None | Catalogue: `fn_delete_seller_effects` sets `unpublished_reason` without changing `visibility`, which the CHECK refuses (inferred from code) | 0023:180-182 vs 0007:130 | Recorded | No | Reproduce in a Catalogue work order |
| OVN-013 | WO-DISC-001 (G-13) | LOW | CONTRACT_GAP | DEFERRED | None | Deleting a Scene-tagged Product answers `409 PRODUCT_HAS_ACTIVE_ORDERS` ("live orders"): right refusal, wrong words | catalogue.service.ts deleteProduct | Recorded | With OVN-003 | Add a code or neutral copy |
| OVN-014 | WO-DISC-001 (G-14) | LOW | IMPLEMENTATION_GAP | DEFERRED | None | `SCENE_BECAME_*` notices have no client copy; only the owner is notified (design: "authorized Seller content recipients") | NOTIF-01 S917 | Recorded | Possibly: recipients | Console/Companion copy work order |
| OVN-015 | WO-DISC-001 (G-15) | INFO | IMPLEMENTATION_GAP | DEFERRED | None | Storefront Scene list, Scene search, slug history and a separate `/products` route are later work (For You is WO-DISC-002) | SCN-01 S45 | Recorded | No | Later work orders |
| OVN-016 | WO-DISC-001 (G-16) | MEDIUM | CONTRACT_GAP | OPEN | Relevant to WO-DISC-002 Market derivation | No Buyer Market resolution for anonymous public reads, so an out-of-Market link is not answered "market unavailable" (S30); `MARKET_NOT_ACTIVE` uses `market.activation_state` (D-183 overlapping Market truths) | SCN-01 S30 | Recorded | No | WO-DISC-002 derives the FYP Market server-side |
| OVN-017 | WO-DISC-001 (G-17) | LOW | IMPLEMENTATION_GAP | DEFERRED | None | No analytics event for Scene transitions (ANL-01 `scene_visibility_changed`) | ANL-01 S144 | Transition rows are the source | No | Analytics work order |
| OVN-018 | WO-DISC-001 (G-18) | INFO | TECH_DEBT | DEFERRED | None | Caption 5000 and 40 tags per request are technical payload bounds, not design rules | WO-DISC-001 S4, S6 | Recorded | Possibly | Confirm or rule numbers |
| OVN-019 | WO-DISC-001 (G-20) | LOW | IMPLEMENTATION_GAP | DEFERRED | None | No Scene visibility reconciliation sweep (EVT-01 `recompute_scene_visibility`); a safety net given the COMMIT-time path; needs K-3 | EVT-01 S793 | Recorded | With OVN-004 | Add after K-3 |
| OVN-020 | repository | MEDIUM | BASELINE_FAILURE | RESOLVED | (was: full-suite green) | `c1-onboarding` "GET lists ascending from today" hard-coded 2026-09-11; the list reads from `CURRENT_DATE`, so after that date the page is empty | Before: `TypeError: Cannot read properties of undefined (reading 'date')` on the current tree; also reproduced at `40a4dce` on a fresh 0001-0053 database. After: 37/37, API suite 698/698 | Test-only fix (WO-DISC-001A, separate commit): the test derives the next 11 September ahead of today; no production change | No | Done |
| OVN-021 | WO-DISC-001 | LOW | ENVIRONMENT | RESOLVED | None | During WO-DISC-001 one test run went to the developer database `adulis` (root package matched a `!@adulis/api` filter, and the disposable-DB variables were not exported in that shell); the Scene suite teardown aborted and left its fixtures | WO-DISC-001 session | Fixtures removed by their UUID prefix under replica mode; orphan sweep on `adulis` passes; procedure changed (per-session env script, packages run by name) | No | Keep running tests only on a disposable database |
| OVN-023 | WO-DISC-001A | LOW | GOVERNANCE | DEFERRED | None | ADU-DB-01 v1.19 recorded a one-line D-301 correction to S4.4b "at the next revision"; v1.20 is mechanical-only and does not carry it | v1.19 S0.1, T24 report item 4 | Recorded in v1.20 S0.1 | No (mechanical scope) | Apply at the next substantive ADU-DB-01 revision |
| OVN-024 | WO-DISC-001A | LOW | ENVIRONMENT | RESOLVED | None | A `git add` listing the already-moved v1.19 path failed as a whole, so the first reissue commit held only the rename | `git log` before push | Unpushed: reset to `8706a6f` (working tree kept) and recommitted with `git add -A` so the deletion is staged; verified both commits' file lists | No | Stage moved files with `git add -A` |
| OVN-022 | WO-DISC-001 | LOW | TECH_DEBT | RESOLVED | None | The committed Kysely types predated migrations 0040, 0043 and 0046 | WO-DISC-001 S18 | Regenerated in WO-DISC-001 (`fcc56f3`) | No | Regenerate after every migration |

## Test / Gate Register

| Work Order | Command / Gate | Result | Baseline comparison | Notes |
|---|---|---|---|---|
| WO-DISC-001A | `pnpm verify:appendix` | PASS (v1.20: 120 tables, `core` 94, 71 enum types) | RED at WO-DISC-001 (`8706a6f`) | gate script unchanged |
| WO-DISC-001A | `pnpm verify:docs` | PASS | PASS | v1.20 is GOVERNED and ASCII |
| WO-DISC-001A | `pnpm typecheck` / `lint` / `build` | PASS | PASS | |
| WO-DISC-001A | `pnpm db:check` | 16/16 | 16/16 | disposable DB `adulis_gates` |
| WO-DISC-001A | `pnpm db:determinism` | PASS | PASS | |
| WO-DISC-001A | `pnpm --filter @adulis/api test` | 698/698 | 697/698 (OVN-020) | first fully green API run |
| WO-DISC-001A | console, mobile, api-client, config, locale, tokens tests | PASS | PASS | run by package name on the disposable DB |
| WO-DISC-001A | `pnpm verify:orphan-sweep` | PASS | PASS | after the full suite |

## Branch / Commit Register

| Work Order | Branch | Start SHA | End SHA | Commits | Pushed |
|---|---|---|---|---|---|
| WO-DISC-001A | `discovery/wo-disc-001a-db-governance` | `8706a6f` | (see push) | `6cfd683` v1.20 reissue; `810b598` c1 date test; docs commit | |

## Deferred Decisions

- OVN-002, OVN-003, OVN-004, OVN-005, OVN-007, OVN-010, OVN-014, OVN-018 (see the register).

## Deferred Defects

- OVN-011, OVN-012 (Catalogue).

## Morning Review Checklist

- (filled in at the end)
