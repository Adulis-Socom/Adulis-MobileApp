# WO-API-001A - Session security, auth schemas and Mobile account context

Status: complete, pushed, awaiting founder review. Branch `mobile/wo-api-001a-auth-security`.
No pull request, no merge, `main` untouched. WO-002 and WO-API-001B not started. No Courier,
payment or infrastructure work.

## 1. Baseline

`mobile/wo-001c-contract-readiness` at `a0fb7d87e79bc98c84ff37c6d19c830474007259` (the accepted
WO-001C audit), verified against `origin` before branching. `origin/main` was
`01302cfb7616cb38de111de9a7694312c58c8913` and is unchanged.

## 2. Branch

`mobile/wo-api-001a-auth-security`, created from the baseline above.

| Commit | Content |
|---|---|
| `672252a` fix(auth): separate session credentials from public ids; bind devices and revocation | 0053, SessionService, guard, auth service/controller behaviour, console, test-fixture migration |
| `f052873` feat(api): publish typed auth bootstrap contracts and account_context | DTOs, decorators, bootstrap `account_context`, regenerated contract and client, the WO spec |
| `5e36f73` test(api-client): pin the typed auth, session and bootstrap contract | `packages/api-client/test/auth.test-d.ts` alone, for its own packages PR |
| `e8dce44` fix(api): never let a shared cache store an authenticated bootstrap | `Cache-Control: private, no-store` on authenticated bootstrap |
| (this record) docs(auth): record WO-API-001A security closure | this file and the register resolutions |

Commit `672252a` alone typechecks (API and console) and its suites pass (c6 and pipeline,
42/42), verified in a separate worktree. Its contract is regenerated in `f052873`, so
`contract-current` holds from `f052873` on. The regenerated `schema.d.ts` travels with its
source, as earlier contract commits did; only the hand-written type test is split out.

## 3. SEC-1 - the credential is no longer the session id

Before: `core.session.id` was both the public identifier and the bearer/cookie credential.
`GET /v1/auth/sessions` listed every live id on the account, so any one session could read
every other session's credential (register SEC-1, release gate, HIGH).

Now (founder ruling A, AUTH-02 v3.3 S31):

- `core.session.id` is the **public** session id: a fresh `randomUUID()`, safe to list, to name
  in `DELETE /v1/auth/sessions/{id}` and to keep in audit columns
  (`revoked_by_session_id`, `payout_change_log.session_id`). It authenticates nothing.
- The **credential** is generated independently and returned once by `POST /v1/auth/otp/verify`:
  in the body for MOBILE (`token`), in the `__Host-adulis_session` cookie for CONSOLE.
- PostgreSQL stores only `core.session.token_hash`, the SHA-256 of the credential.
- `SessionService.authenticate` hashes the presented credential and looks the session up by
  `token_hash`. Expiry, revocation, account status, audience/carrier matching, the idle rules
  and the activity touch are unchanged; the touch writes by public id after the lookup.
- `GET /v1/auth/sessions` names its columns one by one and returns public ids only. It no
  longer returns `device_id` either: for a browser that value is the `__Host-adulis_browser`
  cookie, which the new-device payout lock treats as a known device.

## 4. Credential format

| | |
|---|---|
| Generation | `crypto.randomBytes(32)`: 256 bits from the OS CSPRNG |
| Encoding | base64url, no padding: 43 characters `[A-Za-z0-9_-]` |
| Stored | `sha256(utf8(token))`, 32 bytes, `bytea NOT NULL UNIQUE`, `CHECK (octet_length = 32)` |
| Lookup | shape check (`SESSION_TOKEN_RE`), then an index equality on the hash |
| Never stored | the token itself, anywhere: no table, no idempotency record, no log field |

A fast hash is the right construction for a high-entropy random secret. Slow password hashing
protects low-entropy inputs and would cost a full KDF on every authenticated request, which
the one-read-per-request budget (ADU-CON-02 S17) does not allow. No reversible encryption is
used. There is no application-side comparison to make constant-time: the database compares
hashes, and timing can at most reveal hash prefixes, which do not help find a preimage of a
256-bit secret.

## 5. Session migration and the global sign-out

Migration `0053_session_token_hash.sql` (founder ruling B):

1. Adds `token_hash bytea NOT NULL` with a **volatile default**:
   `sha256(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()))`. `ADD COLUMN`
   evaluates it per row, so every existing row gets a distinct value that no presented token
   can match. A writer that ever omits the hash gets the same unusable row: the default fails
   closed.
2. Adds `UNIQUE (token_hash)` and `CHECK (octet_length(token_hash) = 32)`.
3. Revokes every live session (`revoked_at = now()`).
4. Deletes every `POST /v1/auth/otp/verify` idempotency record. Records written before this
   migration hold the raw session token (dead after step 3) and the raw remembered-device token
   (live for up to seven days); they go now rather than at the 24-hour purge.

Old credentials therefore fail twice over: a uuid does not have the new shape, and no row's
hash matches anything derived from its id. Rows are revoked, not deleted, because they anchor
`revoked_by_session_id`, the payout audit columns, the D5 new-device trigger's "this pair has
signed in before" test and the new-device payout lock's first-session reading.

**Operational effect at deploy: everyone signs in once more.** Console sellers, any mobile
tester and any API client. Remembered devices (`core.account_device`) are untouched, so a
remembered browser keeps R17's longer lifetime on its next sign-in. No dual path exists: the
old lookup by id is gone, not kept behind a flag.

**A dead console cookie never blocks sign-in.** Public routes (bootstrap, OTP request and
verify) refuse a presented-but-dead credential, and browser JavaScript cannot delete an
HttpOnly cookie. Without a fix, every console holding a pre-0053 cookie would have been unable
to start a new sign-in until the cookie's Max-Age ran out (up to 7 days for a remembered
browser). The guard now answers a refused cookie (`SESSION_EXPIRED` / `SESSION_REVOKED`) with a
`Set-Cookie` that expires it, so the next request starts clean. A database error never clears
it. A dead bearer gets no cookie; the app drops its own token on 401.

## 6. SEC-2 - device updates are bound to the caller

`PATCH /v1/devices/{id}` is no longer `@Public`. It requires a session, and the path id must
equal the calling session's own `device_id` **and** the device must belong to the caller's
account (`WHERE id = :id AND account_id = :account`). Every other id - another account's
device, another device of the same account, or an id that does not exist - answers the same
`404 NOT_FOUND` (founder ruling D; AUTH-02 v3.3 S39 "Device ID is not authentication").
`POST /v1/devices` (anonymous registration before sign-in) is unchanged.

## 7. SEC-3 - no credential in the idempotency store

`POST /v1/auth/otp/verify` used to store `session_token` and the raw remembered-device token in
`core.idempotency_record.response_body` for 24 hours and re-serve them on replay.

Now (founder ruling E) the record holds a non-secret completion marker only:

```json
{ "credential_withheld": true, "session_id": "<public session id>" }
```

Retry semantics:

| Case | Answer |
|---|---|
| Identical replay of a **completed** verify | `401 OTP_EXPIRED` with `X-Adulis-Idempotent-Replay: true`, no token, no cookie. The code was consumed; the client starts a fresh sign-in. The locale text already says "This code is no longer valid ... request a new one". |
| Replay of a **failed** verify | Re-executes; failures record nothing (unchanged). |
| Same key, different body | `409 IDEMPOTENCY_KEY_REUSED` (unchanged). |

The session minted by a lost response stays listed in `GET /v1/auth/sessions` until it expires
or is revoked. No token-resurrection mechanism was built: security over convenience, as ruled.
Migration 0053 deletes the verify records written under the old scheme (section 5).
`core.payout_change_log.session_id` and the `revoked_by_session_id` columns now hold public ids
only, so they stopped being credentials without any change.

## 8. SEC-4 - revocation policy

| Action | MOBILE | CONSOLE |
|---|---|---|
| `POST /v1/auth/logout` (new): revoke the calling session | yes, no step-up | yes, no step-up; clears the session cookie |
| `DELETE /v1/auth/sessions/{own id}` | yes, no step-up | yes, no step-up |
| `DELETE /v1/auth/sessions/{another own session}` | `403 PERMISSION_DENIED`, with or without a challenge | needs a satisfied `REVOKE_ALL_SESSIONS` step-up in the body; consumed, one use; a challenge that names a target must name this session |
| `POST /v1/auth/sessions/revoke-others` | `403` (unchanged) | step-up `REVOKE_ALL_SESSIONS`, unbound (a proof bound to one session is refused) |
| Any id not on the caller's account | `404` | `404` |

Revoking one other session is a subset of revoking all of them, so the existing
`REVOKE_ALL_SESSIONS` proof authorises it; because the proof is single-use, a loop of deletes
costs one SMS step-up per session and is never a cheaper revoke-all. No new step-up action was
added: AUTH-02 v3.3 S46 allows new actions only through a versioned security change. The
console's Sessions screen now routes its per-row "end session" through its existing step-up
guard, bound to that session's id. The console's sign-out now calls `POST /v1/auth/logout`, which
also clears the cookie (it used `DELETE` on its own id, which left a dead cookie behind). Ids
are compared case-insensitively, so an upper-case own id is still a self sign-out.

## 9. OpenAPI schemas added

Ten operations now carry request and response schemas, a problem response and their real
headers (`Idempotency-Key`, `X-Adulis-Device`, `X-Adulis-Client`) where the handler reads them:

| Operation | Request | Success | Errors |
|---|---|---|---|
| `GET /v1/bootstrap` | - | `BootstrapResponseDto` (+ `account_context`) | - (pre-existing) |
| `POST /v1/auth/otp/request` | `OtpRequestBodyDto` | 202 `EmptyResponseDto` | `ProblemDto` |
| `POST /v1/auth/otp/resend` | `OtpRequestBodyDto` | 202 `EmptyResponseDto` | `ProblemDto` |
| `POST /v1/auth/otp/verify` | `OtpVerifyBodyDto` | 200 `OtpVerifyResponseDto` | `ProblemDto` |
| `POST /v1/auth/logout` | - | 204 | `ProblemDto` |
| `GET /v1/auth/sessions` | - | `SessionListResponseDto` | `ProblemDto` |
| `DELETE /v1/auth/sessions/{id}` | `RevokeSessionBodyDto` (optional) | 204 | `ProblemDto` |
| `POST /v1/auth/sessions/revoke-others` | `RevokeOthersBodyDto` | `RevokeOthersResponseDto` | `ProblemDto` |
| `POST /v1/devices` | `DeviceRegisterBodyDto` | 201 `DeviceRefDto` | `ProblemDto` |
| `PATCH /v1/devices/{id}` | `DevicePatchBodyDto` | `DeviceRefDto` | `ProblemDto` |

Errors are declared as `application/problem+json`, the media type `ProblemDetailsFilter`
actually sends. `ProblemDto.code` is the error catalogue's closed set, generated from `ERROR_CATALOGUE`, so a
client switches on a typed union. The security schemes now say what the credential is: `bearer`
with `bearerFormat: opaque` (it said `JWT`, register API-2) and a `cookie` scheme for
`__Host-adulis_session`; the authenticated operations above declare both. Validation stays in
zod (`auth.schemas.ts`); the DTO classes describe the wire shape, as `bootstrap.dto.ts` already
did. Contract totals: 136 operations (logout is new), 13 with any schema (was 4), 18 component
schemas (was 2).

## 10. `account_context`

`GET /v1/bootstrap` gains a server-derived projection (founder ruling F; R-18, R-21; MOB-02
v4.3 S84 "relationship summaries needed to expose Seller/Courier mode entry points"):

```json
"account_context": {
  "buyer":            { "available": true },
  "seller_companion": { "available": true },
  "courier":          { "available": false }
}
```

It is `null` for an anonymous request and for a CONSOLE session: mode availability is a
Mobile concept. It is computed on every bootstrap from canonical tables inside a
request-context transaction, and an authenticated bootstrap answers
`Cache-Control: private, no-store` so no edge or shared cache stores it; nothing the client sends (query, `X-Adulis-Seller`, body) is read.
Availability is not authorisation: every request is still checked on its own.

Buyer is inherent to an active ordinary Account (R-23). The guard has already proved the
session live and the Account ACTIVE. No Buyer role is invented and `core.buyer_profile` is not
consulted (nothing in the system writes it).

## 11. Seller Companion derivation

`seller_companion.available` is true when, and only when, the Account

1. owns a Seller whose status is not `DELETED`, or holds a team membership that is neither
   suspended nor revoked on a non-deleted Seller - exactly the D-97 relationship
   `GET /v1/seller/list` already returns; **and**
2. that relationship's role (OWNER for an owner) holds at least one permission whose
   `surfaces` include `MOBILE` - the same `core.role_permission` / `core.permission` rows
   `fn_has_permission` reads.

This is the minimum fact the current system can state with certainty. It does not attempt the
68-code permission reconciliation (register SC-2), and it does not say which Companion actions
are usable; each action is still decided by `fn_has_permission` per request. In today's
42-code seed every role holds at least four MOBILE permissions, so in practice condition 2
holds for every live relationship. `GET /v1/seller/list` names the Sellers.

## 12. Courier fail-closed

`courier.available` is always `false` in this work order. A live `seller_courier` relationship
is still detectable internally (`rolesOf`, the D5 trigger), but it does not make Courier mode
available, because the Courier MOBILE authorisation mechanism is undecided (register ID-3,
ID-4; R-20). Courier routes, audiences, permission codes and the console Courier screen are
untouched. WO-API-001B flips this field once it defines the authorisation (section 18).

## 13. API-client generation

- `pnpm generate:openapi` then `pnpm generate:api-client`: `contracts/openapi.json` and
  `packages/api-client/src/schema.d.ts` regenerated by the tools, never by hand.
- A second regeneration is byte-identical (deterministic).
- `@adulis/api-client generate:check` passes; `paths`, `components` and `operations` remain
  exported (WO-001C type test still passes).
- New `packages/api-client/test/auth.test-d.ts` pins the contract at compile time: typed
  verify body/response with a required `Idempotency-Key`, the optional MOBILE `token`, no
  `token`/`token_hash`/`device_id` field on `SessionDto`, logout's 204, the revoke bodies, the
  device-patch body, `account_context` nullable with exactly three modes, and `ProblemDto.code`.
  Mutation-checked: weakening the no-secret assertion fails `tsc`.
- The Mobile foundation needed no change: it already stores the token opaquely in SecureStore,
  has no hand-written DTO, and release builds stay Buyer-only (it does not read
  `account_context` yet; wiring it is a later Mobile work order).

## 14. Database migrations

One: `db/migrations/0053_session_token_hash.sql` (section 5). Append-only, no down block, like
0050-0052. No other schema change.

## 15. Tests

All runs against the repository's Docker PostgreSQL 17 (`adulis-postgres`, host port 5434;
a local PostgreSQL 18 service holds 5432). Destructive gates ran against a disposable database
(`adulis_gates`), never the local development database.

| Check | Result |
|---|---|
| New `test/wo-api-001a-auth-security.e2e.spec.ts` | **27/27**: SEC-1 (5), SEC-2 (3), SEC-3 (2), SEC-4 (5), account_context (10), migration 0053 (2) |
| Full `@adulis/api` suite, final tree | **661/662**; the one failure is pre-existing (below) |
| Mutation: authenticate by id again | 2 SEC-1 tests fail, as they must |
| Mutation: weaken the no-secret type assertion | `tsc` fails, as it must |
| `@adulis/api-client` test, `generate:check`, second regeneration byte-identical, `verify:contract` | pass |
| Workspace tests outside the API | pass: api-client, locale, mobile 26/26 (config, tokens, console echo only) |
| Gates (29), fresh disposable database | **28 green**; `test` red only on the pre-existing failure |

Gate detail: typecheck, lint, deps, deps-fires, contract-prefix, error-locale, build,
extensions, migrate (0053 on a fresh database), worker-schema, determinism, permission-doc,
docs-ascii, appendix-c, deferred-values, trust-before-open-signup, no-unsafe-eval,
production-react, mt-keys, appendix, orphan-sweep, console-e2e, transcription, surface-markers,
tokens and render-yaml green; contract-current green once the regenerated contract was
committed; boot-smoke green from PowerShell (from the Bash sandbox its headless browser makes no
request at all, which the gate itself names as a sandbox symptom).

**Pre-existing failure, proven at baseline.** `c1-onboarding` "GET lists ascending from today"
seeds an availability override for 2026-09-11 (written 2026-09-07) and expects it in a list that
starts today; today is 2026-11-09. Run at `a0fb7d8` in a separate worktree against a scratch
copy of the database with 0053 removed: `1 failed, 36 passed`, the same assertion. Not touched.

**Console regression** (`console-e2e`, 88 passed, real API, real browser): sign-in through the
suite helper; the beta walk signs up a brand-new phone by OTP, creates a store, sets payout
details, then **signs out through `POST /v1/auth/logout`** and reaches sign-in and the Courier
entry point (`[OK] step 14`); SC-27 Sessions lists sessions, marks the current one and forgets a
remembered device without signing out. API tests add: CONSOLE verify sets the `__Host-` cookie
pair and never a body token (no secret reaches browser JavaScript); remembered device selects
the 7-day lifetime; revoke-one and revoke-others demand step-up; a refused cookie is cleared.

**Mobile regression**: typecheck clean, 26/26 tests, SecureStore storage unchanged, no
hand-written DTO, release builds Buyer-only (`navigation.test.tsx`); `account_context` is not
wired yet, by design.

**Migration tests**: 0053 applied on a fresh database by the `migrate` gate and checked by
`determinism`; the spec replays the 0053 file against a temporary copy of the pre-0053 table
holding legacy rows and asserts every legacy session is revoked, every hash is distinct, 32
bytes and unmatchable from its id, and the old verify idempotency rows are gone.

## 16. Security review

Two independent reviews ran on the final diff: a security review against the work order's
checklist (credential persistence, logs, idempotency, serialization, enumeration, audience
boundaries, replay, fixation, device ownership) and a code/rules review (PR Review Toolkit
code-reviewer). **Neither found a critical or high issue.** Every finding was handled:

| Finding | Severity | Outcome |
|---|---|---|
| A dead console cookie blocks bootstrap and sign-in on public routes; after the global sign-out that is every console for up to 7 days | Medium (pre-existing mechanism, made universal by the sign-out) | **Fixed**: the guard clears a refused session cookie; console sign-out moved to `POST /v1/auth/logout`, which clears it too. Tested. |
| revoke-others accepted a step-up bound to one session | Low (introduced) | **Fixed**: refused with `STEP_UP_REQUIRED`. Tested. |
| Pre-0053 verify idempotency rows still held a live remembered-device secret until the 24 h purge | Low | **Fixed**: 0053 deletes them. Tested by replaying the migration file. |
| Upper-case own session or device id treated as "another" (failed closed) | Info | **Fixed**: compared case-insensitively. Tested. |
| A signed-out or revoked device keeps its push token, so account pushes could still reach it; the app can no longer clear it after sign-out | Low (no push provider is bound today: register WRK-12) | **Recorded, not fixed** (section 17): R-11 says "Sign Out changes session state only", so whether sign-out touches the device is a founder call. |
| Two migrated tests stopped testing what they claim (garbage-token shape check; deletion ticket as bearer) because the fixture helper re-shaped their raw values | Important | **Fixed**: both now send the raw value. |
| `packages/api-client/test/auth.test-d.ts` is a packages change | Rule | **Own commit** (section 15), for its own PR. |
| Error responses declared `application/json`; the filter sends `application/problem+json` | Low | **Fixed** in the decorators and the type test. |
| A console comment justified "forget device" by comparing it to single sign-out, which now needs step-up | Low | **Fixed**. |
| Comment placement in `cookies.ts`; generated Kysely types lack `token_hash` | Info | Comment moved. Kysely types: see section 17. |

Checked by the reviewers with no issue: no plaintext credential in any table, log field, error
body or response other than the one MOBILE verify body; the error filter logs only SQLSTATE and
constraint; one authentication path; carrier/audience matching unchanged; step-up target check
runs before consumption and consumption rolls back with the request; server-minted tokens (no
fixation); concurrent verifies race on the OTP consume; `account_context` reads no client input.

## 17. Remaining gaps

- **API-1 remainder.** 123 of 136 operations are still schema-less, including step-up
  request/verify, remembered-devices DELETE and recovery, and every commerce, Companion and
  Courier operation. WO-002 may use only the typed operations listed in section 9.
- **API-2 remainder.** Security schemes and headers are declared on the touched operations
  only; the rest of the contract still declares none.
- **Push tokens on signed-out devices** (security review, Low). Notification routing
  (`jobs/e2-notification.ts`) pushes to every device row bound to the account with a token and
  GRANTED permission, whether or not that device holds a live session. Options: null the token on
  logout/revocation, or route only to devices with a live session. R-11 ("Sign Out changes
  session state only") makes this a founder decision. No live impact while `NullPushAdapter` is
  bound (WRK-12); it must be settled before a push provider is.
- **Step-up SMS wording.** Revoking one other session reuses the `REVOKE_ALL_SESSIONS` action,
  so its SMS uses the "revoke all sessions" template. A dedicated action needs a versioned
  security change (AUTH-02 v3.3 S46) and a `packages/locale` PR.
- **A lost verify response leaves one live session** (30 days for MOBILE) that the user can see
  and revoke. Accepted by ruling E.
- **Read-only roles can read `token_hash`.** `adulis_readonly` and `adulis_jobs` have table-level
  SELECT on `core.session`. Hashes of 256-bit secrets are not usable credentials; column-level
  revocation would need the table grants rewritten and is not done.
- **Generated Kysely types are stale** (pre-existing). `database.types.generated.ts` was last
  regenerated on 2026-08-29 and lags about twenty migrations; no gate keeps it current. Not
  regenerated here, to avoid unrelated drift; the auth code uses raw SQL and does not need it.
- **Pre-existing test failure.** `c1-onboarding` "GET lists ascending from today" asserts an
  override on 2026-09-11, a date now in the past. It fails identically at the WO-001C baseline
  (`a0fb7d8`); not touched.
- **Deploy note.** 0053 signs everyone out once; sellers must be told to expect it.
- **Mobile** does not read `account_context` yet and still offers Buyer only in release builds;
  wiring mode availability is a later Mobile work order.

## 18. WO-API-001B handoff

WO-API-001B (Courier on MOBILE) starts from here:

1. **Decide the gating mechanism** (register ID-4, founder decision): a database authorisation
   function over `core.seller_courier`, or Courier permission codes in the catalogue. Nothing may
   grant Courier authority to every MOBILE user.
2. **Move Courier routes to MOBILE** with that check (register ID-3, R-20): they carry only
   `@ActorRole('COURIER')` today and check no audience. Decide whether the console Courier screen
   (`apps/console/src/courier`) retires or both audiences run during a transition; update
   `c5-handoff.e2e.spec.ts`.
3. **Flip `account_context.courier`** in `BootstrapController.accountContext` from the hard-coded
   `false` to the derivation step 1 defines. The relationship is already detectable
   (`AuthService.rolesOf`, the D5 trigger, `core.seller_courier` `revoked_at IS NULL`).
4. **Publish the Courier schemas** the same way as section 9 (DTO classes, `PROBLEM_RESPONSE`,
   bearer security), and extend `packages/api-client/test/auth.test-d.ts` or a sibling test.
5. **Not in 001B:** the Courier profile, verification, availability, offer/acceptance and
   one-active-delivery model (register SC-, ID- gaps, R-15) need their own design work order.

The sessions, logout and revocation contract from this work order applies to Courier unchanged:
one ordinary MOBILE session, mode switching changes context, not identity (R-18).
