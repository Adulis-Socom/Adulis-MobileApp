---
name: adulis-seller-companion
description: >-
  Implements and guards the Adulis Seller Companion inside the single mobile app. Use for seller-mode notifications, order detail, inbox, mode switching, any proposal to add seller functionality to mobile, and any proposal to build seller payment confirmation (stale since WO-001C: block it).
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.0.0"
---

# Adulis Seller Companion


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- **Current system design (founder decision WO-001B):** `ADU-MOB-02_v4.3.md` (S232 is its reconciliation) and `ADU-AUTH-02_v3.3.md`, in `docs/system-designs/2026-11-08/Sources/Markdown/`. They outrank the repository documents below for design intent (`DOCUMENT_AUTHORITY.md`).
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — primary repository document.
- `ADU-API-01_API_Contract_v1_11_ASCII.md` — mobile-reachable endpoints (the S12 `M` markers).
- `ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md` — authentication; v2.5 for the surface permissions.
- `ADU-00_One_Page_Business_Model_v9_1.md` — one-app and core-commerce doctrine.
- Founder decision (WO-001, recorded in `apps/mobile/CLAUDE.md`): one app with Buyer, Seller Companion and Courier as sibling modes. It widens the app, not the Companion: this skill's scope and invariants are unchanged.

## Phase-1 scope

> **K-1, payment — founder direction ruled at WO-001C: do not build the payment items in
> item 2 or the payment invariant below.** Payment authority is provider/backend verified,
> and the Seller never establishes PAID by confirming payment (FIN-01 v3.3 S129, MOB-02
> v4.3 S146, R-12). The payment evidence viewer, `Confirm Payment Received` and `Payment
> Not Received` are the built manual-transfer model, now legacy drift. They stay in the
> backend until WO-PAY-001 migrates it, and nothing new is built on them. Today they are
> also the only route into `PAYMENT_CONFIRMED`, so Mark Ready and the handoff QR sit
> behind them. The rest of this scope also differs from ADU-MOB-02 v4.3 S224 (Prepare,
> Courier offer, urgent stock, Claim summary, Pickup credential, and role sets narrower
> than the built ones): see gaps SC-1 to SC-12 in `docs/mobile/WO-001C-CONTRACT-GAPS.json`
> (narrative: `WO-001C-CONTRACT-READINESS.md` S8) before building any of it.

Only these seller-mobile surfaces are required:
1. Notifications / notification centre with deep links.
2. Order detail: reservation/order info, payment evidence viewer, `Confirm Payment Received`, `Payment Not Received`, `Can't Fulfil`, mark ready, handoff status/QR.
3. Inbox: buyer conversations, manual replies, order context.
4. Mode switcher across the account's available modes (Buyer, Seller Companion, Courier). Switching never re-authenticates and never shows a mode the backend has not asserted.

Phase-2 candidates (dashboard/basic analytics/reviews/preferences) are evidence-gated; do not build them automatically just because PWA has them.

## Hard invariants
- There is no `Accept Reservation` action. Reservation never waits for seller acceptance.
- ~~Payment action label is `Confirm Payment Received`~~ **Stale (K-1, WO-001C):** the Seller does not confirm payment, so no seller payment action is built under any label.
- Companion is additive; Buyer Mode loses no capability.
- No payout changes, reissued payment instructions, team changes, subscription purchase, seller deletion, session revocation, identity/verification changes, ownership changes, or account-control phone changes are reachable from mobile.
- No price, tier name, `upgrade`, `manage subscription`, purchase link, billing CTA, or billing deep link appears anywhere in the mobile bundle.
- Where a capability is configured elsewhere, say it is configured in Seller Console without naming a tier or purchase path.
- Core commerce is never paywalled.

## Workflow
1. Check requested action against Companion vs PWA verb boundary.
2. Check endpoint has MOBILE surface permission.
3. Build from server-resolved state and generated types.
4. Include low-bandwidth/offline handling and push deep-link safety.
5. Search the entire touched mobile bundle for prohibited billing language before merge.

## Output contract
```text
SELLER COMPANION REVIEW
Requested capability:
Phase/scope:
Mobile allowed: YES/NO
API endpoint + MOBILE permission:
UI action label:
Sensitive-data handling:
Billing/IAP scan:
PWA handoff if not mobile:
Verdict:
```
