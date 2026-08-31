# WORK ORDER T9 REPORT

**Written as the work happened**, phase by phase, by the agent that did it.

**Every claim below names the command or artifact that produced it**
(ADU-RUL-03 S5.1). Where a number cannot be produced on demand it says so
instead of estimating, and **`State of main` is a ref**.

```
WORK ORDER T9 REPORT

Phase 1  merged in order: #30 #31 #32 #33 #34
         deleted register lines at each step: ALL ZERO
           #30 vs 4e6b392 / 0393a5b        0 / 0
           #31 vs fb2d021 / 979041b        0 / 0
           #32 vs 0b897fa / 0ae5966        0 / 0
           #33 vs 5336130 / f76c6a3        0 / 0
           #34 vs 6865792 / 3ede159        0 / 0
         continuity: D-01..D-139, 137 entries, gaps [25, 28], D-105 count 1
         duplicates: none            out of order: one, pre-existing (D-27, D-26)
         cmd: git diff <parent> <merge> -- DEFECT-REGISTER.md | grep -c '^-[^-]'
         [!] the order says gaps at D-24 and D-27. They are at D-25 and D-28.

Phase 2  four documents installed: NONE. MISSING_SOURCE (D-140), PR #35
         searched: working tree, docs/, docs/registers/, _staging/, parent dir
         installed baseline unchanged: DB v1.12, CON-02 v3.1, VAL-01 v1.1,
                                       REPO-01 absent entirely
         appendix vs fixture on install: NOT APPLICABLE -- nothing installed

Phase 3  PR #36
         deferred-values pinned at 14: NOT DONE -- blocked on ADU-VAL-01 v1.2
           the gate compares three forms and one is the document's S1.1 table,
           which still lists 16 at v1.1. Pinning 14 turns it red on a correct
           tree.
         verify:appendix added as gate 22: NOT DONE -- blocked on DB v1.13,
           whose generated appendices are what the comparator is specified
           against. The gate list is still 21.
         _provenance: the gate reads `.types` and ignores it -- which check-16
           already did and nobody had written down. Now stated in the check's
           header and the fixture, and the COUNTS ARE REMOVED from the prose
           rather than corrected. That is check-16's own doctrine turned on
           the file it reads. `types` untouched: 66 types, 234 values.
           cmd: pnpm db:check -> 16 PASS
         destructive scripts asserting NODE_ENV: 3
           db-reset.mjs (T8-C), db-determinism.mjs, db-loads.mjs (both T9)
           check-10 matched the grep and is a FALSE POSITIVE: its "TRUNCATE"
           is a privilege name in a SQL VALUES list.
           cmd: NODE_ENV=production node ops/scripts/db-determinism.mjs -> exit 2
           cmd: env -u NODE_ENV ... -> "NODE_ENV is unset", exit 2
           cmd: env -u NODE_ENV ... gates.mjs --only determinism -> PASS, exit 0
         D-92 built: migration 0041, body extracted with pg_get_functiondef
           and patched -- one statement, everything else byte-for-byte.
           cmd: pnpm --filter @adulis/api test -- test/t9-d92-follower-threshold.spec.ts
           against 0041          2 passed
           against the OLD body  1 failed: Expected "SATISFIED", Received
                                 "NOT_SATISFIED"  <- the proof
           the absent-evidence arm passes under BOTH definitions, which is
           what shows the fix did not simply open the gate.

Phase 4  PR #37.  C-3 reached: YES
         nine items from readiness[]: 9 rows, state READY, "3 of 9 done."
           cmd: headless Edge --dump-dom on http://localhost:5173/s/<seed
                seller> after a real sign-in, against a database reset
                immediately before; rows counted from data-item attributes
         resumable: second load, 9 rows, same progress -- no stored position
         resolving links: 6 for 6 unsatisfied items, 0 unrouted, each landing
           on the screen S6's table names (SC-22 SC-17 SC-24 SC-18 SC-07)
         SC-02 R26: both facts + not-reversible, aria-live polite, observed by
           CLICKING the radio in a browser, not by reading the source
         market-context provider calling /v1/bootstrap: YES (lib/market.tsx),
           and the call MOVED out of SessionProvider rather than being added
           beside it -- one bootstrap per load, in the order D-118 requires

Gates    21 gates, not 22: verify:appendix is blocked (above)
           cmd: pnpm ci:local            PASS all 21 gates, exit 0
           cmd: apps/api tests           459 passed (461 on the Phase 3 branch,
                                         which adds the two D-92 tests)
           cmd: pnpm db:check            16 PASS
           cmd: pnpm db:determinism      two clean databases converge,
                                         11252 lines compared
           cmd: pnpm verify:mt-keys      182 MT + 2 HUMAN-REQUIRED

Register 9 new: D-140..D-148.  BLOCKERs first:
           D-140  BLOCKER  the four documents did not arrive
           D-145  MAJOR    D-103's literals survived the change that closed it
           D-146  MAJOR    four of six resolving links went nowhere
           D-141  MAJOR    D-92 ruled: a NULL threshold is no bar, and was
                           refusing every seller in such a market
           D-142  MAJOR    an exemption made a class nobody re-checked
           D-143  MINOR    the load harness has not run since product.slug
           D-144  MINOR    C-3's Amharic is English, and the manifest says so
           D-147  MINOR    UPGRADE_REQUIRED cannot fire: the server hardcodes OK
           D-148  MINOR    SC-01 Life 2 waits on C-4's clock rules

State of main: b74c3e7 -- Phase 1 only.
         Unmerged: #35 (Phase 2, records), #36 (Phase 3, gates), #37 (Phase 4,
         C-3), and this report. Each branches from b74c3e7 and each appends to
         the register, so they conflict at the tail in exactly the way T8-C S0
         describes and must be merged in number order with the zero-deleted-
         lines check at each step.
```

## Phase 1 -- the merges, and the one correction

Five merges, each verified rather than trusted: `git diff <parent> <merge> --
docs/build-status/DEFECT-REGISTER.md | grep -c '^-[^-]'` printed **0** against
both parents every time. Three of the five conflicted, all at the register's
tail, which is the only place an append-only file can conflict; #32 also
conflicted in `gates.mjs`, where **both** branches had added a header comment
above `const GATES` and neither replaced the other. Both were kept. Taking one
would have deleted a rule silently, in the file whose subject is rules that
fail silently.

**The continuity spec in the order is off by one.** T9 S1 says "gaps only at
D-24 and D-27". The gaps are at **D-25 and D-28** -- `grep -c '^### D-0*25 '`
returns 0 and D-24 exists. T8-R's wording ("do not back-fill D-25 or D-28")
was the correct one. Nothing was changed on the strength of either reading:
the register is what it is, and this is the note saying which.

Before merging, an adversarial pass over all five PRs raised 34 findings, of
which **9 survived unanimous refutation** -- including one BLOCKER: the
teardown that closed D-128 was leaving an orphaned `seller_public_stats` row
per run, measured at one, because `session_replication_role = replica`
suppresses the foreign key's triggers along with the append-only one. All nine
were fixed on their branches before those branches merged.

## Phase 2 -- the documents did not arrive

Nothing is installed and nothing is amended, because the standing rule is not
to invent a governed document. `docs/amendments/README.md` and
`DOCUMENT_AUTHORITY.md` describe what is installed, and what is installed has
not changed.

One number worth recording while this is open: **ADU-REPO-01 is cited 77 times
across 33 files** -- `.dependency-cruiser.cjs`, `.github/CODEOWNERS`,
`ci.yml`, the root and per-app `CLAUDE.md`, `generate-openapi.ts`, and the
**title of gate `deps`**: *"Dependency rules (ADU-REPO-01 S4)"*. A CI gate
names a section of a document nobody in this repository can open. D-94
recorded the absence; D-140 records its size.

This is D-84's and D-125's pattern for the third time: a rule arrives inside a
work order, is followed, and the document it belongs to does not arrive.

## Phase 3 -- what a pin moving on its first day showed

The order's own line -- *"the pin moving on its first day is the pin
working"* -- holds, and the pin has not moved, because the document that moves
it did not arrive. What the exercise did produce is the D-92 ruling, and that
is the larger of the two halves: a market with `audience_required = true` and
no threshold was refusing **every** seller, which is the exact opposite of
what an absent bar means.

**The two NULLs are kept apart**, and that is the part a one-line fix gets
wrong. A NULL threshold is an absent RULE and now passes; a NULL `v_best` is
absent EVIDENCE and still fails closed. The old single `coalesce` collapsed
both into "no", and a fix that kept collapsing them would have passed the
first test while opening the gate to sellers with no evidence at all -- which
is why the suite pins both arms and why the second arm's passing under both
definitions is the load-bearing half of the proof.

**D-142 is the generalisable finding**, and the order named it before the
grep did: *an exemption creates a class where the rule does not apply, and
nobody re-checks what falls into it later.* D-107 enumerated five read-only
ops scripts and was right about all five. `db-reset.mjs` did not exist yet --
and neither did anyone re-examine `db-determinism.mjs`, which has always run
`DROP DATABASE`.

The fix needed a second half nobody had stated: **the caller declares.** CI
deliberately leaves `NODE_ENV` unset, because an inherited `development`
ships a development console bundle. Both rules are right; what was missing was
anyone saying which environment a CI gate run *is*. It is `test`, and the gate
list now says so.

## Phase 4 -- C-3, and three defects in my own work

The done-clause is met and measured. What is worth carrying forward is what
the adversarial pass found, because all three are the same shape: **a claim
the code did not support.**

- the comment said *"the link is never dead"*; four of six were.
- the PR closed D-103; D-103's literals were still in `Shell.tsx`.
- the code made `UPGRADE_REQUIRED` reachable; the server returns `'OK'` as a
  literal, so it cannot fire.

None of the three was found by reading the diff. The links were found by
loading each destination, the literals by grepping for the strings the new
provider was supposed to remove, and the upgrade state by trying to prove the
gate fired and discovering it could not.

**The console still has no test harness, and C-3 has now landed without it.**
It was owed AT this stage. Every C-3 verification in this report is a browser
driven once, by hand, on the day the screen was built -- which proves the
screen worked, not that it keeps working. `apps/console/CLAUDE.md` now says
that in those words.

## What T9 did NOT do

Out of scope by S5, and untouched: real vendor adapters, the operator surface,
`ops/render.yaml`, the message anchor's immutability (D-86), Amharic
translation quality, and C-4 and beyond.

Blocked by Phase 2 and stated rather than worked around: the
`deferred-values` pin at 14, and `verify:appendix` as gate 22.

Not fixed and recorded: **D-135**, ten suites deleting their market under
`replica` and orphaning the devices other suites minted -- measured at 6
orphaned rows before a full run and 9 after. **D-143**, the Phase D load
harness, unrunnable since `product.slug` became NOT NULL at T6, so
ADU-CON-02-A1 S6's three capacity loads currently cannot be measured at all.

**One unexplained red.** A full `pnpm --filter @adulis/api test` run exited 1
during the Phase 1 review round **without its output being captured**, and
three consecutive runs immediately after passed 459/459. The failing test is
not named here because it is not known. D-124's class -- shared rate-limit
buckets -- is the standing candidate. It is recorded rather than omitted: an
intermittent red nobody writes down is one nobody looks for.

## S-Parked -- what T9 adds to the ruling list

- **D-140**: supply the four documents, or rule which of Phase 3's changes
  proceed against the order's own restatement of the rules rather than
  against the documents.
- **D-147**: the `min_supported_client` floor, and whether the server
  compares `X-Adulis-Client` against it. Until then a whole UI state --
  `UPGRADE_REQUIRED`, one of the closed twelve -- is correct and cannot fire.
- **D-135**: whether each suite deletes its dependents by id, or the shared
  replica-mode teardown becomes a helper that does it once and correctly.
- **The console harness** (no entry; `apps/console/CLAUDE.md` carries it):
  owed at C-3, overdue at C-3's landing.
