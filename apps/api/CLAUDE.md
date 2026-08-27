# `apps/api` + `db` — backend and database

Loaded together with the root `CLAUDE.md`. **Start your session here, not at the
repository root** — from the root, none of the rules below are in context.

**Governing documents:** ADU-DB-01 **v1.10 as amended by A3** · ADU-AUTH-01 **v2.4** ·
ADU-API-01 **v1.6**. Read `docs/amendments/README.md` first: it says what governs and
which amendments are live.

## The doctrine, in one line

**A rule the database can hold, the database holds.** Prefer a constraint to a trigger,
a trigger to a function, a function to a service — in that order, always, dropping a
level only when the level above cannot express the rule. An invariant enforced only in
a NestJS service is an invariant a second endpoint can bypass.

## Migration discipline

- **A migration is never edited after it has merged.** Roll forward with a new one;
  `node-pg-migrate` will not re-run a file it has recorded, so an in-place edit means
  any database already carrying it never receives the fix.
- **Within an unmerged tier, rewrite freely.**
- **Single writer — the backend owner.** Two people adding `0016` collides *cleanly* and
  produces two migrations with one number (ADU-REPO-01 §6).
- **One commit per migration**, e.g. `tier2: migration 09 orders, reservations, guards`.
- Every migration header names the **document, version and section** it transcribes.
- **Transcribe, do not design.** Report what is missing; do not fill it in. Where a
  document contradicts itself, **stop and report** — four reissues and three amendments
  have come from exactly that, and the correct response is an amendment, never a
  judgement call in SQL.
- File numbering and document numbering diverge: migration 05 is split across `0005`
  and `0006`, so `0009` is the A3.3 amendment and document migration 08 is file `0010`.

## The counts, and what asserts them

| | | Asserted by |
|---|---|---|
| Tables | **109** (Appendix B: core 84 + 25) | Appendix C **check 14**, live from Tier 2 |
| Enum types | **66**, 232 values | Appendix C **check 16**, against `pg_type` both directions |
| Append-only tables | **22**, each with both the trigger and the `REVOKE` | Appendix C **check 5** |
| Permissions / grants | **42 / 139**, 8 step-up, 12 mobile-reachable | `pnpm verify:permission-doc`, 252 cells both directions |

A different count is wrong somewhere — **stop and report it** rather than reconciling.
There is deliberately no asserted enum count in the document any more: v1.9 replaced the
number with a check, because a number in prose drifts and a number from a query cannot.
`db/checks/fixtures/appendix-a.json` is the transcription both the check and the tests
compare against.

## Authorization — the exact semantics

- The **Owner is `core.seller.owner_account_id`, and only that.**
  `core.seller_team_member` can never hold `role = 'OWNER'` — a `CHECK` enforces it.
- **`core.fn_has_permission` returns `void` and raises**, in **three cases, not two**
  (A3.3):

  | | |
  |---|---|
  | **`U0002`** | the account **never** held a relationship → API **404** |
  | **`U0001`** | it held one and is **suspended or revoked** → API **403** |
  | **`U0001`** | role or surface failure → API **403** |
  | **`42501`** | **PostgreSQL only.** A grant is misconfigured → API **500**, our defect |

  **Never raise `42501` deliberately**: one code meaning both *you may not* and *our
  grants are wrong* hides a real privilege bug behind a clean denial. `U0003`–`U0999`
  are reserved.

  A suspended Admin is **not** a stranger — they worked there and know the store exists,
  so telling them it does not is a lie that produces a support ticket and looks like a
  bug. That is why the standing failure is 403 and only a stranger gets 404.
- **A suspended team member loses every permission on the next request** (R28), because
  disabling a login does not end a live session and R17 stretched that to seven days.
  The membership lookup reads the row **regardless of standing** and decides afterwards —
  which is what makes `U0001` and `U0002` distinguishable — and it needs its `ORDER BY`,
  because `seller_team_member_live` is unique only `WHERE revoked_at IS NULL` and a
  re-invited member holds several rows.
- The step-up surface restriction is a **column** (`core.permission.requires_step_up`)
  and a **total** `CHECK`, never a list of codes. v1.8's enumeration left three of the
  eight step-up permissions unconstrained; **do not reintroduce a list.**
- Never hand-edit the permission seed. It is executed from
  `docs/amendments/ADU-AUTH-01_v2_4_permission_seed.sql`.

## Stock — the concurrency-critical path

- **`core.product_variant.stock_count` is not writable.** `fn_apply_stock_event` fires
  **`BEFORE INSERT`** on `core.stock_event` (A3.1 — §10.1's *prose* says AFTER and is
  wrong; under AFTER, `RETURNING ... INTO NEW.resulting_count` is inert and every event
  ships with NULL while nothing raises).
- **Overselling is a transaction failure, never a negative number.** The arithmetic
  happens inside one `UPDATE`, so the row lock serialises concurrent decrements; a
  read-then-write in the application is the lost update this shape does not admit.
- ADU-PROJ-01 §13.5 names *"AI-generated code wrong under concurrency"* as a live risk,
  and this is where it would first show. **Migrations 7 and 9 are the pair to read by
  hand** — everywhere else a mistake raises; in those two it produces wrong data.

## Service-layer rules

- **Every state-changing endpoint calls a named ADU-DB-01 function** where one exists,
  and does nothing else of consequence. No endpoint reimplements an invariant.
- `core.fn_has_permission(account, seller, code, audience)` is the **first statement** of
  every seller-scoped writing function.
- Step-up travels as a **function parameter**, never as middleware — so a code path that
  omits it does not compile. A guard decorator is something forgotten on the seventh
  endpoint.
- The active seller is a **request parameter** (`X-Adulis-Seller`), never session state.
- **No string-built SQL outside the `sql` template tag.**
- `contracts/openapi.json` is **generated** (`pnpm generate:openapi`). Never hand-edit it,
  and never commit a locally regenerated copy — CI writes it.

## Gates that must be green before anything is called done

```
pnpm db:migrate && pnpm db:check        # Appendix C, sixteen checks
pnpm db:determinism                     # two clean databases converge
pnpm verify:permission-doc              # 252 cells, both directions
pnpm --filter @adulis/api test
pnpm verify:deps && pnpm verify:deps-fires   # ADU-REPO-01 §4, and that they fire
```

⚠ `pnpm verify:docs-ascii` (A3.5, plus the NUL-byte guard) belongs in that list and
**does not exist on this branch** — it arrives with the Tier 2 branch. Add it here the
moment that merges; a gate block naming a script that is not there teaches a reader to
skip the block.

**`adulis_app` is never a superuser, in any environment, including local.** Under
superuser every boundary check passes while proving nothing — check 10 returns zero rows
because privileges are irrelevant, not because they are correct, and the whole suite then
certifies an unenforced boundary.
