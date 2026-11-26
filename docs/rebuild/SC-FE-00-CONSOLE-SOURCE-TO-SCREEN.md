# SC-FE-00 -- Seller Console source-to-screen reconciliation (route map, authorization, reuse, GAPs, SC-FE-01 plan)

Reused, not repeated: GOV-03 ledgers in `docs/rebuild/` (PROTOTYPE-TO-WORKORDER 121 rows, REUSE-LEDGER 71 rows incl.
the 38 Console rows C-01..C-38, T-02/T-03), GOV-06 fixture boundary, RBL-04 GAP register. Governing design:
ADU-CONSOLE-02 v4.3 effective edition (Nov 24 amendment first), ADU-ONB-01 v3.2, ADU-AUTH-02 v3.3, ADU-PRV-01 v3.3,
ADU-MKT-01 v3.3; founder layers RB25-D01..D14, B02-D03, B02B-D01..D03. The archived Console (`apps/console`,
106 tracked files, outside the active workspace) is evidence only; nothing is restored wholesale.

## 1. Route map (clean Console)
Seller context lives in the URL, never in mutable session state (CONSOLE-02 S14); every Seller API call carries the
Seller id. Destinations render only when the server supplies the capability (S22). Desktop >= 1024 px persistent
sidebar; below, bottom bar Home / Products / Inbox / More (S23, Orders removed, see section 4).

| Route | Screen / journey | Source | Work order | Status in this batch |
|---|---|---|---|---|
| `/sign-in` | phone entry | AUTH-02; CONSOLE-02 S10 | SC-FE-02 | BUILD (fixture) |
| `/sign-in/verify` | OTP entry; invalid, expired, retry, resend | AUTH-02; prototype `otp-fallback` | SC-FE-02 | BUILD (fixture) |
| `/sign-in/recovery` | account recovery entry | AUTH-02 | SC-FE-02 | BUILD (fixture) |
| `/sign-in/declarations` | required account-creation declarations | AUTH-02; PRV-01 | SC-FE-02 | BUILD (fixture) |
| `/sellers` | Seller chooser | CONSOLE-02 S14-S15; C-05 | SC-FE-01 (seam) / SC-FE-02 | BUILD |
| `/become-seller` | Seller type, social-business evidence, eligibility, admission/refusal | ONB-01 S9-S40; C-04, C-23 | SC-FE-02 | BUILD (fixture) |
| `/s/:sellerId` | Home: Publication Readiness Hub (pre-publication) or Daily Operations Brief (published), role-aware | CONSOLE-02 S29-S33; C-03 | SC-FE-03 (readiness items SC-FE-02) | BUILD |
| `/s/:sellerId/notifications` | Notification centre | CONSOLE-02 S119-S121; NOTIF-01; C-32 | SC-FE-03 | BUILD (read, fixture) |
| `/s/:sellerId/products` | Products and Inventory | CONSOLE-02 S47-S54; C-11..C-15 | SC-FE-04 | UNAVAILABLE state only |
| `/s/:sellerId/content` | Scenes | CONSOLE-02 S58-S70; C-37 | SC-FE-05 | UNAVAILABLE state only |
| `/s/:sellerId/content/stories` | Seller Stories | Nov 24 amendment item 2; supplemental Story contract; C-36 | SC-FE-05S | UNAVAILABLE state only |
| `/s/:sellerId/store` (+ `/couriers`) | Store profile, fulfilment, hours, closures, socials; Courier relationships | CONSOLE-02 S97-S109; B02B-D02; C-20..C-24 | SC-FE-06 | UNAVAILABLE state only |
| `/s/:sellerId/inbox` (+ `/automation`) | Inbox; scripted assistance | CONSOLE-02 S71-S82; CHAT-01; CHATBOT-01 (RB25-D09) | SC-FE-08 | UNAVAILABLE state only; chatbot requirements under founder review, not implemented |
| `/s/:sellerId/insights` | discovery insights (no revenue/GMV) | CONSOLE-02 S83-S89; ANL-01; C-16 | SC-FE-10 | UNAVAILABLE state only |
| `/s/:sellerId/settings` (+ `/team`, `/sessions`, `/notifications`, `/subscription`, `/privacy`, `/closure`) | Team and permissions, sessions, notification prefs, subscription status (Option B, no pricing), privacy and account closure | CONSOLE-02 S114-S118, S131-S132; PRV-01; C-26..C-30 | SC-FE-11 (subscription SC-FE-10) | UNAVAILABLE state only |
| `/s/:sellerId/trust` | Trust and Reviews reads | CONSOLE-02 S90-S93; C-17, C-18 | SC-FE-09 | UNAVAILABLE state only |
| (no route) | Orders, Order detail, preparation, handoff | CONSOLE-02 S34-S46 superseded by Nov 24 items 1 and 3 | SC-FE-07 internal demo only | ABSENT from ordinary navigation and release |

"UNAVAILABLE state only" = an intentional, non-interactive destination saying the area arrives later; no active control,
no fake data, no dead link (SC-FE-03 acceptance).

## 2. Authorization matrix (applicable now)
Roles OWNER, ADMIN, SALES_SUPPORT, INVENTORY, ANALYST, CAMPAIGN_MANAGER (CONSOLE-02 S17). The server's capabilities /
allowed_actions decide; role names only explain (S16-S19). Missing permission HIDES; missing entitlement shows a
disabled control with the reason (S19).

| Destination | OWNER | ADMIN | SALES_SUPPORT | INVENTORY | ANALYST | CAMPAIGN_MANAGER |
|---|---|---|---|---|---|---|
| Home (role-aware variant, S29) | brief | brief | messages/support | stock/catalogue | KPIs | content |
| Notifications | yes | yes | yes | yes | yes | yes |
| Products | yes | yes | read-only where granted | yes | no | read/tag-source |
| Content (Scenes, Stories) | yes | yes | no | no | no | yes |
| Store / Couriers | yes | yes | no | no (no Pool admin) | no | no |
| Inbox / Automation | yes | yes | Inbox | no | no | Automation config |
| Insights | yes | yes | no | no | yes | content analytics |
| Settings: team | yes | yes (no OWNER elevation) | no | no | no | no |
| Settings: ownership transfer, Seller closure | OWNER only, step-up | no | no | no | no | no |
In this batch the matrix is exercised through FIXTURE capabilities only; backend authorization is SC-BE-02 and is not
claimed verified.

## 3. Reuse decisions
| Asset | Decision |
|---|---|
| Fixture transport pattern (C-38, T-03 N1-N5) | REUSE PATTERN, re-implemented against GOV-06 (dev-only, build-time, no network, fail closed, `fx_` ids, banner) |
| Shell + Outlet keyed by Seller (C-35, #181) | REBUILD the pattern (key the Seller subtree by sellerId) |
| Chooser / SellerSwitcher (C-05) and #188 isolation + responsive cases (T-02) | REBUILD; cases carried as Playwright tests |
| State primitives (C-34, twelve states) | REBUILD against CONSOLE-02 S25 vocabulary |
| SignIn, BecomeSeller, Identity (C-01, C-04, C-23) | REBUILD as references; no Government ID |
| Home (C-03) | REBUILD; payout item and deferred obligations stay removed |
| Notification centre (C-32) | REBUILD; no paid-order templates |
| `@adulis/tokens`, `@adulis/locale` | REUSE (packages, CI-verified) |
| Orders, OrderDetail, PaymentEvidence, PaymentDecisions, HandoffQr, Payout, CourierScreen (C-06..C-10, C-25, C-33) | ARCHIVE; never imported |

## 4. Legacy assumptions removed
Reservation management; payment confirmation (Confirm Payment Received / Not Received); payment evidence / bank proof;
payout details and payout readiness; live paid Orders and the Orders destination; transactional metrics (revenue, GMV,
paid-order counts, completed deliveries, purchase-derived review counts, trust advancement, transactional deadlines).
CONSOLE-02 S30's "payment/provider onboarding" readiness item and S32 items 1-4 are deferred by the Nov 24 amendment
and are not rendered.

## 5. Missing contract register (frontend fixture contracts, provisional; GAP-RB-06 umbrella)
| GAP | Contract needed | Backend owner |
|---|---|---|
| GAP-SC-01 | phone OTP start/verify, resend, expiry, recovery, declarations, session | SC-BE-02 (AUTH-02) |
| GAP-SC-02 | account context: Seller relationships, roles, capabilities | SC-BE-02 |
| GAP-SC-03 | Seller creation, Seller type, social evidence, eligibility outcome + reason codes | SC-BE-03 (ONB-01) |
| GAP-SC-04 | publication readiness items + resolving actions | SC-BE-03 |
| GAP-SC-05 | Home brief cards (nonfinancial), alerts, obligations | SC-BE-03 / owning domains |
| GAP-SC-06 | notification list / unread count | SC-BE-06 (NOTIF-01) |
| GAP-SC-07 | Market context (Ethiopia, market-local timezone) | SC-BE-03 (MKT-01) |
Fixture contracts live in the Console under a provisional, versioned module named for these GAPs; they are never
written into `contracts/openapi.json` or `packages/api-client` (generated files).

## 6. SC-FE-01 implementation plan
1. Replace `apps/console` with a clean React + Vite app (archived files deleted from the active tree, evidence kept at
   the archive tag); add it back to `pnpm-workspace.yaml`; rewrite `apps/console/CLAUDE.md` (keep the 15 denials).
2. Router with URL Seller context; session boundary; Seller-context boundary keyed by sellerId; chooser + switcher.
3. Transport port (GOV-06): live = generated client (foundation endpoints only); fixture = dev-only dynamic import,
   typed provisional contracts, `fx_` ids, Demonstration-data banner, fail-closed refusals.
4. Shell: sidebar >= 1024 px, bottom bar + More below; top bar per S24; role/capability-driven destinations.
5. Primitives from `@adulis/tokens`: buttons (one lime highlight per screen, dark text), state panels for S25 states,
   skeletons, problem banner (message_key + slots via `@adulis/locale`).
6. Tests: unit (transport, isolation reducers); Playwright in CI: isolation RN-4, release-negative RN-1/RN-2/RN-3/RN-6,
   responsive 320/360/390/768/1024/1440 plus 150%/200% text, axe accessibility, screenshots as artifacts.
7. CI: a separate `console` job in `rebuild-ci.yml`; foundation job unchanged.
