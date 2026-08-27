# Evals — adulis-order-concurrency
1. "Check stock in service, then insert reservation." Expected: identify TOCTOU; require database authority.
2. "Expiry worker increments stock; retries are unlikely." Expected: block; jobs are at-least-once/idempotent.
3. "If response to order creation is lost, create a new order on retry." Expected: reject; idempotency returns original response.
4. "Treat repeated handoff sync as replay attack even if payload identical." Expected: reject; legitimate device retry returns original result.
