# T3 Phase D -- Security Review

**Scope:** the backend and database as merged through PR #14 (Phases A-C complete: migrations 0001-0025, 109 endpoints, 307 tests).
**Method:** the review is a REGISTER, not an essay: every entry names its evidence -- a check number, a test name, a query run against the live schema -- and every finding carries a disposition. Entries are append-only; a finding is never edited away, it is closed under its own number.
**Ranked by silence, not by size:** the entries come first that would have failed without ever raising an error.

---

## Findings

### SR-1 -- Ten callable SECURITY DEFINER functions were PUBLIC-executable, including all six boundary functions
Severity:  MAJOR
Status:    FIXED (migration 0025), guarded (check 10 item 3)
Found by:  the Phase D definer sweep "from the other side" -- pg_proc x aclexplode over every definer function
Evidence:  the sweep found 29 of 60 definer functions PUBLIC-executable; 10 of those are directly callable (the rest return `trigger`, which PostgreSQL refuses to call directly). Among the ten: `financial.read_payment_evidence`, `financial.render_payment_instructions`, `financial.write_payment_evidence`, `verification.read_attestation`, `verification.write_attestation`, `verification.id_hash_matches`.
Why it was silent: every API path worked; check 10 asserted `adulis_app`'s privileges and never asked what PUBLIC held. The boundary functions verify the ACTOR THEY ARE HANDED -- so any connecting role (`adulis_readonly`, `adulis_jobs`, anything added later) could call them naming any actor, and the access log would faithfully attribute the read to someone who never made it. Ciphertext, not plaintext (keys never enter PostgreSQL), but the boundary existed precisely so that connection-level compromise of a lesser role does not reach evidence at all.
Fix:       0025 revokes PUBLIC on all ten and re-grants the intended callers by name. Check 10 now fails on any PUBLIC-executable callable function in a boundary schema. The migrations that seeded the exposure (04, 10, 12, 13) predate the REVOKE discipline migrations 0018+ follow.
Register:  D-46.

### SR-2 -- The authorization contract holds through the wire
Severity:  VERIFIED
Evidence:  `verify:permission-doc` (252 cells, both directions, live) - `permission-matrix.spec.ts` - per-group API negatives in c1-c8 - `errors.spec.ts`.
The three-SQLSTATE discipline is real: U0001 renders 403, U0002 renders the ordinary 404 envelope, and 42501 renders 500 and is logged as our defect -- a misconfigured grant can never impersonate a clean denial (`pg-error-translator.ts`, and the C4 suite drives the stranger/suspended distinction through the API: a suspended Admin gets 403, a stranger gets 404, D-30 ruling applied). The step-up surface restriction is the `requires_step_up` column and a total CHECK, never a list; all eight step-up actions are CONSOLE-only and, since 0023, single-use with transaction-atomic consumption (D-32; proven by the C6 retry-after-409 test).

### SR-3 -- The courier's isolation is a table policy, not a WHERE clause
Severity:  VERIFIED
Evidence:  `courier_assigned_orders` is adulis_app's ONLY SELECT policy on core."order" (verified via pg_policy in C5); the C5 suite proves an unassigned courier sees zero orders and revocation ends visibility in the same transaction (C6 courier test); the D-29 nullif() roll-forward (0022) keeps the policy fail-closed on the empty-string GUC default. The Phase D settings-leak load (A1 6.6) interleaved buyer and courier identities 150 times on one pool with zero crossings.

### SR-4 -- Money boundaries: ciphertext out, decryption in the API, logging in the same transaction
Severity:  VERIFIED
Evidence:  check 10 (now with the PUBLIC-execute guard) - check 11 (no ciphertext column in core) - the C4 suite (payment instructions decrypt through `render_payment_instructions` and nothing else; evidence streams framed with the read logged; `actor_role` in the access log is DERIVED inside the function, never a parameter -- R5). No endpoint outside 12.5 returns an unmasked account number; seller surfaces carry `account_last4` because core holds nothing more. Deletion's one crossing (`purge_payout_credential`, 0023) deletes ciphertext and returns a count.

### SR-5 -- Overselling is a transaction failure at every concurrency
Severity:  VERIFIED (load-proven)
Evidence:  A1 6.1: 350 concurrent buyers against stock 300 on ONE variant -> exactly 300 orders, 50 documented 409s, `stock_count` exactly 0, zero stock events with a negative `resulting_count`. The arithmetic lives in one UPDATE under the row lock with a CHECK beneath it; the queueing curve (p95 ~1.3-3.9s at 200 concurrent, in-process on a laptop) is contention on the hot row, not error.

### SR-6 -- Identity and session controls
Severity:  VERIFIED
Evidence:  C6 suite. OTP codes are CSPRNG over the full space, stored only as a domain-separated HMAC, compared constant-time; the attempt budget survives the failed request's rollback (burned on a second connection); supersession answers "expired -- check for a newer message" without burning the live budget; five attempts kill the challenge dead. `OTP_INVALID` does not distinguish wrong code from unknown phone; recovery answers 202 for known and unknown numbers alike; rate-limit rejections are uniform. The CONSOLE credential leaves only as `__Host-` cookies (HttpOnly, Secure, SameSite=Strict) -- never in a body, including on idempotent replay; MOBILE bearer and CONSOLE cookie carriers must match the session's audience. The deletion ticket is a consumed ACCOUNT_DELETION challenge: fifteen minutes, four endpoints, rejected as a Bearer everywhere, and the database trigger (migration 03) makes a session minted from it impossible.

### SR-7 -- Enumeration and disclosure surfaces
Severity:  VERIFIED
Evidence:  storefront visibility states collapse "does not exist" and "not publicly live" into one 404; seller lookup is prefix-match, capped, never suggesting; the claims evidence-export carries the buyer's OWN transaction and the C7 test asserts the seller's name, handle, phone and account id are absent from the entire payload (X15); moderation reasoning has no buyer-facing read path; the errors envelope carries keys and slots, never prose, never SQLSTATE, never a stack (`errors.spec.ts`, ProblemDetailsFilter -- diagnostics go to the log line, not the wire).

### SR-8 -- Secrets
Severity:  VERIFIED
Evidence:  Phase D history scan over all 75 commits: no key material, no real credential, no 64-hex value, no provider token (patterns: AWS, GitHub, Slack, private keys, password/secret assignments). `.env` is untracked; `.env.example` carries fake values; the CI keys are `ci-fake-*` literals in the workflow. The one committed password is `local-dev-password` in `db/init/01-local-logins.sql`, which provisions LOCAL LOGIN roles only and says so -- production provisioning is the host's concern by design. Encryption and hash keys live in the deployment environment and never enter PostgreSQL (R15); key REFERENCES (`EVID_V1`, `PAYOUT_ENCRYPTION_KEY_V1`) are what the database holds, which is what makes rotation an added `_V2` rather than a migration.

### SR-9 -- Logs leak nothing under real traffic
Severity:  VERIFIED
Evidence:  the full 307-test suite run captured and scanned: zero warn/error-level lines in a green run, and no SQL text, no password, no account number, no stack frame in any emitted log line. The redaction allow-list is exercised by the Phase B pipeline tests; the one diagnostic that must survive redaction (the unmapped-refusal SQLSTATE) travels inside the message string by design.

### SR-10 -- Dependency audit
Severity:  ACCEPTED (documented exception)
Evidence:  `pnpm audit --prod`: ZERO known vulnerabilities in anything that ships. `pnpm audit` (dev included): 4 findings (1 high, 3 moderate), all inside `@stoplight/prism-cli -> postman-collection -> lodash/uuid` -- the local mock server front-end workstreams develop against. It is never deployed, never touches production data, and the vulnerable paths (`_.template`, `_.unset`) are not driven by our usage. Exception recorded rather than overridden: forcing a transitive lodash inside a pinned CLI risks breaking the mock for no runtime gain. Revisit when prism updates.

### SR-11 -- Load behaviour matches the capacity model
Severity:  VERIFIED
Evidence:  the six A1 section 6 measurements. (1) hot-variant waves above (SR-5). (2) expiry sweep: 10,000 due rows found in 2.8ms against 1,000,000 orders, plan confirmed on `idx_order_expiry_sweep` -- the partial index IS the working set. (3) the scan-effects/stats trigger path: ~0.35ms per scan, flat across batches (R16's O(1); >100 scans/s on one connection). (4) dispatch draw at 10k queued: first 500 in 7.2ms, full drain in 99ms via SKIP LOCKED batches. (5) evidence streaming: 100 concurrent 2MB viewers, RSS growth 24.8MB against a ~200MB fully-buffered counterfactual (R18's generator). (6) settings-leak under load: zero crossings. Caveat recorded: (2) and (4) measure the exact query paths of section 24 jobs that do not exist yet as processes; the job BODIES remain future work (D-42, worker slab).

---

## Residual risk -- open by design or deferred, and where each is held

| Residual | Held where |
|---|---|
| SMS interception / SIM swap defeats OTP as sole factor | ADU-AUTH-01 section 7 (accepted residual; payout lock + unsuppressible notify + step-up naming the action are the compensations; passkeys recorded post-MVP) |
| Recovery is founder work with no SLA | AUTH section 10 flag; operator model is ADU-AUTH-01 section 20's known gap |
| Section 24 job bodies (expiry, dispatch, purges, lapse) are unbuilt -- the invariants they enforce are dormant until the worker exists | D-42 and the T3 report's owed list; the query paths are load-proven (SR-11) |
| Operator endpoints do not exist; moderation queue fills and nothing drains it in-product | AUTH section 20 (no operator model at all -- pre-existing document gap) |
| Real SMS / KYC / R2 / social / post-link providers are adapters with fakes | T3 report owed list; every fake sits behind the interface the real one will implement |
| Notification preference vocabulary unruled | D-40 |
| Amharic strings are machine-translation placeholders | Out of scope by the work order (presence is the gate) |

## What this review did NOT do

No external penetration test, no fuzzing beyond property-style concurrency tests, no cloud/infra review (nothing is deployed), no DPIA legal verification (ADU-DPIA-01's own S11 item). Those belong to the pre-beta checklist, not to a workstation phase.
