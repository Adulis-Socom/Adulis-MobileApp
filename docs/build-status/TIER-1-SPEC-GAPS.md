# Tier 1 — what ADU-DB-01 v1.9 and ADU-AUTH-01 v2.2 still leave open

**Produced:** 26 August 2026, second Tier 1 session · **Supersedes** the register
written against v1.8, which is discharged.
**Governing rule:** Work order T1 §3 — *"Transcribe, do not design. Where you
believe something is missing, report it — do not fill it in."* §9 — *"the correct
response is a document amendment, not a judgement call in SQL."*

**Migrations 01–05 are built, applied, tested and deterministic.** This is the
residue.

**v1.9 and v2.2 closed almost everything the first register raised.** All eight of
v1.9's defects D1–D8 are real fixes; both corrections the previous session
proposed were adopted (check 10 became a privilege query, check 15 was scoped to
`db/migrations/`); and v2.2's rewrite of §16 from a group matrix into a code-level
one is exactly the right answer to the objection that a group matrix cannot be
seeded.

| Migration | Status |
|---|---|
| **01 foundation** | Built, applied, tested, deterministic. Unchanged under v1.9 |
| **02 configuration** | **Built.** D8 defined the three tables that had no columns |
| **03 accounts / sessions** | **Built.** |
| **04 verification** | **Built.** D4 supplied the missing write path |
| **05a sellers / availability** | **Built.** D5 fixed the timezone column |
| **05b permission catalogue** | **42 permissions seeded.** `role_permission`'s 139 grants blocked — §A1 |

---

## §A — The one blocker, and it is not a document defect

### A1 · `ADU-AUTH-01 v2.2` §16.2 arrived unreadable · **BLOCKS the `role_permission` seed**

The matrix is 42 rows × 6 role columns = **252 cells**, and every cell arrived as
the same character. Every three-byte UTF-8 glyph in the file lost its trailing
bytes in transit, so ✓ and ✗ — along with the em dashes and the ⚠ marks — all
collapsed to a bare `â`. The legend suffered the same fate, and now reads
*"`â` is granted; `â` is not."*

**Nothing is wrong with the document.** It needs to be re-sent as a UTF-8 file, or
dropped into `docs/`, and the seed is then one `INSERT`.

**What the prose alone fixes**, and it is not enough:

| Fixed by prose | Value |
|---|---|
| `OWNER` | all 42 |
| `ADMIN` | 40 — all but `seller.account:delete` and `seller.ownership:transfer` |
| Universal reads (§16.1 rule 3) | `orders:read`, `products:read`, `stock:read`, `store:read`, `reviews:read`, `notifications:read`, `analytics.basic:read` to all six |
| §16.4 departures | `CAMPAIGN` loses both order-mutation grants · `INVENTORY` gains `handoff:read` + `handoff:custody_transfer` but not `couriers:manage` · `INVENTORY` gains `fulfilment:write` but not `store:write` / `availability:write` · `orders:reissue_instructions` is Owner + Admin only |
| `ANALYST` | 10, of which **0** writes |

**Underdetermined:** *which* ten reads `ANALYST` holds, and the remaining
membership of `SALES_SUPPORT`'s 19, `INVENTORY`'s 16 and `CAMPAIGN`'s 12.

A seeded guess would satisfy **every checksum in §6.9a** and still be wrong — the
counts are exactly what a plausible guess gets right. A wrong grant is not a
visible defect; it is a person who can or cannot do their job, discovered months
later. §24 already says why: *"A matrix test that checks only positives passes on
a seed that grants everything to everyone."*

`core.role_permission` is therefore created and left **empty**, with a test
asserting the emptiness so that a later run cannot mistake it for done.

---

## §B — Contradictions inside ADU-DB-01 v1.9

### B1 · Appendix A defines six enum types twice, and differently · **v1.10**

v1.9 carries forward v1.8's *Other schemas* table of eleven non-core types
**unchanged**, then appends a second block of seven marked *"provisional until
check 16 has run green once."* Six disagree:

| Type | Carried forward — used by migration 01 | Appended |
|---|---|---|
| `verification.verifier_kind` | `KYC_VENDOR`, `VIDEO_CALL` | `VENDOR_KYC`, `FAYDA`, `MANUAL_REVIEW` |
| `financial.retention_reason` | `AWAITING_VALIDATION`, `OPEN_CLAIM` | `OPEN_CLAIM`, `LEGAL_HOLD`, `DISPUTE` |
| `financial.secret_subject_kind` | `PAYMENT_EVIDENCE`, `PAYOUT_CREDENTIAL` | same values, **reversed order** |
| `chat.message_sender_kind` | `BUYER`, `SELLER`, `TEAM_MEMBER`, `BOT` | drops **`TEAM_MEMBER`** |
| `nlu.phrase_source` | `SEED`, `HARVESTED` | `SEEDED`, `HARVESTED`, `OPERATOR_ADDED` |
| `billing.subscription_state` | `BETA`, `TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED` | drops **`TRIAL`**, adds `SAFETY_SUSPENDED` and `EXPIRED` |

**The carried-forward table governs here**, on the document's own instruction that
the appended block is provisional. Check 16 has now run green once against it, so
the appended block is what needs correcting. Three are load-bearing enough to
name:

- **`chat.message_sender_kind` dropping `TEAM_MEMBER`** contradicts §13.2, which
  requires that where a team member confirms a payment *"the acting member is
  recorded, never the seller owner by default"*.
- **`billing.subscription_state` dropping `TRIAL`** contradicts §18.1, whose
  `trial_started_at` / `trial_ends_at` columns and 60-day rule need the state.
  `SAFETY_SUSPENDED` in that list is a `core.seller_status` value, not a
  subscription state — it reads as a copy from the wrong enum.
- **`financial.secret_subject_kind`'s order** matters because the column is
  enum-typed and `ORDER BY` follows declaration order. §13.3's body lists it in
  the carried-forward order.

### B2 · D6 misdiagnoses v1.8, and that misdiagnosis produced B1 · **v1.10**

D6 states that v1.8's Appendix A was *"a `core`-only catalogue presented as
complete"* and that *"every non-core enum — six of them — is absent."*

**Neither half is true.** v1.8 carried all **eleven** non-core types in an *Other
schemas* table, and v1.9 reproduces that table verbatim. The appended block was
written to fill an absence that was not there, and it is the sole source of the
six contradictions above.

The **real** v1.8 defect was the count: its header said 54 and §0.1 / §0.2 said 56
where the enumeration is **66**. v1.9 fixes that correctly and well, by deleting
the asserted number and adding check 16. **That part should stand exactly as
written.** Only D6's account of what was wrong needs correcting — so the appended
block can be withdrawn outright rather than reconciled type by type.

### B3 · The closing summary contradicts §0.1 on two counts · **v1.10, editorial**

The closing paragraph reads *"**109 tables**, 56 enum types, 22 append-only,
fifteen Appendix C checks."* §0.1 says Appendix C *"gains check 16 and now runs
**sixteen**"*, and that the asserted enum count *"is replaced by a derivation rule
and a check"*. The summary reasserts the number the body just retired, and
undercounts the checks.

---

## §C — Where a permission cannot be exercised because its enum value is absent

### C1 · `core.step_up_action` has six values; §16.3 has eight step-up permissions · **v1.10, BLOCKING for step-up**

Appendix A: `PAYOUT_CHANGE`, `REISSUE_INSTRUCTIONS`, `TEAM_CHANGE`,
`SUBSCRIPTION_CHANGE`, `SELLER_DELETION`, `REVOKE_ALL_SESSIONS`.

`seller.identity:manage` and `seller.ownership:transfer` — both step-up, both
Owner-critical, both added precisely to close holes — **have no value here.**
`core.step_up_challenge.action` cannot record a challenge for either, so §6.7's
invariant (*"every mutation implementing one of those actions takes a
`step_up_challenge_id` argument"*) is unsatisfiable for exactly the two most
dangerous ones.

This is D1's class of drift in a different place: the enum is a second copy of a
list that lives in AUTH-01 §16.3. Two values are needed; naming them is v1.10's
call, not a migration's.

### C2 · §6.9a's Companion list names three permissions that do not exist · **v1.10, editorial**

*"The Companion's Phase 1 grants, for reference"* lists
`seller.reservations:read`, `seller.reservations:respond` and
`seller.payment_receipt:confirm`. The catalogue calls them `seller.orders:read`,
`seller.orders:respond` and `seller.payment:confirm`.

Harmless **only** because the list is marked *for reference* and the seed was taken
from AUTH-01 §15.1. Under that correspondence §6.9a's nine and §15.1's nine **M**
codes are the same set exactly, which is what made the surface mapping safe to
make. Worth fixing before someone seeds from the wrong list — which is how D1
began.

---

## §D — The one decision this seed had to make for itself

### D1 · What surfaces do the three **M²** permissions carry today? · **v1.10**

`seller.reviews:read`, `seller.analytics.basic:read` and
`seller.notifications.preferences:write` are marked **M²** — *"Companion Phase 2
(ARCH-01 §3.1). Built on beta evidence, not before."* No document says what
`surfaces` they hold **now**.

**Seeded `{CONSOLE}`.** §6.9a enumerates exactly the nine Phase 1 codes as
carrying `{MOBILE, CONSOLE}` and these are not among them; §15.1's legend says
*"everything unmarked is console-only"*, and **M²** is not **M**. Widening later
is one `UPDATE`; narrowing after a client has shipped against it is a breaking
change. **Confirm or reverse in v1.10.**

---

## §E — Columns described but not named

Each table is built with the columns the document names and without the ones it
only describes. None blocks Tier 1; each blocks a later migration or an API
contract.

| # | Table | Not named | Blocks |
|---|---|---|---|
| E1 | `core.ladder_config` | the **Established and Trusted thresholds**, and the **demotion rules** | migration 8's `fn_recompute_seller_level` |
| E2 | `core.timing_config` | the **cancellation-penalty ladder** (§5.3, §12.7) | migration 9's `buyer_cancellation_counter` |
| E3 | `core.seller_company_detail` | all five — *"registration identifier, trade licence number, TIN, representative `person_id`, representative relationship"* | built with mechanical snake_case names; **ADU-API-01 must agree** |
| E4 | `core.account_control_challenge` | the **anchor column**; the table is described only by its payload | built as `seller_social_account_id`; confirm |
| E5 | `core.buyer_profile` | everything — §6.3 makes every attribute a derived view | built as the account anchor only; confirm a payload-less table is intended |
| E6 | `core.market_phase_gate` | *"each with `attested_by` and `attested_at`"* — per condition (eight more columns, none named) or per row? | built per row, which invents no name |

### E7 · `timing_config` carries two names for one console lifetime · **v1.10**

§5.3 lists `buyer_session_lifetime` and `seller_session_lifetime`; §6.6a adds
`console_session_lifetime` and three more. Under **R2** there is no `SELLER`
audience for the second to describe. Both sets are built, because both are named.
The `CHECK` orders the console pair against `buyer_session_lifetime` as the mobile
lifetime — **which is an inference.** Say which column is MOBILE and retire the
other.

---

## §F — Ordering: §28's migration list against its own foreign keys

None is fatal; each was resolved by dropping a constraint or deferring an object,
and each is recorded so the deferral is not lost.

| # | Object | Wants | §28 places it in | Resolution |
|---|---|---|---|---|
| F1 | `*_config.created_by_account_id` | `core.account` (m3) | migration 2 | bare `uuid`, no FK |
| F2 | `core.seller.category_id` | `core.category` (m6) | migration 5 | bare `uuid`, no FK |
| F3 | `core.fn_enter_ladder` | `core.seller_level_state` (m8) | migration 5 | created; plpgsql resolves at runtime, so it is dormant for three migrations |
| F4 | new-device notification trigger (§6.6) | `core.notification` (m14) + seller relationships (m5) | unassigned | **not built.** Deferred to migration 14 |
| F5 | `core.order_courier_assignment` (§6.9) | `core."order"` (m9) | §6.9 groups it with migration 5 | deferred to migration 9, with the courier RLS policy it belongs to |

---

## §G — Smaller items

- **G1 · `verification.identity_attestation.verified` is never written.** §7.3
  lists the column; `write_attestation` — its only writer — does not set it. Left
  nullable rather than defaulted, because a default decides what an unset
  attestation means.
- **G2 · Check 10 says "the four named functions"; five exist.**
  `read_attestation`, `write_attestation`, `id_hash_matches`,
  `read_payment_evidence`, `render_payment_instructions`. `id_hash_matches` is
  presumably the one not counted.
- **G3 · `core.fn_has_permission` has no body in any document**, and §28 assigns
  it to no migration — though §6.9 makes it *"the first statement of every
  seller-scoped writing function"* and migration 9's `fn_mark_order_ready` calls
  it. Two things are needed before it can be written: the seeded matrix (§A1), and
  a ruling on **how the Owner is resolved** — `seller.owner_account_id`, or a
  `seller_team_member` row with `role = 'OWNER'`? Both exist, and §6.9's one-Owner
  invariant implies the second. **Not built.**
- **G4 · "109 tables across nine schemas" (§0) against ten created.** Appendix A
  places an enum at `waitlist.platform` while stating all types are created in
  migration 1, and `jobs` is a schema too. Carried from v1.8, still open. Check 14
  counts nine; migration 01 creates ten.
- **G5 · `core.operator_grant` is not seeded.** §6.11 says migration 5 seeds *"the
  founder account holding `ADMIN`"*. No founder account id exists in any document
  and `core.account` has no seed, so the grant would have to invent the account it
  references. One `INSERT` once the account is named.

---

## §H — Recommended order for v1.10 and the v2.2 errata

1. **Re-send `ADU-AUTH-01 v2.2` as UTF-8** (§A1). Unblocks the `role_permission`
   seed, Gate C, and §24's matrix tests. **Nothing else in Tier 1 is blocked.**
2. **Withdraw Appendix A's appended enum block** and correct D6's account of what
   v1.8 was (§B1, §B2). Keep check 16 exactly as it is.
3. **Add two values to `core.step_up_action`** (§C1). Without them, step-up on
   identity management and ownership transfer cannot be recorded at all.
4. **Name the `ladder_config` thresholds and the `timing_config` penalty ladder**
   (§E1, §E2). Unblocks migrations 8 and 9.
5. Confirm §D1 (the **M²** surfaces), §E3–E6 (columns named by description), and
   §E7 (which column is the mobile lifetime).
6. Fix §B3 and §C2 editorially.
