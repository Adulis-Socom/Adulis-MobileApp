# WO-020 -- Founder handoff

**Seller Companion frontend foundation**, 12 November 2026.

## Status

**PARTIALLY COMPLETE: backend contract and permission gaps documented.**
- **Frontend: built and tested in code.** The screens, server-derived access, store selection,
  store-scoped requests, notifications, overview and read-only Orders all work against the API's
  observed behaviour.
- **What keeps it from complete:** the API publishes no response schema for any Seller read; the
  overview does not say which counts follow its window; store-inbox attribution is undefined;
  Seller notification copy and a human Order reference don't exist.
- **Native Android and iOS:** not tested.

| | |
|---|---|
| Branch | `mobile/wo-020-seller-companion-foundation` (pushed; not merged) |
| Started from | `b091de8dc98c6101524612a6a6f0a506bce38a99` (WO-018 head) |
| Code and tests verified at | `bc46751` |
| Final SHA | the documentation commit after `bc46751` (in the final report) |
| Records | [development report](WO-020-SELLER-COMPANION-FOUNDATION.md), [capability matrix](WO-020-SELLER-API-CAPABILITY-MATRIX.md), [security review](WO-020-SECURITY-REVIEW.md), [issues](WO-020-ISSUES-AND-BLOCKERS.md), [review guide](WO-020-REVIEW-GUIDE.md), [native backlog](MOBILE-NATIVE-VALIDATION-BACKLOG.md) |

## What a Seller can now do in the app

- **Switch to Seller from You**, only when the server says the Account has a store. It's the same
  session: nothing is signed in or out.
- **Pick a store** when they hold several (name, @handle, role, status). One store opens directly.
- **See Home:** the store, their role and its status. A store that isn't open says so.
- **Read the basic overview:** Published Products now, Orders in the last 30 days, active
  reservations, completed handoffs, followers. Only what the server sends.
- **Read the store's notifications:** Mark as read for ordinary notices. Protected notices, such as a
  payout change, point to the Seller Console instead.
- **See Orders** by the server's groups (Needs action, Active, Completed, Cancelled) and open one,
  view only.
- **Switch back to Buyer.**

There are no Order, payment, product, stock, team or settings actions. Courier stays unavailable.

## How it was verified

- **Runtime contract probe.** Two short read-only probes against the running API (review data on
  the disposable database) confirmed MOBILE authorization and every response shape.
  - The database container was already running.
  - Only the API process was started, for a few minutes each time, then stopped.
  - **This was a judgment call within the resource order.** The order forbids starting Docker or
    PostgreSQL, not the API. It was the only way to see the executable contract without reading
    backend code, which the repository's mobile boundary forbids.
- **Automated tests.** Mobile Jest **461/461** in 26 suites (427 before WO-020), run in band. They
  include 28 Seller route tests, 6 response-check tests, and updated mode and release-build tests.
- **Lightweight gates.** Mobile and locale typecheck, lint, the locale test, `verify:deps`,
  `verify:docs`, `verify:mt-keys` and `verify:error-locale` all pass.
- **Not run (resource order):**
  - `pnpm build` and the mobile export;
  - API tests and the database gates (they need Docker databases);
  - the full parallel `pnpm test`;
  - Expo Doctor;
  - every native check.
- **Security review.** An independent read-only frontend review found no Critical, High or Medium
  issue. Two Lows and two Info items were fixed; three Info items are accepted.

## Decisions for you

1. **What a store inbox should contain** (W20-04). The fixture store's inbox held an Account
   sign-in alert and a payout-change notice; the Buyer inbox held none. A multi-store Account may see
   the same notices under every store. Please confirm the rule with the backend owner.
2. **Protected notices on mobile** (W20-16, review F2). The Companion no longer lets a store mark a
   protected notice as read. Should the Buyer inbox follow the same rule?
3. **Seller notification wording** (W20-05). The Companion shows a neutral sentence until approved
   copy exists (English, and a human Amharic translation).
4. **Unchanged:** native verification is still waiting on a machine with free memory (WO-019, W18-02).

## Storage and memory

| Point | Free RAM | C: free (bytes) | G: free (bytes) |
|---|---|---|---|
| Start | 1.69 GB | 25,794,465,792 | 3,353,507,528,704 |
| After coding | 0.97 GB | 25,782,755,328 | 3,353,441,468,416 |
| After tests | 2.11 GB | 25,762,643,968 | 3,353,389,039,616 |

- **Memory:** commit charge stayed between 36.4 and 36.7 of 44.5 GB. The page file stayed at
  29,520 MB (not changed). An unrelated game held about 10.4 GB throughout and was not closed.
- **Generated:** 203 KB in `G:\AdulisDevelopment\WO-020` (logs and probe scripts). Nothing was
  removed, because no Maestro APK, build or bundle was produced.
- **Protected locations:** untouched.
- **Storage audit:** run once at the end (`G:AdulisDevelopmentWO-020logsaudit-final.txt`: C: 25,762,484,224,
  G: 3,353,389,039,616 bytes free; nothing deleted). The start used direct measurements, not the
  audit script. The audit lists three Maestro driver APKs (76.3 MB) left by earlier work orders.
  They are not WO-020's, so they were left for a later cleanup.

## Recommended next Mobile work order

**WO-019, native accessibility and Seller verification**, on a machine with no other heavy program
running: the WO-018 items and the WO-020 items in the backlog. Then **WO-021, Seller Companion
order awareness**, if the founder approves the notification rules above. It would add Seller
notification copy, an Order line summary (once the backend publishes the line shape), and
deep-linking a notification to its Order.

In parallel, outside the mobile workstream:
- publish response schemas for the Seller reads (W20-01);
- state the overview's window semantics (W20-02);
- return 400 for a malformed Orders cursor (W20-03);
- define store-inbox attribution (W20-04).
