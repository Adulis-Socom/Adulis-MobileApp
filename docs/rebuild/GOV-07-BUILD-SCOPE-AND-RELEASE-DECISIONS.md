# GOV-07 -- Build scope and release decision (clean rebuild)

Status: the BUILD TARGET for the replacement lineage. **It is not a launch authorisation.** The initial public
release requires the founder's separate go/no-go (REL-08); nothing here, and no passing gate, implies it.

## 1. Scope matrix
| Area | Build target (in) | Simulation only (isolated demo, never release) | Deferred (separately gated) | Excluded |
|---|---|---|---|---|
| Seller Console | sign-in/OTP, chooser, becoming a Seller, social-business evidence, eligibility, readiness (no payout gate), daily Home, Products/Variants/stock, Scenes, Seller Stories, store settings and coverage, Courier invitations and relationships, Inbox and allowed scripted help, truthful trust facts and Review reads, discovery metrics, subscription plans/status (no purchase), team/roles/sessions/step-up/ownership/closure | internal Order UX (ADU-ORDER-01, SC-FE-07), payment-related Claim demo (if needed) | live Orders, payment confirmation, payout, refunds, purchased Reviews, Claims (P2-01..03) | - |
| Mobile | Buyer: five Home channels, Scene-only For You, Explore, Search/Shop, Product/Scene detail, Collections, Likes on Scenes, follow, share, report entry, Seller Stories row/viewer, Seller-separated editable Cart, Checkout review A (server quote, no submit), account/privacy/notifications; Seller Companion: urgent stock, Inbox, notifications, mode switch; Courier: verified availability and relationships | Checkout C (payment-return/paid-Order fixtures), handoff QR/OTP screens, Courier offers/one-active-delivery/history, purchase-based Review/Claim writes | live submit, Orders, holds, delivery, purchased Reviews/Claims (P2-02, P2-03) | - |
| Storefront | anonymous SSR Seller profile, Product, Scene, seller-local Search, deep links and app handoff, SEO and removed-content handling | - | web checkout (never in MVP) | Company Website |
| Operator | separate Founder identity (CEO and COO/CTO, WebAuthn), queues and leases, purpose-bound search, moderation of Products/Scenes/Stories/Reviews/Messages, recovery/privacy requests, Founder two-person approval, bounded Solo Coverage, config proposals and audit | payment-related decisions and manual handoff cases (gated) | Staff Operator activation (P2-06; model built, flag off) | CMO Operator account |
| Platform | one backend (NestJS/Fastify), PostgreSQL/Drizzle clean lineage, BullMQ/Valkey + durable outbox, generated contracts, semantic tokens, English locale | - | Amharic public release (P2-05), Market expansion (P2-07), Creator actor (P2-04) | BFFs, microservices, Kubernetes, JWT sessions, Elasticsearch |

## 2. Data ownership (replacement lineage)
Each table and event belongs to one domain owner module in the single API; clients read and write only through
that owner's generated API. Owners follow the designs: identity/sessions (AUTH-02), Seller admission and
readiness (ONB-01), Market and coverage (MKT-01), catalogue and stock ledger (CATINV-01), Scenes (SCN-01),
Stories (STORY contract), media (MEDIA-01), messaging (CHAT-01), notifications (NOTIF-01), trust and reviews
(TRUST-01, REV-01), privacy (PRV-01), moderation and Operator cases (MOD-01, OPS-01), events/outbox (EVT-01).
The legacy database stays owned by the founder and is outside the replacement (RB25-D02). Synthetic seed data
only; no real data copied.

## 3. Report intake
Real report intake (Buyer reporting a Product, Scene, Story, Review or message) is switched on only when the
Operator case flow that handles it is integrated (OP-BE-03, verified in OP-BE-07). Until then the Mobile and
Storefront report entry points show an honest unavailable state (MOB-BE-07).

## 4. Launch-readiness risks (carried; owners are the founder unless stated)
| ID | Risk |
|---|---|
| LR-01 | Deployment exposure UNKNOWN: Render staging existence and deployed SHA cannot be verified here (B2-002); main still carries every legacy route |
| LR-02 | The legacy local database holds commerce rows; any retirement needs disposition, backup and tested restore (PL-001) |
| LR-03 | Subscription-debt and account-deletion policy not finalised; affected behaviour gated (RBL-03) |
| LR-04 | No human Amharic review; Amharic stays non-public |
| LR-05 | Physical Android/iOS testing, load and accessibility audits not yet possible (REL-06) |
| LR-06 | Development machine runs below the 2 GB RAM floor; heavy verification depends on CI (B2-010) |
| LR-07 | Operator report handling must exist before real report intake (section 3) |

## 5. Go/no-go and open decisions
Go/no-go owner: **the founder** (REL-08), on evidence from REL-01..REL-07. Open decisions (each blocks only its
affected work): OD-01 payment authority and provider (P2-01); OD-02 subscription-debt and deletion policy
(RESOLVED for the initial MVP by RB25-D11: debt-free); OD-03 Staff Operator activation; OD-04 public Amharic; OD-05 further Market activation; OD-06 owner of
ADU-CHATBOT-01 (RESOLVED, RB25-D09); OD-07 Mobile messaging order (RESOLVED, RB25-D10); OD-08 disposition of the legacy
local database (PL-001); OD-09 whether the inert legacy tables are ever dropped in the legacy lineage (PL-006,
irrelevant to the replacement).
