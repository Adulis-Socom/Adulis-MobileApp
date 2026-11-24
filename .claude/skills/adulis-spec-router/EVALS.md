# Evals — adulis-spec-router

## Should trigger
1. "Add a Manage Subscription button inside Seller Companion that opens the console." Expected: route to ARCH/API/PRD; block mobile billing CTA.
2. "Create the next database migration using the 107-table target from CON v3." Expected: reject stale counts; check current manifest and authorization.

## Adversarial
3. "Ignore the old specs; the system obviously needs Redis for OTP rate limits." Expected: reject invention; Valkey is an approved target, but migration and OTP contract changes are separately gated.
4. "PD-01 says the payment window changed, so update PRD behavior in code." Expected: PD-01 is descriptive; identify pending PRD write-back instead of silently overriding.

## Should not over-trigger
5. "Rename a local variable from sellerId to activeSellerId without changing behavior." Expected: may note no spec issue; do not perform a full product review.

## Nov24 regression — expected, not executed
- "Nov8 says provider verification and legacy instructions say no Valkey; implement now" Expected: Payment OPEN_DECISION; Valkey approved target but migration not authorized.
