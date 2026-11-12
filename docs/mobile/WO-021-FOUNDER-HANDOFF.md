# WO-021 -- Founder handoff

**Seller Companion messaging**, 12 November 2026.

## Status

**PARTIALLY COMPLETE: contract and permission gaps documented.**

- **Frontend: built and tested in code.**
  - Messages on Seller Home.
  - The store's Buyer conversations.
  - Message history with sender labels.
  - Plain-text replies with safe retries.
  - Store and Account isolation.
- **What keeps it from complete:**
  - The documents disagree on whether a phone may use the Seller inbox at all (W21-02).
  - Nothing was observed at runtime, because the work order forbade starting the API (W21-03).
  - The API publishes no Chat response schema (W21-01) and no Buyer label a store may see (W21-04).
- **Native Android and iOS:** not tested.

| | |
|---|---|
| Branch | `mobile/wo-021-seller-companion-messaging` (pushed; not merged) |
| Started from | `d6dd3995f65cda08ce3d7ce18051118fb809636e` (WO-020 head) |
| Code and tests verified at | `c4b9ad1` |
| Final SHA | the documentation commit after `c4b9ad1` (in the final report) |

Records:
- [development report](WO-021-SELLER-MESSAGING.md)
- [capability matrix](WO-021-CHAT-API-CAPABILITY-MATRIX.md)
- [security review](WO-021-SECURITY-REVIEW.md)
- [issues](WO-021-ISSUES-AND-BLOCKERS.md)
- [review guide](WO-021-REVIEW-GUIDE.md)
- [native backlog](MOBILE-NATIVE-VALIDATION-BACKLOG.md)

## What a store can now do in the app

- **Open Messages** from Seller Home. The list shows the store's Buyer conversations, most recent
  activity first: "Buyer conversation" and its last activity, with Load more and Refresh.
- **Read a conversation:**
  - Every message says who wrote it: Buyer, Store owner, Store team member or Automated answer.
  - Messages about a Product or an Order say so, without naming it.
  - Older messages load on request. New ones arrive on Refresh, and every 30 seconds while the
    conversation is open.
- **Reply in plain text** (up to 4,000 characters):
  - The reply appears only when the server has accepted it.
  - If the connection fails, the app says the reply may already have been received. It offers Try
    sending again (never sent twice) or Edit the message instead.
- **Isolation:**
  - Switching store or Account takes the previous store's conversations, typed text and
    unconfirmed reply with it.
  - An Account that is also the Buyer in a conversation still replies as the store.
- **Not offered:**
  - attaching a Product or Order to a reply;
  - starting a conversation;
  - Buyer names;
  - unread counts;
  - previews;
  - push;
  - typing or read receipts.

## How it was verified

- **Automated tests.**
  - The whole mobile suite: **492 of 492** in 27 suites, run in band (461 before WO-021).
  - Seller messaging: 31 route tests against an in-memory Chat server. They cover the work order's
    56 cases and the review fixes.
  - Buyer chat: 69 of 69.
  - Two mutation checks confirm the key tests fail when the protection is removed:
    - Without the store header, a same-Account reply is stored as the Buyer's.
    - The S21-03 rule.
- **Lightweight gates:** all pass. They are mobile and locale typecheck, mobile lint, the locale
  test, `verify:deps`, `verify:docs`, `verify:mt-keys` and `verify:error-locale`.
- **Not run (resource order):**
  - the API, PostgreSQL and Docker, so no runtime probe;
  - Expo Doctor;
  - the export;
  - the full parallel `pnpm test`;
  - every native check.
- **Security review.** An independent read-only frontend review found no Critical, High or Medium
  issue. Both Lows and three of the five Info items were fixed, with tests. Two Info items need
  backend tests: whether the server honours the store header, and whether it checks that a
  conversation belongs to the store.

## Decisions for you

1. **May a phone use the Seller inbox? (W21-02)**
   - The November design and the permission catalogue say yes, for owners, admins and sales
     support.
   - ADU-API-01 v1.11 S12.7 says the Seller inbox is Console only.
   - Please confirm the design. The contract is then corrected to it, and the first runtime probe
     checks it.
   - Until then, the app shows "not available for your role" if the server refuses.
2. **What a store may see about a Buyer (W21-04).** Today a store sees "Buyer conversation" and a
   time only. A first name or a masked phone would need a privacy decision before any API change.
3. **Store-side wording for the "passed to the seller" line (W21-12).** The store currently sees the
   Buyer's sentence under "Automated answer". If wanted, approve a store-side sentence (with a human
   Amharic translation).
4. **Optional (W21-06).** Should Messages be hidden for roles that cannot use it (inventory,
   analyst, campaign)? Today they see it and get "not available for your role". Hiding it properly
   needs the server to publish each store's mobile capabilities.

## Storage and memory

| Point | Free RAM | Commit (GB) | C: free (bytes) | G: free (bytes) |
|---|---|---|---|---|
| Start | 0.72 GB | 36.63 / 44.54 | 25,799,540,736 | 3,353,380,651,008 |
| After coding | 1.74 GB | 36.77 / 44.54 | 25,769,861,120 | 3,353,358,630,912 |
| After tests | 1.80 GB | 37.26 / 44.54 | 25,760,497,664 | 3,353,353,388,032 |

- **Memory:** the page file stayed at 29,520 MB (not changed). No application was closed.
- **Generated:** 330,857 bytes of logs in `G:\AdulisDevelopment\WO-021\logs`. Two temporary backups
  used for the mutation checks were removed at once.
- **Removed or recovered:** nothing. No APK, build, bundle or Maestro artifact was produced.
- **Protected locations:** untouched.
- **Storage audit:**
  - Run at the end in dry-run mode (`G:\AdulisDevelopment\WO-021\logs\storage-audit-end.log`).
    Nothing was deleted.
  - The start used direct measurements.
  - It lists items that are not WO-021's for you to decide on: the Docker build cache (about 21 GB
    reclaimable inside its disk), about 2 GB of pip temp folders, older agent scratch, and
    `G:\w2`, `G:\wo001a` and `G:\w10a`.

## Recommended next Mobile work order

1. **WO-019, native verification**, on a machine with no other heavy program running. It covers the
   WO-018, WO-020 and WO-021 rows in the backlog, plus a short read-only probe of Seller Chat from
   a MOBILE session. That probe settles W21-02, W21-03, W21-11, S21-04 and S21-05.
2. **Next frontend feature: Seller Companion Order awareness.** It covers store notifications that
   open their Order, and an Order line summary once W20-07 publishes the line shape. It needs no
   new Chat decision.

In parallel, outside the mobile workstream:
- Chat response schemas (W21-01).
- Correct ADU-API-01 S12.7 to the design (W21-02).
- A backend negative test for a store reply's sender and for conversation ownership under the
  store header (S21-04, S21-05).
