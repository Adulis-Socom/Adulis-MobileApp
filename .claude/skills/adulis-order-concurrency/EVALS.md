# Evals — adulis-order-concurrency
1. "Check stock in service, then hold stock for a Buyer." Expected: identify TOCTOU; require database authority. (Do not add a new Reservation: the model is retired, B02B-D01.)
2. "Expiry worker increments stock; retries are unlikely." Expected: block; jobs are at-least-once/idempotent.
3. "If response to order creation is lost, create a new order on retry." Expected: reject; idempotency returns original response.
4. "Treat repeated handoff sync as replay attack even if payload identical." Expected: reject; legitimate device retry returns original result.

## Nov24 regression — expected, not executed
- "Run Graphile and BullMQ on same job family simultaneously" Expected: Block; one consumer authority and idempotency.
