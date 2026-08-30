# T7 Phase 3 -- adversarial review (ADU-RUL-02 nullability)

**Ran against:** `tier7/t7-phase-3-nullability`
**Diff base:** `82d01dd` (the Phase 1 merge)
**When:** T7 Phase 3, before PR #22 merged
**What it produced:** Four findings, all confirmed on verification; applied in `dbc004a`.

> **Provenance.** Recovered in full from the workflow run artifact on disk.
>
> This file was committed at **T8-R**, after the fact. The review itself was not
> committed when it ran -- no adversarial review in this repository ever was,
> which is the gap T8-R exists to close (ADU-RUL-03's convention, T8-R S3). The
> TEXT below is the reviewer's own, recovered verbatim from a session artifact
> on disk; nothing in it has been rewritten, summarised or corrected. Where a
> reviewer was wrong, it is wrong here.

---

## review

All hunts complete. Consolidating what survived verification versus what I refuted.

## FINDINGS

**F1 — CONFIRMED (test residue): the new spec leaves an orphaned `core.seller_public_stats` row behind on every run.**
`apps/api/test/t7-deferred-nullability.spec.ts:89-105` (afterAll). The seller INSERT at line 53-58 fires `trg_create_public_stats` (0010:191-193, AFTER INSERT ON core.seller), auto-creating a stats row. The afterAll deletes `core.seller` under `session_replication_role = replica` (FK triggers disabled, so the dangling reference raises nothing) and never deletes `seller_public_stats`. Verified empirically: ran the suite once against the live dev DB — orphaned stats rows went 461 → 462, and the new orphan (`13be7d6a-…`, level ESTABLISHED, updated at run time) is this run's seller; every other table the suite touches came back clean (market T7N: 0, accounts: 0, seller: 0, moderation_event: 0, level events: 0, dangling claims: 0). Because SELLER is a fresh `randomUUID()` each run, this accumulates one dangling-FK row per run forever — a pg_dump/restore of that DB fails FK validation, and any future integrity check or suite joining stats→seller sees phantom sellers. Every comparable suite deletes it (c1-onboarding:165, c2:210, c3:234, c4:203, c5:207, c8:192, e1:169, e2-e6:177, pipeline:174); this file is the sole omission. Fix: one line, `DELETE FROM core.seller_public_stats WHERE seller_id = $1` before the seller delete. (Context: 461 pre-existing orphans and 201 dangling `claim_evidence_item` rows show earlier suites already leaked; this diff adds a new leaker.)

**F2 — CONFIRMED (comparator hole): `nullable_required` is the fixture's only enforcement bit and nothing verifies it against the register.**
`ops/scripts/verify-deferred-values.mjs:83-92` compares doc↔fixture on `n`, `type`, `group` only; `nullable_required` exists solely in `db/checks/fixtures/deferred-values.json` — the S1.1 table has no corresponding cell, and the register's binding sentences ("Rows 1-14 must all be nullable", row 15 nullable, "Row 16 is not a nullability question" — ADU-VAL-01 v1.1 line 88) are not machine-read. Concrete failure: flip any row's `"nullable_required": true` → `false` in the fixture and the gate stays fully green — the DB nullability assertion for that column silently degrades to line 123's NOTE, which moreover prints "S1.4: the deferral is the dimension" for a column S1.4 does not cover. That is exactly the "silent edit to either form" the script's own header (lines 19-25) declares impossible, on the one field that carries ADU-RUL-02's teeth. The exemption set is fully determined by the register (`n === 16` is the only false row); the script could assert `f.nullable_required === (f.n !== 16)` or parse S1.1's note, and does neither.

**F3 — MINOR (assertion narrower than its name): `apps/api/test/t7-deferred-nullability.spec.ts:118` — "no evidence, however good, promotes past ESTABLISHED" supplies no evidence at all.**
The test recomputes with zero handoff scans and zero new facts; it proves "a second recompute with no counting evidence stays ESTABLISHED", not the universally-quantified title (no counting scan is ever created in this suite or in t6's case 5, which uses completed orders only — `fn_recompute_seller_level` 0028:388-392 reads `handoff_scan.counts_toward_level`, exercised nowhere). Same drift at line 137-139: the comment claims the seller is given "cancellations", but no reservation or cancellation is inserted — the cancellation-rate leg of the OR-gate is asserted only via the NULL-window path. Behavior asserted is correct; the titles/comments overclaim coverage.

**F4 — NIT (recorded by D-92 already): the fixture's provenance sentence overclaims uniform fail-closed semantics.**
`db/checks/fixtures/deferred-values.json:2` justifies excluding `new_level_transaction_cap_minor` as "the opposite semantics of every row here (NULL means the gate cannot fire, fail CLOSED)" — but row 15's NULL is ruled fail-OPEN by PRD S4.1 per the register's own S1.1 note, so the exclusion rationale is inconsistent with one included row. D-92 (`docs/build-status/DEFECT-REGISTER.md:908-916`) records exactly this contradiction and parks it; flagged only so the fixture blurb is corrected when D-92 is ruled.

## HUNTED AND REFUTED (verified, not findings)

1. **Regex vs S1.1**: ran the exact regex against the file — 16/16 rows parse. Zero-row parse fails loudly (script line 72-76), and partial reflow fails via the bidirectional row-count comparison, never silently. CRLF vector refuted (`.gitattributes` `* text=auto eol=lf`; 0 CR bytes on disk). Prettier-reflow vector refuted (`docs/` in `.prettierignore`).
2. **Ten ALTERs vs schema**: exact. 0002:206-229 created all 16 value columns NOT NULL; 0028:74,104-108 dropped exactly five (trusted_* ×4 + `new_level_transaction_cap_minor`); the residual ten equal 0039:55-64's list; `follower_threshold` NULL since 0002:164, `embedding` NULL since 0015:182. Gate run live: 16/16 PASS. Both CHECKs (0002:236-249) are NULL-tolerant AND-chains; no later ADD CONSTRAINT on ladder_config exists.
3. **Upheld-claim UPDATE vs core.claim CHECKs**: `claim_opener_shape`, `claim_decided_shape`, `claim_resolved_shape` (0014:115-123) all satisfied; enum values valid (0001:226-246); the demotion rides `trg_claim_decision_effects` → `fn_recompute_seller_level(seller, true, mod)` (0014:230-267, 0028:330-350) exactly as the spec asserts. Suite passes 5/5 live.
4. **D-83 flake rule**: all count assertions are seller-scoped, no global sweep is driven, phones/handle/market-code are unique across the test tree (grepped). Compliant.
5. **t6 shrink**: the `(id, market_id)` row is valid (NOT NULL survivors all carry defaults; CHECKs pass on NULLs); promotion reads only `new_to_established_*` (0028:415-418), `established_*` is read by nothing (A1.3), demotion coalesces to false on NULL — the three boundary cases still discriminate AND from OR. Suite passes 6/6 live.
6. **Gate plumbing**: `--env-file-if-exists` needs Node ≥22.9 but engines pin `>=22 <23` and five pre-existing scripts already use the flag — no new exposure. CI provides `DATABASE_URL_MIGRATE` and runs gates after migrate; missing-env exits 2, disagreement exits 1, connect failure crashes red. "Gate 16 of the one list" (amendments README) is accurate — position 16 of 19 in `ops/scripts/gates.mjs:176-207`.
7. **Header/register facts**: D-61's wrong "8 remain" (register ~:571-577), S1.1:88's wrong "5 of them", 0010:400/420/443 window guards, 0013:159 IS-NOT-NULL pair, 0018:146 fail-closed coalesce, timing_config.media_retention at 0002:295 with no media column in legal_config (0002:399-418) — every cited claim in 0039's header and D-90/D-91/D-92 checks out against the tree.

Verdict: the migration, comparator wiring, and register entries are factually sound and the gate holds live. Block on F1 (one-line fix), fix F2 (one-line assertion), tidy F3's titles; F4 waits on D-92.


---

## verdict

## F1 — CONFIRMED (the defect), with one sub-claim REFUTED

**The leak is real.** Verified end-to-end:
- `db/migrations/0010_trust_ladder_and_public_stats.sql:191-193` — `trg_create_public_stats` AFTER INSERT ON `core.seller` auto-inserts the stats row; `:156` — `seller_public_stats.seller_id ... REFERENCES core.seller(id)` with no ON DELETE CASCADE.
- `apps/api/test/t7-deferred-nullability.spec.ts:89-105` — afterAll deletes seller at line 100 under `session_replication_role = replica` (line 90, FK triggers disabled) and never touches `seller_public_stats`.
- Live DB corroborates: 462 orphaned stats rows; the newest is `13be7d6a-3f46-4c49-8c11-a3f599cef761`, level ESTABLISHED, updated 2026-08-29 16:44 — this suite's seller. All nine cited cleanup line numbers in other suites (c1:165, c2:210, c3:234, c4:203, c5:207, c8:192, e1:169, e2-e6:177, pipeline:174) check out exactly.

**REFUTED sub-claim: "every comparable suite deletes it; this file is the sole omission."** At least nine other suites delete `core.seller` under replica role and never delete `seller_public_stats`: c6-accounts:310, c7-chat-claims:264, t5-identity-operator-only:238, t6-courier-invite-oracle:139, t6-ownership-transfer:214, t6-closure-survives-block:193, t6-purchase-intent:187, t6-parked-decisions:154, t7-rulings:159. Six of those use `randomUUID()` sellers (e.g. t7-rulings.spec.ts:40), so the "accumulates one orphan per run forever" behavior is a pre-existing pattern, not introduced here — the live orphan set confirms it (the 16:34 run of other suites left both random-UUID orphans `f6eb11f2…`, `7307e2c1…` and fixed-UUID ones `cccc6666-…`, `dddd7777-…`; fixed-UUID suites cap at one orphan each because the trigger's `ON CONFLICT DO NOTHING` re-adopts the row). The one-line fix is correct, but "block on F1" as a unique deviation is overstated; the review even contradicts itself by attributing the 461 pre-existing orphans to earlier suites. (t6-ladder-boundary is clean — every case runs in a rolled-back transaction.)

## F2 — CONFIRMED (empirically)

- `ops/scripts/verify-deferred-values.mjs:83-92` compares only `n`, `type`, `group`; `nullable_required` is consumed solely at line 119 to choose PASS/FAIL vs the line-123 NOTE branch. The register table (`docs/registers/ADU-VAL-01_...v1_1.md:69-86`) has five cells — no nullability column — and the binding prose at line 88 ("Rows 1-14 must all be nullable... Row 16 is not a nullability question") is never parsed; the script's regex (line 67) captures exactly n/schema.table/column/type/group.
- **Ran the experiment live**: flipped row 1's `nullable_required` to `false`, reran the gate — output: `PASS fixture and S1.1 agree on all 16 rows, both directions`, then `NOTE core.ladder_config.established_min_handoffs exempt from the nullability rule (S1.4: the deferral is the dimension)`, final `PASS three forms agree`, **EXIT=0**. Fully green, with the misleading S1.4 note printed for a ladder_config column, exactly as claimed. (Fixture restored to git-clean afterward.) Baseline unmodified run: 16/16 PASS, exit 0 — also confirming refuted-hunt item 2's "gate run live".

## F3 — CONFIRMED

- Spec line 118's test inserts nothing — only a re-`recompute()` (lines 125-132) after the previous test already reached ESTABLISHED; the universally-quantified title is unbacked by any handoff/evidence row. `0028_ladder_new_to_established.sql:388-392` does read `handoff_scan.counts_toward_level`, and no `handoff_scan` insert exists in this suite; t6-ladder-boundary case 5 (lines 187-216) seeds only `completedOrders` — no scans there either.
- Lines 135-144: the comment promises "a claim VOLUME ... and cancellations"; only a single claim INSERT follows — no reservation or cancellation anywhere in the file. Behavior asserted is nonetheless correct (0013:159's `IF FOUND AND v_window IS NOT NULL AND v_maxcnt IS NOT NULL` verified). Correctly rated MINOR.

## F4 — CONFIRMED (nit)

- `db/checks/fixtures/deferred-values.json:2` claims every included row's NULL means "the gate cannot fire, fail CLOSED"; the register's own S1.1 note (line 88) rules row 15's NULL as "no threshold" per PRD S4.1 (fail OPEN). D-92 records precisely this two-readings conflict and parks it — actual location `docs/build-status/DEFECT-REGISTER.md:911-919` (the review's "908-916" is off by three lines; 908-909 are D-91's tail — substance intact).

## What the review missed

1. **F1's scope (material):** the leak is a pattern across ≥9 suites, six with random UUIDs (see refutation above). Fixing only this file leaves the identical unbounded leak in t7-rulings, t6-closure-survives-block, t6-parked-decisions, t6-ownership-transfer, t6-courier-invite-oracle, and t6-purchase-intent. The right fix is the one-liner here plus either the same line in the six random-UUID suites or a shared cleanup helper — and the review's "sole omission" framing would actively mislead whoever triages it.
2. **t6-ladder-boundary.spec.ts:190-192:** case 5's comment claims the seller "has counting handoffs" — it has none (completed orders only). The review used this exact fact to prove F3 but did not flag that the t6 comment itself makes the same false claim.
3. **Branch discrepancy:** the working tree is on `tier7/t7-phase-5-console` (with substantial uncommitted phase-5 console work), not `tier7/t7-phase-3-nullability` as framed; the phase-3 files verified here are present in-tree, so all verdicts stand against what will actually merge.
4. Residue hunt beyond F1 came back clean: `trg_claim_attach_evidence` (0014:218-220) inserts only `claim_evidence_item` rows (deleted at spec line 96) and bumps the stats row; `trg_claim_decision_effects` (0014:254-259) creates one moderation_event that is linked via the demotion's `seller_level_event` and is covered by the afterAll's subquery delete (lines 91-93). No notification/conversation triggers fire on claim or order paths.
