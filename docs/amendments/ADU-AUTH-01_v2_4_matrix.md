# ADU-AUTH-01 v2.4 §16.2 — the role matrix, in the form a comparator can read

**This file is one section of ADU-AUTH-01 v2.4, held separately because
something has to compare it against §16.2a.** See [`README.md`](README.md) for
why the rest of the document is not yet in `docs/`.

**§16.6, second clause — new in v2.4, and the reason this file exists:**

> **INVARIANT — a value given in two forms is not verified until a comparator
> runs.** Two forms that nothing compares are two chances to be wrong, not a
> check. **`pnpm verify:permission-doc` compares all 252 cells of §16.2 against
> §16.2a in both directions and is a standing CI gate** alongside the Appendix C
> checks.
>
> **v2.2's collapsed matrix still parsed as a well-formed table** — which is the
> whole argument. Corruption that leaves the structure intact is invisible to
> every check except one that reads the values and compares them to something.

The other form is
[`ADU-AUTH-01_v2_4_permission_seed.sql`](ADU-AUTH-01_v2_4_permission_seed.sql),
which is what migration 05b executes.

---

## 16.2 The matrix — 42 codes, 6 roles, 139 grants

**ASCII only.** `Y` granted · `.` not granted · `YES` in the Step-up column marks
the eight of §16.3. Columns are Owner, Admin, Sales/Support, Inventory, Analyst,
Campaign — whose `core.team_role` values are `OWNER`, `ADMIN`, `SALES_SUPPORT`,
`INVENTORY`, `ANALYST`, **`CAMPAIGN_MANAGER`**.

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

| Role | Permissions |
|---|:-:|
| `OWNER` | **42** |
| `ADMIN` | **40** |
| `SALES_SUPPORT` | **19** |
| `INVENTORY` | **16** |
| `ANALYST` | **10** |
| `CAMPAIGN` | **12** |

> **R30 — v2.3's "of which write" column is withdrawn.** It stated 27 and 25 for
> Owner and Admin; any consistent definition taken from the action segment gives
> 28 and 26, and **the difference is one code both roles hold being counted as a
> read.** The candidates are `sessions:revoke_all`, `payment:confirm`,
> `refunds:report`, `claims:respond`, `orders:respond` and
> `orders:reissue_instructions` — six codes on which reasonable people differ
> about whether they write.
>
> **A statistic two careful readers compute differently is not a checksum**, and
> defining *write* precisely earns nothing here. The permission totals stay
> because they are countable without a definition. **`ANALYST` holds zero writes
> stays**, because it holds under every candidate definition and is the only
> claim in the row that carries an invariant.

> **The role literals are `core.team_role` values, not the display names used in
> the column headings.** The sixth role is **`CAMPAIGN_MANAGER`** in the enum and
> *Campaign* in prose. A seed written from the headings fails on the cast —
> which is the second reason §16.2a exists: a table for reading and SQL for
> running, generated together.

> **The `surfaces` values are derived from §15.1's `M` markings.** Twelve
> permissions are reachable from the Seller Companion and carry
> `{MOBILE, CONSOLE}`; the other thirty are `{CONSOLE}`. **Every step-up
> permission is `{CONSOLE}`**, which ADU-DB-01 §6.9a's total constraint enforces
> independently — so a wrong array fails at insert rather than at runtime.

> **INVARIANT — the Owner holds all 42 and is the only role that does.** Admin
> lacks exactly two: `seller.account:delete` and `seller.ownership:transfer`.

> **INVARIANT — Analyst holds no write permission of any kind.** Not one, no
> exception, and the count above is the assertion.

## 16.3 The eight step-up permissions — canonical

`seller.payout:update` · `seller.orders:reissue_instructions` ·
`seller.staff:admin` · `seller.subscription:update` · `seller.account:delete` ·
`seller.sessions:revoke_all` · `seller.identity:manage` ·
`seller.ownership:transfer`

**Every one carries `surfaces = '{CONSOLE}'`.** Seven are held by Owner and
Admin; **`seller.ownership:transfer` and `seller.account:delete` are Owner
alone.**
