# WO-021 -- Independent security review

12 November 2026. A separate reviewer reviewed the diff `d6dd399..d365615` (the locale strings, the
shared chat engine and Seller messaging). The review was read-only: no edits, no tests run, no
runtime probe. `apps/api`, `apps/console` and `apps/storefront` were not read.

**This is a frontend-only review. It certifies nothing about the backend.** Server enforcement of
the role, the MOBILE audience, `X-Adulis-Seller` and conversation ownership was not observed (see
W21-02, W21-03).

## Result

**No Critical, High or Medium finding.** There are two Low and five Info findings. The fixes are in
commit `c4b9ad1`, with tests.

| ID | Severity | Area | Finding | Outcome |
|---|---|---|---|---|
| S21-01 | Low | Permission revocation | Only `PERMISSION_DENIED` and `AUDIENCE_NOT_PERMITTED` counted as "denied" and stopped polling. A 403 with another code (for example `STEP_UP_REQUIRED`) left cached history on screen and was polled every 30 s | **Fixed.** On a store's side, any 403 problem is "not available for your role" (`isForbidden`), and any 400, 403 or 404 stops re-reading. Test "S21-01, S21-02" |
| S21-02 | Info | Permission revocation | Refetch on focus and on reconnect still re-sent a refused read | **Fixed** (store side). `refetchOnWindowFocus` and `refetchOnReconnect` are off for a final refusal. Same test (reconnect, then 95 s: no read) |
| S21-03 | Low | Uncertain sends | A gateway 5xx without the API's problem body, or a 201 without a readable `message_id`, counted as "not sent". The retry then got a new key, which could store the reply twice | **Fixed** (store side). Both are now "may already have been received": the key is kept and the text frozen. The API's own refusals stay definite. Test "S21-03"; a mutation that restores the old rule fails it. The Buyer side keeps the shared rule (see below) |
| S21-04 | Info | Sender attribution (backend) | A same-Account reply is the store's only if the server honours `X-Adulis-Seller` on `POST .../messages`. Test 54 proves only the client side | **Recorded** (W21-02, W21-03). Needs a server negative test and the runtime probe. No client-side guess was added |
| S21-05 | Info | Conversation scoping (backend) | Any UUID, including one from a deep link, is read and answered under the active store's header. Ownership is the server's check | **Recorded.** It needs a backend test for history and send under the wrong store header. The client shows the server's 404 as "not available" and does not end the store |
| S21-06 | Info | Idempotency | "Same session" was decided by object identity. That is correct today and fails safe, but a recreated bound API would mint a new key on retry | **Fixed.** The held intent is compared by `isCurrent()` |
| S21-07 | Info | Buyer regression | The refactor also made the Buyer's polling stop on 403 | **Fixed.** The Buyer side again stops on NOT_FOUND only (WO-013 behaviour); the wider set applies to the store's side alone |

## Verdict per focus area (after fixes)

| # | Area | Verdict |
|---|---|---|
| 1 | Seller authorization | OK on the client (server-derived gate, store list, server refusals); MOBILE runtime unverified (W21-02) |
| 2 | MOBILE session audience | OK; fails closed on any 403; no audience fallback |
| 3 | X-Adulis-Seller propagation | OK. All three calls carry it, `seller_id` comes from the same argument, and it is UUID-checked before sending |
| 4 | Seller conversation scoping | OK on the client; S21-05 needs the server |
| 5 | Seller A/B isolation | OK: store-keyed queries and screens; the intent is bound to the store |
| 6 | Cross-Account isolation | OK: session-bound reads, cache cleared on sign-out |
| 7 | Sender attribution | OK on the client (server kinds only, body `{ text }`); S21-04 needs the server |
| 8 | Message idempotency | OK (S21-06 fixed) |
| 9 | Uncertain-send handling | OK (S21-03 fixed on the store side) |
| 10 | Cached private data | OK: `gcTime 0`, no persister |
| 11 | Delayed request responses | OK: `keepIfCurrent`, `isCurrent()` before any state change |
| 12 | Session expiry | OK: the existing 401 handling |
| 13 | Permission revocation | OK (S21-01, S21-02 fixed) |
| 14 | Unauthorized conversation access | OK on the client: a neutral 404, and `refused()` is not called |
| 15 | Private information in logs | OK: no logging added; `ApiError` carries only the status and the code |
| 16 | Route parameter validation | OK: UUID only, before any request |
| 17 | Untrusted message rendering | OK: plain text; only `chat.bot.*` catalogue copy for automated answers |
| 18 | Buyer regression security | OK (S21-07 fixed); Buyer chat 69 of 69 |

## Recorded, not changed

- **The Buyer side has the S21-03 pattern.** `wasAnswered` treats a gateway 5xx without a body, and
  an unreadable 201, as answered. Changing the shared rule would change Buyer behaviour, which
  WO-021 must leave as it is. Recommended for a later Buyer work order.
- **Not reviewed** (app-wide, predating WO-021):
  - bidi-override and spoofing characters in message bodies;
  - Android recents screenshots.
