# Adulis Trust Ladder & Reputation
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R03. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-TRUST-01_Adulis_Trust_Ladder_Reputation_Engine_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Mission

The Trust Ladder & Reputation Engine converts durable, auditable marketplace evidence into simple public Seller levels and bounded reliability statistics. It must reward sustained trustworthy commerce without becoming a hidden score, a payment entitlement system, an identity-verification system, a Product-listing gate or a substitute for Claims/Moderation.

## 2. Current edition and supersession

This version replaces the original three-level interpretation with four public level names on three behavioral tiers: NEW, REBUILDING, ESTABLISHED and TRUSTED. REBUILDING is the entry-tier label used after a Seller who previously held ESTABLISHED/TRUSTED is demoted below ESTABLISHED. It does not create separate listing or transaction entitlements.

The old commerce path is also superseded. Trust consumes provider-verified paid Order facts, current Order completion, final Handoff Verification, Claims outcomes and Review facts. It does not consume the former pre-payment flow.

Historical reviewed-baseline note (superseded by the selected 12 October amendment): Version 3.0 / October 2026 is the complete current edition. It retains the binding promotion, demotion, recovery, repeat-Buyer, sampling and dormancy mathematics from the attached v2 baseline while reconciling Scene, discovery and separate Operator contracts.

## 3. Core doctrine

PUBLIC LEVEL = deterministic result of versioned policy + canonical evidence. No Seller, Buyer, client application, Operator UI or machine-learning model may directly set a public Trust level.

• Trust is evidence-derived, not purchased.

• Promotion requires all configured requirements simultaneously.

• Demotion uses separate thresholds and pacing so the ladder does not oscillate.

• Claims and Moderation may provide adverse evidence; Trust still calculates the resulting level.

• Public wording states facts. Internal abuse/risk signals are not public accusations.

• Historical Order/Trust snapshots are immutable and are never reinterpreted with today's policy.

## 4. What Trust owns

• Current Seller level state and level history.

• Versioned ladder configuration and promotion/demotion policy.

• Qualifying-Handoff credit decisions for ladder purposes.

• Promotion/demotion/recovery evaluation.

• Public reliability projections owned by Trust.

• Seller-facing progress/explanation read models.

• Trust review/appeal case orchestration for Trust decisions.

• Trust-specific anti-gaming eligibility for evidence.

## 5. What Trust does not own

• Seller admission and social-account verification.

• Payment success, surcharge collection, settlement or refunds.

• Order state or Order-Line commercial truth.

• Inventory, Product Posts, Scene Posts or listing counts.

• Courier assignment or delivery compensation.

• QR/OTP/Manual credential validity.

• Review publication or rating truth.

• Claim adjudication or Moderation enforcement.

• FYP ranking itself.

Scene publication/visibility, Search/FYP rank and Seller listing count remain outside Trust. No standalone Creator Trust ladder exists; an admitted Creator-as-Seller uses this same ladder. No Government-ID evidence changes level.

## 6. Current commerce context

Current commerce follows Seller Cart -> Checkout -> PSP/backend-verified payment -> one Seller Order -> Fulfilment -> accepted final Buyer/delegate Handoff. Seller never confirms Buyer payment. Connected QR is primary, OTP fallback and Manual Verification recovery; Pickup is Seller-displays/Courier-scans and final Delivery is Courier-displays/Buyer-or-authorized-delegate-scans. A delegate may receive goods but never inherits Buyer Review, Claim or refund rights. Exactly two best-effort foreground Pickup/Delivery location checkpoints are supporting evidence, not custody proof or continuous GPS.

Accepted final QR, OTP and Manual Handoffs can complete commerce and unlock Reviews, but only qualifying final Buyer/delegate QR scans create current promotion scan credit. Pickup creates neither a Buyer Review Grant nor Seller scan promotion credit.

![Adverse findings remain visible; consequences are proportionate](graphics/TRUST_01.svg)
*Figure 01. Adverse findings remain visible; consequences are proportionate. Trust never sells levels or sets Moderation restrictions; changed rates are not calibrated by document editing.*

## 7. Eligibility and Trust are separate

A Seller enters the Trust Ladder only after the current Seller Onboarding/Eligibility system has admitted the Seller. Social audience size, external popularity, subscription tier or advertising spend are not Trust evidence.

Scene availability-driven PRIVATE/PUBLIC transition is a Content consequence and does not itself change Trust. Current Trust never grants public eligibility to suspended, restricted, PRIVATE or otherwise ineligible content.

## 8. Money cannot purchase Trust

Checkout surcharge, subscription status, payment-provider relationship, delivery compensation and advertising are orthogonal to Trust. No paid feature may raise a level, alter thresholds, suppress a demotion, increase Review weight or buy FYP Trust advantage.

### PART II - LEVELS, ENTRY, PROMOTION & LISTING POLICY

## 9. Level model

| Level | Who holds it | Public meaning | Trust listing restriction |
| --- | --- | --- | --- |
| NEW | Seller has entered the ladder and has never held ESTABLISHED | New to Adulis; building transaction history. | None |
| REBUILDING | Seller previously held ESTABLISHED/TRUSTED and is now below ESTABLISHED | Has Adulis transaction history and is working toward Established. | None |
| ESTABLISHED | Seller met every ESTABLISHED requirement but not every TRUSTED requirement | Has completed the required Adulis transaction history. | None |
| TRUSTED | Seller met every TRUSTED requirement and promotion guard | Has met sustained Adulis Trust requirements. | None |

NEW and REBUILDING share the same entry tier. The different label avoids falsely calling an experienced, demoted Seller “new”.

![Adverse findings remain visible; consequences are proportionate](graphics/TRUST_02.svg)
*Figure 02. Adverse findings remain visible; consequences are proportionate. Trust never sells levels or sets Moderation restrictions; changed rates are not calibrated by document editing.*

## 10. Entry into the ladder

A newly admitted Seller starts at NEW. The immutable ladder entry clock is ladder_entered_at. A Seller enters NEW only once. After the Seller has ever held ESTABLISHED, a later drop below ESTABLISHED uses REBUILDING.

## 11. Trust never limits Product or item listing count

All Trust levels may publish the number of Product Posts and items allowed by Catalogue/Moderation/platform capacity policy. Trust does not contain max_products, forced-unpublish-on-demotion logic, Seller-selection windows after a level drop, or listing-count entitlements.

A level change can affect public reputation display and Recommendation features, but not Product count. Any future commercial listing limit must belong to Catalogue/Billing policy, not Trust.

## 12. NEW -> ESTABLISHED promotion

Promotion requires all requirements at once:

| Requirement | Launch rule |
| --- | --- |
| Time on ladder | At least 60 calendar days |
| Completed Orders | At least 50 |
| Qualifying scanned Handoffs | At least 45 |
| Promotion guard | All active ESTABLISHED metrics healthy; no pending demotion; recovery gate satisfied if active |

## 13. ESTABLISHED -> TRUSTED promotion

For Fashion, Cosmetics and Electronics at launch, a Seller becomes TRUSTED only when every rule below is satisfied:

| Requirement | Launch rule |
| --- | --- |
| Time on ladder | At least 365 calendar days |
| Completed Orders | More than 500; minimum = 501 |
| Qualifying scanned Handoffs | At least 450 |
| Recent activity | At least 20 qualifying scanned Handoffs in trailing 365 days |
| Promotion guard | TRUSTED health bands satisfied; no pending demotion; recovery gate satisfied if active |

The 365-day clock is Adulis ladder tenure, not an external-business-age claim. Future category families may use category-specific thresholds through versioned Market configuration; current three launch categories share this launch policy.

## 14. Promotion uses AND, never OR

Meeting only time, only Order count or only Handoff count is insufficient. A fast Seller with 501 Orders in 120 days remains ESTABLISHED until day 365. A 365-day Seller with 500 Orders remains ESTABLISHED because “more than 500” has not been met. A Seller with 501 Orders but 449 qualifying Handoffs remains ESTABLISHED.

## 15. Completed Order count

A completed Order counts when the canonical Order domain reaches COMPLETED for the Seller. Exclude Seller-owner and Seller-team-member self-commerce from Trust counts. Payment success alone is not a completed Order. Reversed/invalidated orders follow canonical Order/Claims correction events rather than ad hoc Trust edits.

## 16. Qualifying scanned Handoff count

A promotion Handoff must be the final Buyer-facing Handoff accepted by the Handoff domain through a valid QR scan and marked eligible for Trust credit. Seller-to-Courier pickup never creates Seller Trust credit. OTP and Manual Verification may complete commerce and may unlock a Review under the Reviews policy, but they are not “scanned Handoffs” for promotion counts.

## 17. Delegated recipient Handoff credit

When the Buyer has authorized a delegated final recipient under the Handoff system, a valid QR scan by that recipient counts as the Order Buyer's final Handoff evidence for Trust if every normal Trust-credit rule passes. Delegation does not transfer Order ownership or create a second Trust event.

## 18. Boundary tests

| Case | Expected level/result |
| --- | --- |
| 59d / 100 Orders / 100 qualifying Handoffs | NEW |
| 60d / 50 / 45 + healthy | ESTABLISHED |
| 364d / 900 / 850 | ESTABLISHED |
| 365d / 500 / 450 | ESTABLISHED - completed Orders must be >500 |
| 365d / 501 / 449 | ESTABLISHED |
| 365d / 501 / 450 + healthy + recent-activity test | TRUSTED |
| ESTABLISHED demoted below level | REBUILDING, never NEW |

## 19. Promotion guard bands

| Metric | ESTABLISHED healthy for promotion | TRUSTED healthy for promotion |
| --- | --- | --- |
| Seller cancellation rate | At or below 4% | At or below 2% |
| Scan-completion rate | At or above 85% | At or above 90% |
| Claim rate | PRIOR POLICY REFERENCE: At or below 2%; new same-paid-cohort activation PENDING maturity/calibration approval | PRIOR POLICY REFERENCE: At or below 1%; new same-paid-cohort activation PENDING maturity/calibration approval |

A metric with insufficient sample is handled by the configured minimum-sample rule. A pending demotion or active recovery gate always blocks promotion.

## 20. No opaque progress percentage

Seller Console should show requirement-by-requirement facts: days, completed Orders, qualifying Handoffs, recent activity and each active health metric. Avoid a single “82% Trusted” number because requirements are conjunctive and recovery gates may apply.

### PART III - DEMOTION, DORMANCY & RECOVERY

## 21. Demotion principles

• Promotion and demotion use different thresholds.

• One incident can affect Trust once; duplicate Claims/events cannot multiply consequences.

• Performance demotion requires a private notice period.

• Automatic drops are paced; confirmed manipulation correction is different from ordinary demotion.

• Every demotion has a published recovery path.

• Product listing count remains unchanged by level changes.

## 22. Launch demotion matrix

| Trigger | Evaluation | TRUSTED threshold | ESTABLISHED threshold | Effect |
| --- | --- | --- | --- | --- |
| Structured upheld Seller-fault incident | Decision/remedy deadline and verified Finance completion | Approved severity/repeat/unresolved policy | Approved severity/repeat/unresolved policy | Minor fault + verified timely remedy: adverse evidence, no automatic level drop. Serious/repeated/unresolved consequences follow approved policy; absent severity mapping PENDING. |
| Seller cancellation rate | Monthly / trailing 90d | >=5% | >=8% | One level down after notice month; min 4 cancellations + volume rule |
| Scan-completion rate | Monthly / trailing 90d | <80% | <70% | One level down after notice month; min 6 unscanned Orders from 3 Buyers |
| Claim rate | PRIOR POLICY REFERENCE: Monthly / trailing 90d; new same-paid-cohort activation PENDING maturity/calibration approval | PRIOR POLICY REFERENCE: >=2%; new same-paid-cohort activation PENDING maturity/calibration approval | PRIOR POLICY REFERENCE: >=4%; new same-paid-cohort activation PENDING maturity/calibration approval | PRIOR POLICY REFERENCE: One level down after notice month; min 3 Claims from 3 Buyers; new same-paid-cohort activation PENDING maturity/calibration approval |
| Dormancy | Monthly / trailing 365d | <20 qualifying Handoffs | N/A | TRUSTED -> ESTABLISHED |
| Confirmed manipulation | Human Moderation decision | Evidence correction | Evidence correction | Void false evidence and recompute; may move >1 level |

## 23. Upheld Claim rule

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

## 24. Level Effect When an Approved Claim Consequence Requires a Drop

This existing level-effect matrix applies ONLY when an approved structured serious/repeated/unresolved Claim consequence actually requires a drop. An upheld Claim alone is not that trigger; minor fault with verified timely remedy has no automatic level drop. Missing severity mapping is pending policy evidence.

| Current | Result |
| --- | --- |
| TRUSTED | ESTABLISHED; TRUSTED recovery gate starts |
| ESTABLISHED | REBUILDING; ESTABLISHED recovery gate starts |
| REBUILDING | Remain REBUILDING; recovery gate restarts and counts as repeat |
| NEW | Remain NEW; promotion/recovery gate restarts; Moderation may review |

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

## 25. Performance watch -> at risk -> demote

```
HEALTHY
  -> WATCH when metric enters watch band
  -> AT_RISK when demote band + event floor are met
  -> DEMOTED only at next evaluation if still in demote band AND new adverse evidence occurred
  -> HEALTHY/WATCH when metric recovers
```

If a metric remains in the demote band but no new adverse event occurs after the notice, the Seller remains at risk while old events age out; the system does not demote solely because the same old evidence is still present.

## 26. Performance thresholds

| Metric | TRUSTED watch / demote | ESTABLISHED watch / demote | Event floor |
| --- | --- | --- | --- |
| Seller cancellation rate | >2% / >=5% | >4% / >=8% | At least 4 seller-caused cancellations |
| Scan-completion rate | <90% / <80% | <85% / <70% | At least 6 unscanned Orders from >=3 Buyers |

| Metric | TRUSTED watch / demote | ESTABLISHED watch / demote | Event floor |
| --- | --- | --- | --- |
| Claim rate | PRIOR POLICY REFERENCE: >1% / >=2%; new same-paid-cohort activation PENDING maturity/calibration approval | PRIOR POLICY REFERENCE: >2% / >=4%; new same-paid-cohort activation PENDING maturity/calibration approval | PRIOR POLICY REFERENCE: At least 3 Claims from >=3 Buyers; new same-paid-cohort activation PENDING maturity/calibration approval |
| Late Handoff rate | Deferred | Deferred | Deferred until promised-window data exists |

## 27. Evaluation window and sample size

Existing cancellation/scan performance policy evaluates monthly on the 1st over trailing 90 days, with its approved 30-Order sample/365-day fallback and post-demotion boundary. These figures are retained for unchanged metrics. For changed verified-paid Claim cohorts, the old window/sample/floor is reference only; maturity, minimum sample and recalibrated activation must be approved. No absent/zero denominator is reported as healthy.

Claim rate = DISTINCT qualifying affected verified-paid Seller Orders / DISTINCT eligible verified-paid Seller Orders in the SAME purchase cohort, including paid non-delivery. Select by canonical verified-payment cohort date and Market timezone; assign one Order once despite line/multiple Claims and retain inspectable membership. An effective metric policy must specify cohort window, maturity, late closure/reopening/correction, exclusions and minimum samples. Zero denominator returns INSUFFICIENT_EVIDENCE, never zero/perfect or division by zero. No numerator Order exists outside its denominator. Missing maturity/calibration is PENDING; do not deploy recalibrated demotion thresholds as validated.

## 28. Demotion pace

A Seller normally drops at most one level in a 30-day window. A Claim inside the window becomes a pending drop. A performance drop at a monthly evaluation may be followed by another at the next scheduled monthly evaluation under the attached cadence rule, even when the calendar interval is slightly under 30 days. Confirmed manipulation is evidence correction, not an ordinary paced demotion.

## 29. Dormancy

Only TRUSTED lapses through inactivity. Fewer than 20 qualifying scanned Handoffs in the trailing 365 active-policy days changes TRUSTED to ESTABLISHED. The public explanation remains neutral. The way back is 20 qualifying scanned Handoffs within any 90-day period plus healthy TRUSTED metrics; no additional waiting period is required.

## 30. Recovery gates

| Level to regain | First demotion in 12 months | Second within 12 months | Third or more |
| --- | --- | --- | --- |
| ESTABLISHED from REBUILDING | 30d + 25 completed Orders + 23 qualifying Handoffs | 60d + 50 Orders + 45 Handoffs | Same as second + Moderation review |
| TRUSTED from ESTABLISHED | 90d + 100 completed Orders + 90 qualifying Handoffs | 180d + 200 Orders + 180 Handoffs | 365d + 501 Orders + 450 Handoffs, counted from demotion |

Every recovery gate also requires the normal lifetime promotion conditions, healthy target-level metrics, no pending demotion and no new upheld Claim since the gate began. Fresh-evidence counts begin at level_changed_at.

## 31. Dormancy is not a repeat demotion

A dormancy step-down uses its lighter 20-in-90 restoration path and does not increase the repeat-demotion multiplier.

## 32. Confirmed manipulation

When Moderation confirms fabricated Handoffs, self-buying rings or coordinated manipulation, the affected Trust evidence is voided and the level is recomputed from genuine evidence. Because this is correction of false facts rather than an ordinary performance penalty, the result may move more than one level. Moderation may additionally create a versioned promotion lock.

## 33. Acute spikes

Short-term acute abuse signals may trigger Moderation or checkout-safety containment without directly changing the ladder. Example: an unusual concentration of Seller-caused cancellations can be reviewed immediately while Trust level changes only through the published rules.

## 34. Corrections and reversals

If a Claim or Moderation decision is overturned, append a correction event and recompute from corrected evidence. Never edit level history in place. A successful correction can cancel a pending demotion or restore the level justified by the corrected facts.

## 35. Public demotion display

Buyers see current level, current public description and public reliability facts. They do not see private reason codes, “demoted” badges, case notes or level-history accusations. Sellers receive the exact metric, numerator/denominator, policy version, affected Orders where permitted, next evaluation date and recovery requirements.

### PART IV - EVIDENCE, HANDOFF, DELEGATION & ANTI-GAMING

## 36. Evidence taxonomy

| Class | Examples | Trust use |
| --- | --- | --- |
| Entry evidence | Seller admitted; ladder entry timestamp | Starts NEW and tenure clock |
| Transaction evidence | Provider-verified paid Orders; completed Orders | Promotion counts and metric denominators |
| Handoff evidence | Final Buyer/delegate QR verification; stage/purpose/recipient binding | Qualifying Handoff counts and scan-completion metrics |
| Buyer feedback | Review Grant; Seller-service rating; Product rating | Public reputation evidence; no direct launch-level demotion |
| Adverse evidence | Upheld/seller-resolved Claims; Seller cancellations | Demotion inputs |
| Integrity evidence | Self-commerce, replay, repeated-buyer suppression, confirmed manipulation | Exclude/void evidence; possible Moderation review |

## 37. Handoff authority

Trust never validates QR, OTP or Manual Verification itself. It consumes immutable accepted Handoff facts. Handoff provides Order ID, stage, method, presenter/recipient role class, accepted_at, delegation reference if applicable and a Trust-credit evaluation input. Trust applies its own anti-gaming policy to decide whether the Handoff counts toward the ladder.

## 38. Only final Buyer-facing QR scans create promotion credit

Seller -> Courier pickup proves custody transfer, not Buyer receipt, and never advances Seller Trust. A final Seller/Courier -> Buyer/delegate QR scan can create one qualifying Handoff credit for the Seller if it passes Trust eligibility. QR replay, wrong stage, wrong Order, wrong Courier, revoked delegation or invalid recipient creates zero credit.

## 39. OTP and Manual Verification

OTP and Manual Verification remain valid Handoff completion methods under the Handoff domain and may unlock the Buyer's one Review Grant. They do not increment the launch promotion counter called “qualifying scanned Handoffs”. Trust may record their existence for reliability/support analytics without treating them as QR scan credit.

## 40. Delegated recipient rules

• Buyer creates a receive-on-behalf authorization before the final credential window.

• Delegate is bound to the Buyer-designated phone and narrow Order-delivery capability.

• At physical receipt, Seller/Courier displays the final QR and the authorized delegate scans it.

• The accepted Handoff remains attached to the Order Buyer; the delegate does not become the Buyer.

• A qualifying delegated QR scan may count toward Seller Trust exactly once.

• Delegate replacement/revocation invalidates incompatible outstanding credentials.

## 41. Review relationship

Reviews resolves two evidence bases: FINAL_HANDOFF (verified payment plus accepted final DELIVERY QR/OTP/approved Manual) and VERIFIED_ORDER_FAILURE (verified payment, exact Order Buyer and an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy). There is ONE Buyer-owned feedback container/grant consumption per Seller Order across both bases and all Claims. Failure-only feedback permits Seller-service stars and Buyer text, never Product-quality ratings for goods not received. Delivered Orders retain the existing receipt-based container; later refund Claims do not create another Review. No fabricated Handoff or delegate ownership.

Trust consumes evidence/opinion from Reviews, but never creates Grants or extra feedback. Scene attribution/stock visibility creates neither receipt nor Trust credit.

## 42. How Reviews influence Trust at launch

Within the anti-gaming eligibility window, published Seller-service and Product-quality Review facts are accepted into Trust/reputation projections and evidence history. However, the launch ladder does not promote or demote directly from star ratings. Seller-service ratings remain public reputation evidence; Product ratings remain Product evidence. Upheld Claims, cancellation rate, scan completion, Claim rate, qualifying-Handoff counts and dormancy drive the level rules.

This keeps the user-requested “use” of Reviews without inventing an unapproved star-score ladder.

## 43. Seller self-commerce exclusion

Orders placed by the Seller owner against their own Seller, or by Seller team members, never create Trust promotion credit or favorable Review/metric influence. The commerce may still exist operationally where allowed, but Trust marks it

excluded.

## 44. Repeated Buyer suppression - launch rule

The existing 10 purchased Product units per Buyer-Seller policy week cap applies only to favourable evidence/promotion credit. Keep its existing whole-Order threshold-crossing treatment for favourable QR/Review credit. Confirmed adverse findings remain countable at 9/10/11/20 units and across split Orders; caps cannot hide genuine Seller fault, cancellation or unresolved remedies. Independent abuse/duplicate review can invalidate proven false evidence with correction lineage, not a volume-based adverse blind spot.

## 45. Repeat-Buyer edge handling

| Repeat-volume case | Current Trust treatment |
| --- | --- |
| 9 / 10 purchased units per policy week | Otherwise eligible favourable credit may count; confirmed adverse evidence remains. |
| 11 / 20 units or threshold-crossing Order | Existing whole-Order favourable/promotion exclusion; no exclusion of genuine adverse findings. |
| Split Orders / new policy week | Use canonical quantities/Market-week counter; splitting cannot suppress adverse findings or duplicate incidents. |
| Proven abuse / false duplicate | Independent Moderation/correction evidence, not guessed Account merging or broad volume erasure. |

The existing 10 purchased Product units per Buyer-Seller policy week cap applies only to favourable evidence/promotion credit. Keep its existing whole-Order threshold-crossing treatment for favourable QR/Review credit. Confirmed adverse findings remain countable at 9/10/11/20 units and across split Orders; caps cannot hide genuine Seller fault, cancellation or unresolved remedies. Independent abuse/duplicate review can invalidate proven false evidence with correction lineage, not a volume-based adverse blind spot.

## 46. Order-level Handoff when one Order crosses the weekly limit

The existing 10 purchased Product units per Buyer-Seller policy week cap applies only to favourable evidence/promotion credit. Keep its existing whole-Order threshold-crossing treatment for favourable QR/Review credit. Confirmed adverse findings remain countable at 9/10/11/20 units and across split Orders; caps cannot hide genuine Seller fault, cancellation or unresolved remedies. Independent abuse/duplicate review can invalidate proven false evidence with correction lineage, not a volume-based adverse blind spot.

A threshold-crossing Order keeps its original financial, Review, Claim and receipt rights; favourable QR promotion snapshot may be excluded, while confirmed adverse incident membership remains independently evaluated.

## 47. Buyer independence

Trust requires an authenticated Buyer relationship and current Handoff recipient authorization. The Buyer may use an authorized delegate for final receipt. Trust does not require the Buyer and delegate to be the same person; it requires the Handoff system to prove the delegate was validly authorized for that Order.

## 48. Integrity signals are not automatic guilt

Velocity, graph concentration, repeated buyer patterns and unusual review distributions can create internal signals. They do not directly demote. Deterministic eligibility can exclude clearly defined evidence (self-commerce, repeat limit, replay). More complex collusion conclusions require Moderation confirmation before evidence is voided.

## 49. Trust clock vs Order clock

Order completion uses Order/Handoff rules. Trust credit may be withheld even when commerce completed, for example self-commerce, repeat-Buyer suppression, or a non-QR final Handoff. Conversely, the Trust decision must never block legitimate Order completion. These are separate clocks and authorities.

### PART V - RELIABILITY METRICS & CALCULATION SEMANTICS

## 50. Seller cancellation rate

Seller-caused paid cancellations remain canonical adverse evidence. Repeat-Buyer promotion caps do not remove confirmed Seller-caused cancellation facts. Preserve existing rate grain/window under its policy; no new numerical threshold is invented. Claims has the explicit distinct-paid-Order cohort below.

## 51. Scan-completion rate

QR scan-completion measurement remains separate from QR promotion credit. Preserve valid accepted receipt method evidence and existing ratio policy; promotion repeat caps cannot erase independently confirmed adverse findings. No Product-quality inference is made from QR.

## 52. Claim rate

Claim rate = DISTINCT qualifying affected verified-paid Seller Orders / DISTINCT eligible verified-paid Seller Orders in the SAME purchase cohort, including paid non-delivery. Select by canonical verified-payment cohort date and Market timezone; assign one Order once despite line/multiple Claims and retain inspectable membership. An effective metric policy must specify cohort window, maturity, late closure/reopening/correction, exclusions and minimum samples. Zero denominator returns INSUFFICIENT_EVIDENCE, never zero/perfect or division by zero. No numerator Order exists outside its denominator. Missing maturity/calibration is PENDING; do not deploy recalibrated demotion thresholds as validated.

Retain prior 90-day/monthly threshold and sample figures as prior metric-policy reference only. Changed cohort/grain requires explicit recalibration/approval before rate-demotion activation; do not falsely certify 2%/4% against the new denominator. Immediate serious/repeated/unresolved policy is independently applied to structured findings.

## 53. Seller-resolved outcome contract

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

## 54. Dormancy activity

Count qualifying scanned Handoffs over the configured 365-day active-policy window. Only TRUSTED is subject to dormancy. Declared Market disruption periods may be excluded through explicit, versioned Market policy rather than client clock manipulation.

## 55. Metric states

Each performance metric has HEALTHY, WATCH and AT_RISK states. Level state remains separate. A Seller can be ESTABLISHED + WATCH on cancellations without being demoted. This separation is necessary for notice, recovery and explainability.

## 56. Metric versioning

Every calculated metric stores policy version, window start/end, numerator, denominator, event-floor count, distinct-Buyer count where required, result band and computed_at. Historical Seller-facing explanations reference the version used at the time.

Record metric_definition_version, canonical paid cohort membership/date/timezone, maturity cutoff/policy, revision/supersession lineage, late closures, exclusions, numerator distinct Orders, denominator distinct Orders and minimum-sample status. Recompute affected cohorts on approved correction without rewriting raw history.

## 57. Minimum samples

Do not render a zero rate as “perfect” when no denominator exists. Return INSUFFICIENT_EVIDENCE. Rate-based demotion requires the configured minimum sample and event floors; immediate upheld-Claim rules are not rate-based and therefore do not wait for sample size.

## 58. Level recompute function

```
recomputeSellerTrust(sellerId, decisionTime)
  load current effective policy and canonical evidence
  separate favourable promotion exclusions from adverse findings
  fold decision/correction + Finance completion lineage per incident
  evaluate serious/repeated/unresolved consequences once
  compute same-cohort distinct paid-Order metrics if policy approved
  evaluate recovery / promotion using existing approved values
  append justified transition + snapshot + outbox atomically
```

The existing 10 purchased Product units per Buyer-Seller policy week cap applies only to favourable evidence/promotion credit. Keep its existing whole-Order threshold-crossing treatment for favourable QR/Review credit. Confirmed adverse findings remain countable at 9/10/11/20 units and across split Orders; caps cannot hide genuine Seller fault, cancellation or unresolved remedies. Independent abuse/duplicate review can invalidate proven false evidence with correction lineage, not a volume-based adverse blind spot.

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

## 59. No direct level update

Application roles do not receive generic UPDATE permission on Seller level. Every change goes through a trusted domain command/function that records evidence snapshot, policy version, prior level, next level, source, reason code and correlation ID.

Separate Operator review/correction commands may append justified evidence changes, then invoke the same deterministic recompute function. No Operator, Founder, Staff, Seller or client receives a generic set-level capability.

## 60. Historical snapshots

Paid Orders may snapshot the Seller Trust level/public facts the Buyer saw. A later promotion or demotion changes future presentation and Recommendation signals only; it does not rewrite the historical Order or imply the Seller had the new level at purchase time.

### PART VI - DATA MODEL, EVENTS, TRANSACTIONS & APIS

## 61. Core data model

Keep canonical level state, immutable events, policy/evidence versions, recovery gates and pending-demotion lineage in PostgreSQL. Ordinary Seller/Buyer references and privileged Operator references remain separate typed foreign keys.

| Entity | Key fields / purpose |
| --- | --- |
| seller_level_state | seller_id PK; level_name; tier; ladder_entered_at; level_changed_at; config_version; evidence_version; updated_at |
| seller_level_event | id; seller_id; from/to; source; trigger; evidence_snapshot_ref; config_version; effective_at; reversed_by_event_id |
| trust_policy_version | market_id; category_policy_key; effective range; promotion/demotion/recovery thresholds; status; proposed/approved Operator Account references |
| trust_metric_snapshot | seller_id; metric_kind; window; numerator/denominator; distinct Buyers; band; config_version |
| trust_recovery_gate | seller_id; target_level; started_at; repeat_index; required days/Orders/Handoffs; status |
| trust_pending_demotion | seller_id; trigger; earliest_effective_at; source_ref; status |
| trust_evidence_exclusion | seller_id; source kind/ref; reason_code; policy_version; effective_at; reversal_ref |
| trust_review_case | seller_id; challenged_event_id; state; claimed_by_operator_account_id; evidence_refs; decision_refs; case_version |
| trust_review_decision / audit | operator_account_id; capability; case/version; evidence/command reference; policy; reason; request/time; approval context when required |

## 62. Level representation

Recommended enum: NEW, REBUILDING, ESTABLISHED, TRUSTED. Add a derived behavioral tier if useful: ENTRY for NEW/REBUILDING, ESTABLISHED, TRUSTED. Business logic should read tier where rules are shared and level_name where public copy differs.

## 63. Policy schema - promotion

| Field | Launch value |
| --- | --- |
| established_min_days | 60 |
| established_min_completed_orders | 50 |
| established_min_qualifying_handoffs | 45 |
| trusted_min_days | 365 |
| trusted_min_completed_orders | 501 |
| trusted_min_qualifying_handoffs | 450 |
| trusted_recent_handoffs_count / window | 20 / 365 days |

## 64. Policy schema - performance

| Field family | Launch value |
| --- | --- |
| cancellation watch/demote | TRUSTED 2%/5%; ESTABLISHED 4%/8% |
| scan completion watch/demote | TRUSTED 90%/80%; ESTABLISHED 85%/70% |
| claim rate watch/demote | PRIOR POLICY REFERENCE: TRUSTED 1%/2%; ESTABLISHED 2%/4%; new same-paid-cohort activation PENDING maturity/calibration approval |
| evaluation/demotion window | Monthly; trailing 90 days |
| low-volume/min sample | 365 days fallback; 30 Orders |
| event floors | Cancellation/unscanned prior approved floors retained; Claim-rate floor is prior reference pending same-cohort policy approval. |
| repeat-Buyer Product-unit limit | 10 per Buyer-Seller policy week |
| dormancy | 20 qualifying Handoffs / 365 days |

## 65. Policy validation constraints

• TRUSTED promotion thresholds must be stricter than ESTABLISHED thresholds.

• Handoff count cannot exceed Order count in a promotion rule.

• Maximum-type watch < demote; minimum-type scan demote < watch.

• TRUSTED demotion standard is never looser than ESTABLISHED.

• Watch/demote pair is both present or both disabled.

• Recovery values are positive and bounded by the intended policy.

• Effective ranges for one Market/category policy cannot overlap.

## 66. Canonical events

| Registered canonical fact | Trust owner interpretation |
| --- | --- |
| payment.verified | Canonical verified-paid Order cohort membership; preserve real duplicate charges without double-counting Order. |
| order.completed | Completed-Order promotion history; never sole Claim-rate denominator. |
| handoff.verified | Current final QR/delegate/purpose evidence; favourable promotion cap only. |
| review.published | Basis-aware Seller-service / received Product-quality projections; no star-driven automatic level. |
| claim.decision_recorded | Structured severity/fault/remedy/correction incident; current approved consequence and distinct-Order cohort. |
| refund.status_changed | Finance verified money completion/timing; pending/refused/overdue are not completed. |
| moderation.enforcement_changed | Independent safety restriction and proven-evidence correction through owner policy. |
| trust.level_changed | Committed Trust result for consumer projections/notices; replay deduped. |

Event version is the envelope/registry schema version, not a new independent suffixed fact. Retained historical producer names require explicitly versioned compatibility only when actual deployed evidence demands it. Future cancellation, disruption or policy-activation extensions require a governed entry in the EVT registry before emission; configuration/illustrative names cannot bypass its closed contract.

Version the structured Claim consequence fact: incident_id, seller_order_id, seller_fault, severity, remedy_responsibility, amount/currency, deadline, verified_completion_status/time, resolution_classification, decision_id/version, supersedes_decision_id and correction lineage. One logical consequence per incident/decision; repeated delivery is deduplicated with durable PostgreSQL effect identity. Corrections repair derived outcomes, never overwrite old decisions or real financial facts. Missing severity/maturity/calibration values remain pending policy evidence.

Also consume claim.decision_corrected and verified claim.remedy_completed with current supersession/completion reads. handoff.verified favourable final-receipt effects require stage DELIVERY; PICKUP is custody evidence only. Per-incident/version and per-consumer effects prevent replay from counting an adverse finding or favourable credit again; G04 values remain unapproved where absent.

## 67. Transactional outbox

Domain owners commit canonical facts and an outbox record together. Trust consumers are idempotent. Duplicate event delivery must not duplicate Handoff credit, count a Claim twice, create two level events or increment projections twice.

## 68. Trust API - public

```
GET /v1/sellers/{sellerId}/trust
  -> level_name
  -> public_description
  -> public reliability statistics
  -> evidence sample sizes / freshness
  -> last_qualifying_handoff_month?
  -> no private demotion reason/history
```

## 69. Trust API - Seller

```
GET /v1/sellers/{sellerId}/trust/dashboard
GET /v1/sellers/{sellerId}/trust/evidence
GET /v1/sellers/{sellerId}/trust/recovery
POST /v1/sellers/{sellerId}/trust/review-cases
GET /v1/sellers/{sellerId}/trust/review-cases/{id}
```

Server authorization uses the current Seller-team role model. Read-only specialist access follows explicit permissions; no role gets direct level mutation.

## 70. Trust API - Operator

```
GET /v1/operator/trust/sellers/{sellerId}
GET /v1/operator/trust/review-cases
POST /v1/operator/trust/review-cases/{id}/claim
POST /v1/operator/trust/review-cases/{id}/decision
POST /v1/operator/trust/evidence/{id}/correct
```

Operator decisions correct evidence or review a Trust event. The UI never exposes “set seller level = TRUSTED”.

Operator Account is a separately provisioned privileged internal principal. A person may also hold an ordinary Account, but credentials, sessions, strong authentication, recovery, revocation and audit identity remain independent. Ordinary Account OTP, Seller roles, public registration and Mode switching never create Operator authority.

Privileged workflows require an isolated OPERATOR session, current explicit capability, exact resource/Market/case scope, strong authentication and freshness, plus approval when the existing Founder/Staff governance requires it. Restricted evidence needs its own current capability and case/purpose authorization; ADMIN supplies no universal bypass. Record operator_account_id, capability, policy, case/version, reason, request/time and applicable approval context. No impersonation or direct generic domain-state setter is introduced.

The Operator API above is available only to a current separate OPERATOR principal with the exact Trust review/correction capability. Ordinary Accounts, stale capabilities, generic ADMIN and direct level-setting requests are denied. Evidence correction is append-only and returns the recomputed policy result, never a selected level.

## 71. Error taxonomy

| Code | Meaning |
| --- | --- |
| TRUST_POLICY_NOT_CONFIGURED | Required Market/category policy unavailable |
| TRUST_EVIDENCE_INSUFFICIENT | Rate decision lacks minimum sample |
| TRUST_PROMOTION_BLOCKED | One or more guard/recovery conditions not met |
| TRUST_REVIEW_ALREADY_OPEN | Existing unresolved Trust review case |
| TRUST_EVENT_ALREADY_APPLIED | Idempotent duplicate |
| TRUST_EVIDENCE_EXCLUDED | Evidence exists but cannot influence Trust under anti-gaming policy |
| TRUST_UNAUTHORIZED | Actor lacks Trust read/review authority |

### PART VII - SURFACES, EXPLAINABILITY & FAIRNESS

## 72. Buyer-facing representation

Discovery cards may show a lightweight current public Trust badge when useful; avoid stuffing reliability detail into every Scene card. Product detail, Seller profile/Storefront and an explicit Trust explanation surface may show approved level description, Seller-service summary, scan-completion/cancellation/Claim reliability and sample context.

Only public approved features enter Search/FYP. Internal anti-gaming reasons, private disputes, Buyer/delegate identifiers and detailed demotion evidence remain private to authorized Seller or restricted Operator views.

## 73. Seller Trust dashboard

Show current level, each next-level requirement, exact current counts, active health bands, metric numerators/denominators, WATCH/AT_RISK notices, pending demotion timing, recovery gate, excluded-evidence categories at safe granularity and how to request review.

## 74. No listing-count warning

Because Trust does not limit Product count, Seller UI must not show “publish more Products when Established”, “choose which Products remain after demotion”, or similar legacy copy. Level change never triggers Catalogue unpublishing.

## 75. FYP integration

Marketplace Search launches with PRODUCT_POST, SELLER and SCENE_POST. Scene eligibility is current PUBLIC plus Seller/Market/Moderation/media/tag availability gates; PostgreSQL + pg_trgm and bounded derived projections remain the baseline. FYP top-level units are image/photo Scene Posts only. Product Posts remain Product-detail, tag, Shop and Search commerce destinations. Buyer Home retains For You (default), Following, Nearby, Discounts and Locally Made; none bypasses public eligibility. Ranking follows hard gates and belongs to Search/Recommendation, never this domain.

Recommendation consumes the current Trust level and bounded public reliability features as one family after all hard public gates. Trust does not choose placement, paid boost, Search/FYP rank or retrospective impressions. A level event invalidates future Trust features via outbox; Search Product/Seller/Scene ranking remains query-led and organic.

Scene stock-driven PRIVATE removes public eligibility but is not itself a Trust consequence. Current visibility and Moderation denial override any positive Trust signal.

## 76. Reviews and Trust display

Keep Product-quality and Seller-service ratings separate. A Product rating is not a Seller Trust level. Seller-service ratings are reputation evidence but do not directly demote the ladder at launch. Review provenance may say Verified Handoff where Reviews allows it; Trust level remains a separate concept.

## 77. Appeals / Trust review

Sellers can challenge a consequential Trust event by identifying incorrect evidence or attribution. They cannot negotiate a different threshold case-by-case. Reviewer corrects source attribution/evidence; the engine recomputes using the same versioned policy.

A separate Operator Account with current review/evidence capability handles the case under existing approval governance. Record privileged actor, reason, evidence/source correction, policy, case version and approval context. The Seller does not negotiate a threshold or choose a level.

![Ordinary relationships and privileged authority are independent](graphics/TRUST_03.svg)
*Figure 03. Ordinary relationships and privileged authority are independent. The same human may possess both principals, but session, credential, recovery, scope and audit do not cross from an ordinary Account to an Operator Account.*

## 78. Fairness diagnostics

Operations should monitor level distribution, promotion latency, demotion rate by Market/category, percentage of excluded Handoffs, repeat-Buyer suppression rate, claim/cancellation attribution corrections, successful Trust reviews and sample-size insufficiency. These metrics are diagnostic; they do not silently alter the policy.

### PART VIII - CONFIGURATION, GOVERNANCE & CATEGORY EVOLUTION

## 79. Versioned per-Market policy

Trust thresholds live in typed, effective-dated configuration. PostgreSQL is canonical. Every level event references the exact config version. Current launch categories Fashion, Cosmetics and Electronics share the same policy key.

## 80. Future category-specific rules

When Adulis adds materially different categories, introduce category-policy grouping rather than hard-coded branches. A Seller/Product category may resolve to a Trust policy group such as GENERAL_RETAIL_V1 or a future category-specific group. New thresholds require governance, simulation and explicit activation; existing history is not rewritten.

## 81. Configuration activation

Critical Trust policy changes require proposal, diff, simulation, second-person approval under Operator governance, future effective time, audit record and rollback plan. A change that would make Sellers immediately fail a new metric should first issue notices rather than surprise-demote on activation.

Consume existing Founder/Staff governance for privileged policy activation. Proposed/approved actor references are operator_account_id, with distinct current authorization, strong-auth freshness and independently required approval. Ordinary Account registration/recovery, Seller role union and ADMIN are not policy authority.

## 82. Policy simulator

Before activating a threshold version, run historical/beta evidence through the proposed policy and report expected counts by level, promotions, demotions, recovery durations, repeat-Buyer exclusions and low-sample Sellers. Simulator output is advisory; production decisions still use the activated version.

## 83. Threshold publication

Seller-facing policy documentation publishes the level requirements, performance thresholds, evaluation cadence, recovery path and dormancy rule. Security-sensitive anti-gaming implementation details may be summarized rather than exposing evasion mechanics.

## 84. Declared disruptions

A Market can declare dated disruption periods through governed configuration for events such as provider-wide checkout outages, regional emergency or broad connectivity failure. Only approved periods alter metric windows; clients cannot self-declare an exclusion.

## 85. No feature-flag level arithmetic

Feature flags may expose UI or rollout behavior but cannot substitute for Trust policy. Client code never receives thresholds and calculates the authoritative level. All level decisions are server-side and versioned.

### PART IX - SECURITY, PRIVACY, ONLINE OPERATION & FAILURE SEMANTICS

## 86. Online-only authority

Every Trust-affecting command and every final Handoff verification used by Trust requires current backend connectivity. The client may cache read-only presentation data for performance, but no local device state can create Handoff credit, publish a Trust decision, apply a demotion or grant promotion.

## 87. Authorization

One ordinary human uses one stable ordinary Adulis Account across Buyer capability, Seller ownership, Seller-team participation and a persistent Courier profile. Different humans use different Accounts and never share credentials. Ownership, team membership and Courier relationships are independent; a team Account may have multiple active roles whose current permissions compose within the exact Seller scope.

At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the ordinary Account's team slot. Seller ownership and many private Seller-Courier Pool relationships do not consume that slot. Switching Buyer/Seller/Courier Mode changes presentation and current context, never identity or authority.

Operator Account is a separately provisioned privileged internal principal. A person may also hold an ordinary Account, but credentials, sessions, strong authentication, recovery, revocation and audit identity remain independent. Ordinary Account OTP, Seller roles, public registration and Mode switching never create Operator authority.

Privileged workflows require an isolated OPERATOR session, current explicit capability, exact resource/Market/case scope, strong authentication and freshness, plus approval when the existing Founder/Staff governance requires it. Restricted evidence needs its own current capability and case/purpose authorization; ADMIN supplies no universal bypass. Record operator_account_id, capability, policy, case/version, reason, request/time and applicable approval context. No impersonation or direct generic domain-state setter is introduced.

Buyer cannot mutate Trust. Seller ownership/team role union permits only current scoped Seller reads and review requests, never level/evidence mutation. Backend Trust recomputation uses trusted service identity, canonical evidence and policy; a client-supplied role, counts_toward_level or metric band is rejected.

## 88. PII minimization

Trust stores opaque Account/Buyer references needed for anti-gaming and audit, not raw chat bodies, payment secrets, OTP/QR credentials, private delegate phone values or unnecessary social profile content. Public Trust reads never expose Buyer identities.

Current platform Seller admission/Trust does not require or store Government-ID, passport, national-ID, selfie-to-ID or biometric identity evidence. Approved social-account control/business admission belongs to Onboarding/Verification. Provider-owned PSP KYC remains a separate provider boundary; it is not a platform identity-document evidence store. A future formal requirement needs explicit versioned product/privacy/provider approval.

## 89. Secrets and logging

Pino/Sentry logs carry request/correlation IDs, Seller reference, policy version, metric kind and stable reason code. Never log QR/OTP content, provider secrets, access/session tokens or private Claim evidence. Valkey keys must not encode sensitive raw phone/email values.

## 90. Valkey role

Valkey supports bounded read caches, distributed rate coordination and BullMQ. It is never authoritative for Seller level, metric history, Handoff credit, Claim consequence or policy. Valkey loss degrades performance and queue availability but cannot erase canonical Trust truth.

## 91. Failure behavior

| Failure | Required behavior |
| --- | --- |
| Trust worker unavailable | Order/Handoff/Review remain valid; Trust projection may lag; backlog/reconciliation alert |
| Valkey unavailable | Fall back to PostgreSQL for critical reads where safe; queue-dependent recompute delayed; no guessed level |
| Claims unavailable | Do not invent Claim outcome; keep last canonical Trust state |
| Handoff unavailable | No new accepted final Handoff; therefore no new scan credit |
| Policy resolution fails | Fail closed for promotion/demotion command; public read may show last canonical level with freshness metadata |
| Analytics unavailable | No effect on Trust truth |

## 92. Deletion and retention

Account/Seller deletion follows Privacy/Data Lifecycle rules. Public Seller visibility may disappear, while level events/evidence references required for open Claims, corrections, security or lawful retention remain under policy. Deletion does not rewrite historical Orders or Trust decisions.

## 93. Reconciliation

Scheduled reconciliation compares canonical evidence with Seller-level state, metric projections, qualifying-Handoff credits and pending/recovery records. Mismatch creates an integrity incident. Reconciliation corrects through append-only events, never silent historical mutation.

### PART X - TECHNOLOGY STACK, INTEGRATIONS, OBSERVABILITY & DEPLOYMENT

## 94. Latest technology baseline

| Layer | Current baseline |
| --- | --- |
| Backend | Node.js; NestJS; Fastify; strict TypeScript |
| Persistence | PostgreSQL; Drizzle ORM; pg_trgm; btree_gist; pg_stat_statements |
| Async / cache | Valkey; BullMQ; transactional outbox |
| API | REST; OpenAPI; @nestjs/swagger; generated TypeScript clients |
| Security | @nestjs/throttler; @fastify/helmet; server-side authorization; libphonenumber-js where phone normalization is needed upstream |
| Mobile reference | React Native; Expo; Expo Router; TanStack Query; FlashList; Expo Image; Expo SecureStore; Expo Camera; Expo Notifications; Expo Updates; small Zustand store |
| Quality | Jest; Testcontainers; Maestro; Playwright; k6 |
| Observability | Sentry; Pino structured logs; pg_stat_statements |
| Architecture control | dependency-cruiser |
| Delivery | Docker; GitHub Actions; Render; Cloudflare; EAS |

Trust itself does not need a standalone microservice at MVP. It belongs in the Adulis Platform modular monolith behind explicit public domain interfaces.

## 95. Module structure

```
apps/platform-api
  modules/trust
    application/
    domain/
    infrastructure/
    api/
    jobs/
    projections/
    policy/
    tests/
```

```
packages/contracts
  generated OpenAPI client/types only; no database access
```

## 96. Primary integrations

| Domain | Trust consumes / emits |
| --- | --- |
| Onboarding | Consumes Seller admission/lifecycle; starts ladder once eligible |
| Orders | Consumes PAID/COMPLETED/cancellation attribution and Order snapshots |
| Handoff | Consumes accepted final Handoff and method/delegation refs |
| Reviews | Consumes published Review facts; emits no Review eligibility |
| Claims | Consumes structured final/seller-resolved outcomes; emits level consequence events |
| Moderation | Consumes confirmed evidence invalidation/manipulation; emits Trust review context |
| FYP/Recommendation | Provides current Trust features; never accepts ranking writes |
| Storefront / Seller Console / Mobile | Provides bounded read models |
| Notifications | Emits promotion/demotion/watch/recovery messages |
| Analytics | Emits privacy-minimized Trust events; Analytics is never level authority |

| Additional current integration | Contract |
| --- | --- |
| Search | PRODUCT_POST / SELLER / SCENE_POST from launch; public Trust/reliability features only; retrieval and rank stay Search-owned |
| Content / Scene lifecycle | Current PUBLIC gate; availability-driven PRIVATE/PUBLIC does not itself affect level |
| Auth / Operator | One ordinary multi-relationship Account; separate privileged principal and typed Operator review/approval audit refs |

## 97. Observability

Monitor recompute latency, outbox lag, BullMQ age, Valkey availability, promotion/demotion job errors, metric freshness, level-event mismatch, exclusion rate, pending-demotion age, recovery-gate age, successful review corrections and database query plans. Alert on direct-level-write attempts and duplicate evidence-credit detection.

Observe separate Operator denial/revocation, review/correction evidence audit, Search/FYP projection freshness and inappropriate level changes caused solely by Scene availability. Public observability never exposes private anti-gaming reasons.

## 98. Performance architecture

Public Trust read is projection-first and bounded. Do not aggregate lifetime Orders/Handoffs/Claims on every Storefront/FYP request. Incremental counters and periodic reconciliation provide fast reads while PostgreSQL remains canonical. Use indexed time-window queries for monthly evaluation jobs.

## 99. Deployment

Trust ships with adulis-platform through Docker/GitHub Actions/Render and the shared database migration pipeline. Threshold/config migration and code deployment are separate concerns: activating a policy version is an audited production operation, not merely deploying application code.

### PART XI - TESTING, MIGRATION, LAUNCH GATES & FINAL ARCHITECTURE

## 100. Core transition tests

| Test | Expected |
| --- | --- |
| 60d/50/45 | Promote NEW -> ESTABLISHED if healthy |
| 365d/500/450 | Remain ESTABLISHED |
| 365d/501/450 + healthy + recent activity | Promote -> TRUSTED |
| ESTABLISHED demotion | REBUILDING |
| Approved serious/repeated/unresolved drop at TRUSTED | Apply approved level consequence once; recovery begins. Minor + verified timely remedy has no automatic drop. |
| NOT UPHELD Claim | No mandatory demotion |
| Confirmed manipulation removes enough credit | Recompute may move multiple levels |
| Product count changes | No Trust level change or Product unpublish |

Additional specified cases: minor/timely completion, serious/repeat/refusal/overdue/late completion, overturned/replayed decision, same paid non-delivery cohort, zero denominator and 9/10/11/20-unit adverse findings. No execution is claimed.

## 101. Handoff and delegation tests

• Seller->Courier pickup never advances Seller level.

• Buyer QR final Handoff may create one qualifying Handoff.

• Authorized delegate QR final Handoff may create the same one qualifying Handoff for the Buyer Order.

• OTP/Manual final Handoff completes commerce/review eligibility but does not increment scanned-Handoff promotion count.

• Replay/wrong-stage/wrong-recipient QR creates zero Trust credit.

• Revoked/replaced delegate cannot create Trust credit.

## 102. Repeat-Buyer tests

• 1-10 Product units in the Buyer-Seller policy week: otherwise-valid Trust evidence remains eligible.

• Exactly 10 units remains inside the limit.

• Threshold-crossing / over-limit scope is excluded from favourable/promotion credit only; confirmed adverse findings remain countable.

• Suppression does not block Order completion, Handoff, Review publication, Claim or refund rights.

• Suppression reason is auditable and cannot be set by the client.

• New policy week resets the counter.

## 103. Demotion/recovery tests

• Performance breach requires minimum sample, event floor, notice month and new adverse evidence.

• Two metrics breaching in one evaluation cause at most one performance level drop.

• Second upheld Claim within pace window creates pending consequence rather than immediate double-drop.

• Dormancy affects TRUSTED only and uses the 20-in-90 restoration path.

• Recovery gate fresh counts begin at level_changed_at.

• Successful evidence correction reverses via append-only compensation.

## 104. Security and integrity tests

• Buyer/Seller client cannot set counts_toward_level, level, policy version or metric band.

• Seller-team member self-order is excluded.

• Operator cannot directly set arbitrary level.

• Valkey deletion does not erase canonical level.

• Duplicate BullMQ/outbox delivery is idempotent.

• Public API never reveals private Buyer/delegate identifiers.

• Logs contain no QR/OTP/provider secrets.

Retain all promotion, demotion, sampling, repeat-Buyer, correction/recovery and dormancy cases. Add current identity/discovery/content regression scenarios below.

• Current regression 01: Superseded content identifiers no longer appear as current types.

• Current regression 02: Scene Post/FYP consumes Trust projection but cannot set level.

• Current regression 03: Search Seller/Product/Scene ranking may consume public Trust features only.

• Current regression 04: Scene stock-driven PRIVATE transition does not affect Trust by itself.

• Current regression 05: Operator ordinary Account cannot review/correct Trust evidence.

• Current regression 06: Authorized separate Operator Account can perform permitted review action.

• Current regression 07: Operator cannot directly set Seller level.

• Current regression 08: Trust level never alters Product listing count.

• Current regression 09: Creator-as-Seller follows same Trust ladder; no separate Creator ladder.

• Current regression 10: No Government-ID evidence changes level.

## 105. Migration from v1.0

1 Add REBUILDING level name and behavioral-tier mapping.

2 Remove all Trust-controlled Product-count restrictions and downgrade unpublishing behavior.

3 Set ESTABLISHED promotion to 60d / 50 completed Orders / 45 qualifying scanned Handoffs.

4 Set TRUSTED promotion to 365d / >500 completed Orders (minimum 501) / 450 qualifying scanned Handoffs + health/recent-activity guard.

5 Add performance watch/demote thresholds, event floors, dormancy and recovery-gate models from the attached final metrics.

6 Replace old transaction-state dependencies with provider-verified paid/completed Order facts.

7 Replace old Handoff assumptions with current online Handoff Verification and delegated-recipient semantics.

8 Add repeat-Buyer weekly Product-unit suppression at 10, limited to favourable/promotion credit; confirmed adverse findings remain countable.

9 Replace all cache naming with Valkey and remove disconnected Trust-credit paths.

10 Rebuild public/Seller/Operator read models and final architecture.

For v3 integration migration, canonical content references become Scene Post; Search consumes the current public projection; ordinary Account relationships remain one identity and privileged review/approval refs migrate to separate Operator Account FKs using explicit mapping. Do not infer missing actors or rewrite historical policy/evidence snapshots. Recompute with the retained numerical policy only where canonical evidence changed.

## 106. Production launch gate

• All four level names render correctly; REBUILDING cannot be confused with NEW.

• Trust level does not change Product listing count.

• NEW -> ESTABLISHED boundary tests pass.

• TRUSTED requires day 365, minimum 501 completed Orders and 450 qualifying scanned Handoffs.

• Promotion guards and minimum-sample rules pass.

• All attached demotion thresholds are represented in versioned configuration.

• Upheld-Claim, performance, dormancy and recovery paths pass deterministic fixtures.

• Delegated-recipient QR Handoff can count; invalid delegation cannot.

• Repeat-Buyer weekly cap is favourable-only and cannot affect owning-domain rights.

• No client can set level/credit fields.

• PostgreSQL constraints prevent overlapping active policy ranges.

• Valkey/BullMQ outages cannot corrupt canonical Trust state.

• Seller-facing explanation shows exact rules and recovery.

• Public API exposes facts without private accusation detail.

• Reconciliation, Sentry/Pino and pg_stat_statements monitoring are live.

• Jest/Testcontainers/Maestro/Playwright/k6 critical suites pass.

Current launch also requires separate Operator authority, lightweight discovery vs detailed Product/Seller Trust presentation, no Scene lifecycle/rank ownership, no Creator-specific ladder and no Government-ID Trust input. Original numerical boundary and recovery tests remain mandatory.

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 107. Canonical write-backs

Current write-backs: Claims exposes structured fault/severity/incident/decision/correction and remedy deadline; Finance exposes verified completion/timing. Reviews provides one Buyer/Order receipt-or-failure identity, Seller-service facts and received-only Product quality. Orders/Finance provide same verified-paid cohort membership including non-delivery; Handoff separately provides valid final QR promotion evidence. Analytics implements the same distinct-Order cohort and favourable-only cap. Console/Mobile/Storefront explain truthful current facts; no listing cap, paid level, Government-ID requirement or generic Operator level setter.

A minor upheld Seller-fault Claim with verified remedy completion within its approved deadline remains adverse evidence but does not automatically drop the Trust level. Serious, repeated or unresolved failures retain stronger approved consequences. Refusal, promise and late/unverified completion do not qualify as a timely remedy. Claims owns fault/severity/adjudication; Finance owns money completion; Trust owns versioned consequences and NEW versus REBUILDING semantics. Moderation restrictions remain independently owned.

Claim rate = DISTINCT qualifying affected verified-paid Seller Orders / DISTINCT eligible verified-paid Seller Orders in the SAME purchase cohort, including paid non-delivery. Select by canonical verified-payment cohort date and Market timezone; assign one Order once despite line/multiple Claims and retain inspectable membership. An effective metric policy must specify cohort window, maturity, late closure/reopening/correction, exclusions and minimum samples. Zero denominator returns INSUFFICIENT_EVIDENCE, never zero/perfect or division by zero. No numerator Order exists outside its denominator. Missing maturity/calibration is PENDING; do not deploy recalibrated demotion thresholds as validated.

The existing 10 purchased Product units per Buyer-Seller policy week cap applies only to favourable evidence/promotion credit. Keep its existing whole-Order threshold-crossing treatment for favourable QR/Review credit. Confirmed adverse findings remain countable at 9/10/11/20 units and across split Orders; caps cannot hide genuine Seller fault, cancellation or unresolved remedies. Independent abuse/duplicate review can invalidate proven false evidence with correction lineage, not a volume-based adverse blind spot.

## 108. Final System Architecture

Canonical Order, Handoff, Claims, Reviews and confirmed Moderation facts feed the same policy-versioned deterministic engine. The engine applies exclusions, demotion/recovery/promotion and writes level state, immutable event and outbox atomically. Authorized separate Operator corrections alter evidence with audit, then recompute; no actor directly sets level.

![Adverse findings remain visible; consequences are proportionate](graphics/TRUST_04.svg)
*Figure 04. Adverse findings remain visible; consequences are proportionate. Trust never sells levels or sets Moderation restrictions; changed rates are not calibrated by document editing.*

![Adverse findings remain visible; consequences are proportionate](graphics/TRUST_05.svg)
*Figure 05. Adverse findings remain visible; consequences are proportionate. Trust never sells levels or sets Moderation restrictions; changed rates are not calibrated by document editing.*

Search/FYP/Storefront consume safe current public features; Seller Console receives detailed private progress/notices. PostgreSQL owns history; Valkey/BullMQ support execution and reconciliation only.

## 109. Final engineering doctrine

Trust is a public claim about evidence, not a hidden judgment about character. A Seller reaches a level only through ratified, inspectable rules. Handoff credit comes from authoritative physical-transfer evidence; delegated receipt is valid when the Handoff system proves the delegation. Repeated-buyer anti-gaming caps favourable/promotion credit only. Product listing count is never a Trust entitlement. Demotion is explainable, paced and recoverable. Confirmed false evidence is corrected, not preserved for convenience.

For the launch categories, the binding promotion ladder is: NEW -> ESTABLISHED at 60 days + 50 completed Orders

### + 45 qualifying scanned Handoffs; ESTABLISHED -> TRUSTED at 365 days + at least 501 completed Orders + 450

### qualifying scanned Handoffs, with current health and activity guards.

### APPENDIX A - LAUNCH CONFIGURATION REFERENCE

| Parameter | Launch value |
| --- | --- |
| Levels | NEW / REBUILDING / ESTABLISHED / TRUSTED |
| NEW->ESTABLISHED | 60d / 50 completed Orders / 45 qualifying scanned Handoffs |
| ESTABLISHED->TRUSTED | 365d / >500 completed Orders (min 501) / 450 qualifying scanned Handoffs |
| TRUSTED recent activity | 20 qualifying Handoffs / 365d |
| Cancellation watch/demote | TRUSTED >2% / >=5%; ESTABLISHED >4% / >=8% |
| Scan completion watch/demote | TRUSTED <90% / <80%; ESTABLISHED <85% / <70% |
| Claim rate watch/demote | PRIOR POLICY REFERENCE: TRUSTED >1% / >=2%; ESTABLISHED >2% / >=4%; new same-paid-cohort activation PENDING maturity/calibration approval |
| Performance window / cadence | Trailing 90d; monthly on 1st |
| Low volume | 365d fallback; minimum 30 eligible Orders |
| Event floors | Cancellation 4; unscanned 6 from 3 Buyers retained; previous Claim floor 3/3 Buyers is reference pending same-cohort maturity/calibration approval. |
| Dormancy | TRUSTED -> ESTABLISHED below 20 qualifying Handoffs / 365d |
| Recovery ESTABLISHED | 30d / 25 Orders / 23 Handoffs; repeat rules apply |
| Recovery TRUSTED | 90d / 100 Orders / 90 Handoffs; repeat rules apply |
| Repeat-Buyer suppression | 10 purchased Product units / Buyer-Seller policy week |
| Product/item listing count | Not limited by Trust level |
| Current category policy | Fashion + Cosmetics + Electronics share launch config |
| Future category policy | Versioned category-policy groups |

### Source reconciliation note

The attached final Trust Ladder metrics remain the basis for demotion, recovery, dormancy and the NEW->ESTABLISHED path. This current edition intentionally removes the attachment's older 10-Product restriction because the current founder instruction explicitly states that Product/item count is not capped by Trust. This current edition also interprets “more than 500 completed Orders” literally as a minimum of 501 for TRUSTED, superseding the attachment's earlier 500-or-more wording.

### APPENDIX B - ARCHITECTURE FITNESS FUNCTIONS

• No occurrence of the retired commerce object may exist in Trust schema, API, tests or UI copy.

• No cache/queue implementation may be treated as canonical Trust state; Valkey is support only.

• No device-only or delayed local action can change level or Handoff credit.

• No Seller Trust level may limit Product or item listing count.

• No role has a generic direct level setter.

• All promotions and demotions cite policy_version and evidence_snapshot_ref.

• Every qualifying scanned Handoff has one stable Order/Handoff identity and is idempotent.

• Delegated final QR receipt can count exactly once when authorization is valid.

• Repeat-Buyer suppression is applied only to favourable/promotion credit; adverse findings stay eligible.

• FYP/Analytics/Storefront cannot mutate Trust; they consume read models/events only.

• Historical Order Trust snapshots are not rewritten by later level changes.

• Public copy never exposes private case reasons or Buyer identity.

Current architecture fitness additionally requires canonical Scene types, PUBLIC eligibility before Search/FYP, separate Operator principal authorization/audit and no Government-ID or Creator-specific Trust inputs. All ratified numeric policy values above remain unchanged.

## 110. Hard invariants

• TRUST-INV-01 Levels are NEW, REBUILDING, ESTABLISHED, TRUSTED.

• TRUST-INV-02 NEW is entered only before Seller has ever held ESTABLISHED.

• TRUST-INV-03 Demoted experienced Seller below ESTABLISHED uses REBUILDING.

• TRUST-INV-04 Trust never limits Product count.

• TRUST-INV-05 Promotion requirements are conjunctive.

• TRUST-INV-06 Seller/Buyer/client/Operator cannot directly set level.

• TRUST-INV-07 Current ESTABLISHED threshold = 60d + 50 Orders + 45 qualifying scans + guards.

• TRUST-INV-08 Current TRUSTED threshold = 365d + >=501 Orders + 450 qualifying scans + activity/guards.

• TRUST-INV-09 Promotion scan credit requires eligible final Buyer/delegate QR under current policy.

• TRUST-INV-10 Pickup never creates Seller promotion credit.

• TRUST-INV-11 OTP/Manual may complete commerce/Review but not current QR promotion counter.

• TRUST-INV-12 Review stars do not directly set ladder level.

• TRUST-INV-13 Money cannot buy Trust.

• TRUST-INV-14 Repeat-Buyer suppression is favourable-only.

• TRUST-INV-15 Trust corrections are append-only/recomputed.

• TRUST-INV-16 PostgreSQL is canonical.

• TRUST-INV-17 Scene Post lifecycle is not Trust-owned.

• TRUST-INV-18 Search/FYP rank is not Trust-owned.

• TRUST-INV-19 Trust governance/review uses separate Operator Accounts.

• TRUST-INV-20 Government-ID evidence is not a current Trust input.

## 111. Glossary

| Term | Current meaning |
| --- | --- |
| Account | Ordinary stable human identity across Buyer, Seller and Courier relationships; never shared credentials. |
| Operator Account | Separate privileged internal principal with independent strong authentication, session, recovery and audit. |
| Product Post | Canonical structured public commerce representation of exactly one Product. |
| Scene Post | Canonical image-led Seller content with caption, Product tags and revision lineage. |
| SCENE_POST / ScenePost | Current API/event enum and entity name for Scene Post. |
| Shoppable Post | Superseded former name for Scene Post; not a current independent entity. |
| Publication state | DRAFT, PUBLISHED or ARCHIVED; separate from visibility and moderation. |
| PUBLIC / PRIVATE | Content-owned current visibility; PRIVATE denies all Buyer/public Scene resolution. |
| Product tag | Same-Seller Product reference within a Scene; mutable commerce resolves canonically. |
| Published revision | Immutable composition/version; attribution records the actual version served. |
| Seller Order | One Seller transaction anchored to PSP/backend-verified payment and canonical OrderLines. |
| Final Handoff | Accepted Buyer/delegate receipt; QR primary, OTP fallback, Manual recovery; Pickup differs. |
| Review Grant | One Buyer-owned eligibility/consumption per paid Seller Order; FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; delegate never owns it. |
| Trust level | NEW, REBUILDING, ESTABLISHED or TRUSTED, computed from ratified canonical evidence. |
| Transactional outbox | Durable committed facts for idempotent asynchronous consequences and repair. |
| Valkey / BullMQ | Non-canonical cache/queue and execution; PostgreSQL retains business truth. |
| NEW | Seller has never held ESTABLISHED; three behavioral tiers use four public labels. |
| REBUILDING | Previously stronger Seller below Established standing. |
| ESTABLISHED | 60 days + 50 completed Orders + 45 qualifying QR scans and guards. |
| TRUSTED | 365 days + at least 501 completed Orders + 450 scans and activity/guards. |
| Qualifying scan | Eligible final Buyer/delegate QR only; excludes Pickup and disallowed evidence. |
| WATCH / AT_RISK | Private metric bands and actionable notice before performance demotion. |
| Recovery gate | Fresh post-demotion days/Orders/scans under repeat-index policy. |
| Dormancy | TRUSTED-only recent-activity loss; restoration follows its distinct rule. |
| Repeat-Buyer suppression | 10 Product-unit weekly Buyer-Seller rule; favourable-only promotion exclusions; confirmed adverse evidence retained. |
| Evidence correction | Append-only invalidation/reversal followed by deterministic policy recomputation. |
| Policy snapshot | Exact effective policy/evidence lineage; later changes do not rewrite history. |

## 112. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-05 — Final Scene engagement model | The 13 October designs define Scene commerce/discovery but do not fully freeze the later action bar and presentation. | Scene actions are Like, Save, Share, Reviews, Follow, More and Explore the Scene. Like belongs to the Scene only and no public Like count is shown. Save saves the Scene only. Follow is Seller-level. More may include Not Interested where applicable, Hide this Scene and Report. Public comments and reposts are not part of the current MVP. Explore the Scene is the primary commerce-exploration action. | PR-004, 26-27 Oct 2026 |
| R-08 — Review presentation and write eligibility | The 13 October Reviews design separates Product Quality and Seller Service and defines evidence-based eligibility. | Anyone may read Reviews. Product Reviews expose Product Review and Seller Review. Scene Reviews expose one Product tab per distinct tagged Product plus Seller Review. Write/Edit controls appear only when authoritative Review eligibility exists; ineligible viewers see no composer. Product Quality and Seller Service remain separate. One active Product Review and one active Seller Review are maintained per qualifying entitlement; edit updates instead of duplicating. Sellers cannot edit/delete legitimate Buyer Reviews; Report Review is a moderation utility. The prototype’s completed-order path does not silently remove the 13 October design’s VERIFIED_ORDER_FAILURE Seller-service basis; that failure basis remains valid unless a later founder decision explicitly removes it. | PR-005, 27 Oct 2026 |
| R-09 — Seller profile and Storefront information architecture | The 13 October designs define Seller profile/Storefront content but not the final shared tab order. | Buyer Seller profile and standalone public Storefront share Scenes / Products / Reviews / About and open on Scenes. Scenes show the Seller’s Buyer-public eligible Scenes. Products show the catalogue with available first. Reviews is Seller Service; Product Quality remains on Product. About includes description, Trust facts, category, neighborhood/operating area, fulfilment, member since and social accounts. Collection point appears only where Buyer Collection is offered. Header actions are Follow and Message; the public Storefront hands these actions into the app. Trust is information, not a button. | PR-002, 26 Oct 2026 |
| R-13 — Seller engagement analytics grouping | The 13 October Analytics design provides event/attribution architecture but not the final Seller-facing metric grouping. | Scene Performance prioritizes commerce outcomes (Explore opens, Product-detail visits, Seller inquiries, Orders initiated, verified completed Orders) before engagement counts (views, hotspot taps, Likes, Saves, Shares). Product Performance includes views, Saves, Product rating, inquiries and Order outcomes. Seller Reputation keeps Seller rating, Product ratings, verified completed Orders, service quality and Trust separate. Do not blend popularity and Trust into one score. | PR-007, 27 Oct 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
