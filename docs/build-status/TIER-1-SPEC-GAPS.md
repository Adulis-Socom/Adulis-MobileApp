# Tier 1 — the register for ADU-DB-01 v1.10

**Produced:** 27 August 2026, third Tier 1 session · **Supersedes** the registers
written against v1.8 and against v1.9-before-A1, both discharged.
**Governing rule:** Work order T1 §3 — *"Transcribe, do not design. Where you
believe something is missing, report it — do not fill it in."*

**Tier 1 is complete.** Migrations 01–05 are built, applied, tested and
deterministic; the permission catalogue and the 139-grant matrix are seeded and
verified; Gate C is met. This is what v1.10 is written against.

| | |
|---|---|
| Appendix C | **7 PASS · 9 PENDING · 0 FAIL** across sixteen checks |
| The matrix, through `fn_has_permission` | **139 pass · 113 raise · 0 disagreements** |
| Step-up on `MOBILE` | **0 of 48** allowed, every role including `OWNER` |
| Determinism | identical across two clean databases, 2895 lines |
| Tests | **117 pass**, 6 suites |

**Amendment A1 settled everything that was blocking**, and both of its
predecessors' registers are now closed. A1.1 confirmed migration 01 needed no
change; A1.2 added the two missing `step_up_action` values; A1.3 supplied
`fn_has_permission` and the Owner ruling; A1.4's `CAMPAIGN_MANAGER` was already
correct. ADU-AUTH-01 v2.3 delivered the matrix in a form that survived transit.

---

## §A — The one ruling still needed, and it is a live hole

### A1 · A **suspended** team member keeps every permission until their session expires · **v1.10, SECURITY**

A1.3's body resolves the actor's role with:

```sql
SELECT tm.role INTO v_role
  FROM core.seller_team_member tm
 WHERE tm.seller_id = p_seller AND tm.account_id = p_account
   AND tm.revoked_at IS NULL;          -- suspended_at is NOT tested
```

`core.seller_team_member` carries **both** `suspended_at` and `revoked_at`, and
§18.1 is explicit that suspension is the mechanism: *"Team logins are disabled,
not deleted: `seller_team_member.suspended_at` rather than a row removal."*

**Disabling a login does not end a session.** A member suspended for cause who is
holding a live console session keeps their full grant set until that session
expires — **up to 12 hours, or 7 days on a remembered device under R17**. For an
`ADMIN` that is payout access, staff administration, subscription and identity
management, for a week, after the Owner has suspended them.

**Two candidate rulings, and this is the founder's call, not a transcription:**

1. **Test it here** — add `AND tm.suspended_at IS NULL` to the predicate. One
   line, immediate effect on every in-flight session, and it makes suspension
   behave like the revocation §8.2 already promises takes effect *"server-side
   immediately, not at next token refresh"*.
2. **Revoke sessions on suspension instead** — a trigger on `suspended_at`
   ending every session that member holds. Stronger, and consistent with
   §8.2's mechanism, but it is a trigger writing `core.session` and belongs to
   migration 3's neighbourhood rather than to this function.

**Not taken here.** Adding the clause is a ruling about what suspension means,
and A1.3's body is otherwise transcribed verbatim. Reported instead.

### A2 · `no_data_found` is SQLSTATE `P0002`, not class `02` · **v1.10, API contract**

A1.3 annotates the scope failure `-- API maps to 404`. `USING ERRCODE =
'no_data_found'` yields **`P0002`**, PL/pgSQL's condition code, not `02000`.

It is distinct from `42501`, which is all the design needs, and both are asserted
by test. But **the API mapping layer must map `P0002` → 404 and `42501` → 403**,
and a reader going by class would look in the wrong place. Worth one sentence in
ADU-API-01 §7's error table.

---

## §B — Documentation defects found while applying A1

### B1 · v2.3 §16.2a's fenced SQL still says `CAMPAIGN`, not `CAMPAIGN_MANAGER` · **v2.3 errata**

A1.4 states that *"ADU-AUTH-01 v2.3 and its `.sql` are corrected"*. The attached
`.sql` **is** corrected. The fenced SQL block inside the markdown is **not** — all
twelve of its Campaign rows still read `('CAMPAIGN', ...)`, which is the version
A1.4 says *"would have failed on the cast."*

The repository installed and seeded from the `.sql`, and the tests parse the
`.sql`, so nothing here is wrong. But the markdown is the copy a reader reaches
for first.

### B2 · §16.2's *"of which write"* column does not reproduce, and *write* is never defined · **v1.10, minor**

Any consistent definition of *write* taken from the action segment gives
**Owner 28 / Admin 26** against the stated **27 / 25**. The difference is exactly
one code held by both roles being counted as a read. Candidates:
`seller.sessions:revoke_all`, `seller.payment:confirm`, `seller.refunds:report`,
`seller.claims:respond`, `seller.orders:respond`,
`seller.orders:reissue_instructions`.

**Nothing depends on it.** Every binding count holds — 42 / 139 / 8, per-role
42 · 40 · 19 · 16 · 10 · 12 — and **`ANALYST` holds zero writes under every
candidate definition**, which is the row that matters. Either define *write* or
drop the column.

### B3 · The closing summary contradicts §0.1 on two counts · **v1.10, editorial**

v1.9's closing paragraph reads *"109 tables, **56 enum types**, 22 append-only,
**fifteen** Appendix C checks."* §0.1 says Appendix C *"gains check 16 and now
runs **sixteen**"*, and that the asserted enum count *"is replaced by a derivation
rule and a check"*. The count is **66** (A1.1), now **232 values**, and there are
**sixteen** checks.

### B4 · §6.9a's Companion list names three permissions that do not exist · **v1.10, editorial**

*"The Companion's Phase 1 grants, for reference"* lists
`seller.reservations:read`, `seller.reservations:respond` and
`seller.payment_receipt:confirm`. The catalogue calls them `seller.orders:read`,
`seller.orders:respond` and `seller.payment:confirm`.

Harmless **only** because the seed came from ADU-AUTH-01 §16.2a. Worth fixing
before someone seeds from the wrong list — which is how D1 began. Note also that
the list is now stale in a second way: v2.3 makes **twelve** permissions
mobile-reachable, not nine.

---

## §C — Columns described but not named

Each table is built with the columns the document names and without the ones it
only describes. **None blocks Tier 1**; each blocks a later migration or an API
contract.

| # | Table | Not named | Blocks |
|---|---|---|---|
| C1 | `core.ladder_config` | the **Established and Trusted thresholds**, and the **demotion rules** | migration 8's `fn_recompute_seller_level` |
| C2 | `core.timing_config` | the **cancellation-penalty ladder** (§5.3, §12.7) | migration 9's `buyer_cancellation_counter` |
| C3 | `core.seller_company_detail` | all five — *"registration identifier, trade licence number, TIN, representative `person_id`, representative relationship"* | built with mechanical snake_case names; **ADU-API-01 must agree** |
| C4 | `core.account_control_challenge` | the **anchor column**; the table is described only by its payload | built as `seller_social_account_id`; confirm |
| C5 | `core.buyer_profile` | everything — §6.3 makes every attribute a derived view | built as the account anchor only; confirm a payload-less table is intended |
| C6 | `core.market_phase_gate` | *"each with `attested_by` and `attested_at`"* — per condition (eight more columns, none named) or per row? | built per row, which invents no name |

### C7 · `timing_config` carries two names for one console lifetime · **v1.10**

§5.3 lists `buyer_session_lifetime` and `seller_session_lifetime`; §6.6a adds
`console_session_lifetime` and three more. Under **R2** there is no `SELLER`
audience for the second to describe. Both sets are built, because both are named.
The `CHECK` orders the console pair against `buyer_session_lifetime` as the mobile
lifetime — **which is an inference.** Say which column is MOBILE and retire the
other.

---

## §D — Ordering: §28's migration list against its own foreign keys

None is fatal; each was resolved by dropping a constraint or deferring an object,
and each is recorded so the deferral is not lost.

| # | Object | Wants | §28 places it in | Resolution |
|---|---|---|---|---|
| D1 | `*_config.created_by_account_id` | `core.account` (m3) | migration 2 | bare `uuid`, no FK |
| D2 | `core.seller.category_id` | `core.category` (m6) | migration 5 | bare `uuid`, no FK |
| D3 | `core.fn_enter_ladder` | `core.seller_level_state` (m8) | migration 5 | created; plpgsql resolves at runtime, so it is dormant for three migrations |
| D4 | `core.fn_has_permission` | `core.permission`, `core.role_permission` (05b) | A1.5 says 05a | created in 05a as instructed; same runtime resolution |
| D5 | new-device notification trigger (§6.6) | `core.notification` (m14) + seller relationships (m5) | unassigned | **not built.** Deferred to migration 14 |
| D6 | `core.order_courier_assignment` (§6.9) | `core."order"` (m9) | §6.9 groups it with migration 5 | deferred to migration 9, with the courier RLS policy it belongs to |

---

## §E — Smaller items

- **E1 · `verification.identity_attestation.verified` is never written.** §7.3
  lists the column; `write_attestation` — its only writer — does not set it. Left
  nullable rather than defaulted, because a default decides what an unset
  attestation means.
- **E2 · Check 10 says "the four named functions"; five exist.**
  `read_attestation`, `write_attestation`, `id_hash_matches`,
  `read_payment_evidence`, `render_payment_instructions`.
- **E3 · "109 tables across nine schemas" (§0) against ten created.** Appendix A
  places an enum at `waitlist.platform` while stating all types are created in
  migration 1, and `jobs` is a schema too. Check 14 counts nine; migration 01
  creates ten.
- **E4 · `core.operator_grant` is not seeded.** §6.11 says migration 5 seeds *"the
  founder account holding `ADMIN`"*. No founder account id exists in any document
  and `core.account` has no seed, so the grant would have to invent the account it
  references. A1.5 defers it to Tier 4.
- **E5 · `adulis_app` retains `SELECT` on the catalogue.** A1.3 justifies
  `SECURITY DEFINER` on the grounds that these are tables *"which the app role has
  no need to read directly"*, but ADU-AUTH-01 §5 returns `roles[]` as a rendering
  hint and §16.2 requires that a client not hide a control the server would
  permit — which needs the grant set, not a yes/no per call. `SELECT` is kept and
  the tension reported; `SECURITY DEFINER` makes the function correct either way.
- **E6 · Ownership transfer needs `ON UPDATE CASCADE`.** A1.3 records it: the
  transfer updates `owner_account_id`, a composite-FK anchor, so every child FK
  referencing `(seller_id, owner_account_id)` needs the cascade or the transfer
  raises. Tier 7, written down now.

---

## §F — Recommended order for v1.10

1. **Rule on §A1** — whether a suspended team member keeps their permissions. It
   is the only item here with a live security consequence, and it is one line
   either way.
2. **Name the `ladder_config` thresholds and the `timing_config` penalty ladder**
   (§C1, §C2). Unblocks migrations 8 and 9, which are the next two after Tier 1.
3. Confirm §C3–C6 (columns named by description) and §C7 (which column is the
   mobile lifetime).
4. Fix §B1 (the `CAMPAIGN` rows in v2.3's fenced block), §B3 and §B4
   editorially; define or drop §B2's *write* column.
5. Record §A2 in ADU-API-01 §7's error table, and §E6 before Tier 7.
