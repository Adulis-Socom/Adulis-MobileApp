# `apps/api` + `db` — backend and database

Loaded together with the root `CLAUDE.md`. **Start your session here, not at the
repository root** — from the root, none of the rules below are in context.

**Governing documents:** ADU-DB-01 **v1.14** (T13) · ADU-AUTH-01 **v2.6** (T13, and **v2.5
remains canonical for the permission catalogue** -- the split is in `docs/amendments/README.md`) ·
ADU-API-01 **v1.7** · ADU-CON-02 **v3.2**. Read `docs/amendments/README.md` first: it says what
governs and which amendments are live. A1, A2 and A3 are all absorbed into the installed
text and no longer apply separately.

> **This file CITES the specifications; it does not replace them** (ADU-REPO-01 v1.2 S6).
> Where a rule is inlined below for practicality, **the citation beside it governs, and the
> inlined line is the first thing to check when the two disagree.** A rule kept in two
> places grows a stale copy, and the copy an agent reads first is the one it follows.

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
| Tables | **116** | Appendix C **check 14**, live from Tier 2, **against `db/checks/fixtures/`** |
| Enum types | **71** types | Appendix C **check 16**, against `pg_type` both directions |
| Append-only tables | **22**, each with both the trigger and the `REVOKE` | Appendix C **check 5** |
| Permissions / grants | **42 / 139**, 8 step-up, 12 mobile-reachable | `pnpm verify:permission-doc`, 252 cells both directions |

A different count is wrong somewhere — **stop and report it** rather than reconciling.

> **The document's printed counts and the build's now AGREE, and that is new.** Three
> revisions running, ADU-DB-01 announced an appendix correction it did not perform, and
> every one stayed green because nothing compared them. **v1.13 stopped writing its own
> appendices**: Appendix A and Appendix B are GENERATED from `db/checks/fixtures/` and
> `pg_class` (`pnpm generate:appendix`), and `pnpm verify:appendix` compares document to
> fixture in both directions. So the document, the fixture and the database agree by
> construction rather than by review.
>
> **SEVEN of check 14's rows are body-over-manifest and pinned by name** --
> `core.category_market_availability` (D-18), `core.notification_preference` (D-40),
> `core.seller_courier_invite` (D-59), `billing.purchase_intent` (D-68),
> `core.seller_ownership_transfer` (D-70), and the two migration 0043 adds,
> `core.otp_delivery_attempt` and `core.platform_otp_budget`. `pnpm db:check` prints the
> split: **116 tables: manifest 109 + 7 body-over-manifest.**
>
> The first five are folded into v1.14's Appendix B and flagged there. **The last two are
> not** -- check 14's own comment says v1.14 owes those two Appendix B rows -- so the
> count agrees while the enumeration does not yet. Say seven, not five.
>
> **[!] The INSTALLED v1.14 is correct; the founder's source carried one stale number**
> (D-190). His Appendix B opens "116 tables" and its closing sentence read "Reproducing
> **114** names here" -- v1.13's count, carried forward when the headline was updated. The
> installed copy reads 116, which is a one-word deviation from the source, made
> deliberately and registered; a ruling is invited. **Nothing in the binding document is
> wrong.**
>
> **Do not fix a count by editing the document to match the fixture, or the fixture to
> match the document** -- find which one the database agrees with.

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

> ### INVARIANT — the idempotency record is a state channel (register D-69)
>
> **An endpoint whose failure must be indistinguishable from its success cannot fail
> inside the transaction holding its idempotency claim.**
>
> `HandlerTransaction.runIdempotent` writes the record **inside** the handler's
> transaction, deliberately, so a state-changing POST cannot forget one. The
> consequence is that a handler which throws writes **no** record — and a caller who
> replays the same `Idempotency-Key` then re-executes instead of replaying, with no
> `X-Adulis-Idempotent-Replay` header. **Two requests distinguish the two branches
> whatever the first body said.**
>
> This is how G1.8's courier invite leaked after its body was fixed: the 404-on-unknown
> -phone path rolled back, and a body-shape fix alone left the oracle wide open. So:
>
> - an endpoint that must not distinguish two inputs has to reach a **COMMIT on both
>   paths** — the same statements, both committing;
> - where a genuine refusal is still required, it must be **independent of the
>   discriminating input** (G1.8's rate limit is keyed on the seller, never on the phone);
> - where a side effect must be counted even though the transaction rolls back, it goes
>   **on its own connection** — `RateLimitService.consume` already does.
>
> The same rollback trap bites lazy activation: anything written at the top of a handler
> transaction is undone when the handler raises. See register D-74, which is that trap
> found in G1.6's own test.
- `contracts/openapi.json` is **generated** (`pnpm generate:openapi`) and **tracked, with
  CI as its only author** — a human-authored diff to it fails the build. Regenerate
  locally to look at it; do not commit that copy.
- **`/v1` must appear in the OpenAPI PATH KEYS** (ADU-REPO-01 v1.2 §5.1).
  `setGlobalPrefix('v1')` **alone does not do this** — it prefixes the routes and leaves
  the Swagger document keys unprefixed, producing a spec that serves correctly from the
  real API and **404s against every mocked path**. That is the worst shape available: the
  API works, the types look right, and every front-end workstream is broken at the one
  place the seam exists to serve. `pnpm verify:contract` asserts it; the gate is inert
  until this migration's tier produces a contract and fires the day it does.

## Gates that must be green before anything is called done

```
pnpm db:migrate && pnpm db:check        # Appendix C, sixteen checks
pnpm db:determinism                     # two clean databases converge
pnpm verify:permission-doc              # 252 cells, both directions
pnpm verify:docs-ascii                  # A3.5, plus the NUL-byte guard
pnpm verify:appendix                    # Appendix A/B vs the fixtures, both ways
pnpm verify:transcription               # migration 0043 vs ADU-AUTH-01 v2.6, both ways, self-checked
pnpm --filter @adulis/api test
pnpm verify:deps && pnpm verify:deps-fires   # ADU-REPO-01 §4, and that they fire
pnpm verify:contract                    # /v1 in the path keys — inert until Tier 3
```

**`adulis_app` is never a superuser, in any environment, including local.** Under
superuser every boundary check passes while proving nothing — check 10 returns zero rows
because privileges are irrelevant, not because they are correct, and the whole suite then
certifies an unenforced boundary.
