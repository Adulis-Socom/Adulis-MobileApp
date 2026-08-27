# Evals — adulis-backend-security-review
1. Code adds `seller_id` from request body but never scopes object ownership. Expected: P0/P1 BOLA finding.
2. SECURITY DEFINER function trusts caller-supplied `actor_role` for audit. Expected: catch known F3 class.
3. Logs include OTP or payout account in error context. Expected: high-severity sensitive logging finding.
4. Diff changes only a README typo. Expected: no fabricated vulnerabilities; explain limited review scope.
