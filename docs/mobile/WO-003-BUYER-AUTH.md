# WO-003 - Mobile bootstrap, authentication and Buyer sign-in

Status: complete, pushed, awaiting founder review. Branch `mobile/wo-003-buyer-auth`. No pull
request, no merge, `main` untouched. No backend, migration, OpenAPI, payment, discovery,
Seller Companion or Courier change. The next work order is not started.

Corrected by WO-003A (`docs/mobile/WO-003A-AUTH-HARDENING.md`): the device registration key
(section 5), Verify links (section 22) and a false statement about the verify idempotency
record (section 22). Each correction is marked in place; nothing else is rewritten.

## 1. Baseline

`mobile/wo-002-buyer-shell` at `6f6e48173e79d8bf55a6865ba1e602e7b481ac62`, verified against
`origin` before branching.

## 2. Branch and commits

`mobile/wo-003-buyer-auth`. The commit table is in section 24.

## 3. Routes added

| Route | File | Purpose |
|---|---|---|
| `/auth/sign-in` | `src/app/(buyer)/auth/sign-in.tsx` | phone entry, requests the code |
| `/auth/verify` | `src/app/(buyer)/auth/verify.tsx` | code entry, resend, change number, age declaration when asked |

Both sit inside the `(buyer)` Stack, over the tabs, with a native header and Back. They are
opened only by the Buyer tapping **Sign in** on Saved, Orders, You or Notifications
(`src/buyer/SignInRequired.tsx`); nothing opens them automatically and opening a protected tab
sends nothing. Each entry passes `returnTo`, checked against an allowlist
(`src/auth/sign-in-flow.ts`: `/home/for-you`, `/saved`, `/orders`, `/account`,
`/notifications`; anything else becomes `/account`), so a deep link cannot send a newly
signed-in Buyer somewhere arbitrary. After sign-in the app returns to that tab with
`router.dismissTo`, so Back does not return to the code screen. A signed-in Buyer who opens
either route is redirected to `returnTo`; `/auth/verify` without a valid phone redirects to
`/auth/sign-in`.

## 4. API boundary

`src/api/client.ts` is the one HTTP boundary. Request and response types come from
`@adulis/api-client` (`paths`, `components`); no DTO is hand-written and no contract type is
cast away. openapi-fetch is not in the repository and was not added: the package README
prescribes the types, and six calls do not justify a dependency.

Every request carries `Accept: application/json`, `X-Adulis-Client: android/<version>` (or
`ios/...`; ADU-API-01 v1.11 header table, version from the app config) and
`X-Adulis-Device: <install id>`; `Authorization: Bearer` only when a session exists (or an
explicit credential for logout); `Idempotency-Key` where the contract takes one. Every request
has a 10 s timeout. A failure is an `ApiError` of one of four kinds: `offline` (the request
never got an answer), `timeout`, `problem` (an `application/problem+json` answer, any status)
or `unexpected` (an answer that is not a problem document, including a success status whose
body is not JSON). Its message names only the kind, status and code, never a credential,
phone or code.

Idempotency keys are client-generated UUIDv7s (ADU-API-01 S8): epoch milliseconds in the
first 48 bits, the rest from the platform's secure random source. A key belongs to the
Buyer's intent: a double tap or a retry after `offline`/`timeout` (outcome unknown) reuses it;
once the server has answered (any problem or unexpected answer) the next attempt gets a new
key, so a stored refusal such as a 429 is never replayed for the life of the key.

Problems render from the catalogue key the server sends (`title_key`, for example
`error.request.rate_limited`) with its slots (`src/api/messages.ts`). A key the mobile catalogue
lacks, or a slot the template needs and the problem lacks, renders the generic
`error.request.internal` rather than a raw key or a gap. Server English is never shown.

In a release build the origin must be `https://` (`src/api/config.ts`); the check runs before
the request, so a misconfigured release fails as an error, not as "offline", and no bearer
leaves over plain HTTP.

## 5. Device registration

`src/device/device-storage.ts`. On first launch the app creates a UUID v4 install id
(`uuid.v4()` from `expo`, backed by the platform secure random source) and stores it in
SecureStore (`adulis.device.id`). It is read, not regenerated, on every later launch. If
SecureStore cannot be read, an id is used for this run only and not written, so a transient
storage failure never replaces the persisted id. A read or write failure is logged by its
message. The id is created once per app run and held for the run.

Before the first bootstrap, and again before requesting a code, the app ensures the install is
registered: `POST /v1/devices` with `{ id, platform: ANDROID | IOS }`, no bearer, and the install
id as the `Idempotency-Key` (a v4, not a v7: the key must survive restarts, and the
registration is idempotent by id anyway), so a retry or a second launch replays rather than
creates. Success
is recorded as `adulis.device.registered = <id>`; registration runs again only if that record
is missing or names another id. Native check: one `core.device` row per install, platform
`ANDROID`, market stamped, linked to the Account after sign-in, unchanged across relaunch.

**WO-003A correction:** the install id is no longer the `Idempotency-Key`. Client keys are
UUIDv7 (ADU-API-01 S8), so registration now has its own persistent UUIDv7 intent key
(`adulis.device.registration_key`), kept until the server confirms and then removed. The
install id itself is unchanged. See WO-003A section 5.

## 6. Bootstrap

`src/api/bootstrap.ts`. `GET /v1/bootstrap` runs through TanStack Query under the key
`['bootstrap', 'guest' | 'account']`, so signing in or out fetches a fresh one (authenticated
bootstrap returns `account_context`). Stale time 5 minutes; transient failures (offline,
timeout) retry up to twice; a server answer is never retried. The app reads only what the contract defines: `server_time`, `market`,
`min_supported_client`, `client_status`, `environment`, `locales`, `feature_flags`,
`media_public_origin` and `account_context`. Nothing is inferred beyond those fields, and
`server_time` is not yet used by any screen.

Startup (`src/app/_layout.tsx`) waits for the stored-credential restore and the first
bootstrap attempt only. Each request is bounded by the 10 s timeout; on a first launch the
registration and the bootstrap run one after the other, so a hanging network can hold the
loading screen for up to about 20 s once. A retry, an offline start or a failure
never holds the app: offline, the shell opens with the stored session. After startup a later
bootstrap never unmounts the navigator, so signing in or out never loses the Buyer's place.

## 7. Version gate

- `UPGRADE_REQUIRED`: the whole navigator is replaced by `src/components/UpgradeRequired.tsx`
  (title, body, **Check again** that refetches bootstrap). Nothing renders behind it, no route
  is reachable, and no store link is offered: no store listing exists to link to, and none is
  invented.
- `UPGRADE_RECOMMENDED`: a dismissible notice on Home (`src/buyer/HomeHeader.tsx`), never
  blocking; dismissal lasts for the app run (`upgradeNoticeDismissed` in the UI store).
- `OK`: nothing shown.

## 8. Sign-in flow

1. The Buyer taps **Sign in** on a protected tab.
2. Phone entry: phone keyboard, `autoComplete="tel"`, label, hint with the example format.
   Spaces, dashes, brackets and dots are removed; the result must be E.164
   (`+` then 8-15 digits, no leading 0). Anything else is refused inline with
   `auth.phone.invalid` and no request is sent. No country code is guessed or added: the
   contract defines no normalisation, so none is invented. No password, email or social
   sign-in exists.
3. **Send code**: if no bootstrap has succeeded in this run, bootstrap first (the query
   registers the install before it; the server refuses an OTP for a device it has not yet
   placed in a market), then `POST /v1/auth/otp/request`
   `{ phone, purpose: SIGN_IN, audience: MOBILE }` with an Idempotency-Key.
4. Code entry (`/auth/verify`): number keyboard, `autoComplete="sms-otp"`,
   `textContentType="oneTimeCode"`, six digits, inline validation.
5. **Verify**: `POST /v1/auth/otp/verify` `{ phone, code, device_id }` (MOBILE requires the
   device id), plus `age_declared_over_18` only when asked (section 10).
6. On success the credential is written to SecureStore, then the session state switches to
   signed in; no restart. The bootstrap key changes, so an authenticated bootstrap follows.
   Screen readers hear `auth.signed_in`. The app returns to `returnTo`.

Buttons are disabled while a request is in flight. Idempotency keys follow section 4: a
changed phone, code or declaration, or a server answer, starts a new key.

Every inline error, the age-declaration error and the resend notice are spoken when they
appear (`AccessibilityInfo.announceForAccessibility`): the `alert` role alone is not
announced on Android or iOS.

## 9. OTP and resend

**Send a new code** calls `POST /v1/auth/otp/resend` `{ phone, purpose, audience }` (the
contract declares no Idempotency-Key there), clears the field and says
`auth.code.resent` ("A new code is on its way. The previous code no longer works."). No
countdown is shown: the contract publishes no resend interval, so none is guessed. When the
server refuses (429 `RATE_LIMITED`), its `retry_after_seconds` slot is shown verbatim
("Too many requests. Try again in 359 seconds." was observed on the device against the real
API). Wrong, expired and exhausted codes render the server's own keys
(`error.auth.otp_invalid`, `otp_expired`, `otp_attempts_exceeded`). The code is never logged,
stored, or displayed except as the Buyer types it.

## 10. Age declaration

Shown only after the server answers verify with 400 `AGE_DECLARATION_REQUIRED` (a phone with
no Account). A checkbox then appears with the binding wording `auth.age.declaration`; its error
sits under the checkbox, not on the code field, so a correct code is not marked wrong. Verify
with the box unchecked is refused locally and nothing is sent. Checked, the same code is sent
again with `age_declared_over_18: true`. No date of birth is collected. An existing Account is
never asked (both paths validated on the device).

`auth.age.declaration` is HUMAN-REQUIRED (ADU-RUL-03 S4): English in `am.ts` with the marker,
pinned in `ops/scripts/verify-mt-keys.mjs`. It duplicates the console's
`console.signin.age_declaration` wording; whether the two should become one shared key is a
founder question (section 22).

## 11. Credential storage

The bearer is opaque and is never decoded. It lives only in SecureStore under
`adulis.session.token`, written only by `signIn` and removed only by `clearSession`, both in
`src/auth/session.tsx` (the session-storage abstraction from WO-001). It is never put in
Zustand, SQLite, the query cache, logs, error messages or the diagnostics screen; the
diagnostics screen shows `account_context` availability only. Tests assert one SecureStore
write under that key, nothing token-shaped in the UI store, no token or code in any console
output, and that every request bearer equals the issued token. No public session id is
treated as a credential (the client never reads one).

## 12. Session restoration

At launch `restoreSession` reads the stored credential; present means signed in at once (no
network wait), absent means guest. A read failure is logged by message only and treated as
guest. The authenticated bootstrap then validates the credential: a dead one ends the session
(section 13). Validated on the device: cold relaunch after sign-in opens signed in.

## 13. Expired or revoked session (one behaviour)

The single path: a response 401 with code `SESSION_EXPIRED` or `SESSION_REVOKED` to a request
that carried the session bearer calls `onSessionEnded` with that credential. Only if it is
still the current one (a late answer for an earlier session cannot end a newer one), the app
leaves the session at once: credential dropped from memory, whole query cache cleared, active
mode cleared, state guest; then the SecureStore delete runs. If the delete fails it is logged
and the app stays guest: the leftover credential is dead, and the next launch's bootstrap ends
it again. No request after it carries it and nothing retries with it. Every other 401 (for example a wrong code, which also answers 401)
ends nothing. Logout's own 401 means "already signed out" and is not an error.

## 14. Offline

Offline is not unauthenticated. An offline start keeps the stored credential and opens signed
in; the version verdict arrives when the network does. Failed requests show
`common.offline` or `common.timeout`; 4xx, 429 and 5xx show the server's key. Validated on the
device with the API unreachable: relaunch stayed signed in, Saved showed the signed-in state,
Sign out cleared the device at once, and Send code showed the offline message.

## 15. account_context

Read from the authenticated bootstrap (`useAccountContext()`), exactly as sent; the client
computes no role availability and reads no local flag. Guests have none. It is shown only on
the development diagnostics screen. Nothing in the release Buyer shell reads it yet.

## 16. Release build: Buyer only

No mode switcher, no Seller Companion entry, no Courier entry, whatever `account_context`
says (tested with `seller_companion.available = true`). Development builds keep the WO-002
diagnostic shells.

## 17. Sign out

`signOut` starts `POST /v1/auth/logout` with the current credential and, without waiting,
runs `clearSession`. The device forgets the session immediately whatever the network does; a
failed revoke is logged by its reason only. Validated: online, `core.session.revoked_at` was
set within the same second; offline, the device signed out and the server session stays valid
until it expires, because the client no longer holds the credential to retry with (section 22).

**Push tokens (founder ruling, recorded only):** "A signed-out device must not receive
account-private notifications when it has no active authenticated session for that Account.
The push token itself does not have to be deleted on Sign Out. No real push provider may be
connected until delivery eligibility enforces the session/account rule." WO-003 registers no
push token and connects no provider.

## 18. Locale

Commit `11b4ef9` (`packages/locale` only, for its own PR): the sign-in, code, resend, age,
upgrade, offline and timeout strings, EN and AM at parity; `buyer.sign_in.coming` removed
(Sign in now works). Amharic stays development-only. The Amharic tab-label truncation stays
deferred, as recorded in WO-002.

## 19. Tests

`pnpm --filter @adulis/mobile test`: 8 suites, 81 tests.

- `src/auth/auth-flow.test.tsx` (26 tests, the real route tree and providers against a fake
  API that records every request): first-launch registration, no re-registration later, entry
  and phone validation, request headers and body (UUIDv7 key), the same Idempotency-Key after
  a lost connection and a new one after a server refusal, the server rate-limit message (shown
  and spoken), bootstrap before the code request when none has succeeded, wrong code (shown
  and spoken), successful sign-in (SecureStore, verify body with `device_id`, authenticated
  bootstrap, shell update), age declaration only when required and the code kept, resend and
  its backoff message, change number, restore, `SESSION_EXPIRED` and `SESSION_REVOKED`
  removing the credential once, leaving the session even when the delete fails, offline start
  keeping it, a non-session 401 clearing nothing, sign-out, `UPGRADE_REQUIRED` blocking and
  Check again, `UPGRADE_RECOMMENDED` dismissal, `account_context` absent for guests and as
  sent when signed in, release Buyer-only with Seller available, the security assertions in
  section 11, and the code never shown back.
- `src/api/client.test.ts` (8 tests): failure classification (a non-JSON success body
  included), UUIDv7 keys, the 10 s timeout, the session-ending rule (naming the credential
  carried; wrong-code and offline end nothing), logout 204/401/500, the release HTTPS check,
  catalogue rendering and fallback.
- `src/buyer/buyer-shell.test.tsx`, `src/modes/navigation.test.tsx`: moved to the shared
  in-memory SecureStore and fake API (`src/testing/`); sign-out revokes with the issued
  credential and never waits on a stalled network.

## 20. Maestro and native validation

Android emulator `Adulis_Pixel_8a_API_37` (Android 17), the WO-002 debug build (WO-003 adds
no native module), Metro with `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000`, and the real
API locally (`NODE_ENV=development`, `.env` loaded, Docker Postgres on 5434), with
`adb reverse` for 8081 and 3000.

The development code comes from `apps/api/.dev-sms.log`, where the development SMS adapter
writes it instead of sending (D-106, development only). Production OTP behaviour is not
touched.

| Flow | Result |
|---|---|
| `.maestro/buyer-auth-request.yaml` (fresh install as guest, Saved offers Sign in, invalid phone refused, code requested) | pass |
| `.maestro/buyer-auth-verify.yaml` (wrong code refused, new Account asked for the age declaration, signed in on Saved, no Seller/Courier entry, cold relaunch restores, Sign out returns to guest) | pass |
| Both again in system Dark at font scale 1.3 with an existing Account (age step skipped) | pass |
| Back from sign-in to the asking tab, phone and number keyboards, Change number | pass, Dark, 1.3 |
| API unreachable: relaunch signed in, sign out locally, Send code shows offline | pass |
| `.maestro/buyer-shell.yaml` (WO-002 regression; its stale "Signing in arrives" line now asserts the Sign in button) | pass |
| Request and verify flows again after the review fixes (section 21), new Account | pass |

Database checks after the runs: one MOBILE session per sign-in, bound to the device, stored
as a hash, revoked at Sign out; one device row per install.

Not validated natively: `UPGRADE_REQUIRED` and `UPGRADE_RECOMMENDED` (they need the server's
`min_supported_client` raised; covered by tests), iOS (no macOS host), a TalkBack pass
(roles, labels and states, and the spoken errors, are asserted in tests).

## 21. Reviews

Two independent reviews of the diff (a code review, and a security and error-handling review)
found every hard constraint met: contract types only, the bearer only in SecureStore, the one
session-ending path, sign-out without waiting, age declaration only on request,
`account_context` observed only, the version gate, catalogue strings, no other app imported.
Findings and what was done:

| Finding | Done |
|---|---|
| Send code skipped bootstrap after registration succeeded and bootstrap failed, so the server kept refusing the OTP for an unplaced device | bootstrap until one succeeds; test |
| A late 401 for an earlier session could end a newer one | `onSessionEnded` names the credential carried; test |
| A server-ended session with a failed SecureStore delete stayed signed in | leave in memory first, delete best-effort and log; test |
| Errors were not spoken (the alert role alone is not announced) | announced when they appear; tests |
| A key reused after a server answer could replay a stored refusal | new key after any server answer; test |
| UUIDv4 keys where ADU-API-01 S8 says UUIDv7 | UUIDv7 keys; test |
| A non-JSON success body escaped classification | `unexpected`; test |
| Silent device-id storage failures; id held in a memo | logged by message; held in state |
| Non-API failures on the sign-in screens were not logged | logged by message |
| Doc: retry count and startup bound | corrected (section 6) |

## 22. Deferred work and founder questions

- Offline sign-out leaves the server session valid until expiry. A queued revoke would need
  the client to keep the credential after sign-out, which the rule "forget at once" forbids.
  Founder decision if a different trade-off is wanted.
- One shared key for the over-18 wording (`auth.age.declaration` and
  `console.signin.age_declaration` are the same sentence).
- Store links for `UPGRADE_REQUIRED` once listings exist.
- Resend countdown once the contract publishes the interval.
- Push token registration and delivery eligibility (ruling in section 17).
- Amharic: human review before release; tab-label truncation (WO-002).
- Mode switching for Seller Companion and Courier from `account_context`.
- No notice when the server ends a session: the app returns to guest silently.
  `error.auth.session_expired` exists; whether to show it is a UX decision.
- A device failure during sign-in (for example SecureStore refusing the write) shows the
  generic "on our side" message; a device-specific message needs a new catalogue key.
- The phone number travels in the verify route's params. No sink reads it today; analytics or
  crash reporting added later must not capture route params.
- `/auth/verify` opened by a deep link skips the request step, so Send a new code would send
  an SMS to the number in the link (server rate limits apply). Founder decision whether verify
  should require an in-app request first. **Resolved by WO-003A:** Verify now opens only for a
  phone this app run successfully requested a code for; any other link opens Sign in.
- If the server purges a device row (retention) the install's local "registered" record still
  says registered and the install never registers again (see D-118). Server-side or a later
  client recovery; not in WO-003.
- **Corrected by WO-003A.** This item used to say that the bearer sits in idempotency records
  for 24 h after `/v1/auth/otp/verify`. That was false: since WO-API-001A SEC-3 a completed
  verify records only `{ "credential_withheld": true, "session_id": "<public session id>" }`,
  and a replay answers `401 OTP_EXPIRED` with no credential. WO-003A section 7 re-verified this
  against a real sign-in. No backend question remains here.
- The "You are signed in" announcement runs just before the screen changes; Android may cut it
  short. A TalkBack pass on hardware should confirm.

## 23. Contract gaps

- **CG-WO3-1** `GET /v1/bootstrap` declares no header parameters (`X-Adulis-Client`,
  `X-Adulis-Device`) and no 401 response, though with a dead bearer it answers 401
  `SESSION_EXPIRED` / `SESSION_REVOKED`. The client sends the documented headers and decodes
  the problem generically.
- **CG-WO3-2** `POST /v1/devices` declares only `Idempotency-Key`; `X-Adulis-Device` is not
  declared. Sent anyway, as ADU-API-01 requires on every request.

Neither needs a mobile-side cast; both are recorded for a contract revision.

## 24. Commits

| Commit | Content |
|---|---|
| `11b4ef9` feat(locale): add the mobile sign-in and bootstrap strings (WO-003) | `packages/locale` only, for its own packages PR, which the mobile change needs first |
| `e8449bf` feat(mobile): add device registration, bootstrap, version gate and Buyer sign-in | API client, device storage, bootstrap, auth routes, session, components, `apps/mobile/CLAUDE.md`, the existing tests moved to `src/testing` |
| `3fab39b` test(mobile): cover Buyer sign-in, session handling and the API client | the new tests and the Maestro flows |
| `61f4b19` docs(mobile): record WO-003 completion | this record (this table added in the next commit) |

## 25. Next recommended work order

Real Buyer discovery domain work (Home For You feed and Product/Scene reads) on top of the
signed-in shell.
