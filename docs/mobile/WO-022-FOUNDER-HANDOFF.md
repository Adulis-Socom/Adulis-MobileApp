# WO-022 -- Founder handoff

**Messaging reliability hardening and Seller Companion messaging UX**, 12 November 2026.

## Status

**PARTIALLY COMPLETE: contract and policy gaps documented.**

- **Built and tested in code:**
  - The Buyer duplicate-message risk is fixed (S21-03, Buyer side).
  - Buyer and Seller now share one reliability rule.
  - A second defect (an unconfirmed message carried into another conversation) is fixed.
  - The Seller inbox and reply area name the open store.
- **What keeps it from complete:**
  - Whether a phone may use the Seller inbox (W21-02) is still a contract question. A formal
    proposal is ready for your decision.
  - Four founder decisions remain open: conversation references, escalation wording,
    unpublished-Product retries, and permission names.
  - The backend's idempotency answers are unverified.
- **Native Android and iOS:** not tested.

| | |
|---|---|
| Branch | `mobile/wo-022-messaging-reliability-hardening` (pushed; not merged) |
| Started from | `e5e4a6e59aaecae64d2d8e17d7efd93324de4eeb` (WO-021 head) |
| Code and tests verified at | `0da543b` |
| Final SHA | the documentation commit after `0da543b` (in the final report) |

Records:
- [reliability](WO-022-MESSAGING-RELIABILITY.md)
- [Seller UX](WO-022-SELLER-MESSAGING-UX.md)
- [contract reconciliation](WO-022-SELLER-CHAT-CONTRACT-RECONCILIATION.md)
- [security review](WO-022-SECURITY-REVIEW.md)
- [issues](WO-022-ISSUES-AND-BLOCKERS.md)
- [review guide](WO-022-REVIEW-GUIDE.md)
- [native backlog](MOBILE-NATIVE-VALIDATION-BACKLOG.md)

## What changed for people

- **Buyers:**
  - If a message gets an unclear answer, the app says it may already have been received. Try
    sending again sends the identical message (same text, same Product, same key), so it arrives at
    most once.
  - A message about a Product can never be retried as a message about another Product or without
    it.
  - A clear refusal from the Adulis server still says "not sent".
- **Stores:**
  - Messages names the open store ("Conversations for Store A (@store-a)").
  - Each conversation shows its last activity and when it started.
  - The reply area says "Replies are sent as Store A (@store-a)."
  - Store replies use the same safe-retry rule.

## How it was verified

- **Automated tests, all in band:**
  - Whole mobile suite: **520 of 520** in 27 suites (492 before WO-022).
  - Buyer chat: 85 of 85 (16 new).
  - Seller chat: 43 of 43 (12 new).
- **Mutation checks:** putting the old rules back fails the new tests. That covers the old
  classification and the missing screen key (11 fail), and the code-only refusal rule (2 fail).
  Every mutation was restored.
- **Gates (all pass):** mobile and locale typecheck, mobile lint, the locale test, `verify:deps`,
  `verify:docs`, `verify:mt-keys`, `verify:error-locale`.
- **Not run (resource order):** the emulator, Gradle, Maestro, Docker, PostgreSQL, the API, the
  export, Expo Doctor, and the full parallel test run.
- **Security review:** an independent read-only frontend review found no Critical, High or Medium
  issue.
  - Fixed: the Low (an intermediary's error could be mistaken for a server refusal) and one Info
    (test fixtures).
  - Recorded: three Info items.

## Decisions for you

1. **Seller messaging on the phone (W21-02 / W22-05).** Approve, or rule otherwise:
   > Seller Companion messaging is supported for Owner, Admin and Sales Support when the backend
   > confirms the Seller relationship and messaging permissions.

   If approved, ADU-API-01 S12.7 is corrected and backend tests are written. The exact edits and
   acceptance criteria are in the reconciliation proposal.
2. **Permission names (W22-08).** The design says `seller.inbox:read/reply`; the database says
   `seller.messages:read/send`. Choose one.
3. **Telling conversations apart (W22-11).** May a store see a server-issued conversation reference,
   or any Buyer label? This is a privacy decision.
4. **Escalation wording for stores (W22-12).** Approve "The buyer requested a response from your
   team." (with a human Amharic translation).
5. **Retrying after a Product was unpublished (W22-13).** Today the Buyer must choose "Edit the
   message instead". Should the identical message be replayed instead, once the backend confirms its
   answer?

These are optional and not blocking:
- Hiding Messages for roles that cannot use it needs the server to publish per-store capabilities
  (proposal B).
- A warning when leaving a conversation with an unclear message (W22-15).

## Storage and memory

| Point | Free RAM | Commit (GB) | C: free (bytes) | G: free (bytes) |
|---|---|---|---|---|
| Start | 0.43 GB | 37.62 / 44.54 | 25,732,055,040 | 3,353,352,339,456 |
| After coding | 1.30 GB | 36.82 / 44.54 | 25,722,888,192 | 3,353,340,805,120 |
| After tests | 0.76 GB | 36.99 / 44.54 | 25,698,484,224 | 3,353,331,367,936 |

- **Memory:** the page file stayed at 29,520 MB (not changed). No application was closed. The SSD
  (SanDisk Extreme, exFAT, G:) was verified at the start.
- **Generated:** 378,920 bytes of logs in `G:\AdulisDevelopment\WO-022`. The temporary mutation
  backups were removed at once.
- **Removed or recovered:** nothing. No APK, build, bundle or Maestro artifact was produced.
- **Protected locations:** untouched.
- **Storage audit:** run at the end in dry-run mode
  (`G:\AdulisDevelopment\WO-022\logs\storage-audit-end.log`). Nothing was deleted, and the start
  used direct measurements.

## Recommended next Mobile work order

1. **WO-019, native verification**, on a free machine. It covers the WO-018 to WO-022 backlog,
   including a local proxy to fake gateway failures, plus the read-only Seller Chat probe that
   settles W21-02/W21-03 and backend matrix rows 1-16.
2. **Next frontend feature: Seller Companion Order awareness.** Store notifications would open their
   Order, with an Order line summary once W20-07 publishes the line shape. It needs no open Chat
   decision.
