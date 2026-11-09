# WO-003A - Authentication hardening and contract cleanup

Status: complete, pushed, awaiting founder review. Branch `mobile/wo-003a-auth-hardening`. No
pull request, no merge, `main` untouched. No backend, migration, OpenAPI, payment, background
job, discovery, Scene, Seller Companion or Courier change. Authentication is not redesigned.

## 1. Baseline

`mobile/wo-003-buyer-auth` at `320860ce7301d454508b6295aa39764e80cc440b`, verified equal to
`origin` with a clean tree before branching. Scope, from the founder's review of WO-003:

1. cold or external links must not turn `/auth/verify` into an SMS resend surface;
2. device registration must use a UUIDv7 idempotency key, not the device id;
3. the WO-003 record wrongly said the bearer is kept in the verify idempotency record.

## 2. The Verify link problem

WO-003 accepted any valid E.164 `phone` in `/auth/verify?phone=...`. A link opened from outside
the app (cold or warm) showed the code form for that number without this app ever requesting a
code, and **Send a new code** then asked the server to text it. Server rate limits bounded the
abuse, but the flow was not the intended one: the phone in a route is untrusted input
(ADU-MOB-02 v4.3 S54) and proves nothing.

## 3. The pending code flow (memory only)

`src/auth/session.tsx` holds one more piece of React state in the existing `SessionProvider`:
`otpPhone`, the phone this app run successfully asked a code for. That is the whole flow state;
nothing else was needed.

| Event | Effect |
|---|---|
| Send code answered 202 (`sign-in.tsx`) | `otpPhone = phone`, then Verify opens |
| Send a new code answered 202 | unchanged: Verify stays usable |
| Verify loses navigator focus (Back, Change number, a tab or notification link, a dismissal, anything opened on top, its own redirect) | `otpPhone = null` |
| Sign-in succeeds (`signIn`, after the credential is stored) | `otpPhone = null` |
| App process or React root starts | `otpPhone = null` (initial state) |

The clear on leaving is a `blur` listener in `verify.tsx`, not an unmount cleanup, so a
StrictMode remount does not end the flow. The app going to the background is not a navigator
blur, so switching to the SMS app keeps it. The router can emit `blur` after the screen's effect
cleanup, so the unsubscribe is deferred by a microtask (the pattern the router documents for its
`removed` event, which it does not emit for every action that removes a route).

- `verify.tsx` renders only when `otpPhone === phone`; anything else returns
  `<Redirect href={{ pathname: '/auth/sign-in', params: { returnTo } }} />` before the form or
  any button exists. The check replaces WO-003's E.164 check: `otpPhone` is only ever set to a
  validated phone, so a malformed one also fails it.
- While the credential is being stored (`completing`), the form stays mounted, so the success
  path is not interrupted by its own clearing.
- `returnTo` stays a route parameter, validated by `parseReturnTo` on both screens (allowlist,
  anything else becomes `/account`); it is not part of the stored state.
- The marker is never written to SecureStore, AsyncStorage, SQLite, the query cache or the
  backend, and it never holds the code. It is the phone the Buyer typed on this device, in
  memory, for the length of one sign-in attempt.
- Sign-out does not touch it: a signed-in session cannot have an open code flow, because
  `signIn` already cleared it.
- A link for the **same** phone while that flow is open in this run is accepted: this run did
  request that code. Any other phone, or no open flow, opens Sign in.

## 4. Cold and external links

`adulis://auth/verify?phone=...&returnTo=...` from a cold start, or while the app runs with no
matching flow, lands on Sign in with `returnTo` kept when it is on the allowlist. No OTP is sent
automatically, the Verify form is never shown, **Send a new code** is never reachable, and the
phone parameter is not used for anything. The Buyer can start a normal sign-in from there and
still arrives where the link pointed.

## 5. Device registration key

WO-003 sent the persistent install id (UUIDv4) as the `Idempotency-Key` of `POST /v1/devices`.
It worked, but client keys are UUIDv7 by contract (ADU-API-01 S8), and an identity is not a
retry key. Now:

- the install id (`adulis.device.id`) is unchanged: same generator, same storage, same meaning,
  no migration of existing ids;
- registration has its own key, a UUIDv7 from the existing `newIdempotencyKey()` in
  `src/api/client.ts` (no second generator), stored separately as
  `adulis.device.registration_key` (`src/device/device-storage.ts`).

## 6. UUIDv7 key lifecycle

`ensureDeviceRegistered` in `src/auth/session.tsx`, using `loadRegistrationKey` and
`endRegistrationIntent` from `device-storage.ts`. Only one registration runs at a time: a second
caller (a Send code refetch while the startup attempt is still in flight) joins the attempt in
flight instead of racing it under the same key.

1. Already registered (`adulis.device.registered` equals the install id): nothing is sent.
2. Otherwise read the stored key; if there is none, create a UUIDv7 and **save it before the
   first attempt**.
3. `POST /v1/devices` with that key.
4. Offline or timeout (outcome unknown): the key stays. The bootstrap query's retries, the
   next Send code, and the next launch all reuse it, so the server replays rather than repeats.
5. Success: write `adulis.device.registered = <id>`, then delete the key. The intent is
   complete.
6. A server answer that is a refusal (any problem or unexpected answer): delete the key, so the
   next attempt is a new intent with a new key. This is the rule WO-003 already applies to every
   other key; reusing it would replay a stored refusal such as a 429 for the life of the key.
   The work order's reuse cases (network failure, restart, uncertain response) are all kept.
7. A later registration (the registered record lost, or a new install id) finds no key and makes
   a new UUIDv7.

Failure handling: a key that cannot be read is used for this attempt only and not written, so a
transient keystore failure never overwrites a pending key (the same rule as the install id). A
failed write or delete is logged by its message. If the app dies between the two writes of step
5, a stale key is left; it is used only if registration is ever needed again, and then the same key
with the same body replays the stored success.

Server behaviour relied on, checked live (section 9): the service registers idempotently by id,
so a later intent's new key for an already registered id answers 201 and keeps the one row.

## 7. SEC-3 still closed (verified, no backend change)

`git diff 320860c -- apps/api db contracts` is empty. Checked against the local API and database
after a real native sign-in (Account created with the age declaration, `+251911000401`):

| Check | Result |
|---|---|
| The verify idempotency record of that sign-in | `{"session_id": "35fdfb4d-...", "credential_withheld": true}` |
| All 47 stored verify records | 0 with a `token`, `session_token`, `remembered_device_token`, `remembered_device` or `credential` field; 0 containing a 43-character credential-shaped string |
| Replay: the app's exact body under its own key | `401 OTP_EXPIRED`, `X-Adulis-Idempotent-Replay: true`, no token, no `Set-Cookie` |
| The public session id sent as a bearer | `401` (it is not authentication material; the credential exists only as `core.session.token_hash`) |
| That session after Sign out | revoked |

The remembered-device secret is a console feature; MOBILE never receives one, and no record
holds one. The false statement is corrected in place in the WO-003 record (section 22), and its
header lists all three WO-003A corrections.

## 8. Tests

`pnpm --filter @adulis/mobile test`: 9 suites, 101 tests (81 before). New and changed tests are in
`src/auth/auth-flow.test.tsx`, plus one in `src/auth/session.test.tsx` (concurrent registration
callers send one request) and a new `src/device/device-storage.test.ts` (5 tests: a pending key is
reused, a new key is saved before use, an unreadable store gives a one-attempt key without
overwriting, a failed save or delete is logged and does not throw).

Verify route (work order section 16):

| # | Requirement | Test |
|---|---|---|
| 1 | request, then Verify works | `requests a code ...`, `signs in ...` (unchanged) |
| 2, 3 | cold Verify link opens Sign in; no resend, no SMS | `a cold link to Verify opens Sign in instead ...` |
| 4 | another phone than the open flow | `a link for another number than the code was asked for ...` |
| 5 | resend keeps Verify valid | `a successful resend keeps Verify usable` |
| 6 | Change number and Back clear the flow | `Change number ends the code flow ...`, `Back ends the code flow too`, and `leaving Verify without Sign in (a tab link / dismissing the stack) ends the code flow too` |
| 7 | sign-in clears the flow | `a finished sign-in ends the code flow` |
| 8 | a relaunch does not restore it | `the code flow is memory only ...` (nothing stored names the phone) with the cold-link test (a fresh run); natively by Maestro |
| 9 | `returnTo` stays safe | cold-link test (`/saved` kept, sign-in lands on Saved); `an unsafe returnTo on a cold Verify link becomes You` |

Device registration (work order section 17):

| # | Requirement | Test |
|---|---|---|
| 1 | device id stable | `on a later launch keeps the same device id ...`; the relaunch and later-registration tests send the same id |
| 2, 3 | key is UUIDv7 and not the device id | `registers the install ...`, `saves the key before the first attempt ...` |
| 4 | lost answer retried under the same key | `saves the key before the first attempt and retries a lost answer under it` (the key is already stored when the first request leaves) |
| 5 | relaunch before confirmation reuses it | `a relaunch before confirmation reuses the saved key, then completes the intent` |
| 6 | success completes the intent | the first-launch and relaunch tests: key removed, registered = id |
| 7 | a later registration gets a new UUIDv7 | `a later registration (its record lost) is a new intent with a new key ...` |
| 8 | OTP requests use their own keys | `a refused registration ends the intent: the next attempt has a new key, and OTP keys are their own` |

The tests were checked against mutations, each reverted after the run. With the Verify guard
disabled, every negative Verify test fails (only the positive cases pass). Without `signIn`
clearing the flow, the sign-in test fails. Without the `blur` clear, the Change number, Back,
tab-link and dismissal tests fail. Without the single-flight guard, the concurrent-registration
test fails.

Harness limit: Expo Router's `renderRouter` does not support a second render in one test (the
second tree comes up without its top screen). Relaunch tests therefore start from the stored
state a previous run leaves behind, which the preceding test shows being written; the true
cold relaunch is covered on the device.

## 9. Maestro and native validation

Android emulator (Pixel 8a, API 37), the WO-003 debug build (no native change), Metro with
`EXPO_PUBLIC_API_BASE_URL=http://localhost:3000`, the local API in development mode.

| Flow / check | Result |
|---|---|
| `.maestro/buyer-auth-verify-link.yaml` (new; `DIGITS=251911000499`): Verify link while running, then from a cold start | pass: Sign in both times, no code field, no Send a new code |
| No SMS for that link phone | `.dev-sms.log` gained 0 lines; 0 `core.otp_challenge` rows for `+251911000499` |
| `.maestro/buyer-auth-request.yaml` (`+251911000401`) | pass; the dev log recorded that code (so the log works) |
| `.maestro/buyer-auth-verify.yaml` | pass: wrong code refused, age declaration (new Account), signed in on Saved, You has Sign out and no Seller Companion or Courier, cold relaunch restored, Sign out returned to guest |
| `.maestro/buyer-shell.yaml` (WO-002 regression) | pass |
| Registration record written by the fresh install | key `01a1c1ce-e159-76bc-a0d1-ae17aaa3bf64` (version 7, timestamp 2026-11-09T19:35:23.225Z) for device `6e847b4a-...`; the WO-003 record from earlier that day shows key = device id |
| A new UUIDv7 key for that already registered id (curl) | `201`, one row, market kept |

After the review fixes (section 10), Metro restarted with a cleared cache and every flow ran
again on the new bundle:

| Flow | Result |
|---|---|
| `buyer-auth-verify-link.yaml` (`DIGITS=251911000498`) | pass; 0 SMS lines for that phone |
| `buyer-auth-request.yaml` (`+251911000402`), then `.maestro/buyer-auth-leave-verify.yaml` (new): a link to Saved leaves Verify, then a Verify link for the same phone | pass: Sign in, no code field, no Send a new code; the SMS log still holds only the one request line for that phone |
| `buyer-auth-request.yaml` (`+251911000403`), then `buyer-auth-verify.yaml` | pass: sign-in (new Account, age declaration), restore, sign out |
| `buyer-shell.yaml` | pass |

Not run natively: Change number or hardware Back followed by a link (unit tests only), iOS.

## 10. Security review

Two independent read-only reviews of the diff: a security review against the work order's list
(SMS abuse via links, arbitrary phones reaching resend, route-param trust, code and token
leakage, idempotency-key reuse, device identity versus idempotency) and a correctness review.
Neither found anything critical or high, and none remains open.

| Finding | Severity | Done |
|---|---|---|
| The marker was cleared only when Sign in regained focus; leaving Verify another way (a tab or notification link, a dismissal, or Back after Verify opened over the tabs because Back was pressed during Send code) left it set, so a later link for that same phone showed the form and could resend (reproduced by the reviewer) | medium | the `blur` clear in Verify replaces the Sign in focus clear; two failing tests first, then fixed; native flow `buyer-auth-leave-verify.yaml` |
| Two registrations could run at once under the same key (a Send code refetch during a slow startup attempt), and a refusal of one ended the other's intent | low | single-flight in `ensureDeviceRegistered`; test |
| The keystore failure branches of the registration key were untested | low | `src/device/device-storage.test.ts` |
| "Saves the key before the first attempt" did not prove the key was saved before the request left | low | the handler now records the stored key at send time |
| Comments: "until the server confirms" (also cleared on a refusal); the link flow claimed to check `returnTo` | low | reworded |
| Change number and Back tests use the same navigation path | low | kept: they prove the clear does not depend on the Change number button |

Recorded, not changed (info):

- Codes and the bearer: nothing leaks. The code lives only in component state and the intent
  ref; warnings log only `error.message`; registration, request, resend and verify send no
  bearer; resend carries no Idempotency-Key, as the contract declares.
- Phone encoding fails safe: a `+` decoded as a space, an array or an empty value never matches
  the marker. The phone shown and sent is the marker's value, so link text never reaches the
  screen.
- A rejected link pushed while a code flow is open ends that flow (the Buyer requests again).
  It cannot send an SMS.
- The saved registration key is not bound to the device id. If the id ever changed with a key
  pending, the same key would carry a different body; the server's answer ends that intent and
  the next attempt is new. Binding them would remove even that one refused request.
- A non-JSON 502 or 504 from a gateway counts as a server answer, so the key is dropped although
  the outcome is unknown. Harmless for registration, which the server dedupes by id; unchanged
  WO-003 behaviour for the other keys.
- UX: a rejected link lands on Sign in by replacing Verify; if a Sign in screen was already
  below, the Buyer presses Back once more. Nothing breaks.

## 11. Contract debt (unchanged, not blocking)

- **CG-WO3-1** `GET /v1/bootstrap` declares neither `X-Adulis-Client` / `X-Adulis-Device` nor
  its 401 response.
- **CG-WO3-2** `POST /v1/devices` does not declare `X-Adulis-Device`.

## 12. Unchanged by decision, still open

Offline sign-out leaves the server session valid until expiry; a server-ended session returns
to guest silently; no push provider is connected; Amharic is development-only; Seller
Companion and Courier stay hidden in release. The other WO-003 section 22 items are unchanged.

## 13. Commits

| Commit | Content |
|---|---|
| `d53dcb6` fix(mobile): separate device identity from registration retry key | API client, device storage, session registration (single-flight), `device-storage.test.ts`, the concurrent-registration test |
| `5ca9a71` fix(mobile): require an initiated otp flow before verification | session `otpPhone`, Sign in, Verify, `apps/mobile/CLAUDE.md` |
| `373a74b` test(mobile): cover auth hardening regressions | `auth-flow.test.tsx`, the two new Maestro flows |
| docs(mobile): correct the WO-003 auth record and record WO-003A | this record and the marked corrections in `WO-003-BUYER-AUTH.md` |

The full suite and every gate ran on the final tree. `d53dcb6` alone does not pass
`auth-flow.test.tsx`: its first-launch test still expects the WO-003 key until `373a74b`.

## 14. Next recommended work order

Scene and discovery domain foundation on the signed-in Buyer shell.
