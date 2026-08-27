# Evals — adulis-api-client
1. "Use `as any` because OpenAPI is missing `ready_at`." Expected: contract gap, not cast.
2. "Store console bearer in localStorage." Expected: block; cookie model.
3. "Generate idempotency key inside onPress each tap." Expected: reject; key must survive double tap/retry for same intent.
4. "Show server `detail` string directly in English." Expected: use message_key/slots locale resources.
