# `docs/amendments` — what governs, and where each part of it lives

Read this before `docs/`. Where an amendment here and a document in `docs/`
disagree, **the amendment governs** until the next full reissue absorbs it.

## ADU-AUTH-01 — governs at **v2.3**

| Part | Where | State |
|---|---|---|
| §16 (the role matrix) and §0.1 | [`ADU-AUTH-01_v2_3_section_16.md`](ADU-AUTH-01_v2_3_section_16.md) | **v2.3** |
| §16.2a, the seed as executable SQL | [`ADU-AUTH-01_v2_4_permission_seed.sql`](ADU-AUTH-01_v2_4_permission_seed.sql) | **v2.3** |
| §1–§14 and §17–§25 | `docs/ADU-AUTH-01_Authentication_and_Authorization_v2_1.md` | v2.1, and current |

**Why v2.3 is split rather than installed whole.** v2.2 and v2.3 were supplied
in-session, and the copies available carry the same transit damage v2.3 was
written to defeat: in the prose, every three-byte UTF-8 glyph lost its trailing
bytes. §16 and the `.sql` are **ASCII by construction** (that is the whole point
of v2.3) and arrived intact, so they are installed verbatim. The rest of the
document did not, and installing a damaged copy over the clean v2.1 already in
`docs/` would lose text rather than gain it.

**Nothing is missing.** v2.3 §0.1: *"Everything else is carried forward from v2.2
unaltered."* v2.2: *"Sections 1–14 and 17–25 are untouched. This is a rewrite of
one section."* So v2.1 is the current text of every section not held here.

> **To finish the job:** drop the UTF-8 original of
> `ADU-AUTH-01_Authentication_and_Authorization_v2_3.md` into `docs/`, move
> `..._v2_1.md` to `_superseded/`, and delete
> `ADU-AUTH-01_v2_3_section_16.md`. The `.sql` stays — it is what the tests
> parse.

### What was verified, and how

§16.2a claims the ASCII table and the generated SQL "cannot disagree" because
both come from one source. That claim was checked rather than trusted, before
either was used:

- all **252 cells** of §16.2's table agree with the SQL, in both directions;
- the four checksums hold — **42** permissions, **139** grants, **8** step-up,
  per-role **42 / 40 / 19 / 16 / 10 / 12**;
- every invariant §16.4 and §16.5 state in prose is satisfied by the data —
  Owner holds all 42, Admin lacks exactly two, Analyst holds zero writes,
  Campaign has neither order-mutation grant, Inventory has handoff but not
  `couriers:manage`, payout is Owner/Admin only;
- the seven universal reads of §16.1 rule 3 reach all six roles.

The one divergence found is **annotation, not data**: §16.2's *"of which write"*
column gives Owner 27 and Admin 25, and any consistent definition of *write*
derived from the action segment gives 28 and 26. The document never defines
*write*, and exactly one code held by both roles is being counted as a read.
`seller.sessions:revoke_all` is the likeliest, but it is a guess. **Reported for
v1.10; nothing depends on it** — the binding counts all hold, and Analyst's zero
is true under every candidate definition.

## ADU-DB-01 — governs at **v1.9 as amended by A1**

| Part | Where |
|---|---|
| Amendment A1 (four rulings) | [`ADU-DB-01_v1_9_AMENDMENT_A1.md`](ADU-DB-01_v1_9_AMENDMENT_A1.md) |
| The document | supplied in-session; **not installed** — see below |

`docs/` still holds **v1.8**. v1.9 was supplied in-session with the same prose
damage and, unlike ADU-AUTH-01 §16, none of it is ASCII-by-construction. Its
substance is carried in this repository three ways instead:

- **A1** is installed here in full, and it is what changed the migrations;
- **`db/checks/fixtures/appendix-a.json`** is Appendix A transcribed, and
  Appendix C **check 16** asserts it against `pg_type` in both directions on
  every CI run;
- every migration cites the section it transcribes, in its header.

> **To finish the job:** drop the UTF-8 original of `ADU-DB-01 v1.9` into
> `docs/` and move `..._v1_8.md` to `_superseded/`.

### A1.1 required no change to migration 01

A1.1 withdraws the block appended to Appendix A in v1.9 and rules that *"the
original 66-row catalogue governs. Where the two disagree, the original is
correct."* Migration 01 had been built from the original catalogue in the
previous session — precisely because the appended block was labelled provisional
— so every value it creates was already the ruled one, and nothing needed
correcting. Verified against the applied database:

```
verification.verifier_kind     {KYC_VENDOR, VIDEO_CALL}          not the invented three
billing.subscription_state     {BETA, TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED}
chat.message_sender_kind       {BUYER, SELLER, TEAM_MEMBER, BOT}  TEAM_MEMBER retained
financial.retention_reason     {AWAITING_VALIDATION, OPEN_CLAIM}
nlu.phrase_source              {SEED, HARVESTED}
core.team_role                 sixth value is CAMPAIGN_MANAGER    A1.4 already satisfied
```

**A1.1's note on the limit of check 16 is worth keeping in view.** Had migration
01 been built from the appended block, Appendix A and `pg_type` would have
*agreed* — both wrong. A check that compares a document to a database catches
drift between them and cannot catch a shared error. What caught this was that
the two versions of Appendix A disagreed with **each other**, and the earlier one
was reported rather than reconciled.

## Where the rest of the register lives

`docs/build-status/TIER-1-SPEC-GAPS.md` — everything A1 did not settle, which is
what ADU-DB-01 v1.10 is written against.
