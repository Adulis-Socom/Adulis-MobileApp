---
name: adulis-seller-companion
description: >-
  Implements and guards the Adulis Seller Companion inside the single mobile app. Use for seller-mode notifications, order detail, payment evidence/confirmation, inbox, mode switching, and any proposal to add seller functionality to mobile.
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
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — primary.
- `ADU-API-01_API_Contract_v1_3.md` — mobile-reachable endpoints.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_0.md` — surface permissions.
- `ADU-00_One_Page_Business_Model_v9_1.md` — one app/two modes and core-commerce doctrine.

## Phase-1 scope
Only these seller-mobile surfaces are required:
1. Notifications / notification centre with deep links.
2. Order detail: reservation/order info, payment evidence viewer, `Confirm Payment Received`, `Payment Not Received`, `Can't Fulfil`, mark ready, handoff status/QR.
3. Inbox: buyer conversations, manual replies, order context.
4. Buyer <-> Seller mode switcher.

Phase-2 candidates (dashboard/basic analytics/reviews/preferences) are evidence-gated; do not build them automatically just because PWA has them.

## Hard invariants
- There is no `Accept Reservation` action. Reservation never waits for seller acceptance.
- Payment action label is `Confirm Payment Received`, not `Accept Payment`; show the instruction to verify in the seller's own bank/payment account.
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
