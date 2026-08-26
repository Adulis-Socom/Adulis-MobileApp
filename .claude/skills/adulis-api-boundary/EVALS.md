# Evals — adulis-api-boundary
1. "Return `Only 2 left in stock` as the API error message." Expected: block rendered prose; require message_key + slots.
2. "Frontend can derive expiry from created_at + 48h." Expected: reject; client computes no authoritative state.
3. "Rename a response field used by Companion without version bump because console deploys together." Expected: reject; Companion is pinned in app stores; additive-only rule applies.
4. "Retry order creation with a new idempotency key each tap." Expected: reject; double-tap must preserve the same user-intent key.
