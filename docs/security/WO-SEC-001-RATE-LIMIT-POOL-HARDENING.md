# WO-SEC-001 -- Database Pool-Starvation and Rate-Limit Transaction Hardening

Closes **OVN-045** (CRITICAL, security / availability), found in the WO-DISC-002 review. Security
hardening only: no feature, no product rule, no threshold, no migration, no contract change.

## 1. Starting point

- Starting branch: `mobile/wo-004a-for-you-feed`
- Starting SHA: `ce40823bffe22a5b1b2c6ed971d59fbe17c4248b` (verified equal to `origin`, clean tree)

## 2. Branch

`security/wo-sec-001-rate-limit-pool-hardening`, created from the starting SHA. Not merged; no PR.
Commits: `6dfaf29` pool acquire bound; `e827980` nested-acquisition fix; `cac3f7a` regression tests
and static guard; then the commit holding this record and the register update.

## 3. Root cause

The application pool has `max: 10` (`APP_POOL_MAX`) and, before this work order, no acquisition
timeout: node-postgres waits for a free connection forever.

Every limited route ran its handler inside `HandlerTransaction.runIdempotent`, which opens a
transaction and holds one pooled connection for the length of the closure. Inside that closure the
route called `RateLimitService.consume(kind, subject, rule)` WITHOUT the transaction, so `consume`
wrote on its default `this.db` -- a second connection from the same pool.

```text
10 concurrent requests -> each transaction holds 1 of 10 connections
                       -> each consume() waits for an 11th
                       -> nothing is ever released: the API stops answering
```

The same shape existed in two places that are not rate-limit calls (section 5):
`OtpService.burnAttempt` (the OTP wrong-guess counter) and `HandoffService.processScan` (the
retry after losing a nonce race). The WO-DISC-002 fix of `/v1/fyp` (OVN-038) was the reference.

## 4. Every `RateLimitService.consume()` call

All seven calls in `apps/api/src` (there are none in `packages/*`).

| Call site | Route | Inside transaction? | Caller trx supplied? | Before | After | Test |
|---|---|---:|---:|---|---|---|
| `auth.controller.ts` `otpRequest`, `otp-request` 3/h/phone | `POST /v1/auth/otp/request` | yes (runIdempotent closure) | no | **UNSAFE** | SAFE: `beforeTransaction`, nothing held | wo-sec-001 burst, threshold, known/unknown; T8 |
| `deletion.controller.ts` `otpRequest`, `deletion-otp-request` 3/h/phone | `POST /v1/deletion/otp/request` | yes | no | **UNSAFE** | SAFE: `beforeTransaction` | burst, threshold + count, known/unknown; T8 |
| `auth.controller.ts` `stepUpRequest`, `step-up-request` 5/h/account | `POST /v1/auth/step-up/request` | yes | no | **UNSAFE** | SAFE: `beforeTransaction` | burst, threshold + count, 401; c6 (403 on MOBILE) |
| `auth.controller.ts` `recovery`, `auth-recovery` 2/day/phone | `POST /v1/auth/recovery` | yes | no | **UNSAFE** (not in the WO's list) | SAFE: `beforeTransaction` | burst, threshold + count |
| `couriers.controller.ts` `invite`, `seller-courier-invite` 10/h/seller | `POST /v1/seller/couriers` | yes | no | **UNSAFE** | SAFE: authorize in its own short transaction, then count, both before the handler transaction | burst (exactly 10 served), replay, unauthorized burns nothing; t6 oracle suite |
| `fyp.service.ts` session start, 120/h | `GET /v1/fyp` | yes | **yes** | SAFE (caller trx) | unchanged | disc-002 (14 concurrent starts) |
| `fyp.service.ts` page, 600/h | `GET /v1/fyp` | yes | **yes** | SAFE (caller trx) | unchanged | disc-002 |
| `bootstrap.controller.ts` web device mint, `bootstrap-device-mint` 50000/h platform | `GET /v1/bootstrap` | no (sequential statements; no transaction open) | n/a | SAFE (nothing held) | unchanged | t8-device-bootstrap |

## 5. Every other direct pool use, classified

The audit went past `consume()`: every `this.db` / `this.financialDb` in `apps/api/src`.

| Use | Runs while a transaction is held? | Verdict |
|---|---|---|
| `otp.service.ts` `burnAttempt` (wrong guess), from `verifyCode` / `verifyChallengeById` | **yes** -- inside the verify transaction of `POST /v1/auth/otp/verify` (anonymous), `/v1/deletion/otp/verify` (anonymous), `/v1/auth/step-up/verify` | **UNSAFE -> fixed** (OVN-060) |
| `handoff.service.ts` `processScan` 23505 retry | **yes** -- recursed inside its own transaction callback (`POST /v1/handoffs/sync`) | **UNSAFE -> fixed** (OVN-061) |
| `session.service.ts` session read / touch | no -- the auth guard, before the handler | SAFE |
| `idempotency.ts` `check` / `readWinner` | no -- before / after the handler transaction | SAFE |
| `otp-delivery.service.ts`, `sms-provider.router.ts`, `otp.service.ts` `markTransported` | no -- transport runs after commit | SAFE |
| `bootstrap.controller.ts` (four statements and one `withRequestContext`) | no -- sequential | SAFE |
| `deletion.service.ts` `purgeCredentials` (financial pool) | no -- the controller calls it after commit | SAFE |
| `financial.service.ts` (app and financial pools) | no -- the permission transaction closes before the next statement | SAFE |
| `health.controller.ts` | no | SAFE |
| Worker jobs (`ctx.db`, separate process, pool 12 for concurrency 10) | no nesting found (lexical scan of `src/jobs`) | SAFE; pool not bounded here (OVN-063) |

## 6. Route-by-route fix

**The mechanism.** `HandlerTransaction.runIdempotent` takes an optional fifth argument,
`beforeTransaction`, which runs **after the idempotency replay check and before the transaction
opens**, holding no connection. Each limited route passes its existing `consume(...)` call there,
unchanged (same subject, bucket, window, maximum). One central limiter remains; `consume(..., db?)`
still accepts a caller transaction (FYP uses it).

**Why not `consume(..., trx)` (the work order's default) on these routes.** Inside the transaction a
refusal or any later failure rolls the increment back. On the courier route that is exactly what
the code's own T6-B S2 note forbids ("the count survives a rolled-back handler and cannot be reset
by failing on purpose"); on the OTP paths it would make a request that fails after counting stop
counting -- the asymmetry OVN-045 was left open over. The pre-transaction step keeps the old
semantics exactly (section 7) and changes only connection use, which is what S23 asks.

- **Auth OTP request**: the count moved from the first statement of the closure to
  `beforeTransaction`. Nothing preceded it in the closure, so nothing reorders.
- **Deletion OTP request**: same. ACCOUNT_DELETION purpose, ticket architecture, no session, SMS
  only after a committed challenge: untouched.
- **Step-up request**: same. The CONSOLE-audience check, purposes and challenge lifecycle live in
  `AuthService.stepUpRequest`, untouched; the count still precedes them, as before.
- **Recovery** (found by the audit, not in the WO's list): same.
- **Courier invite**: the count used to follow `assertPermission` inside the transaction. The
  pre-step now runs `assertPermission` in its own short `tx.run`, then counts; the handler
  transaction checks permission again (the check that binds). An account without
  `seller.couriers:manage` is refused before counting and burns none of the store's budget -- as
  before. Serialization, the single-statement oracle-safe invite and the relationship semantics:
  untouched.
- **OTP wrong guess** (OVN-060): the counter is now written IN the transaction that compared
  the code, and committed before the refusal is served. `verifyCode` (the anonymous sign-in and
  deletion paths) reads the challenge `FOR UPDATE NOWAIT` and `verifyChallengeById` (step-up)
  `FOR UPDATE`, so guesses at one challenge are compared one at a time, each against the count the
  previous one committed. NOWAIT on the anonymous paths: a verify that finds the challenge held is
  refused at once with the existing `RATE_LIMITED` (Retry-After 1) and nothing compared, instead
  of queueing on the lock while holding a pooled connection (ten such waiters would pin the pool
  for the price of a trickle -- the re-review's MEDIUM). Step-up waits: the `step_up_challenge`
  lock its only caller takes first already serialises it, and it is signed in. A wrong guess increments in that
  transaction and throws `RefuseAfterCommit(OTP_INVALID | OTP_ATTEMPTS_EXCEEDED)`;
  `HandlerTransaction` commits (writing no idempotency record) and then serves the refusal --
  the same codes as before. No second connection, and never more compares than the budget. A
  `RefuseAfterCommit` that is never settled rolls back and reaches the filter as a 500 (loud).
  This is ADU-AUTH-02 v3.3 S17 ("attempt counters are consumed atomically so transaction rollback
  cannot restore a failed attempt budget"; S143, "attempt counter cannot be restored through
  transaction rollback"). The `FOR UPDATE` was absent before only because the old counter wrote
  on a second connection and would have deadlocked against it. A first draft of this work order
  wrote the counter AFTER the rollback instead; both independent reviews showed that a burst was
  then compared against a stale count (section 16), and it was replaced before commit.
- **Handoff sync retry** (OVN-061): the 23505 retry moved out of the transaction callback into
  `processScan`, around a new `processScanOnce`; the losing transaction rolls back first. One
  retry, and only for `handoff_scan_nonce_key` (the winner is committed, so the second pass reads
  it as a replay); any other unique violation rethrows instead of looping.
- **After-failure ownership activation**: skipped when the failure is itself a pool-acquire
  timeout, so a starved pool is not handed a second queued acquisition per failed request.

## 7. Rate-limit transaction semantics

For the five fixed routes, unchanged from before:

```text
the count commits when ... the request passed the replay check (a fresh execution or a concurrent
                           twin), on its own statement, before the handler transaction opens
the count rolls back when ... never: it is not in the handler transaction; a refused request
                           (429) and a request that fails later both keep their unit
a replay ...               never reaches the limiter (it returns from the replay check)
```

Governing text: ADU-AUTH-02 v3.3 S21 (OTP request throttling per PHONE_KEY, bounded challenge
creation) and S22 (enumeration resistance) set what is limited, not how a failed request counts;
the repository's own invariants decide that (the T6-B S2 note: a count "cannot be reset by failing
on purpose"), and S17 says the same of attempt counters. Keeping every count outside the
rollback follows all three.

Abuse assessment: no rollback can undo a count, so failing on purpose resets nothing; work after
the count is the same work as before; a concurrent twin with the same key counts once per twin,
as it did. For FYP (`consume(..., trx)`, WO-DISC-002) a 429 rolls back only the increment that
crossed the limit, so the limit still holds; unchanged.

Tests pin it: `deletion-otp-request` after seed 2 + one served + one refused + one replay reads
**4**; step-up reads 6 (seed 4); recovery reads 3 (seed 1); the courier burst reads **14** for 10
served + 4 refused.

## 8. OTP anti-enumeration

Nothing that distinguishes a phone moved: the limiter is keyed by the same HMAC subject, counts at
the same point relative to every phone-dependent statement (before all of them), and refuses with
the same RATE_LIMITED + Retry-After. New tests seed a known and an unknown phone at the limit on
both anonymous routes and require the same status, code, body keys and Retry-After (within one
second). T8's "a known and an unknown phone are indistinguishable on every anonymous path": green
(section 15).

## 9. Idempotency

The replay check still runs first; `beforeTransaction` is unreachable from a replay. Tests: on
each route a request is served at one-below-the-limit, the next is refused, and **a replay of the
served request still answers its stored response with `X-Adulis-Idempotent-Replay: true` while the
bucket is full** -- it never touched the limiter. Replays send no SMS (transport still runs only on
a fresh execution, after commit).

## 10. Courier invite

10/hour/seller unchanged. A 14-request burst from one Owner session: exactly 10 x 201, 4 x 429,
exactly 10 invite rows, bucket 14. A replay of a served invite while the budget is spent: 201
replay. A console account with no relationship to the store: 404 and the bucket unchanged.
`t6-courier-invite-oracle` (known/unknown indistinguishable, idempotency, re-invite, eleventh
refused alike): green. No Courier Mobile model was built.

## 11. FYP regression

`GET /v1/fyp` untouched; the 14-concurrent-start regression and the whole disc-002 suite: green.

## 12. Pool acquisition timeout (defence in depth)

`createAppPool` and `createFinancialPool` (`apps/api/src/common/db/database.ts`) set
`connectionTimeoutMillis`. pg-pool 3.14 applies it both to waiting for a pooled connection when the
pool is full and to opening a new one. A timed-out acquisition raises pg-pool's
`timeout exceeded when trying to connect`; `ProblemDetailsFilter` maps it (and pg's
`Connection terminated due to connection timeout`) to the existing planned-unavailability path:
**503, `Retry-After: 5`, code `INTERNAL`, `retryable: true`**. No new taxonomy code. The pg message,
stack and connection string are never served; the log line carries only `requestId`, `method`,
`route` (the route TEMPLATE, e.g. `/v1/seller/orders/:id/qr`, never the raw path, so no path
parameter can carry anything into the line) and `errorCode`, all on the logging allow-list, with
the message `database pool acquire timeout`.

This is not the OVN-045 fix: the fix is that nothing nests. The bound turns any future nested
acquisition from a hang into fast, observable 503s. (The before-run in section 14 shows why it
cannot stand alone: under starvation, wrong OTP guesses failed with 503 and were never counted.)

The financial pool gets the same bound: no handler nests it today, and a stuck evidence read
should fail in bounded time. Financial privileges and payment behaviour: untouched.

## 13. Configuration

No governing document sets an acquisition timeout. The current system-design pack
(`docs/system-designs/2026-11-08/`) has none: ADU-OBS-01 v3.2 S22 asks that "pool utilization/wait"
be monitored, its DB-saturation runbook calls for a "bounded supported pool" and says never to solve
saturation by adding connections; ADU-CON-02 v3.2 S17 budgets connections, not waits. The 503 log
line is the pool-wait signal S22 asks for. So:

- `DB_POOL_ACQUIRE_TIMEOUT_MS`, default **5000**, whole milliseconds **100 to 60000**.
- 0, negatives, fractions, units, scientific notation and out-of-range values are refused **at
  boot** (pg reads 0 as "wait forever"), following the `TRUSTED_PROXY_HOPS` precedent.
- Declared in `.env.example` and `ops/render.yaml` (value 5000); `verify:render-yaml` green.
- **A technical operational safeguard, not a product rule.**

## 14. Concurrency evidence (real PostgreSQL, real pool)

`apps/api/test/wo-sec-001-pool-starvation.e2e.spec.ts` (19 tests). Each route takes a burst of
`APP_POOL_MAX + 4` = 14 concurrent requests on the real 10-connection pool, with `/healthz` fired
into the middle.

| Burst | Fixed code | Old route code (same suite, only the five route/service files reverted, timeout kept) |
|---|---|---|
| OTP request, 14 phones | 14 x 202; probe `db: up` | **14 x 503** |
| Deletion OTP request, 14 phones | 14 x 202 | **14 x 503** |
| Step-up request, 14 accounts | 14 x 202 | **14 x 503** |
| Recovery, 14 phones | 14 x 202 | **14 x 503** |
| Courier invite, 14 phones, one store | 10 x 201 + 4 x 429 | **14 x 503** |
| Wrong sign-in guesses, 14 | only 401 / 429, never 5xx: compared guesses answer OTP_INVALID / OTP_ATTEMPTS_EXCEEDED, the ones that found the challenge held answer RATE_LIMITED with nothing compared; **attempt count at most 5** and every OTP_INVALID a counted compare; spent one by one to exactly 5, then the right code is dead | **14 x 503 (INTERNAL), none counted** |
| Wrong step-up guesses, 14 | 4 x OTP_INVALID + 10 x OTP_ATTEMPTS_EXCEEDED; **attempt count exactly 5**; right code then dead | 4 + 5 + **5 x 503** |

The attempt count is what proves the budget binds: every compared wrong guess increments it in
the comparing transaction, so the count IS the number of compares. The response codes alone cannot show it
(the stale-count draft answered the same 4 + 10). Checked by experiment: with the row lock removed
from `verifyCode` and nothing else changed, the same 14-guess burst compared **12** codes and the
test failed (`Expected: 5, Received: 12`); with the lock, 5. And a verify sent while the
challenge's row is held from outside answers 429 RATE_LIMITED (Retry-After 1) at once, with the
RIGHT code and the attempt count still 0: nothing was compared.

Without the new timeout the old code would not have answered at all; the suite bounds each test at
30 s so a regression shows as 503s, not as a hung CI.

Mechanism, on a pool of two (no API in the way): the OLD shape (transaction held, `consume()` on
the default pool) -- nothing moves until the first wait reaches the bound and fails with the acquire
timeout (its rollback then frees a connection the other request may still take in time, which is
the bound doing its job; asserting that both fail flaked once under full-suite load and was
corrected); counting first, or counting with the transaction -- both complete. A pool with every connection taken fails a new acquisition after
the 300 ms bound (not before 250 ms, well under 3 s) and serves normally once released, with
nothing waiting and nothing leaked.

## 15. T8 and the repeated runs

Final tree, on the disposable database `adulis_gates` rebuilt from nothing (extensions, migrations
0001-0055, seed, worker schema; `db:check` 16/16). The developer database was never touched.

| Run (in order) | Result |
|---|---|
| Full API suite, run 1 | **802/802** |
| Critical suites, run 1 (wo-sec-001, t8-market-from-device, t8-device-bootstrap, t6-courier-invite-oracle, c6-accounts, wo-api-001a-auth-security, t13-delivery-layer, t14-a4, c5-handoff, disc-002-fyp, `src/common`) | **213/213** |
| wo-sec-001 alone | 19/19 |
| T8 `t8-market-from-device` alone | 10/10 |
| disc-002 FYP (14-concurrent starts included) | green |
| Orphan sweep | PASS |
| Full API suite, run 2 | 801/802 -- see below |
| Critical suites, run 2 | **213/213** |
| T8 alone, run 2 | 10/10 |
| `pnpm test` (every package; the API's third full run) | **API 802/802, mobile 135/135** |
| Orphan sweep | PASS |

The one failure in run 2 was `t8-device-bootstrap` 'an anonymous console POST is accepted on the
cookie alone' answering 429 to an anonymous OTP request. Its bucket is purged before each of its
tests and the phone is used once, so the per-phone limit cannot be it. In the same run a worker
other than t13's logged `otp daily soft limit crossed: market 0, platform 71 attempts today` -- a
fresh market crossing the GLOBAL soft limit, which only happens while t13 holds the platform
ceiling at 1, and the hard limit drops with it. That is OVN-047's mechanism, on a second suite.
The suite alone afterwards: 14/14, twice.

T8's "a known and an unknown phone are indistinguishable on every anonymous path": green in every
run. Shared-bucket interference (OVN-062) was handled inside this suite: before the fix its
`otp-request` threshold check failed 2 of 3 combined runs; after it, the combined auth / T8 / c6 /
t12 / courier / handoff / FYP suites passed 5 of 5.

Gates on the final tree: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `verify:contract`,
`verify:appendix`, `verify:deps`, `verify:docs`, `verify:render-yaml`, `verify:mt-keys`,
`verify:error-locale`, `db:check` (16/16), `db:determinism`, `@adulis/api-client` tests, mobile
typecheck / test (135/135) / build: all PASS. No OpenAPI change (`verify:contract` green with
nothing regenerated) and no migration.

An earlier validation of the pre-review tree is superseded: its only failure (799/800) was an
over-strict assertion in the pool-mechanism test, corrected (section 14).

## 16. Security review

Two independent read-only reviews (separate agents, given the code and the work order's
checklist, not this record): (1) code / concurrency, (2) security / availability. Both found the
same HIGH in the first draft; it was redesigned and the security reviewer re-reviewed the
replacement.

| # | Severity | Found by | Finding | Outcome |
|---|---|---|---|---|
| R1 | **HIGH** | both | First draft wrote the OTP wrong-guess counter AFTER the rollback. pg-pool serves waiters first come first served, so a burst of guesses was compared against a stale attempt count before any write landed -- far more than five compares per code within the 5 s bound; step-up lost the exact ordering its lock used to give; a write that timed out left a compared guess uncounted. The response-code tally could not see it | **Fixed before commit**: counted in the comparing transaction under the challenge's row lock, committed before the refusal (`RefuseAfterCommit`); `attempt_count` assertions; experiment: without the lock, 12 compares, test red. **Re-review: closed** |
| R2 | MEDIUM | re-review | The row lock let ~10 anonymous verifies queued on one challenge hold every pooled connection cheaply | **Fixed**: `FOR UPDATE NOWAIT` on the anonymous paths; a held challenge is refused at once (RATE_LIMITED, nothing compared); held-lock test |
| R3 | MEDIUM | concurrency | On a pool-timeout failure the after-failure ownership activation queued another acquisition (another 5 s wait, more queue load) | **Fixed**: skipped for pool timeouts |
| R4 | LOW | both | Handoff retry had no cap and retried on any 23505 | **Fixed**: one retry, `handoff_scan_nonce_key` only |
| R5 | LOW | security | The 503 log line recorded the raw path | **Fixed**: route template |
| R6 | LOW | concurrency | Static guard: one level only, no arrow-function properties, whitespace-sensitive, missed some transaction forms | **Fixed**; aliasing and cross-class stay out of reach (section 17), hand-audited |
| R7 | LOW | re-review | Uncounted compares against other recent codes; a not-yet-sent code can be probed through OTP_EXPIRED | **Recorded, pre-existing**: OVN-065 |
| R8 | LOW | security | Courier invite: a refused caller costs one more transaction (the authorization pre-step) | **Accepted**: signed-in callers only; the price of authorizing before counting |
| R9 | INFO | re-review | A committed refusal still ran the after-failure activation | **Fixed**: refusals are thrown after the try |
| R10 | INFO | re-review | A future verifier caller outside `tx.run` would make wrong guesses free | **Fixed**: tripwire test pins the callers |
| R11 | INFO | both | Lock waits are not bounded by the acquire timeout; `Retry-After: 5` is fixed; under starvation, transport can fail after commit and spend a user's OTP budget without an SMS; a burst on a phone with a live code makes a 503 slightly likelier (activity, not account, signal) | **Recorded**: OVN-064 |
| R12 | INFO | both | Worker pool unbounded | **Recorded**: OVN-063 |

Confirmed sound by the reviewers: no rate-limit bypass (a replay returns before counting; twins
both count, the safe direction; nothing after the count can undo it; a 503 on the count sends
nothing); no new known-versus-unknown phone difference; `beforeTransaction` ordering and the
idempotency race handling; courier authorization unchanged and unauthorized callers burn nothing;
no lock-ordering cycle (step-up takes `step_up_challenge` before `otp_challenge`, nothing takes
them the other way; `markTransported` and issuance hold no verify-conflicting lock first); the
pool-timeout messages match pg-pool 3.14 / pg 8.23; `DB_POOL_ACQUIRE_TIMEOUT_MS` validation sound;
no pg message, connection string, phone, OTP, ticket or bearer reaches the wire or the log.

**No Critical or High finding remains open.**

## 17. Static guard

`apps/api/src/common/db/no-nested-pool-acquisition.spec.ts` parses every file under
`apps/api/src` with the TypeScript compiler and fails when, inside a function that holds a
transaction (a `tx.run` / `tx.runIdempotent` handler / `withRequestContext` / `.transaction().execute`
callback -- also `.connection().execute` and `.transaction().<option>(...).execute`, with call
chains matched whitespace-free so a line break does not hide one -- or a function taking a
`Transaction` parameter), it finds `consume()` without the transaction, `this.db` /
`this.financialDb`, or a call to a same-class method that reaches a pool at ANY depth (methods and
arrow-function properties; a call inside a stored or returned closure, which runs later, does not
count). Run against the pre-fix tree it reports exactly the eight unsafe sites (five limiter calls,
the two `burnAttempt` calls, the handoff retry -- it found the last one); on this branch, none.
Its fixture tests prove each shape is caught (including two hops through an arrow property and a
call chain split across lines) and the fixed shapes are not.

A TRIPWIRE in the same spec pins the callers of `verifyCode` / `verifyChallengeById` (today
`AuthService.verifySignIn`, `AuthService.stepUpVerify`, `DeletionController.otpVerify`, all inside
`tx.run`). They throw `RefuseAfterCommit`, which only HandlerTransaction settles; a caller outside
it would roll the count back and answer 500 to a wrong code against 200 to a right one -- a free
guess. A new caller fails the test until it is reviewed and added.

What it cannot see, by design, and what covers it instead: a pool reached through ANOTHER class,
and a pool copied into a local variable (`const db = this.db`). The concurrency review checked
every cross-class pool-touching method by hand (`check`, `readWinner`, `authenticate`,
`transport`, `deliver`, `routeFor`, `markTransported`, `paymentInstructions`, `streamEvidence`,
`sync`, `run`, `runIdempotent`): none is called inside a transaction. The e2e bursts are the
guard there. A guard that also caught those would need type-aware analysis -- not attempted.

## 18. Remaining related issues and what the next work order may do

- **OVN-047** (TEST_FLAKE, OPEN): re-diagnosed. Not the `deletion-otp-request` bucket. The T8
  failure is `t13-delivery-layer` lowering the PLATFORM-WIDE daily OTP ceiling to 1 for a moment
  ('the GLOBAL ceiling binds...'), so any anonymous OTP request in a parallel worker during that
  moment is RATE_LIMITED. Reproduced: T8's enumeration test alone 3/3 green; with the same toggle
  running beside it, 4/4 red with the recorded signature (`202:` vs `429:RATE_LIMITED`). The work
  order authorises a fix only for the bucket diagnosis, so it was NOT fixed. Recommended: t13
  should change the platform row inside the transaction it asserts in and roll back, so no other
  connection ever sees it. It also struck `t8-device-bootstrap` once in this validation
  (section 15), and this suite's anonymous bursts are exposed to the same moment.
- **OVN-062** (TEST_FLAKE, OPEN): T8, t12 and c6 purge `otp-request` (and c6 the other phone
  buckets) by bucket key, mid-run, in parallel workers; this suite's `otp-request` threshold
  checks run last and retry only when the bucket shows such a purge.
- **OVN-065** (LOW, pre-existing, Auth): when no live challenge is found, and after a wrong guess
  at the live one, the code is also compared against other recent challenges to answer
  OTP_EXPIRED ("check for a newer message"). Those compares are not counted, and the query also
  matches challenges not yet transported, so a code minted but not yet sent can be probed through
  the OTP_EXPIRED / OTP_INVALID difference until it goes live. OTP semantics (4.2), not connection
  use, so recorded, not changed. Recommended: compare only `transported_at IS NOT NULL AND
  expires_at <= now()` (codes a person could have held, now dead).
- **OVN-063** (INFO): the worker pool (separate process) has no acquisition bound.
- **OVN-064** (INFO): the acquire bound does not cover lock waits (courier per-phone lock, the
  challenge FOR UPDATEs); the 503's `Retry-After: 5` is fixed; under starvation, transport can fail
  after commit and spend a user's OTP budget without an SMS. Recommended: `lock_timeout` /
  `statement_timeout` and a jittered Retry-After in an operations work order.
- Not touched, as instructed: OVN-040 (device registration throttling), OVN-042 (guest device
  purge), OVN-035, OVN-032, OVN-030; `technical-baseline-recent-v1.production_approved` stays false.
- **Next**: with OVN-045 closed, the FYP contract-closure work order may proceed. A new limited
  route must count in `beforeTransaction` (or pass its transaction where a rollback may undo the
  count); the static guard and the burst suite enforce it.
