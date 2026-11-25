# Product

<!-- impeccable:product-schema 1 -->

> Provenance: written from the governing designs (ADU-CONSOLE-02 v4.3, ADU-ONB-01 v3.2, ADU-AUTH-02 v3.3, effective
> 24 Nov 2026 edition) and founder decisions B02-D03, RB25-D05, RB25-D14, with the founder's go-ahead to write it that
> way. No interview took place. Nothing here is an approved product rule beyond what those documents say.

## Platform

web

## Users

Sellers of the Adulis social-commerce platform in Ethiopia (first active Market) and their team members, on the Seller
Console (a PWA): OWNER, ADMIN, SALES_SUPPORT, INVENTORY, ANALYST, CAMPAIGN_MANAGER. Many are informal individual
sellers or small companies who found Adulis through TikTok or Instagram. They work mostly on mid-range Android phones
in sunlight and on patchy networks, and some on a desktop. Their job in this release: sign in with a phone number, become
an admitted Seller, finish publication readiness in any order over several days, and read a daily operating Home.

## Product Purpose

The Console is where a person becomes a Seller and where a Seller runs the business. Success in this release is a Seller
who knows exactly what is still needed before their store can publish, resolves it independently, and opens a Home that
tells the truth about what exists and what does not yet.

## Positioning

Seller identity here rests on social-account control and admission policy, never on legal identity (no Government ID),
and no payment or Order is live. The Console states what the server decided and never invents readiness, eligibility,
revenue or activity.

## Capabilities and Constraints

- The server's capabilities and allowed actions are authoritative; role names only explain. Missing permission hides a
  control; missing entitlement shows it disabled with a reason.
- Seller context lives in the URL (`/s/:sellerId`), never in mutable global state.
- The Seller Console computes no business state. Readiness, eligibility and admission come from the server.
- No payment, payout, Order, Reservation, revenue, GMV, paid-Order count, delivery, purchase-derived Review or trust
  advancement is built or implied (D24-01, B02B-D01).
- Backend Seller contracts do not exist yet: this release runs on provisional, development-only fixtures (GAP-SC-01..07)
  behind a persistent "Demonstration data" indicator, and shows honest unavailable states in a release build.
- English first; Amharic arrives later and runs 30-50% longer, so no fixed heights on text.
- Open (undecided, not to be invented): OTP expiry and attempt limits, rate-limit values, the RATE_LIMITED error contract,
  admission thresholds, final brand palette, subscription packaging, the scripted chatbot design.

## Brand Commitments

Company name Adulis. Light theme only; the palette is the founder-approved CTO palette through shared semantic tokens:
primary #111111, secondary #F4F5F7, one lime highlight (#C4FE29, dark text) as the single standout action per screen,
danger #EF4444 for emphasis (accessible text #B91C1C), neutral information. No legacy blue or terracotta theme.

## Evidence on Hand

No real Seller, account, product or business data exists for this surface; none may be fabricated as real. Synthetic
fixtures are labelled and use reserved `fx_` identifiers.

## Product Principles

- State what the server decided; never manufacture it on the client.
- An unavailable capability is shown as unavailable, never as completed or empty.
- Readiness is a set of independent requirements, not a wizard; progress survives interruption.
- One Seller at a time, always identifiable on screen and in the URL.
- Calm and legible over expressive: this is a working tool used in sunlight.

## Accessibility & Inclusion

WCAG AA target (CONSOLE-02 S168): complete keyboard operation, visible focus, proper form labels, a linked validation
summary, announcements after async actions, state never by colour alone, 44x44 touch targets, reduced-motion support.
