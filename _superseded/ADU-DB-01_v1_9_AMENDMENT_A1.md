# AMENDMENT A1 to ADU-DB-01 v1.9

**Date:** 26 August 2026 · **Author:** Founder / CEO
**Status:** Binding amendment. Applies to ADU-DB-01 v1.9 until v1.10 issues, at
which point v1.10 absorbs it.
**Purpose:** unblock the completion of Tier 1. Three defects, three fixes, then
finish migration 5.

> **Repository note.** Everything below is the founder's text. Each ruling is
> followed by a short **APPLIED** block recording where it landed in this
> repository and anything found while applying it. Those blocks are the only
> additions.

---

## 0. What this is, and what it is not

Your Tier 1 report identified three things that block migration 5 and one that is
a defect in v1.9 itself. **All four are confirmed and all four are mine.** This
amendment resolves them so Tier 1 can finish; the remainder of your register —
§D, §E, §F — goes into **ADU-DB-01 v1.10**, which is written against
`TIER-1-SPEC-GAPS.md` once I have it. **Do not wait for v1.10 to finish Tier 1.**

---

## A1.1 — Appendix A: the appended block is withdrawn entirely

**You were right and my correction was wrong.** I verified: **ADU-DB-01 v1.8's
Appendix A contained 66 enum rows — 55 in `core` and 11 schema-qualified.** My
claim that it was "core-only, every non-core enum absent" came from a regular
expression that did not allow dots in type names, and I trusted the tool instead
of reading the section.

> **RULING — the block appended to Appendix A in v1.9, headed with the seven
> non-core types and labelled *provisional*, is withdrawn in full.** The original
> 66-row catalogue governs. Where the two disagree, **the original is correct** —
> including `verification.verifier_kind` as `KYC_VENDOR, VIDEO_CALL` (not the
> three values I invented) and `billing.subscription_state` retaining **`TRIAL`**
> (§18.1) and **`SUSPENDED`**.
>
> **The count is 66.** That was your figure in the first report and it was right
> then.
>
> **Check 16 stays**, and it is the part of D6 that was worth having: the
> catalogue is verified against `pg_type` in both directions rather than asserted
> in a heading. ⚠ **But note what check 16 could not have caught here** — had
> migration 1 been built from the appended block, Appendix A and `pg_type` would
> have *agreed*, both wrong. A check that compares a document to a database
> catches drift between them and cannot catch a shared error. That limit belongs
> in v1.10's wording.

**If migration 1 as applied used any value from the withdrawn block, correct it
before merge.**

> **APPLIED — no change was needed.** Migration 01 had been built from the
> original catalogue in the previous session, precisely because the appended
> block was labelled provisional, so every value it creates was already the ruled
> one. Verified against the applied database: `verifier_kind` is
> `{KYC_VENDOR, VIDEO_CALL}`; `subscription_state` retains `TRIAL` and
> `SUSPENDED`; `message_sender_kind` retains `TEAM_MEMBER`; `retention_reason` is
> `{AWAITING_VALIDATION, OPEN_CLAIM}`; `phrase_source` is `{SEED, HARVESTED}`.
> The `_conflicts` block in `db/checks/fixtures/appendix-a.json` is updated to
> record the withdrawal rather than pose it as an open question.

## A1.2 — `core.step_up_action` gains two values

**Confirmed.** The enum carries six values against §16.3's eight step-up
permissions. `seller.identity:manage` and `seller.ownership:transfer` have no
value, so §6.7's challenge cannot be recorded for them — **the two most dangerous
actions in the system are the two that cannot be audited.**

> **RULING — `core.step_up_action` becomes eight values**, one per step-up
> permission:
>
> `PAYOUT_CHANGE` · `REISSUE_INSTRUCTIONS` · `TEAM_CHANGE` ·
> `SUBSCRIPTION_CHANGE` · `SELLER_DELETION` · `REVOKE_ALL_SESSIONS` ·
> **`IDENTITY_CHANGE`** · **`OWNERSHIP_TRANSFER`**
>
> Added in **migration 1**, where enums are created — not by a later
> `ALTER TYPE`. Migration 1 has run in your environment but nothing is merged, so
> rewrite it.
>
> **INVARIANT — `core.step_up_action` has exactly one value per permission where
> `requires_step_up` is true, and the two sets correspond one-to-one.** Recorded
> as a v1.10 candidate for Appendix C: a query asserting the correspondence, so a
> ninth step-up permission cannot be added without a value to record its
> challenge.

> **APPLIED.** Migration 01 rewritten; the catalogue is now 66 types and **232**
> values. The one-to-one correspondence is asserted twice: in migration 05b's
> `DO $seed_check$` block, which fails the migration, and in
> `permission-matrix.spec.ts`, which fails the build. A test also writes a
> `step_up_challenge` row for each of the two new actions, which was impossible
> before.

## A1.3 — `core.fn_has_permission`, defined

**Confirmed and it is the largest of the three.** I have cited this function in
five places as *"the first statement of every seller-scoped writing function"* and
never written its body. Owner resolution was genuinely unruled, because a role
can come from two places and nothing said which.

### The Owner ruling

`core.seller` carries `owner_account_id`, and **`UNIQUE (id, owner_account_id)`
is a composite-foreign-key anchor used throughout §9–§12.** The Owner therefore
cannot move to `seller_team_member` without breaking those anchors.

> **RULING — the Owner is `core.seller.owner_account_id`, and only that.
> `core.seller_team_member` never holds a row with `role = 'OWNER'`.**
>
> ```sql
> ALTER TABLE core.seller_team_member
>   ADD CONSTRAINT team_member_is_never_owner CHECK (role <> 'OWNER');
> ```
>
> Two sources of truth for one fact is how a person ends up Owner in one table
> and Admin in another. The seller row wins because it already had to.
>
> **This makes §16's "exactly one Owner" free** — it is a single column, not an
> index over a set — and it makes *"`seller.staff:admin` never permits changing
> the Owner"* enforceable, because staff administration writes
> `seller_team_member` and ownership lives elsewhere.

⚠ **v1.10 item, not a Tier 1 blocker.** Ownership transfer updates
`owner_account_id`, which is a composite-FK anchor — so every child FK
referencing `(seller_id, owner_account_id)` needs `ON UPDATE CASCADE`, or the
transfer raises. Tier 7, but it should be written down before it is discovered.

### The body

The function as ruled is transcribed into
`db/migrations/0005_sellers_availability_and_operators.sql`. Its four stated
properties:

> **1. It returns `void` and raises.** Every call site uses `PERFORM`. A boolean
> return invites `IF NOT fn_has_permission(...) THEN` — and the failure mode of
> that shape is a caller that forgets the `IF`, which reads as authorised.

> **2. A missing relationship raises `no_data_found`, and the role and surface
> failures raise `insufficient_privilege`.** Two error classes, because
> ADU-AUTH-01 §19 requires a scope failure to return **404** and a permission
> failure **403**. Reporting "no relationship" as 403 confirms that a seller with
> that id exists.

> **3. Role and surface are checked in one query and raise identically.**
> ADU-AUTH-01 §14: *a 403 never says which gate stopped you*. **One `EXISTS`
> covering both makes the function structurally unable to distinguish them** —
> not a discipline, a shape.

> **4. It checks neither `seller.status` nor object ownership.** Gate 0
> (suspension → 409) and gate 4 (is this object actually theirs → 404 via
> composite FK) belong to the calling function and to the schema respectively.

> **APPLIED, with one forced departure and one thing deliberately not added.**
>
> **Forced.** The listing reads `tm.removed_at IS NULL`. There is no `removed_at`
> column — §6.9 gives `core.seller_team_member` `suspended_at` and `revoked_at`,
> and the table was built from that list. `revoked_at` is used, being the column
> that carries the meaning the predicate wants. Transcribed verbatim the function
> would not compile, which is the same class of defect as D5.
>
> **Not added, and it needs a ruling.** The body tests `revoked_at` and **not**
> `suspended_at`, so a **suspended team member still resolves to their role and
> still passes every permission check**. §18.1 says *"Team logins are disabled,
> not deleted"*, which locates suspension at authentication rather than here — but
> a member suspended while holding a live session keeps full authority until that
> session expires, **which is up to 12 hours, or 7 days on a remembered device**.
> Adding the clause is a one-line change and it is a ruling, not a transcription.
> See `TIER-1-SPEC-GAPS.md` §A1.
>
> **One note for the API layer.** `USING ERRCODE = 'no_data_found'` yields
> SQLSTATE **`P0002`**, PL/pgSQL's condition, not class `02`. It is distinct from
> `42501`, which is all the design needs — but the mapping layer must map
> **P0002 → 404** and **42501 → 403**, and a reader of the *"API maps to 404"*
> comment could reasonably go looking for `02000`.
>
> **Ownership.** `SECURITY DEFINER` runs as the function's owner, and these
> migrations are applied by a bootstrap superuser. The function is explicitly
> `ALTER FUNCTION ... OWNER TO adulis_migrate`, which is not a login role, and
> granted the narrowest read set it needs. Without that line an authorization
> function would run as a superuser.

## A1.4 — Correction to ADU-AUTH-01 v2.3

`core.team_role`'s sixth value is **`CAMPAIGN_MANAGER`**, not `CAMPAIGN`. The
seed I sent first used the display name and **would have failed on the cast.**

> **APPLIED — already correct.** Migration 01 created `core.team_role` with
> `CAMPAIGN_MANAGER` in the previous session, and the corrected `.sql` uses it.
>
> ⚠ **The correction did not reach the whole document.** §16.2a's fenced SQL
> block inside `ADU-AUTH-01 v2.3` still reads `('CAMPAIGN', ...)` in all twelve
> of its Campaign rows, while the attached `.sql` file reads `CAMPAIGN_MANAGER`.
> The `.sql` is what this repository installed and what the tests parse. **The
> fenced block in the markdown needs the same correction**, or the next reader
> takes the version that fails on the cast.

---

## A1.5 — Finish Tier 1

**Gate C is met when** `pnpm db:check` shows **7 PASS / 9 PENDING / 0 FAIL**, the
four checksums hold, and the 252-cell matrix reproduces through the function in
both directions.

> **APPLIED — Gate C is met.**
>
> | | |
> |---|---|
> | `pnpm db:check` | **7 PASS · 9 PENDING · 0 FAIL** (sixteen checks) |
> | Checksums | 42 permissions · 139 grants · 8 step-up · 42/40/19/16/10/12 · ANALYST 0 writes |
> | The matrix through `fn_has_permission` | **139 grants pass · 113 non-grants raise · 0 disagreements** |
> | Step-up on MOBILE | **0 of 48** allowed, across all six roles including OWNER |
> | Determinism | identical schema across two clean databases, 2895 lines |
> | Tests | **117 pass**, 6 suites |
>
> Step 4 was followed: §16.2a's SQL is **executed, not transcribed**. The
> authority copy is installed at
> `docs/amendments/ADU-AUTH-01_v2_3_permission_seed.sql`, the migration carries
> the same statements, and `permission-matrix.spec.ts` parses the authority file
> and compares it against the live database — so a bad copy into the migration
> fails the build rather than the audit.
>
> §16.6 is also made executable: `pnpm verify:permission-doc` compares §16.2's
> ASCII table against §16.2a's SQL over all 252 cells, in both directions, on
> every CI run. That is the comparison the two-forms rule depends on and which
> nothing was performing.

**Still not to be done:** the `operator_grant` founder seed (no account exists yet
— Tier 4), the new-device notification trigger (migration 14),
`order_courier_assignment` (migration 9), migrations 06–15, any endpoint, any
Tier 2 work.

> **APPLIED — none of these was done.**
