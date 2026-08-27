# ADU-AUTH-01 v2.3 — §0.1 and §16

**Version:** 2.3 · **Baseline date:** 26 August 2026 · **Supersedes:** v2.2
**Status:** Binding. This file carries the sections that changed in v2.2 and
v2.3. §1–§14 and §17–§25 are unaltered and are in
`docs/ADU-AUTH-01_Authentication_and_Authorization_v2_1.md`. See
[`README.md`](README.md) for why the document is split this way.

---

## 0.1 What changed in v2.3

**v2.3 changes no grant. It changes the encoding.**

ADU-AUTH-01 v2.2 §16.2 rendered its matrix with two three-byte UTF-8
characters, and in transit **every one of the 252 cells lost its trailing bytes
and collapsed to the same glyph.** Granted and not-granted became
indistinguishable, and the legend collapsed with them. The seed could not be
transcribed, and the agent correctly refused to guess: the prose pins Owner's
42, Admin's 40, the seven universal reads and §16.4's departures, but leaves
Analyst's ten and the membership of 19 / 16 / 12 underdetermined — **and a guess
would have satisfied every checksum in ADU-DB-01 §6.9a.**

| # | Change |
|---|---|
| **§16.2** | The matrix is **ASCII only** — `Y` and `.`, `YES` in the step-up column. No character above U+007F appears in it |
| **§16.2a** | **New: the seed as executable SQL.** 42 `INSERT` values and 139 grants, generated from the same source as the table. There is nothing left to transcribe |
| **§16.6** | **New: a rule.** Load-bearing data in this document set is ASCII; decorative glyphs may appear in prose and never in a cell whose value is the data |

**Why the SQL block is the real fix.** An ASCII table still has to be read by a
human or a parser and turned into rows — and a transcription step is a place
where a defect can enter without anything raising. §16.2a removes the step. The
table is for reading; the SQL is for running; both are generated from one source,
so they cannot disagree.

**Everything else is carried forward from v2.2 unaltered** — the same 42 codes,
the same 139 grants, the same two departures, the same canonical eight.

---

# 16. The role matrix

ADU-PRD-01 §16.2 names six roles and describes none of them beyond *"whatever
their role grants, server-enforced on every endpoint."* This is that grant, **at
the level the database stores it**.

## 16.1 How this matrix was derived, and where it may be argued with

v2.1 stated the matrix by **permission group** — twelve rows such as *"Catalogue
write, publish"*. A group row cannot be seeded: `core.role_permission` is keyed
on `permission_code`, and *"Store write, availability"* covers four codes that do
not all belong to the same role.

The expansion below applies three rules, stated so that any row can be checked
rather than trusted:

1. **Where a group holds both a read and a write code, a partial grant resolves
   to the read.** That is what partial means when the alternative is a write.
2. **Where a group holds only writes, a partial grant resolves to the narrowest
   code** — the one whose consequences stop inside the role's own work.
3. **Reads that every role needs to do its job are granted to all six** —
   `orders:read`, `products:read`, `stock:read`, `store:read`, `reviews:read`,
   `notifications:read`, `analytics.basic:read`. Withholding them produces a role
   that cannot see the thing it is meant to act on, and none of them exposes
   money, identity or a buyer's contact details.

## 16.2 The matrix — 42 codes, 6 roles, 139 grants

**ASCII only.** `Y` granted · `.` not granted · `YES` in the Step-up column marks
the eight of §16.3. Columns are Owner, Admin, Sales/Support, Inventory, Analyst,
Campaign — the last being `CAMPAIGN_MANAGER` in `core.team_role`.

| Group | Permission code | Step-up | Own | Adm | Sal | Inv | Ana | Cam |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Orders | `seller.orders:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.orders:respond` |  | Y | Y | Y | . | . | . |
|  | `seller.order_ready:update` |  | Y | Y | Y | Y | . | . |
|  | `seller.orders:reissue_instructions` | YES | Y | Y | . | . | . | . |
| Payment | `seller.payment_evidence:read` |  | Y | Y | Y | . | . | . |
|  | `seller.payment:confirm` |  | Y | Y | Y | . | . | . |
|  | `seller.refunds:report` |  | Y | Y | Y | . | . | . |
| Catalogue | `seller.products:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.products:write` |  | Y | Y | . | Y | . | . |
|  | `seller.products:publish` |  | Y | Y | . | Y | . | . |
|  | `seller.media:write` |  | Y | Y | . | Y | . | Y |
| Stock | `seller.stock:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.stock:write` |  | Y | Y | . | Y | . | . |
|  | `seller.stock:bulk_write` |  | Y | Y | . | Y | . | . |
| Store | `seller.store:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.store:write` |  | Y | Y | . | . | . | . |
|  | `seller.availability:write` |  | Y | Y | . | . | . | . |
|  | `seller.fulfilment:write` |  | Y | Y | . | Y | . | . |
| Messaging | `seller.messages:read` |  | Y | Y | Y | . | . | . |
|  | `seller.messages:send` |  | Y | Y | Y | . | . | . |
| Handoff | `seller.handoff:read` |  | Y | Y | Y | Y | . | . |
|  | `seller.handoff:custody_transfer` |  | Y | Y | Y | Y | . | . |
|  | `seller.couriers:manage` |  | Y | Y | Y | . | . | . |
| Feedback | `seller.reviews:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.claims:read` |  | Y | Y | Y | . | Y | . |
|  | `seller.claims:respond` |  | Y | Y | Y | . | . | . |
| Analytics | `seller.analytics.basic:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.analytics.full:read` |  | Y | Y | . | . | Y | Y |
|  | `seller.analytics:export` |  | Y | Y | . | . | Y | . |
| Notifications | `seller.notifications:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.notifications.preferences:write` |  | Y | Y | . | . | . | . |
| Automation | `seller.chatbot:configure` |  | Y | Y | . | . | . | Y |
|  | `seller.chatbot.flows:write` |  | Y | Y | . | . | . | Y |
|  | `seller.broadcasts:send` |  | Y | Y | . | . | . | Y |
| Administrative | `seller.payout:read` |  | Y | Y | . | . | . | . |
|  | `seller.payout:update` | YES | Y | Y | . | . | . | . |
|  | `seller.staff:admin` | YES | Y | Y | . | . | . | . |
|  | `seller.ownership:transfer` | YES | Y | . | . | . | . | . |
|  | `seller.subscription:update` | YES | Y | Y | . | . | . | . |
|  | `seller.identity:manage` | YES | Y | Y | . | . | . | . |
|  | `seller.account:delete` | YES | Y | . | . | . | . | . |
|  | `seller.sessions:revoke_all` | YES | Y | Y | . | . | . | . |

**Per-role totals**, as a checksum against the seed:

| Role | Permissions | Of which write |
|---|:-:|:-:|
| `OWNER` | **42** | 27 |
| `ADMIN` | **40** | 25 |
| `SALES_SUPPORT` | **19** | 8 |
| `INVENTORY` | **16** | 8 |
| `ANALYST` | **10** | **0** |
| `CAMPAIGN_MANAGER` | **12** | 4 |

> ⚠ **Repository note, not part of the document.** The *"of which write"* column
> is the one figure here that does not reproduce: any consistent definition of
> *write* derived from the action segment gives Owner **28** and Admin **26**, so
> exactly one code held by both is being counted as a read. The document never
> defines *write*. Reported for v1.10; **nothing depends on it** — every binding
> count holds, and Analyst's zero is true under all candidate definitions.

## 16.2a The seed, as executable SQL

Generated from the same source as §16.2, so the two cannot disagree. **ASCII
only, and no transcription step.** It is held in this repository as a file rather
than a fenced block, so that the tests can parse the authority copy directly:

**→ [`ADU-AUTH-01_v2_3_permission_seed.sql`](ADU-AUTH-01_v2_3_permission_seed.sql)**

`db/migrations/0006_permission_catalogue.sql` carries the same statements, and
`apps/api/test/permission-matrix.spec.ts` parses the file above and compares it
against the live database — so a bad copy into the migration fails the build.

**Verify with the checksums of §16.2, not by reading the block.** 42 permission
rows, 139 grant rows, 8 with `requires_step_up`, and per-role totals
42 · 40 · 19 · 16 · 10 · 12 with `ANALYST` at zero writes.

> **The `surfaces` values are derived from §15.1's `M` markings.** Twelve
> permissions are reachable from the Seller Companion and carry
> `{MOBILE, CONSOLE}`; the other thirty are `{CONSOLE}`. **Every step-up
> permission is `{CONSOLE}`**, which ADU-DB-01 §6.9a's total constraint enforces
> independently — so a wrong array here fails at insert rather than at runtime.

> **INVARIANT — the Owner holds all 42 and is the only role that does.** Admin
> lacks exactly two: `seller.account:delete` and `seller.ownership:transfer`.

> **INVARIANT — Analyst holds no write permission of any kind.** Not one, no
> exception, and the count above is the assertion. A single write on this row
> makes the role something else.

## 16.3 The eight step-up permissions — canonical

`seller.payout:update` · `seller.orders:reissue_instructions` ·
`seller.staff:admin` · `seller.subscription:update` · `seller.account:delete` ·
`seller.sessions:revoke_all` · `seller.identity:manage` ·
`seller.ownership:transfer`

> **This list governs.** ADU-DB-01 v1.9 rebuilds the constraint and Appendix C's
> reviewer query from this section, and the seed is verified against it rather
> than against the constraint.

**Every one carries `surfaces = '{CONSOLE}'`.** Seven are held by Owner and
Admin; **`seller.ownership:transfer` and `seller.account:delete` are Owner
alone.**

## 16.4 Two departures from v2.1's group matrix, each deliberate

Recorded so that a reviewer holding both versions knows which differences are
decisions and which would be errors.

**1. Campaign loses the order-mutation grants.** v2.1 gave Campaign a partial
grant on *"Orders respond, ready"*. **v2.2 grants it neither.** Cancelling an
order line is what *Can't Fulfil* does, and every cancellation feeds the seller's
published cancellation rate — a trust-ladder input. A marketing role that can
move a trust signal is a hole. Campaign keeps `orders:read`.

**2. Inventory gains handoff.** v2.1 gave Inventory a partial grant on
*"Handoff, couriers"*. **v2.2 grants `handoff:read` and
`handoff:custody_transfer`**, withholding `couriers:manage`. Inventory holds
`order_ready:update` — the person who marks an order ready is the person standing
at the door when the courier arrives, and a role that can declare goods ready but
cannot hand them over is incoherent. Managing the courier roster stays
administrative.

**Two more resolutions, both following v2.1's own reasoning rather than
departing from it:**

- **`seller.fulfilment:write` goes to Inventory.** §15.1 already said why: *"an
  Inventory role that can declare how goods reach buyers without also being able
  to rename the store is a distinction Business tier will want."* Inventory does
  **not** get `store:write` or `availability:write`.
- **`seller.orders:reissue_instructions` is Owner and Admin only**, though
  Sales/Support does all other payment work. Reissuing instructions
  **re-transmits the payout details**, and §10.4's principle applies exactly: the
  people who touch money every day are the ones who must not be able to redirect
  it.

## 16.5 The constraints this matrix satisfies

- **§10.4: only Owner/Admin may view or change payout details** — *"no other
  role, including Sales/Support who confirm payments daily."*
- **§16.9: only the Owner may delete.** No Admin, no other role.
- **§16.2: no role except Owner/Admin may change billing, delete the seller, or
  alter team membership.**
- **Analyst is read-only, without exception.**

> ⚠ **`seller.ownership:transfer` closes a hole.** §16.2 lets an Admin alter team
> membership. Combined with the one-Owner invariant, an Admin could demote the
> Owner and promote themselves — **acquiring the only two powers Admin lacks,
> from a role that was never meant to have them.**
>
> Ownership transfer is therefore its own permission, granted to the Owner alone,
> with step-up. **INVARIANT — `seller.staff:admin` never permits changing the
> Owner.** Amendment A1.3 makes this structural: the Owner is
> `core.seller.owner_account_id`, and `core.seller_team_member` can never hold a
> row with `role = 'OWNER'`, so staff administration writes a table that does not
> contain ownership.

> ⚠ **Admin is very nearly Owner, and that should be a deliberate choice.** Admin
> can change payout, manage staff, change the subscription and manage identity.
> The only differences are deletion and ownership. **For a shop with three staff
> that is probably too much** — worth reconsidering when Business tier is
> designed.

**At MVP only `OWNER` is reachable.** Business tier is post-MVP, so team members
do not exist yet. **The matrix ships anyway** — the enum values are in the schema,
the grants are seeded, and nothing is reachable. Adding roles later to a system
that assumed one is far harder than leaving five unused.

## 16.6 Encoding — a rule this document set now follows

> **INVARIANT — data that is load-bearing is ASCII.** A cell whose *value* is the
> data — a grant, a flag, a state — uses characters below U+007F. Decorative
> glyphs stay in prose, where losing one costs a reader nothing.

**The reasoning is not aesthetic.** v2.2's matrix used two glyphs differing only
in their second and third UTF-8 bytes. When those bytes were lost the two
collapsed into one character, and **252 cells became indistinguishable while
still looking like a well-formed table.** That is the worst class of corruption:
it does not fail loudly, and a reader who did not know the original would seed
252 grants with confidence.

**Where a value must survive transit, give it twice in different forms.** §16.2
is a table for a human; §16.2a is SQL for a machine; both come from one
generator. Corruption that damages one is visible against the other.
