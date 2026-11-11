# WO-011 -- Founder Handoff

Buyer Account, settings, security and privacy. 12 November 2026.

## Result

**PARTIAL.** Every control the existing API supports is built, secure and validated. Profile
editing is blocked by a missing contract: no Buyer profile exists to edit (ON-20261111-132). The
work order rates that as PARTIAL.

Working against the real local API (Android, disposable database):
- **You tab, in four sections:**
  - Account: the signed-in statement.
  - Preferences: Appearance System/Light/Dark, and Language. Amharic is development-only; a
    release build says English.
  - Security: the Account's live sessions, with "This device", Refresh and Sign out.
  - Privacy: Delete Account.
- **Account deletion** on the existing ticket flow: the phone, an SMS code, the server's
  consequences and blockers, a typed confirmation (DELETE), then deletion confirmed by the server.
  The device signs out only if the deleted Account was its own.

Deferred: Edit Profile (no contract); signing out other sessions (CONSOLE plus step-up only,
ON-134); keeping Appearance or Language across launches (no approved device store, ON-133).

**iOS was not tested.**

## Branch and commits

`mobile/wo-011-buyer-account`, from `e00706f1e2cab5c0147fbd0a01109afe492ba766` (WO-010A HEAD). The
pushed HEAD is in the overnight report.

| Commit | Change |
|---|---|
| `a465674` | locale: Account, sessions and deletion strings (packages/locale, own commit) |
| `38d5446` | locale: the unconfirmed-outcome sentence |
| `0dc996b` | mobile: You tab sections, sessions, Account deletion, tests |
| `2f80b06` | locale: outcome sentences after the security review |
| `ddf71a6` | mobile: security-review fixes (M1, M2, L1-L4) |
| `d34076f` | test: Maestro flows account.yaml and account-delete.yaml |
| next | docs: the three WO-011 records and the register |

## Tests

- **Jest:** account.test.tsx 28/28 (the section 13 matrix plus the review fixes); mobile
  319/319; typecheck and lint clean.
- **Native (Android 17 emulator, the WO-010A APK reused, real local API, disposable database):**
  - Account: guest, sign-in, signed-in sessions and Language, Dark at font scale 1.3, sign-out.
  - Deletion: cancel (no code requested), request, typed confirmation. The disposable Account
    became SCRUBBED with 0 live sessions; the other Account stayed ACTIVE.
  - Regression: category Shop, Search, Seller Profile.
  - Commerce rows unchanged (carts 0, reservations 5, orders 8).
- **Full repository gates** run once before the overnight handoff (see the overnight report).

## Security

The independent review found no Critical or High. Two Medium and four Low were fixed before this
checkpoint (`WO-011-SECURITY-PRIVACY.md`). The ticket never travels as a bearer, and is never
stored or logged.

## Decisions for the founder

1. **Deletion lifecycle** (ON-129). The design's deletion requests (step-up, states,
   cooling-off, status) are not in the backend; Mobile uses the immediate ticket flow. Is that
   acceptable for the first release?
2. **Bind deletion to the session** (ON-130)? Today the ticket deletes whichever Account owns the
   typed phone. That is mitigated in the app, and fixable only by a contract change.
3. **Buyer profile** (ON-132): define it before Edit Profile can be built.
4. **Persist Appearance and Language** (ON-133): approve a device-local store.
5. **Sign out other sessions from Mobile** (ON-134)?
6. **HUMAN-REQUIRED class** for the typed-confirmation strings (ON-131).

## Storage

| Checkpoint | C: free (bytes) | G: free (bytes) |
|---|---|---|
| A, before development | 16,315,011,072 | 3,362,530,525,184 |
| B, after coding | 12,000,800,768 | 3,362,502,213,632 |
| C, after testing | 19,989,479,424 | 3,361,541,718,016 |
| D, after cleanup | 20,002,234,368 | 3,361,877,262,336 |

- **C: dip at B.** C: fell 4.31 GB at B with no Adulis location growing. It came back without any
  action (ON-20261111-136; likely Windows Update or system temp files).
- **Steady state.** The page file stayed at 38,823 MB, and Docker's disk was unchanged.
- **Cleanup.** 50 verified Maestro driver APKs were removed (315,531,900 B).
- **Kept as evidence.** The Maestro screenshots and logs (49.2 MB) under
  `G:\AdulisDevelopment\WO-011\maestro`.
- **Shared caches** (reused, not cleaned): Jest 2,812 files and Metro 4,331 files; the Node cache
  did not grow (7,541 files).
- **Protected folders untouched:** `G:\Android\`, `G:\w2`, `G:\w2x`, `G:\wo001a`, `G:\w10a`,
  `G:\adulis-claude-scratch-archive`, Docker volumes.
