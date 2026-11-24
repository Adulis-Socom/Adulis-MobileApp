---
name: adulis-seller-companion
description: >-
  Implements and guards the Adulis Seller Companion inside the single mobile app. Use for seller-mode notifications, order detail, inbox, mode switching, any proposal to add seller functionality to mobile, and any proposal to build seller payment confirmation (stale since WO-001C: block it).
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.1.0"
---

# Adulis Seller Companion


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Console is current workstream; resume Companion only in Mobile tier. Real messaging/notifications and authorized nonfinancial capabilities follow current MOB/AUTH; order/preparation/QR/handoff/courier journeys internal simulations until payment decision. No Story authoring, billing, payout or payment actions. Mode eligibility backend-owned; no reauthentication solely on switch.

## Governing sources (legacy executable references unless noted)
- **Current system design (founder decision WO-001B):** `ADU-MOB-02_v4.3.md` (S232 is its reconciliation) and `ADU-AUTH-02_v3.3.md`, in `docs/system-designs/2026-11-08/Sources/Markdown/`. They outrank the repository documents below for design intent (`DOCUMENT_AUTHORITY.md`).
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — primary repository document.
- `ADU-API-01_API_Contract_v1_11_ASCII.md` — mobile-reachable endpoints (the S12 `M` markers).
- `ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md` — authentication; v2.5 for the surface permissions.
- `ADU-00_One_Page_Business_Model_v9_1.md` — one-app and core-commerce doctrine.
- Founder decision (WO-001, recorded in `apps/mobile/CLAUDE.md`): one app with Buyer, Seller Companion and Courier as sibling modes. It widens the app, not the Companion: this skill's scope and invariants are unchanged.

## MVP scope

After Console tier: notifications, messaging and backend-asserted mode switching. Order/preparation/handoff journeys are internal simulations until payment authority is approved. Apply current domain permissions and named work orders.

## Hard invariants
- There is no `Accept Reservation` action. Reservation never waits for seller acceptance.
- No Seller payment action under any label.
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
