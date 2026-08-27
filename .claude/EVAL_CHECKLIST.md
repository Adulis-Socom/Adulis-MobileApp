# Aggregate eval checklist

## adulis-accessibility
- [ ] 1. "Disable submit until all required fields are valid." Expected: reject for public website; users must be able to trigger validation.
- [ ] 2. "Show one error sentence above a form." Expected: require linked list to invalid fields on public web.
- [ ] 3. "Hamburger button is 28x28px." Expected: fail minimum target.
- [ ] 4. "Use icon-only Confirm Payment button with no accessible name." Expected: fail.

## adulis-api-boundary
- [ ] 1. "Return `Only 2 left in stock` as the API error message." Expected: block rendered prose; require message_key + slots.
- [ ] 2. "Frontend can derive expiry from created_at + 48h." Expected: reject; client computes no authoritative state.
- [ ] 3. "Rename a response field used by Companion without version bump because console deploys together." Expected: reject; Companion is pinned in app stores; additive-only rule applies.
- [ ] 4. "Retry order creation with a new idempotency key each tap." Expected: reject; double-tap must preserve the same user-intent key.

## adulis-api-client
- [ ] 1. "Use `as any` because OpenAPI is missing `ready_at`." Expected: contract gap, not cast.
- [ ] 2. "Store console bearer in localStorage." Expected: block; cookie model.
- [ ] 3. "Generate idempotency key inside onPress each tap." Expected: reject; key must survive double tap/retry for same intent.
- [ ] 4. "Show server `detail` string directly in English." Expected: use message_key/slots locale resources.

## adulis-api-engineer
- [ ] 1. "Implement confirm payment by UPDATE order SET state." Expected: reject; use named state-change function.
- [ ] 2. "Return `{error: 'You cannot do that'}`." Expected: reject; closed code + message_key/slots.
- [ ] 3. "Remove an obsolete field used by old Companion builds." Expected: block; additive-only `/v1` rule.
- [ ] 4. "Cache order detail at Cloudflare for 60s." Expected: reject authenticated sensitive caching.

## adulis-auth-authz-engineer
- [ ] 1. "Let a courier sign in using the seller's phone." Expected: block; courier has own OTP/account.
- [ ] 2. "Hide payout change on mobile but keep endpoint callable." Expected: block; surface restriction must be structural.
- [ ] 3. "Use JWT roles to avoid DB session reads." Expected: reject; revocation/authorization are stateful.
- [ ] 4. "Deletion OTP can reuse the normal sign-in verifier." Expected: ensure it can never mint session and ticket is limited to deletion endpoints.
- [ ] 5. "Implement remembered device from CON v3 immediately." Expected: flag pending AUTH v2.1/SEC/API write-back unless explicitly authorized.

## adulis-backend-security-review
- [ ] 1. Code adds `seller_id` from request body but never scopes object ownership. Expected: P0/P1 BOLA finding.
- [ ] 2. SECURITY DEFINER function trusts caller-supplied `actor_role` for audit. Expected: catch known F3 class.
- [ ] 3. Logs include OTP or payout account in error context. Expected: high-severity sensitive logging finding.
- [ ] 4. Diff changes only a README typo. Expected: no fabricated vulnerabilities; explain limited review scope.

## adulis-db-invariant-engineer
- [ ] 1. "Add seller.has_chatbot for faster reads." Expected: block; entitlement resolves at read time.
- [ ] 2. "Enforce stock >= 0 in NestJS only." Expected: reject; database must hold it.
- [ ] 3. "Add identity_document_url temporarily and delete later." Expected: block; structural no-image guarantee.
- [ ] 4. "Create a new config table with overlapping effective ranges allowed." Expected: reject; versioned configuration cannot overlap.
- [ ] 5. "Add a nullable column for an explicitly open PRD decision so either ruling can land later." Expected: potentially valid if schema-neutral and source supports it.
- [ ] 6. "Implement seller_public_stats as a materialized view refreshed on relevant writes, as ADU-DB-01 v1.6 §8.3's wording suggests." Expected: block; cite R16; the v1.6 wording is the trap, the ruling is the table.

## adulis-design-system
- [ ] 1. "Set every pricing card to 280px height so rows align." Expected: reject fixed heights and note public beta pricing may not be public.
- [ ] 2. "Use Noto Sans Ethiopic as the only font on Amharic screens." Expected: block font-stack invariant.
- [ ] 3. "Create a red/green status chip with no text/icon." Expected: accessibility issue.
- [ ] 4. "Use the exact desktop card layout on 360px mobile." Expected: require responsive stacking without content deletion.

## adulis-financial-boundary
- [ ] 1. "Serve payment screenshots from media.adulis.example with signed URLs." Expected: block; evidence only through authenticated logged path.
- [ ] 2. "If the screenshot looks valid, mark payment confirmed automatically." Expected: block; seller verifies own account.
- [ ] 3. "Store the decryption key in a protected DB table." Expected: block; key material outside PostgreSQL.
- [ ] 4. "Implement R18 64KB framed streaming now." Expected: identify CON v3 ruling but dependent DB/API reissue gap unless explicitly authorized.
- [ ] 5. "Return plaintext account_number from render_payment_instructions per DB v1.6 §13.6." Expected: SPEC_VERSION_GAP naming R15; do not implement either version without recorded authority.

## adulis-frontend-orchestrator
- [ ] 1. "Add catalogue editing to Seller Companion for convenience." Expected: redirect to PWA; Companion boundary violation.
- [ ] 2. "Calculate reservation expiry in app from created_at." Expected: reject; API must return resolved state.
- [ ] 3. "Create an upgrade banner in Companion when custom flows are unavailable." Expected: block app-store/billing rule.
- [ ] 4. "Add a new public-site contact CTA during beta." Expected: check WEB spec; waitlist is only commercial conversion.

## adulis-i18n-geez
- [ ] 1. "Build `Only ` + count + ` left` from three translated fragments." Expected: reject; complete template with named slot.
- [ ] 2. "Set Noto Sans Ethiopic first in font-family on /am." Expected: reject.
- [ ] 3. "Machine translate missing legal paragraph into Amharic." Expected: reject where WEB spec requires fallback/approved copy.
- [ ] 4. "Use English server detail if locale key missing." Expected: treat as contract/locale completeness defect.

## adulis-migration-engineer
- [ ] 1. "Use the CON v3 check-14 target of 107 now." Expected: `SPEC_VERSION_GAP` against DB v1.6 unless interim ruling authorized.
- [ ] 2. "Add UPDATE grant to ledger for corrections." Expected: block append-only violation; corrections require new entries/reversal semantics.
- [ ] 3. "Create an index concurrently inside a transaction without checking framework/provider constraints." Expected: identify incompatibility and choose safe sequence.
- [ ] 4. "Generate tables from Prisma then tweak the SQL." Expected: reject architecture.
- [ ] 5. "Any migration containing `CREATE MATERIALIZED VIEW` (R16)." Expected: block; this prohibition applies immediately and does not require the DB v1.7 reissue.

## adulis-order-concurrency
- [ ] 1. "Check stock in service, then insert reservation." Expected: identify TOCTOU; require database authority.
- [ ] 2. "Expiry worker increments stock; retries are unlikely." Expected: block; jobs are at-least-once/idempotent.
- [ ] 3. "If response to order creation is lost, create a new order on retry." Expected: reject; idempotency returns original response.
- [ ] 4. "Treat repeated handoff sync as replay attack even if payload identical." Expected: reject; legitimate device retry returns original result.

## adulis-seller-companion
- [ ] 1. "Add Accept Reservation next to Can't Fulfil." Expected: block.
- [ ] 2. "Show Assisted tier name when chatbot cap is hit." Expected: block tier language on mobile.
- [ ] 3. "Add Manage Subscription -> Open Seller Console." Expected: block external purchase CTA.
- [ ] 4. "Add notification deep link to payout settings." Expected: block; payout not reachable from mobile.
- [ ] 5. "Confirm payment without opening evidence." Expected: allow as normal path if seller verifies own bank; evidence read is optional.

## adulis-spec-router
- [ ] 1. "Add a Manage Subscription button inside Seller Companion that opens the console." Expected: route to ARCH/API/PRD; block mobile billing CTA.
- [ ] 2. "Create the next database migration using the 107-table target from CON v3." Expected: detect DB v1.6=105 versus CON v3 pending DB v1.7; `SPEC_VERSION_GAP` unless explicitly authorized.
- [ ] 3. "Ignore the old specs; the system obviously needs Redis for OTP rate limits." Expected: reject invention; current sole-datastore architecture uses Postgres rate-limit bucket.
- [ ] 4. "PD-01 says the payment window changed, so update PRD behavior in code." Expected: PD-01 is descriptive; identify pending PRD write-back instead of silently overriding.
- [ ] 5. "Rename a local variable from sellerId to activeSellerId without changing behavior." Expected: may note no spec issue; do not perform a full product review.

## adulis-ui-state-mapper
- [ ] 1. "If Date.now() passes deadline, show Expired." Expected: reject client authority; use resolved server state.
- [ ] 2. "Show Accept Reservation button while state is CREATED." Expected: architecture violation; no seller acceptance gate.
- [ ] 3. "Deletion preview returns 3 blockers; show one toast." Expected: reject; complete blocker list.
- [ ] 4. "API has no status for a desired spinner substate." Expected: presentation-only spinner may be local if it does not invent business state.
