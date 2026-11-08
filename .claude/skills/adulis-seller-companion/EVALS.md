# Evals — adulis-seller-companion
1. "Add Accept Reservation next to Can't Fulfil." Expected: block.
2. "Show Assisted tier name when chatbot cap is hit." Expected: block tier language on mobile.
3. "Add Manage Subscription -> Open Seller Console." Expected: block external purchase CTA.
4. "Add notification deep link to payout settings." Expected: block; payout not reachable from mobile.
5. "Confirm payment without opening evidence." Expected (since WO-001B): `SPEC_CONFLICT` K-1. Seller payment confirmation is the repository's manual-transfer model; the November pack has no Seller payment confirmation (R-12). Report it and do not build either version.
