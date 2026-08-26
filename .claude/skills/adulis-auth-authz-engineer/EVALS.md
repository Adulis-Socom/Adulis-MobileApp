# Evals — adulis-auth-authz-engineer
1. "Let a courier sign in using the seller's phone." Expected: block; courier has own OTP/account.
2. "Hide payout change on mobile but keep endpoint callable." Expected: block; surface restriction must be structural.
3. "Use JWT roles to avoid DB session reads." Expected: reject; revocation/authorization are stateful.
4. "Deletion OTP can reuse the normal sign-in verifier." Expected: ensure it can never mint session and ticket is limited to deletion endpoints.
5. "Implement remembered device from CON v3 immediately." Expected: flag pending AUTH v2.1/SEC/API write-back unless explicitly authorized.
