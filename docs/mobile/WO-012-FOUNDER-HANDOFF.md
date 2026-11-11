# WO-012 -- Founder Handoff

Buyer notifications and in-app inbox. 12 November 2026.

## Result

**COMPLETE** against the work order's criteria:
- Real Buyer notifications appear, and authentication is enforced.
- Read state works per notification.
- Pagination works.
- Buyer and Seller scopes stay separate.
- Account switching is safe.
- Unknown templates fail safely.
- The native Android flows pass.
- No push and no payment functionality was added.

Working against the real local API (Android, disposable database, controlled rows):
- **The inbox:** Recent and Older; Unread or Read on every row; Mark as read; Refresh (button,
  pull, and returning to the app); Load older to the end.
- **The guest prompt.**
- **Dark mode at font scale 1.3.**

**What a Buyer reads today is thin, by design.** No Buyer notification template has approved
copy, so every row says "You have a notification from Adulis.", plus "It is about one of your
orders." when it names an Order (ON-20261111-141). No row opens anything: Orders is not built,
and a notification is never business truth.

Deferred:
- **Mark all read** (ON-139): the server's read-all also marks the Account's Seller notifications
  read.
- **Push** (out of scope, ON-145).
- **Notification destinations** (ON-144).

**iOS was not tested.**

## Branch and commits

`mobile/wo-012-buyer-notifications`, from `e598312073c730bfa47e35581db470e31aab8f2e` (the WO-011
checkpoint). The pushed HEAD is in the overnight report.

| Commit | Change |
|---|---|
| `15c64e3` | locale: inbox strings (packages/locale, own commit) |
| `8a56c45` | mobile: the inbox, read state, pagination, tests |
| `55794c2` | mobile: security-review fixes (Buyer-namespace copy only; refetch after NOT_FOUND; cursor guard) |
| `211b575` | test: Maestro notifications.yaml |
| next | docs: WO-012 records and the register |

## Tests

- **Jest:** notifications.test.tsx 14/14; mobile 333/333. Every test asserts there is no read-all,
  no push registration and no commerce call.
- **Native (WO-010A APK reused, disposable database, 29 Buyer rows plus 1 Seller-class row for a
  disposable Account):**
  - Guest prompt.
  - Sign-in; the inbox (Recent, Unread, the generic sentence, Received); Mark as read; Refresh;
    Load older to the end.
  - Dark at font scale 1.3.
  - Sign-out, then the guest prompt again.
  - Regression: You (guest) and Shop.
  - Database: exactly one more Buyer row read, and the Seller-class row still unread (no
    Account-wide read-all).
  - Commerce rows unchanged.

## Security

The independent review found no Critical or High:
- **MEDIUM, fixed (`55794c2`):** a row naming any catalogue key could render a Seller, error or
  SMS sentence. Only `notification.buyer.*` copy renders now.
- **LOW, fixed:** a stale row after a NOT_FOUND read.
- **Server-side LOW, recorded (ON-146):** the Buyer scope is a deny-list, which has drifted
  before. The client now renders a leaked Seller row generically.

## Decisions for the founder

1. **Buyer notification copy** (ON-141): approve English copy per template (then human Amharic),
   or rule that the server sends rendered text as ADU-NOTIF-01 S40 designs.
2. **Account security notices** (ON-143): NEW_DEVICE_SIGNIN reaches only the Seller feed, so a
   Buyer-only Account never sees it.
3. **Push** (ON-145): provider, and the permission moment (ADU-MOB-02 S172).
4. **Backend follow-ups (no decision, engineering):**
   - a scoped read-all (ON-139);
   - an allow-listed Buyer scope (ON-146);
   - a `(scheduled_for, id)` cursor (ON-142);
   - response DTOs (ON-140).

## Storage

| Checkpoint | C: free (bytes) | G: free (bytes) |
|---|---|---|
| A, before development | 20,001,128,448 | 3,361,867,825,152 |
| B, after coding (taken after the first native run) | 19,821,174,784 | 3,361,444,200,448 |
| C, after testing | 19,810,607,104 | 3,361,293,205,504 |
| D, after cleanup | 19,807,621,120 | 3,361,462,026,240 |

- **Growth.** C: moved 0.19 GB, mostly other software. The emulator, Metro, Maestro, Jest and the
  logs all wrote to the SSD.
- **Cleanup.** 26 verified Maestro driver APKs were removed (164,076,588 B).
- **Kept as evidence.** Maestro screenshots and logs under `G:\AdulisDevelopment\WO-012\maestro`.
- **Untouched.** Shared caches are reused, not cleaned. The protected folders were not touched.
