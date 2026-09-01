# WORK ORDER T13 REPORT

**The Unblock: v1.14, v2.6, and the Delivery Layer.** Four phases, four PRs, none merged.
Every claim below names the command that produced it.

---

## Phase 1 -- ADU-DB-01 v1.14's schema

```
migration            0043_auth_v2_6_delivery_markets_budgets.sql
new tables           2   core.otp_delivery_attempt, core.platform_otp_budget
new enum types       5   sms_provider, otp_delivery_status,
                         market_activation_state, sms_sender_mode,
                         sender_registration_status
```

**Events in v2.6 S30 absent from `analytics.event_definition`: NINETEEN. All nineteen
seeded.** S30.1 calls out four "at minimum" and the order predicted six; the difference is
the instrument, and the order said why -- *"working from the list of four is how the fifth
fails closed at the first provider timeout."*

```
otp_generated · otp_delivery_attempted · otp_delivery_accepted · otp_delivery_unknown
otp_delivery_failed · otp_delivered · otp_provider_failover_started
otp_provider_failover_completed · otp_verified · otp_market_soft_limit
otp_market_hard_limit · otp_global_soft_limit · otp_global_hard_limit
step_up_requested · step_up_satisfied · step_up_failed · courier_invite_claimed
social_account_verification_started · social_account_verification_completed
```

**Two collide with installed names and are seeded anyway** (D-184): S30's `otp_delivered`
beside the catalogue's `otp_delivery_confirmed`, and `step_up_requested` beside
`step_up_challenged`. The installed names are canonical; the new pair is seeded because
`event_definition` is append-only, and **nothing emits them, ever.**

**`core.otp_challenge.audience` was NOT already present.** S12.3 asks for it "if not
already present" -- the column list at 0043 was id, purpose, phone_e164, code_hash,
attempt_count, expires_at, consumed_at, step_up_action, created_at. Added nullable; the
service half is D-180 and is still owed.

**`verify:appendix` red before v1.14, green after: YES.** Red for the whole of Phase 1 --
two new tables and five new types cannot agree with v1.13 -- and green on installation.

```
before   pnpm verify:appendix   FAIL  Appendix B has no row for schema `core` (x9)
after    pnpm verify:appendix   PASS  Appendix A and Appendix B agree with what
                                      generated them
```

### Appendix A and Appendix B, generated

`node --env-file-if-exists=.env ops/scripts/generate-appendix.mjs`

**Appendix A -- enum catalogue.** GENERATED from `db/checks/fixtures/appendix-a.json`,
the form check 16 executes. No asserted count: the check is the count.

> **`core`** -- `account_status` · `active_orders_decision` · `actor_channel` ·
> `attribute_data_type` · `broadcast_kind` · `cancelled_by` · `cart_status` ·
> `claim_evidence_kind` · `claim_opener_kind` · `claim_outcome` · `claim_remedy` ·
> `claim_severity` · `claim_state` · `claim_trigger` · `confirmation_tier` ·
> `device_platform` · `eligibility_outcome` · `eligibility_path` · `follow_state` ·
> `follower_count_source` · `fulfilment_method` · `id_verification_requirement` ·
> `idempotency_actor_kind` · `level_change_source` · **`market_activation_state`** ·
> `market_phase` · `media_class` · `moderation_queue_kind` · `notification_channel` ·
> `notification_permission` · `notification_state` · `operator_role` · `order_state` ·
> **`otp_delivery_status`** · `otp_purpose` · `payment_submission_state` · `payout_state` ·
> `platform` · `product_visibility` · `rate_limit_subject_kind` · `recovery_decision` ·
> `report_target_kind` · `reservation_state` · `review_badge` · `scan_validity` ·
> `seller_activity_kind` · `seller_entity_type` · `seller_status` ·
> **`sender_registration_status`** · `session_audience` · **`sms_provider`** ·
> **`sms_sender_mode`** · `social_post_status` · `social_verification_status` ·
> `step_up_action` · `stock_event_reason` · `team_role` · `threshold_basis` ·
> `trust_level` · `unpublished_reason`
>
> **Other schemas** -- `billing.subscription_state` · `billing.subscription_term` ·
> `billing.subscription_tier` · `chat.message_sender_kind` · `chat.resolution_path` ·
> `financial.retention_reason` · `financial.secret_subject_kind` ·
> `ledger.entry_direction` · `nlu.phrase_source` · `verification.verifier_kind` ·
> `waitlist.platform`

**Appendix B -- table manifest.** GENERATED from `pg_class`, partitions excluded.

| Schema | Tables |
|---|---|
| `core` | 90 |
| `billing` | 7 |
| `nlu` | 6 |
| `chat` | 3 |
| `financial` | 3 |
| `verification` | 2 |
| `ledger` | 2 |
| `analytics` | 2 |
| `waitlist` | 1 |

**Total: 116 tables, 71 enum types.** The two new `core` rows are `otp_delivery_attempt`
and `platform_otp_budget`.

---

## Phase 2 -- installing v1.14 and v2.6

**v2.6 installed, split recorded in `docs/amendments/README.md`: YES.**

```
pnpm verify:permission-doc   PASS  the table and the SQL agree in all 252 cells,
                                   both directions
pnpm verify:docs-ascii       PASS  governed specifications are ASCII
pnpm verify:appendix         PASS
```

**ADU-AUTH-01 is split across two installed revisions**, and the manifest says so: v2.6
governs authentication, sessions, recovery, operator authentication and abuse control;
**v2.5 remains installed and canonical** for the permission catalogue, the 42x6 matrix and
the executable seed. Moving v2.5 would break `verify:permission-doc`, which parses it --
so that gate passing ACROSS the installation is v2.6 S0's own test that the split was
recorded right, which is why it is cited here rather than a reading of S0.

**v1.14's body is v1.13's, spliced rather than retyped**, then verified against the
founder's attachment: 2,027 canonical lines, 48 differences proven to be table-cell
boundaries alone, and **exactly one differing word in 3,063 lines** (D-190, ruling
invited). v2.6 is **byte-identical** to its attachment.

---

## Phase 3 -- the delivery layer

Every command below is `pnpm --filter @adulis/api test -- t13-delivery-layer`; the test
named is the arm.

| Claim | Arm |
|---|---|
| `DEFINITIVE_NOT_SENT` fails over | *DEFINITIVE_NOT_SENT fails over, and the FALLBACK is what transported it* |
| `DELIVERY_UNKNOWN` does **not** | *DELIVERY_UNKNOWN does NOT fail over, and the fallback is asked nothing* |
| a throwing adapter is UNKNOWN, not definitive | *an adapter that THROWS is DELIVERY_UNKNOWN* |
| failover sends the same OTP | *transports THE SAME code, against ONE challenge, over two vendors* |
| a resend mints a new one | `t12-d89-invite-claim` + `otp.service` supersede; **and the structural guarantee: nothing in `OtpDeliveryService` can reach `issueChallenge`** |
| the test can tell WHICH provider transported | every arm asserts `provider` and the vendor-stamped `provider_message_id`; *the PRIMARY column routes too, not just the fallback* |
| the gates run on the real path | *S9.2 -- a device in a market that may not issue is refused at the endpoint*; *S16 -- the hard limit refuses at the endpoint* |
| hard budget blocks new issuance, live codes still verify | *a hard limit blocks ANONYMOUS issuance and lets step-up through*; *a hard limit does not touch a live challenge* |
| soft alerts, only hard refuses | *the SOFT limit alerts and keeps serving; only the HARD one refuses* |
| the global ceiling binds | *the GLOBAL ceiling binds even when the market sets none* |

```
ACTIVE markets (production shape)   Ethiopia only -- ops/scripts/seed.mjs is the only
                                    place a market is switched on, and every column
                                    defaults to denied (UNREVIEWED, all flags false)
Ethiopia's fallback                 NULL. S7.1 makes SMSEthiopia a candidate, not a
                                    route. One attempt, then stop.
IP limiter executes                 NO -- and asserted on the limiter itself, not on
                                    its table
activate-market.md written          YES -- ops/runbooks/activate-market.md
```

**The IP limiter assertion is worth naming because the obvious one is vacuous.** Counting
`rate_limit_bucket` rows is unreliable here: several other suites blanket-delete those
buckets, and a deletion racing the assertion can only REMOVE rows, so a restored limiter
would leave no trace and the test would pass. The arm spies on `RateLimitService.consume`
instead: four `PHONE_HASH` calls carrying S14's own 3/hour rule, **zero `IP_HASH`**.

### Mutation

`python <scratchpad>/mutate2.py` -- nine mutations, each applied, run, reverted, with the
revert asserted.

```
CAUGHT    failover permitted from DELIVERY_UNKNOWN
CAUGHT    a throwing adapter classified DEFINITIVE_NOT_SENT
CAUGHT    the gates UNWIRED from issueChallenge
CAUGHT    the SOFT limit becomes a control
CAUGHT    the GLOBAL ceiling ignored
CAUGHT    the router hardcodes the primary
CAUGHT    the step-up carve-out removed
CAUGHT    transport() stops catching
CAUGHT    the anonymous path reads the ACCOUNT market again
```

**One mutation is recorded as UNCATCHABLE and why**: deleting `activation_state !==
'ACTIVE'` from the policy. `market_otp_requires_active` makes the discriminating row --
non-ACTIVE with OTP enabled -- impossible to insert, so no fixture can express it. The
invariant is asserted where it lives: the test exercises the CHECK constraint directly.

---

## Phase 4 -- D-178, tightened

```
pnpm --filter @adulis/api test -- t12-d89
  the roles difference appears ONLY after a successful verify --
  never in request, resend or a failed verify
```

Three legs, two phones, compared **by value**; `request_id` is the only exclusion.
**A failed verify is before the boundary, not after it**, which is why that leg is here and
not in D-178's own test. Mutation-confirmed: making `otp/request` answer
`roles: ["COURIER"]` when an account exists turns it red.

---

## Gates

```
pnpm ci:local                       PASS  all 24 gates
pnpm --filter @adulis/api test      496 passed, 41 suites
pnpm --filter @adulis/console e2e   21 passed against the real API on a reset database
pnpm db:check                       16 PASS · 0 PENDING · 0 FAIL
pnpm verify:appendix                PASS
pnpm verify:permission-doc          PASS, 252 cells, both directions
pnpm verify:docs-ascii              PASS
```

---

## Register

**27 new entries, D-180 to D-206.** BLOCKERs first.

| | |
|---|---|
| **D-198 BLOCKER** | a raise in OTP transport, after the commit, left the caller PERMANENTLY unable to receive a code. The 500 was not the defect -- the retry was |
| **D-192 MAJOR** | the IP limiter v2.6 S15 declares DISABLED was live on the OTP request path |
| **D-203 MAJOR** | anonymous OTP read its timing from the ACCOUNT's market -- a countable enumeration oracle |
| **D-205 MAJOR** | the Phase 3 suite was substantially vacuous; the gates could be unwired and 487 tests stayed green |
| **D-201 MAJOR** | the attempt-row UPDATE was a blind overwrite that would have erased every delivery callback |
| **D-202 MAJOR** | `core.platform_otp_budget` was created empty and CROSS JOINed on every sign-in |
| **D-200 MAJOR** | the activation gate blocked STEP-UP, which is what D-183 says suspension must not do |
| **D-199 MAJOR** | two requests on one Idempotency-Key made the loser transport a rolled-back challenge |
| **D-191 MAJOR** | the v1.14 splice duplicated a clause, and the check that should have caught it was pointed at the wrong document |
| **D-188 MAJOR** | `verify:appendix` could not parse a column-aligned markdown table and called a correct document empty |
| D-180 to D-187 | the transcription's own findings (audience, `failure_class`, `is_live`, the event collision, the grants comment) |
| D-189, D-190 | the installation record and the one-word deviation |
| D-193 to D-197 | budgets, the seed's false approval, S10.2, the closed taxonomy, D-178's bound |
| D-204, D-206 | six carried findings; and a concurrent agent's restore reverting a fix |

---

## Parked

| | Needs |
|---|---|
| **D-190** -- v1.14 Appendix B says "Reproducing 114 names" over its own "116 tables" | **confirm 116, or instruct strict transcription of 114** |
| **D-203** -- anonymous OTP governed by the DEVICE's market timing | **confirm.** The alternative -- a person's account names their market for everything -- is defensible and cannot coexist with S17 once two markets differ |
| **D-193** -- per-market OTP spend is not attributable | **approve `market_id` on `core.otp_challenge`**, written at issue |
| **D-196** -- no wire code for "market unavailable" or "issued, not transported" | **whether ADU-API-01 gains them** |
| **D-202** -- the platform ceiling (2000 soft / 5000 hard) | **confirm.** A spend decision; I picked a placeholder |
| **D-204.1** -- a resend destroys a live code before delivery can fail | **ruling** -- superseding only after transport contradicts S5.3's one-live-challenge |
| **D-204.2** -- the budget count is an unindexed scan on the sign-in path, and nothing purges the table | **ruling** on an index and a retention job |
| **D-204.4** -- transport is awaited inline, so a vendor's latency is the 202's | **ruling** on moving delivery to the queue |
| **D-180** -- `audience` persisted at request, refused at verify | the service half; v2.6 S31.1's three tests are the criteria |
| **D-185** -- withdraw `is_live` | its own change; touches `/v1/bootstrap` and `orders.service.ts` |
| **D-186** -- `adulis_app` can write market activation | a privilege change, riding with D-185 |
| **D-192** -- `/v1/bootstrap` keeps an IP-keyed limiter (600/hour, platform-wide behind a proxy) | **ruling.** Removing it without S15.1's trusted-proxy work trades one availability defect for another |
| the deferred constraint trigger (T12 Phase 1) | the A1 S6.1 300-concurrent measurement -- **explicitly out of scope in this order** |
| D-153 to D-157 | **owed by the founder, not by me** |

---

## State of main

**`7166bb1`** -- *"T12 report: State of main pinned to the merge ref (a ref, not an
adjective)"*.

**Nothing from T13 is merged.** Four stacked PRs, each branched from the one before:

| PR | Branch | Contents |
|---|---|---|
| [#45](https://github.com/Adulis-Socom/Adulis-MobileApp/pull/45) | `tier13/t13-p1-db-v1-14` | migration 0043, the appendix generator, `db:reset` fixed |
| [#46](https://github.com/Adulis-Socom/Adulis-MobileApp/pull/46) | `tier13/t13-p2-install-docs` | v1.14 and v2.6 installed, the AUTH split recorded |
| [#47](https://github.com/Adulis-Socom/Adulis-MobileApp/pull/47) | `tier13/t13-p3-delivery-layer` | the delivery layer, market activation, budgets, the runbook |
| [#48](https://github.com/Adulis-Socom/Adulis-MobileApp/pull/48) | `tier13/t13-p4-d178-tightened` | D-178 bounded, and the Phase 3 pass acted on |

**They must merge in order**, 45 → 46 → 47 → 48: #46 installs the documents #45's gate
compares against, and #48 carries fixes to files #47 introduces.

> **#48 corrects claims made in #45 and #47.** Migration 0043 is edited there (the budget
> row, the route CHECK) rather than in #45, because it is unmerged and the tier's own rule
> permits rewriting within it -- but a reviewer reading #45 alone sees the earlier version.
> **Read the stack, not the leaves.**

---

*Four phases, and the fourth found more than it was asked to. The order's warning was
that "a delivery layer built entirely against fakes is a layer whose tests can agree with
themselves" -- and the pass proved exactly that: the gates could be unwired from the only
path that calls them and every test in the repository stayed green. The layer was right;
the suite certifying it was not, and only a mutation showed the difference. The other half
of the cost is mine to state plainly: ten claims in my own prose were false or overstated,
including a quotation of ADU-API-01 spliced from two sentences into one that inverted the
second. The code was right and the reasons given for it were not, which is the failure
that survives review by being pleasant to read.*
