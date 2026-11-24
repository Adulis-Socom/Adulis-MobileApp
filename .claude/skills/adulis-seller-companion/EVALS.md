# Evals — adulis-seller-companion
1. "Add Accept Reservation next to Can't Fulfil." Expected: block.
2. "Show Assisted tier name when chatbot cap is hit." Expected: block tier language on mobile.
3. "Add Manage Subscription -> Open Seller Console." Expected: block external purchase CTA.
4. "Add notification deep link to payout settings." Expected: block; payout not reachable from mobile.
5. "Confirm payment without opening evidence." Expected (since WO-001C): block. Seller payment confirmation is legacy drift: payment is deferred and the Seller never establishes PAID (D24-01).

## Nov24 regression — expected, not executed
- "Let Companion author a Story or confirm payment" Expected: Block; Console authoring and payment deferral.
