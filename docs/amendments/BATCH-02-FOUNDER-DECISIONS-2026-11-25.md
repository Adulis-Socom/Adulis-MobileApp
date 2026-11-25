# Batch 02 founder decisions -- addendum of 25 November 2026

Status: founder decisions recorded for the MVP build stage. Working authority, not a signed
board, legal or licensing approval. It does not authorise any code, database or infrastructure
change by itself; each change needs its own work order. It does NOT alter the November 8 pack,
the November 24 decision register (D24-01..D24-18), or any historical record. Identifiers below
are new and unique (B02-D01..B02-D05).

Order of authority is unchanged: the latest explicit founder decision, then the November 24
register and amendments, then the November 8 reconciled pack, then compatible prototype UX, then
historical specifications and existing code as evidence of what is built.

## Decisions

### B02-D01 -- Subscription Option B
Keep the subscription architecture: plan definitions, subscription status, entitlement
resolution and the legitimate non-financial capability management. DISABLE every
payment-collection action: purchase, manual bank-transfer billing, payment instructions,
purchase intents, "mark transferred", transfer confirmation, paid upgrades. No Seller may
activate a paid entitlement by manipulating the frontend. Do not invent plan pricing, trial
lengths, entitlement limits or free-tier policy; where a commercial value is missing, show an
unavailable state and register the gap. Supersedes the "Subscription ... remains open" wording
of the Batch 01 notes and of the 24 November skills refresh.

### B02-D02 -- Payout Option A
Payout is deferred entirely. Remove Payout from active MVP navigation and block direct-route
access to bank-account collection, editing and disclosure. Preserve existing database records,
historical code and the financial security controls; delete nothing; add no replacement
financial workflow. A Seller is not required to supply payout information to complete otherwise
valid non-financial onboarding or readiness. If the existing backend readiness contract demands
it, record a contract gap; do not fabricate readiness or weaken authorization. Supersedes the
"payout scope remains open" wording of the Batch 01 notes and of the skills refresh.

### B02-D03 -- CTO palette supersedes the prototype theme
The CTO palette is the governing visual direction: primary #111111, secondary #F4F5F7, accent
#C4FE29, danger/like #EF4444, gray #7E8494, border #E5E7EB, background #F5F5F7, delivered through
the shared semantic-token package. The earlier prototype theme (the terracotta "Baseline" light
palette) is superseded as a current requirement; a prototype screen that uses it is evidence of
layout and interaction only. The base colors are preserved, not replaced.

### B02-D04 -- Accessibility-derived variants (authorised proposals, subject to measurement)
White surface #FFFFFF; accessible secondary text #5B6272; accessible danger text #B91C1C; dark
foreground #111111 on lime; stronger interactive-control boundaries where the #E5E7EB border
would be the only cue. Each is adopted only after a measured contrast result is recorded
(WCAG AA text, non-text contrast for control boundaries). Measured on 2026-11-25 (see
`.claude/skills/adulis-design-system/SKILL.md`): #7E8494 text and #EF4444 text fail 4.5:1 on the
page and white backgrounds; #E5E7EB is decorative only. Shared-token changes ship in their own
PR (work order DS-TOK-01).

### B02-D05 -- Batch 02 work orders and dependencies
Sequential: INT-01 (integrate #180, #182, #181) -> GOV-SKILL-01-CLOSE -> GOV-DESIGN-01 (this
addendum) -> SC-SAFE-01 (financial containment, frontend) -> DS-TOK-01 (tokens, own PR) ->
SC-FE-01-CLOSE -> CI-FIXTURE-01 -> SC-FE-02 (sign-in, onboarding, readiness) -> SC-FE-03
(dashboard). Dependencies: SC-FE-02 needs SC-SAFE-01 (no payout or payment step may enter
onboarding) and SC-FE-01-CLOSE; SC-FE-03 needs SC-FE-02; the Console token consumption needs
DS-TOK-01. Stop after SC-FE-03. Technology migration, backend stages, Mobile, Storefront,
Operator, payment, Stories implementation and Scene authoring are NOT authorised by this batch.

## Boundaries that do not change
No payment provider, Seller payment confirmation or rejection, payment evidence, refund,
settlement, credential, surcharge or real paid Order. Checkout stays Option A (real Cart and
review, no submission) plus Option C (isolated development-only simulation). Payment authority
stays unresolved (D24-01). Frontend containment of the legacy financial surfaces does not
contain the API: backend containment is a separate, unauthorised work order (see the Batch 02
financial containment report).
