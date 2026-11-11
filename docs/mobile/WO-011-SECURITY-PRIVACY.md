# WO-011 -- Security and privacy of the Buyer Account controls

Work order WO-011 (12 November 2026). Companion to `WO-011-BUYER-ACCOUNT.md`.

## 1. Credentials

| Credential | Where it lives | Sent with | Never |
|---|---|---|---|
| MOBILE bearer (opaque) | SecureStore only (unchanged) | Account reads (`GET /v1/auth/sessions`), sign-out | With a deletion call |
| Deletion ticket (UUID, 15 minutes) | The Delete Account screen's memory (`useRef`) | `GET /v1/deletion/preview`, `POST /v1/deletion/confirm` as `Authorization: Ticket <id>` | Stored, put in a route parameter, logged, shown, cached, or sent as a bearer |
| Deletion OTP | The code field, cleared on success | `POST /v1/deletion/otp/verify` only | Logged or stored |

- **The client's `ticket` mode** (`src/api/client.ts`) never reads the bearer. A ticket request
  has no session token, so its 401 can never call `onSessionEnded`.
- **Session-ended handling is unchanged:** only a bearer request's 401 SESSION_EXPIRED or
  SESSION_REVOKED ends the session.
- **The OTP calls send no Authorization header at all.** The server authenticates any bearer
  presented on its public routes and answers a bearer on a ticket endpoint with SESSION_EXPIRED,
  so sending one by mistake would have signed the Buyer out. Tests assert that no deletion call
  carries a bearer.

## 2. What the server enforces (read, not changed)

- The ticket is accepted by exactly the four deletion endpoints. It needs a consumed
  ACCOUNT_DELETION challenge within fifteen minutes, for an ACTIVE Account with that phone.
- `core.fn_delete_account` re-checks the ticket and every blocker in its own transaction. It
  revokes every session of the deleted Account and purges payout ciphertext on the financial
  connection after commit.
- Confirm requires `acknowledge: true` and an `Idempotency-Key`. The key's actor is the ticket's
  Account. Blockers answer 409 DELETION_BLOCKED with `items[]`.
- Sessions: `GET /v1/auth/sessions` lists only the caller's Account. Revoking another session
  needs CONSOLE and a REVOKE_ALL_SESSIONS step-up.

## 3. Independent security review (read-only)

No Critical and no High finding. Every Medium and Low finding was fixed before the checkpoint.

| # | Severity | Finding | Fix |
|---|---|---|---|
| M1 | MEDIUM | The ticket deletes the Account that owns the typed phone. If that is not the signed-in Account, the app still said "your Account" and dropped the signed-in credential without a server sign-out | After a confirmed deletion the app asks the server, with this device's bearer (`GET /v1/bootstrap`): a revoked session means this Account was deleted (sign out); a live session means another Account was (the device stays signed in, and says so); no answer means a proper sign-out (`signOut`, with the server revoke). The preview names the phone ("This deletes the Adulis Account registered to {phone}.") and so does the outcome |
| M2 | MEDIUM | A lost answer was only detected for offline and timeout. The server refuses a deleted Account's ticket before its idempotency replay, so after a 5xx, or a retry past the deadline, a deleted Account could be told "code expired, start again" | Any confirm without a definitive answer marks the outcome uncertain. Afterwards a refused or expired ticket settles as "unconfirmed", resolved by the same server check: a revoked session shows the deletion as done. The comments no longer claim the key replays a completed deletion |
| L1 | LOW | A background 401 (the server revokes the sessions as the deletion commits) could unmount the screen before the confirm answer arrived | A `confirming` ref keeps the flow on screen while a confirm is in flight |
| L2 | LOW | Two presses in one frame could both start a confirm | The guard is a ref, not React state |
| L3 | LOW | Blockers from several Sellers share a message key, giving duplicate React keys | Index-based keys |
| L4 | LOW | A fresh ticket the server refuses (for example, no ACTIVE Account has that phone) showed "code expired" | It now says "This code could not be used to delete an Account. Check the phone number and start again." The Buyer has proven the phone, so this reveals nothing new |
| INFO | -- | Ticket/bearer separation, ticket exposure, OTP handling, key scope, late session answers, server-key rendering, release-build Amharic, and no payment or checkout surface | Checked clean. Optional hardening not done: accept only `deletion.effect.*` and `deletion.blocker.*` keys; correct the ticket deadline with bootstrap `server_time` (a device clock 15+ minutes fast cannot delete in-app, which fails safe) |

Tests added for the fixes: M1 (another Account deleted, and no answer), M2 (5xx then refused), L2
(a second press in flight). Account suite: 28 tests.

## 4. Privacy

- **No new personal data is shown or stored.** Sessions show platform, surface, times and the
  server's approximate location, and only when the server recorded one.
- **No phone, name or identifier** is shown beyond the phone the Buyer typed for deletion.
- **Late answers.** A late sessions answer for an earlier session is refused, and sign-out clears
  every cached private answer.
- **The deletion consequences** (effects) are the server's, rendered from the shared catalogue,
  as R-11 requires (no re-authored policy). Any line the app cannot render withholds the
  irreversible step.
- **Retention and anonymisation** are the server's (PRV-01 S31 and `fn_delete_account`). The
  app makes no claim beyond the server's effect list.

## 5. Residual risks (register)

- **Phone binding** (ON-20261111-130). Mitigated: the target is shown, and the device signs out
  only for its own Account. Requiring the ticket's Account to match the session is a product and
  contract decision.
- **Design lifecycle not built** (ON-20261111-129). No cooling-off, cancellation or status route
  exists in the backend; deletion is immediate.
- **Typed-confirmation wording** (ON-20261111-131). Its translation class (HUMAN-REQUIRED) needs a
  ruling.
