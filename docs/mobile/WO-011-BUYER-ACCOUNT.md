# WO-011 -- Buyer Account, settings, security and privacy

Work order WO-011 (12 November 2026). Branch `mobile/wo-011-buyer-account`, from WO-010A HEAD
`e00706f1e2cab5c0147fbd0a01109afe492ba766`. Engineering record; it changes no specification.

## 1. Sources

- **Design:** ADU-MOB-02 v4.3 S137 and S232 R-11 (the governing list of Account controls), R-17
  (Light/Dark/System), R-19 (Amharic stays disabled for users); ADU-AUTH-02 v3.3 S38, S46, S118
  (sessions, revocation, step-up); ADU-PRV-01 v3.3 S29-S31, S57 (deletion lifecycle).
- **Executable contract:** `contracts/openapi.json` (ADU-API-01 v1.11): `GET /v1/auth/sessions`,
  `DELETE /v1/auth/sessions/{id}`, `POST /v1/auth/sessions/revoke-others`, and the deletion-ticket
  group `/v1/deletion/*` (S12.18).
- **Server behaviour checked:** `apps/api/src/modules/auth` (listSessions, revokeSession) and
  `apps/api/src/modules/deletion`. Read only; no API change.

## 2. The You tab (`src/app/(buyer)/(tabs)/account.tsx`)

| Section | What it shows or does | Source |
|---|---|---|
| Account (signed in) | "You are signed in to your Adulis Account on this device." and the line naming what is still to come | No Buyer profile exists in the contract or the designs |
| Preferences | Appearance: System, Light, Dark (`ChoiceGroup`, a radio group with checked state). Language: English and Amharic in development builds; a release build says "Adulis is shown in English." | R-17, R-19 |
| Security (signed in) | The Account's live sessions (`GET /v1/auth/sessions`): device platform, surface (Adulis app or Seller Console), last active, signed in, an approximate location only when the server recorded one, and "This device" from the server's `current` flag. Refresh. Sign out. | AUTH-02 S38, S118 |
| Privacy (signed in) | Delete Account | R-11 |
| A guest | The sign-in prompt and the device Preferences; no Account, Security or Privacy control | MOB-INV-15 |

**What is NOT shown, and why:**
- **No profile field or Edit Profile.** "Edit Profile" exists only as a label in R-11. No document
  defines a Buyer field: no display name, avatar or handle. No endpoint edits one; the Seller
  Profile API is a store profile and was not repurposed (ON-20261111-132).
- **No phone number.** Mobile receives it only during the sign-in run, and no Account read
  returns it.
- **No internal identifiers.** Session ids are public but are not shown.
- **No revoke of another session, and no "sign out everywhere".** The contract allows that only
  from CONSOLE with a REVOKE_ALL_SESSIONS step-up, and no step-up is reachable from Mobile. The
  design's "revoke one or all other sessions according to policy" (AUTH-02 S38) therefore has no
  MOBILE path (ON-20261111-134). The screen says so in one sentence.
- **No persistence of Appearance or Language.** Both live in the in-memory UI store for the app
  run. The approved device stores are SecureStore (credentials) and SQLite (no tables until a
  design defines them); a new storage library would be a new native dependency. This is
  unchanged behaviour, recorded (ON-20261111-133).

## 3. Sessions

`useAccountSessions()` (`src/buyer/account.ts`) reads `GET /v1/auth/sessions` with the bearer, bound
to the session on screen (`keepIfCurrent`): an answer that lands after a sign-out or another
sign-in is refused, never shown. `clearSession` clears the cache with every other private answer.
A 401 SESSION_EXPIRED or SESSION_REVOKED ends the session through the existing client path.
Offline or timeout shows "Your sessions could not be loaded." with the cause and Try again.

Sign out is the existing `signOut` (`POST /v1/auth/logout`, the credential first removed from the
device). It is the one revoke a MOBILE session may make, of itself.

## 4. Account deletion (`src/buyer/DeleteAccount.tsx`, route `/account/delete`)

Built on the EXISTING deletion-ticket flow, as the work order directs; the design's
deletion-request lifecycle is not in the backend (section 6).

| Step | Call | Notes |
|---|---|---|
| Explanation | none | Permanent, irreversible, signs this device out; Continue or Cancel |
| Phone | `POST /v1/deletion/otp/request {phone}` | Anonymous (no bearer), one idempotency key per intent; the device is bootstrapped first |
| Code | `POST /v1/deletion/otp/verify {phone, code}` | Answers `{ticket, expires_at, scope}`; checked at the boundary |
| Preview | `GET /v1/deletion/preview`, `Authorization: Ticket <id>` | The server's effects and blockers, rendered from their catalogue keys |
| Typed confirmation | none | The Buyer types the catalogue word (DELETE); anything else is refused locally |
| Confirm | `POST /v1/deletion/confirm {acknowledge: true}`, Ticket, `Idempotency-Key` | One key per ticket, kept across a lost connection |
| Outcome | `GET /v1/bootstrap` with this device's bearer | Only after the server answered `{deleted: true}`. A revoked session means this Account was deleted (local sign-out); a live session means another Account was (still signed in); no answer means a proper sign-out |

- **The ticket** stays in the screen's memory only: no storage, route parameter, log or error
  text. It is dropped when the screen closes, the code expires or deletion completes.
- **Its deadline** is the earlier of the server's `expires_at` and fifteen minutes from receipt,
  and is checked before every use. The server's 401 for a dead ticket sends the Buyer back to the
  phone step. A ticket's 401 never ends the app session: the client sends no bearer with a ticket
  and calls `onSessionEnded` only for a bearer.
- **Blockers** (preview `items[]`, or a 409 DELETION_BLOCKED at confirm) withhold confirmation.
- **Unrenderable lines.** An effect or blocker the mobile catalogue cannot render withholds
  confirmation ("The deletion details could not be shown in full..."). The app never hides a
  consequence or shows a raw key.
- **Lost answers.** A confirm with no definitive answer (offline, a timeout, a 5xx) marks the
  outcome uncertain; a retry keeps the same key. The server refuses a deleted Account's ticket
  before it would replay, so if a later attempt finds the ticket refused or expired, the app
  settles the outcome with the bootstrap check. A revoked session shows the deletion as done; a
  live one shows "unconfirmed". It never says "start again" for an Account that may be gone.
- **Session change.** If the session the flow started in ends or changes while no confirm is in
  flight, the flow leaves.
- **Phone binding.** The ticket names an Account by possession of the phone, not by the signed-in
  session (ON-20261111-130). The preview and the outcome name the phone. The outcome check
  decides whether this device signs out, so deleting another number's Account does not sign this
  device out.

## 5. Tests

`src/buyer/account.test.tsx`: 28 tests on the real route tree with the fake API, numbered by the
work order's section 13 matrix. Four of them cover the security review's fixes (M1 twice, M2, L2).
They cover every row except 19's server-side purge, which the API suite owns (`apps/api`
deletion tests), and the native rows below.

Native results: `WO-011-FOUNDER-HANDOFF.md`.

## 6. Conflicts and gaps (register)

| Id | Kind | Summary |
|---|---|---|
| ON-20261111-129 | SPEC_CONFLICT | PRV-01 S57 designs a deletion-request lifecycle (step-up, states, optional cooling-off, status route); the backend implements only the immediate ticket flow. Mobile uses the implemented flow as directed |
| ON-20261111-130 | CONTRACT_GAP | The ticket identifies the Account by phone possession; no read lets the client confirm it is the signed-in Account |
| ON-20261111-131 | DECISION | The typed-confirmation strings are candidates for HUMAN-REQUIRED translation; classifying them needs a ruling |
| ON-20261111-132 | CONTRACT_GAP | No Buyer profile fields or edit endpoint ("Edit Profile" in R-11 has no definition) |
| ON-20261111-133 | DECISION | Appearance and Language are not persisted: no approved device-local store |
| ON-20261111-134 | CONTRACT_GAP | Revoking other sessions has no MOBILE path (CONSOLE plus step-up only) |
| ON-20261111-135 | CONTRACT_GAP | The deletion endpoints publish no request or response schemas; the client checks the answers at its boundary |
