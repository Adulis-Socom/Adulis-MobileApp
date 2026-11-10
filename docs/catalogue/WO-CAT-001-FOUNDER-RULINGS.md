# WO-CAT-001 -- Founder rulings of 10 November 2026

Source: the founder's WO-CAT-001 work order, section 5 ("NEW FOUNDER APPROVALS -- 10 NOVEMBER
2026") and section 6 (hotspot deferral). These approvals are authoritative for WO-CAT-001. They do
not amend any governed document; where a governed document must change, the document-governance
process applies. The nine WO-DISC-002A decisions in
`docs/discovery/FYP_FOUNDER_DECISIONS_2026-11-10.md` are untouched and remain PENDING.

Each ruling separates four things: the approved product direction, what WO-CAT-001 implemented,
the technical requirements still open, and the legal/privacy conditions still open.

## OVN-072 -- Product price presentation: APPROVED

**Approved direction.** Show actual current Variant prices. When the ACTIVE Variants differ, show
the minimum-maximum range ("ETB 900 - ETB 1,200"); when they are equal, one amount. Never present
`base_price_minor` as the current selling price. This concerns presentation only: it does not
change Variant stock eligibility or payment amounts.

**Implemented.** One shared public price projection (ACTIVE Variants, integer minor units, the
Market's currency) serves the Product detail, Storefront list, Seller-scoped search, post-link
resolution and Scene tags. No public read presents the seed as a price; the seed fields stay in
responses for compatibility, described as seeds. A Product with no ACTIVE Variant, or whose ACTIVE
Variants are not all priced in the Market's currency, has no current price (null), never a fallback.
The range is computed over ACTIVE Variants regardless of stock, as approved; stock is reported
separately per Variant.

**Remaining technical requirements.** The database does not constrain a Variant's currency to its
Market; the projection refuses to merge currencies, but the write path should reject them
(registered). An "available-from" price is a separate future presentation decision; not built.

**Legal/privacy conditions.** None.

## OVN-073 -- Product view measurement: MEASUREMENT PRINCIPLE APPROVED; implementation and privacy approval OPEN

**Approved direction.** A deliberate Product opening and a technical revalidation are different
events. A Buyer refreshing Product data must not automatically increase the Product's genuine view
count. The target is genuine Product-detail visits under a defined, de-duplicated boundary. The
approval is not permission to invent retention periods, profiling policies or attribution windows.

**Implemented.** See WO-CAT-001-PUBLIC-READ-INTEGRITY.md sections 15-16. In short: the server no
longer records a `product_viewed` for a Product read that the client declares a technical
revalidation; the Buyer app declares every pull, background-return and screen revalidation, and
never its first open. The declaration can only withhold an event, never create one. No new event,
identifier, window, retention period or storage was introduced.

**Remaining technical requirements.** The governed deliberate-open event is ANL-01's
`product_post_opened` (CLIENT producer). It is not in `analytics.event_definition`, not in the
API-01 closed client allow-list, and `analytics.event` has no `client_event_id` for ANL-01's
de-duplication. Building it needs a registry entry, a contract change and a dedup key; the exact
specification is prepared in the integrity record, gated. Until then `product_views` remains a count
of server-recorded Product openings, not unique visitors.

**Legal/privacy conditions (OPEN).** DPIA-01 PA-23 measurement basis "not approved"; raw-event
retention "LEGAL REVIEW REQUIRED" (PRV-01 :1388, DPIA-01 :448); user notice not provided (DPIA-01
:1573). No new tracking may be enabled until these close.

## OVN-080 -- Mobile routes: PROVISIONAL ROUTE DECISION APPROVED; final URL scheme OPEN

**Approved direction.** Keep `/scenes/:scenePostRef` and `/product/:handle/:slug` for current Mobile
development. Do not redesign them in WO-CAT-001.

**Implemented.** Routes unchanged. Market scoping was achieved without any route or URL change (the
requester's Market is derived server-side), so no competing URL format was created.

**Remaining technical requirements (release dependency).** The final public Universal Link and Web
URL scheme must be standardised across Mobile, Seller Storefront and Company Website before launch,
including how an anonymous web visitor's Market is carried when two Markets share a handle (see
OVN-016/OVN-077).

**Legal/privacy conditions.** None.

## OVN-081 -- Unavailable content: APPROVED

**Approved direction.** Neutral Buyer-facing messages ("This Scene is no longer available.", "This
Product is no longer available."), never disclosing whether the content was unpublished, made
PRIVATE, moderated, restricted, removed, or never existed.

**Implemented.** Unchanged and preserved: every non-public answer is the same bare 404, including
the new cases WO-CAT-001 adds (another Market's Seller, an ambiguous handle, an inactive Market).
The Buyer app shows only the neutral message.

**Remaining technical requirements.** None.

**Legal/privacy conditions.** None.

## Hotspots (OVN-006): DEFERRED to the Seller Console development phase

No MediaPresentation, coordinate storage, hotspot API, authoring, overlay or placement calculation
was built. The numbered Product list in Explore the Scene stays the whole selection surface.
