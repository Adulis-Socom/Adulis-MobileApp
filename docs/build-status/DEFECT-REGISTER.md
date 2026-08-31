# DEFECT REGISTER — Work Order T3, autonomous run

Append-only within this run. One entry per finding, written when found.
Format: Work Order T3 §3. Severity test for BLOCKER: **does it raise?**

---

### D-01 - Work Order T2-B is referenced and does not exist here
Severity:  QUESTION
Phase:     A, all migrations
Source:    Work Order T3 §4 -- "Governed by Work Order T2-B S2 to S4, which stands in full. Its per-migration traps are not repeated here; read it."
Found by:  pre-flight recon -- `docs/build-status/` holds only TIER-1-SPEC-GAPS.md and TIER-STATUS.md; repo-wide grep for "T2-B" is empty
Effect:    The per-migration trap list T3 defers to is unavailable. The four traps T3 restates in §4 are covered; anything T2-B adds beyond them is not.
Response:  PARKED
Action:    Proceeding under Work Order T2 Task C (which specified migrations 06-15 and CP-4..CP-7), T3 §4's restated traps, and ADU-DB-01 v1.10+A3 directly. Every migration cites its document section, so a T2-B trap that concerns a transcribed section is discharged by the transcription being checked against the document.
Ruling needed: Supply T2-B, or confirm T3 §4's four restated traps are the complete set.

### D-02 - The skills pack's governing-source lists are stale
Severity:  MINOR
Phase:     all
Source:    `.claude/skills/*/SKILL.md` -- e.g. spec-router names `ADU-DB-01 ... v1_6.md`, `ADU-API-01 ... v1_3.md`, `ADU-AUTH-01 ... v2_0.md`
Found by:  loading adulis-spec-router before Phase A
Effect:    A skill followed literally would route to superseded documents. T3 §1: where a skill and a governing document disagree, the document wins.
Response:  WORKED AROUND
Action:    Versions taken from `docs/amendments/README.md` (DB-01 v1.10+A3, AUTH-01 v2.4, API-01 v1.6, REPO-01 v1.2). Skills' procedures and hard blocks applied as written; their filename lists ignored where superseded. Not editing the skills pack mid-run -- it is `_staging`-delivered and shared-owned.
Ruling needed: Reissue the skills pack with current filenames (or make the source lists point at DOCUMENT_AUTHORITY.md instead of filenames).

### D-03 - Appendix C check 5's implementation would have failed on its first live run
Severity:  MAJOR (in the harness, not the schema)
Phase:     A, gate
Source:    ADU-DB-01 v1.10 Appendix C check 5 -- "Count trg_append_only triggers; count REVOKE UPDATE, DELETE -- 22 each, same tables"
Found by:  reading check-05-append-only.mjs before flipping CURRENT_TIER to 2
Effect:    The check asserted set EQUALITY between trigger-carrying tables and tables where adulis_app lacks UPDATE+DELETE. Tables deliberately stricter than append-only (verification.*, financial.* with no privileges at all; the legal transition tables; seller_level_state) would land in the second set without triggers and fail the gate -- a false FAIL that would have taught the reader to distrust the harness.
Response:  WORKED AROUND
Action:    check-05 rewritten before its first live run: exactly 22 triggers, and every trigger-carrying table revoked (append-only implies both mechanisms). The reverse implication is not the doctrine and is dropped, with the reasoning in the check header. Appendix B remains the count's source.
Ruling needed: none -- harness correction, invariant unchanged.

### D-04 - Release-reason set for A3.2 chosen, needs ratification
Severity:  QUESTION
Phase:     A, migration 09
Source:    AMENDMENT A3.2 -- "WHERE reason IN ( /* release reasons */ )"; ADU-DB-01 v1.10 §12.4 names "release reasons" and never enumerates them (reported at CP-4, unresolved)
Found by:  building migration 09's stock_release_once index and release_has_a_line CHECK
Effect:    The index and CHECK need a concrete reason list.
Response:  WORKED AROUND
Action:    {ORDER_EXPIRED, LINE_CANCELLED} -- the two stock_event_reason values whose semantic is stock returning from an order. SELLER_SET/RESTOCK/ORDER_CREATED are not releases; RECONCILIATION is delta=0 by §14.2 and releases nothing. Both index and CHECK carry the pair and a header note.
Ruling needed: Confirm the release-reason set is exactly {ORDER_EXPIRED, LINE_CANCELLED}.

### D-05 - nlu.intent_phrase.embedding has no dimension anywhere
Severity:  MAJOR
Phase:     A, migration 13
Source:    ADU-DB-01 v1.10 §17.2 -- "`embedding vector(N)`. HNSW index for layer 3." N appears nowhere in the document set; ADU-VAL-01 does not carry it either
Found by:  building migration 13
Effect:    pgvector requires a fixed dimension to build an HNSW index. Choosing N chooses the embedding model, which is a product/infrastructure decision, not a transcription.
Response:  PARKED
Action:    Column created as dimensionless `vector` (valid in pgvector; inserts of any single dimension work). The HNSW index is NOT created -- an index needs the dimension. Layer 3 remains functional-but-unindexed until N is ruled. Fails safe: slower, never wrong.
Ruling needed: The embedding dimension N (equivalently: which embedding model layer 3 uses).

### D-06 - waitlist.application is in the manifest but in no migration
Severity:  QUESTION
Phase:     A, migration 15
Source:    ADU-DB-01 v1.10 Appendix B counts `waitlist.application` in the 109; §28's fifteen-item migration list never names it; §25/C7 call the waitlist "its own store, in its own schema, with its own credentials" and "not a dependency of the product database"
Found by:  reconciling check 14's count of 109 against §28
Effect:    Check 14 cannot reach 109 without the table, and no migration is assigned to create it.
Response:  WORKED AROUND
Action:    Created in migration 15 (the final, transport/misc migration). The C7 separation is operational (the real waitlist deployment runs its own store); the schema definition living here is what the manifest already implies. Header note in the migration.
Ruling needed: Confirm placement, or amend §28 to name the migration that owns it.

### D-07 - Elided function bodies: built where prose fully determines them, parked where it does not
Severity:  QUESTION
Phase:     A/C boundary
Source:    ADU-DB-01 v1.10 elides bodies (`$$ ... $$` or prose-only) for: fn_publication_readiness, fn_publish_product, storefront search, post-link resolution (all four already A3.4: "owed by v1.11 -- correct not to build them"), plus billing.fn_effective_limit (§18.3), fn_evaluate_eligibility (§7.4), fn_recompute_seller_level (§8.1-8.2), fn_create_order (§12.3), fn_deletion_blockers / fn_delete_seller (§18.6), fn_request_payout_change / fn_cancel_payout_change (§13.4), fn_transfer_seller_ownership, fn_unpublish_product, financial.read_payment_evidence (signature + rules given), render_payment_instructions (numbered-comment skeleton)
Found by:  planning migrations 08-15
Effect:    Some of these are load-bearing for Phase A's own tests (T3 §4 explicitly orders the fail-closed ladder test, which needs fn_recompute_seller_level to exist).
Response:  split -- BUILT where every behavior is stated in prose and the function is needed by Phase A: fn_recompute_seller_level (criteria = the 16 named ladder_config columns + §8.1's three mechanisms + §8.2), fn_create_order (§12.3 enumerates every check and effect), ledger.fn_assert_balanced (double-entry balance per transaction), financial.read_payment_evidence and render_payment_instructions (rules given: derived role, log-in-same-transaction, ciphertext out). PARKED, with A3.4's own precedent: fn_publication_readiness, fn_publish_product, storefront search, post-link resolution, fn_effective_limit (jsonb shape and capability keys underdetermined), fn_evaluate_eligibility (edge semantics of the audience path underdetermined -- Phase C1 needs it), fn_deletion_blockers/fn_delete_seller (Phase C6), payout change functions (Phase C4), fn_transfer_seller_ownership, fn_unpublish_product (Phase C).
Ruling needed: v1.11 to print the parked bodies, or bless the built ones.

### D-08 - billing.tier_definition is described, never given columns
Severity:  QUESTION
Phase:     A, migration 14
Source:    ADU-DB-01 v1.10 §18.3 -- "billing.tier_definition (versioned: product cap, chatbot scope, blue tick, broadcast, analytics scope, team, support tier, API)"; §18.4 -- "tier_definition carries a row for the BETA state" (a STATE, while other rows are per TIER)
Found by:  building migration 14
Effect:    The exact C-series failure v1.10 §0.1 named ("a table described in prose and never given columns") -- in the one table it missed. The key shape is genuinely ambiguous: rows keyed by tier AND one row keyed by a subscription state.
Response:  WORKED AROUND
Action:    Minimal faithful transcription: versioned rows (effective range per §4), nullable `tier` + nullable `subscription_state` with an XOR CHECK (exactly one set), and the eight described capabilities as typed columns named to reflect configuration rather than stored entitlement (check 3's grep). NO rows seeded -- the values are §16/X3 commercial-model territory and ADU-VAL-01 §4 holds them.
Ruling needed: v1.11 to name tier_definition's columns the way §5.5 named ladder_config's.

### D-09 - Cancellation-counter weights are configuration with no column
Severity:  QUESTION
Phase:     A, migration 09
Source:    ADU-DB-01 v1.10 §12.7 -- "the counter increments on EXPIRED_UNCLAIMED at a higher weight than on CANCELLED_BY_BUYER. The weights are configuration." §5.5's timing_config additions do not include them; ADU-VAL-01 does not list them
Found by:  building migration 09's buyer_cancellation_counter
Effect:    The increment weighting cannot be configured anywhere. (The word itself cannot even appear in migration 14 -- Appendix C check 6 greps follow/feed-adjacent DDL for it.)
Response:  PARKED
Action:    Table built with the §12.7 columns (buyer, seller NULL, count, window_start, cooldown_until). Increment logic is the Tier 3+ job's business; when the columns for the two multipliers are ruled they land in timing_config by migration.
Ruling needed: Name the two timing_config columns (expiry multiplier, cancel multiplier) and their defaults, or fold into ADU-VAL-01 §2.

### D-10 - The §20 event catalogue counts 65 names; §22 says 68
Severity:  MINOR
Phase:     A, migration 14
Source:    ADU-DB-01 v1.10 §22 -- "All 68 event names in S20 ... are seeded as version 1 definitions"; ADU-PRD-01 v8.5 §20 lists 65 names (counted mechanically at seed time); ADU-AUTH-01 v2.4 §23 adds five more (otp_requested, otp_delivery_confirmed, otp_verify_failed, otp_superseded, age_declaration_recorded), which would make 70
Found by:  seeding analytics.event_definition in migration 14
Effect:    A checksum in prose that does not reproduce -- the R30 pattern. No build effect: the seed is the union of the two authoritative lists, and fn_validate_event fails closed on anything unseeded.
Response:  WORKED AROUND
Action:    Seeded the §20 list plus AUTH §23's five, each as version 1 with a fixed introduced_at. The count is whatever the union is; the register records it rather than forcing it to 68.
Ruling needed: v1.11 to restate the event count as a derivation (like the enum count) rather than a number.

### D-11 - §14.2's cross-table CHECK cannot be a CHECK
Severity:  MINOR
Phase:     A, migration 11
Source:    ADU-DB-01 v1.10 §14.2 -- "CHECK (signed_at >= order_qr_token.issued_at)"
Found by:  building migration 11
Effect:    PostgreSQL CHECK constraints cannot reference another table. As written it is unimplementable.
Response:  WORKED AROUND
Action:    Enforced inside the BEFORE INSERT validity trigger on handoff_scan, which already reads the token row to compute corrected_at's floor -- same transaction, same row, same guarantee, and it raises.
Ruling needed: none -- v1.11 should reword CHECK to "enforced by the validity trigger".

### D-12 - seller_public_stats needs counter columns the document does not name
Severity:  QUESTION
Phase:     A, migration 08
Source:    ADU-DB-01 v1.10 §8.3 -- the table "carries level, completed handoff count, cancellation rate, confirmation rate, scan completion rate, unresolved claim count, missed payment-confirmation windows, stock confidence"; R16 -- "Counts are incremented, rates are recomputed from counters held on the same row, never by scanning the source tables"
Found by:  building migration 08's O(1) trigger maintenance
Effect:    A rate maintained O(1) needs its numerator and denominator as columns; the document names the rates but not the counters.
Response:  WORKED AROUND
Action:    Each published rate carries its two counters on the row (e.g. reservations_cancelled + reservations_terminal -> cancellation_rate), named and commented with the §12.5 arithmetic they implement ("counts reservation rows, never order rows"). Published values remain exactly the §8.3 list; counters are the R16 mechanism. "Stock confidence" is NOT stored (it would drift -- §10.2's own argument); the storefront reads v_stock_confidence per variant.
Ruling needed: v1.11 to name the counter columns, or bless these.

### D-13 - Ladder rate denominators are not defined anywhere
Severity:  QUESTION
Phase:     A, migration 08
Source:    ADU-DB-01 v1.10 S5.5 names the rate THRESHOLDS; no document defines the rates' numerators or denominators
Found by:  building fn_recompute_seller_level
Effect:    A threshold without a defined rate is uncomparable.
Response:  WORKED AROUND
Action:    Three helper functions, one denominator choice each, greppable and testable in isolation: claim rate = upheld claims / counting handoffs per window (zero handoffs with an upheld claim -> 1, else NULL); cancellation rate = seller-caused terminals / all terminal reservations, window anchored on the parent order's created_at; scan completion = counting scans / completed orders, capped at 1. NULL fails closed in the caller.
Ruling needed: Ratify the three definitions or supply corrections; they change who climbs.

### D-14 - fn_mark_order_ready's printed body contradicts its own idempotency claim
Severity:  MINOR
Phase:     A, migration 09
Source:    ADU-DB-01 v1.10 S12.6a -- body uses RETURNING ... INTO STRICT; the invariant two lines below says the second call is a no-op; ADU-API-01 v1.6 S12.11 agrees
Found by:  transcribing the body
Effect:    INTO STRICT raises NO_DATA_FOUND on exactly the call both documents call a no-op.
Response:  WORKED AROUND
Action:    The claim wins over the listing (two documents against one code line): repeat call returns the existing ready_at; wrong-state raises restrict_violation (mapper: 409 ORDER_NOT_READYABLE); wrong-seller raises U0002. Also declared a local v_ready -- the printed INTO STRICT ready_at name-collides with the column.
Ruling needed: v1.11 to reprint the body.

### D-15 - order_clock_consistency as printed forbids the document's own ratified row 17
Severity:  MAJOR (raised loudly; found before any data existed)
Phase:     A, migration 09
Source:    ADU-DB-01 v1.10 S12.4 -- CHECK ((state IN paid-family) = (clock_stopped_at IS NOT NULL)); S12.2.1 row 17 -- PAYMENT_CONFIRMED -> CANCELLED_BY_SELLER, "derived - every line REFUNDED", R-3 ratified
Found by:  CP-5 smoke: refunding the only line of a paid order raised order_clock_consistency inside fn_derive_order_state
Effect:    Every full-refund path on a paid order is impossible as printed. The clock stops PERMANENTLY at payment (12.4's own word), so the cancelled order keeps clock_stopped_at set -- and the printed equality then forbids the state the ratified transition set requires.
Response:  WORKED AROUND
Action:    CHECK weakened to a CASE: paid-family states require a stopped clock; CREATED/NOTIFIED/PAYMENT_SUBMITTED/EXPIRED_UNCLAIMED require a running one; the two CANCELLED terminals admit either, because both entry paths (pre-payment, post-refund) are ratified. The sweep's predicate (clock_stopped_at IS NULL) still excludes every paid order.
Ruling needed: v1.11 to reprint the CHECK; the two real invariants are unchanged.

### D-16 - The financial boundary has read paths but no ratified write path
Severity:  MINOR
Phase:     A, migration 10
Source:    ADU-DB-01 v1.10 S13 defines financial.payment_evidence, its access log, and read_payment_evidence / render_payment_instructions; no document prints the function that WRITES evidence, names the operator roles the derived-role read admits, or says what a cross-currency snapshot does with no fx source
Found by:  building migration 10 - a read-only boundary with no write path is D4's write_attestation gap over again
Effect:    Without a boundary-owned writer, the upload path would need app table grants in financial - the exact hole S13 exists to close.
Response:  WORKED AROUND
Action:    financial.write_payment_evidence built as the narrow definer commit path (insert + log, nothing else), owned by adulis_financial like its read twins; the derived-role read admits CLAIM_REVIEWER / SUPPORT / ADMIN operator grants (IDENTITY_REVIEWER and MODERATOR deliberately absent - identity review and content moderation have no business reading payment evidence); U0003 carries the revalidation items[] in DETAIL per ADU-API-01 S5.1; a cross-currency order with no fx source REFUSES rather than inventing a rate.
Ruling needed: v1.11 to print the writer, the role set, and the fx rule.

### D-17 - Claim evidence kinds have no kind-per-trigger mapping
Severity:  QUESTION
Phase:     A, migration 12
Source:    ADU-DB-01 v1.10 S16 - "a trigger on claim insert populates the set" and the claim_evidence_kind catalogue; no document maps which kinds attach for which claim trigger
Found by:  building the attach trigger
Effect:    The bundle's composition is unspecified; a wrong subset under-evidences a dispute.
Response:  WORKED AROUND
Action:    Attach every kind whose referent EXISTS at open (transitions, stock events, level-at-order always; payment evidence, scan records, acting team members when present) - over-inclusion is reviewable, omission is not. Payment evidence is marked retained in the same transaction. CHAT_HISTORY and BANK_RECORD attach later by their own flows (chat is migration 13; a bank record only exists after a trace).
Ruling needed: v1.11 to print the mapping, or bless attach-what-exists.

### D-18 - Appendix B omits a table the section 9 body requires
Severity:  MINOR
Phase:     A, gate (check 14's first live run)
Source:    ADU-DB-01 v1.10 section 9 - "core.category -- id, parent, code, per-market availability"; Appendix B - core = 84 tables, category_market_availability not among them
Found by:  check 14 going live at Tier 2: 110 tables against the manifest's 109
Effect:    The only relational spelling of per-market availability is a join table; a migration set matching the manifest exactly cannot satisfy the body.
Response:  WORKED AROUND
Action:    This is the manifest's own recorded failure mode - it omitted seller_availability through v1.7 and says "recount whenever the manifest changes". Check 14 now expects manifest 109 plus a BODY_OVER_MANIFEST list pinned BY NAME (currently the one table), and verifies the pinned table exists - so any other stray table still fails the check.
Ruling needed: v1.11 to add core.category_market_availability to Appendix B (core = 85, total 110).

### D-19 - An upheld claim demotes under MODERATION source, but no printed path supplies the moderation_event the CHECK demands
Severity:  MINOR
Phase:     A, gate (CP-7 ladder test)
Source:    ADU-DB-01 v1.10 S8.1 - seller_level_event CHECK: a MODERATION-sourced change requires moderation_event_id; S8.3/S5.2 - an upheld claim ALWAYS forces demotion; section 16 prints no moderation_event write on the claim decision path
Found by:  the CP-7 forced-demotion test: the decision trigger's recompute call violated moderation_change_is_logged on the first real demotion
Effect:    Every claim-driven forced demotion is impossible as printed - the CHECK demands an audit row no path creates.
Response:  WORKED AROUND
Action:    The upheld decision IS a moderation act, so the decision trigger records it as one: INSERT core.moderation_event (actor = decided_by, target SELLER, decision CLAIM_UPHELD, reason = outcome_reason) and passes the id to the recompute - claim -> moderation_event -> seller_level_event, one audit chain. decided_by becomes effectively required for an UPHELD outcome (the moderation event's actor is NOT NULL): an anonymous demotion fails loudly rather than proceeding.
Ruling needed: v1.11 to print the decision path's moderation_event write, or supply the intended alternative.

### D-20 - /v1/bootstrap needs two values no document rules
Severity:  QUESTION
Phase:     B, pipeline component 12
Source:    ADU-API-01 v1.6 S3.1 defines the response (min_supported_client, market{...}); no document says WHICH market an anonymous bootstrap resolves, nor where the client version floor lives
Found by:  building the endpoint
Effect:    Market selection matters the day a second market exists; the version floor gates every store-distributed client.
Response:  WORKED AROUND
Action:    Phase 1 is one market, so the single live market is served (is_live DESC, created_at ASC as tiebreak) - loudly wrong the day a second market goes live, by design and by comment. min_supported_client is a value-arrives-later in the ADU-VAL-01 sense: floored at 0.0.0 so every client passes until a floor is ruled; client_status is OK unconditionally until then.
Ruling needed: market resolution for anonymous bootstrap (geo? header? single-market assumption ratified?), and where the version floor is configured (a column on market? an ops value?).

### D-21 - S9.4 says ten readiness items; the wire contract enumerates nine
Severity:  MINOR
Phase:     C1
Source:    ADU-DB-01 v1.10 S9.4 - "the ten items in S4.6's table"; ADU-API-01 v1.6 S7.1a - nine items, named, in order, with R7c's removal of ACTIVE_HOURS explained (availability is informational, zero windows valid, a gate that never fails is worse than no gate)
Found by:  building fn_publication_readiness
Effect:    An agent following DB-01's count would reintroduce a gate that cannot fail.
Response:  WORKED AROUND
Action:    Nine items built, in the API document's ratified order. The later, wire-governing document wins; DB-01's count is stale against R7c.
Ruling needed: ADU-DB-01 v1.11 to say nine.

### D-22 - fn_publication_readiness's printed signature cannot emit the event its own invariant demands
Severity:  MINOR
Phase:     C1
Source:    ADU-DB-01 v1.10 S9.4 prints LANGUAGE sql STABLE; the same section: "seller_publication_blocked is emitted ... by the function itself"
Found by:  building the function
Effect:    A STABLE sql function cannot INSERT; as printed, either the signature or the invariant must give.
Response:  WORKED AROUND
Action:    The invariant outranks the annotation (S4.6: the funnel data "cannot be reconstructed later"); built plpgsql VOLATILE. Related: eligibility_path is a NOT NULL cohort column on seller-scoped events, and a seller with no evaluation yet HAS no path - that event travels without seller_id, carrying the seller in payload, rather than inventing a cohort (D-21a in the migration's comments).
Ruling needed: v1.11 to reprint the signature.

### D-23 - Three reserved-band SQLSTATEs allocated for step-up failures
Severity:  QUESTION
Phase:     C1
Source:    ADU-API-01 v1.6 S7.1a reserves U0003-U0999 "for future deliberate raises"; the taxonomy carries three distinct step-up codes (STEP_UP_REQUIRED / STEP_UP_EXPIRED / STEP_UP_ACTION_MISMATCH); no document assigns their SQLSTATEs
Found by:  building fn_assert_step_up (migration 0019) - the checking function the S6.7 doctrine describes and every document elides
Effect:    Distinct wire codes need distinct database signals, or the mapper collapses them.
Response:  WORKED AROUND
Action:    U0004 -> STEP_UP_REQUIRED (also covers another account's challenge - confirming a challenge exists is the same oracle a scope 404 refuses to be), U0005 -> STEP_UP_EXPIRED (stale freshness or past expiry; absent timing config fails closed here too), U0006 -> STEP_UP_ACTION_MISMATCH. Wired into the translator.
Ruling needed: ratify the three assignments into S7.1a's table.

### D-24 - POST /v1/seller/ownership-transfer is catalogued; its product rules are not written
Severity:  MINOR (PARKED endpoint)
Phase:     C1
Source:    ADU-API-01 v1.6 S12.9 catalogues the endpoint and S15 (open items) says the product rules - who may receive, what notice, what the outgoing owner retains - "are not written in any document. ADU-PRD-01 v8.6 owes them"; fn_transfer_seller_ownership's body is elided everywhere
Found by:  building C1
Effect:    An endpoint built now would invent transfer semantics wholesale.
Response:  PARKED - the endpoint is not built; the other thirteen C1 entries are.
Ruling needed: ADU-PRD-01 v8.6's transfer rules; then the endpoint follows in days.

### D-27 - The ruled context wrapper sets three settings; a ratified function body reads a fourth
Severity:  MINOR
Phase:     C3
Source:    ADU-CON-02 v3.0 S6.1 prints set_config for exactly adulis.account_id / actor_role / seller_id; ADU-DB-01 v1.7 S12.6a's printed fn_mark_order_ready body reads current_setting('adulis.audience')
Found by:  the C3 gate suite - every mark-ready call was a 500 (unrecognised configuration parameter)
Effect:    The surface check the function performs below the endpoint cannot run.
Response:  WORKED AROUND
Action:    The wrapper sets a FOURTH transaction-local setting, adulis.audience, from the authenticated session's audience - additive, same third-argument-true discipline, the original three untouched.
Ruling needed: ADU-CON-02's next reissue to print four.

### D-26 - U0007 allocated for the buyer-cancellation cooldown
Severity:  QUESTION
Phase:     C3
Source:    ADU-API-01 v1.6 S7.1a's reserved band; BUYER_COOLDOWN_ACTIVE exists in the closed taxonomy; ADU-PRD-01 S9.5 rules the penalty ladder; no document assigns the SQLSTATE
Found by:  building the cooldown gate into order creation (migration 0021)
Effect:    The gate needs a distinct database signal to reach the wire as its own 409.
Response:  WORKED AROUND
Action:    U0007 -> 409 BUYER_COOLDOWN_ACTIVE, the until-timestamp as a typed slot in DETAIL. Same device as D-23's trio.
Ruling needed: ratify into S7.1a's table.

### D-29 - The verbatim courier policy dies on an empty GUC
Severity:  MAJOR (a 22P02 on buyer reads, plan-dependent)
Phase:     C4
Source:    ADU-DB-01 v1.10 S6.9's printed courier SELECT policy casts current_setting('adulis.account_id', true) straight to uuid
Found by:  the C4 gate suite: buyer-context reads 500ed with invalid input syntax for type uuid ""
Effect:    A custom GUC's post-transaction default is the EMPTY STRING on any pooled connection that ever set it, and PostgreSQL does not guarantee OR short-circuit inside a policy - the EXISTS arm can evaluate ''::uuid on a plain buyer read.
Response:  WORKED AROUND
Action:    Policy rolled forward (0022, ALTER POLICY - 0011 is merged and never edited) with nullif(...,'')::uuid. Meaning unchanged: an unset or empty account matches no assignment - fail closed.
Ruling needed: v1.11 to reprint the policy with the total cast.

### D-30 - 12.5 says a non-buyer gets 403; S19 says an unrelated actor must not learn the object exists
Severity:  MINOR
Phase:     C4
Source:    ADU-API-01 v1.6 S12.5 - "403 where the caller is not the buyer"; ADU-AUTH-01 v2.4 S19/S21 - a scope failure is 404 with no detail, because 403 confirms existence
Found by:  the stranger probe in the C4 gate suite
Effect:    The two rulings cannot both hold for a stranger probing a random order id.
Response:  WORKED AROUND
Action:    S19's principle wins (it is the stronger and later security doctrine, and the render function already raises U0002): the wire says 404. A buyer-adjacent caller with a REAL relationship that is merely wrong-state still gets the ordinary conflict codes.
Ruling needed: ADU-API-01 v1.7 to align 12.5's sentence with its own 7.1a table.

### D-31 - The scan signature scheme is described by behaviour, not by construction
Severity:  QUESTION
Phase:     C5
Source:    ADU-API-01 v1.6 S12.6.1 - "the client signs once, at the moment of scanning, and stores the signed blob"; REJECTED_SIGNATURE = "signature does not verify"; no document says what key signs a scan or how the client would hold one
Found by:  building POST /v1/handoffs/sync
Effect:    A client-held signing key contradicts the trust model (nothing client-held is trusted for authorization); with none, "signs" is unimplementable as written.
Response:  WORKED AROUND
Action:    The QR the seller displays carries an HMAC the SERVER minted over (order_ref, nonce, key version) with the versioned identity secret under a domain prefix; the buyer's device captures it and timestamps the blob. "Signs once, retries identical bytes" becomes literal: the signature proves the scan came from a genuinely displayed QR, and byte-identity discriminates a retry from an attack (nonce+order+account+signed_at-ms). A nonce that is not the order's displayed QR is REJECTED_SIGNATURE; an absent token or order is REJECTED_UNKNOWN_ORDER.
Ruling needed: ratify the scheme or supply the intended one.

### D-32 - fn_assert_step_up never consumed the challenge
Severity:  MAJOR
Phase:     C6
Source:    ADU-AUTH-01 v2.4 S9.2 - "Uses: exactly one. Consumed by the action it authorised"; migration 0019 (merged) verified freshness and binding but wrote nothing
Found by:  reading 0019 against S9.2 while wiring the C6 step-up endpoints
Effect:    One satisfied challenge could authorise the SAME action repeatedly inside the five-minute freshness window - a replayed payout change, a second reissue.
Response:  FIXED (roll-forward)
Action:    0023 adds step_up_challenge.consumed_at and rewrites fn_assert_step_up to refuse a consumed challenge and consume on success, under FOR UPDATE so concurrent presentations serialise. Consumption is transaction-atomic: a refused action rolls its consumption back, so the honest retry after fixing the refusal still works (proven in the C6 gate suite). c4's post-consumption tests now mint per-use challenges - the behaviour the spec always described.

### D-33 - AUTH 4.2 mandates OTP_SUPERSEDED; API 7.1's closed taxonomy has no such code
Severity:  MINOR
Phase:     C6
Source:    ADU-AUTH-01 v2.4 S4.2 - "The error must say so specifically - OTP_SUPERSEDED"; ADU-API-01 v1.6 S7.1 Auth row omits it and the taxonomy is closed
Found by:  building POST /v1/auth/otp/verify
Effect:    The two documents cannot both hold on the wire.
Response:  WORKED AROUND
Action:    DOCUMENT_AUTHORITY gives wire behaviour to ADU-API-01, so the wire says OTP_EXPIRED - and the verify path detects a code from a recently superseded challenge specifically (burning no attempt on the live one), and the otp_expired string in BOTH locales now reads "check your messages for a newer code", which is the UX S4.2 exists to protect.
Ruling needed: ADU-API-01 v1.7 to add OTP_SUPERSEDED to the Auth group, or ADU-AUTH-01 to withdraw the named code.

### D-34 - 12.2 lists revoke-others for B S C; AUTH 9.1 says no step-up action is reachable from MOBILE
Severity:  MINOR
Phase:     C6
Source:    ADU-API-01 v1.6 S12.2 row "POST /v1/auth/sessions/revoke-others S | B S C"; ADU-AUTH-01 v2.4 S9.1 INVARIANT - all step-up actions CONSOLE-only
Found by:  building the endpoint
Effect:    A buyer on MOBILE either can or cannot revoke all other sessions; the documents disagree.
Response:  WORKED AROUND
Action:    Authorization doctrine belongs to ADU-AUTH-01: the endpoint (and step-up/request itself) refuses MOBILE with 403. A mobile buyer still revokes sessions one at a time - same outcome, more taps, no invariant broken.
Ruling needed: ADU-API-01 v1.7 to correct the audience column, or AUTH to carve the exception.

### D-35 - Buyer-side account deletion: two undocumented mechanisms had to exist
Severity:  QUESTION
Phase:     C6
Source:    ADU-PRD-01 v8.5 S21 ("Buyers: identity scrubbed... active reservations released") names no mechanism for either; account.phone_e164 is NOT NULL UNIQUE and IS the authentication factor
Found by:  writing core.fn_delete_account (0023)
Effect:    (a) "Released" cannot apply to an order whose payment was already asserted - releasing it strands money; (b) "scrubbed" cannot null the phone column.
Response:  WORKED AROUND (both recorded in the 0023 header)
Action:    (a) Deletion is BLOCKED while the account, as buyer, holds an order in PAYMENT_SUBMITTED or PAYMENT_CONFIRMED - S16.9's own money-blocks-deletion principle applied to the buyer side; pre-payment reservations release through the ordinary buyer-cancel path (fn_cancel_line). (b) The scrubbed account keeps a tombstone phone: '+999' + digits derived from the account id - satisfies core.e164, stays unique, frees the real number.
Ruling needed: ADU-PRD-01 to ratify the buyer money gate (or specify the settlement path) and the tombstone convention.

### D-36 - The billing purchase flow is listed in 12.12 but S16.7 says no purchase surface exists at MVP
Severity:  QUESTION
Phase:     C6
Source:    ADU-API-01 v1.6 S12.12 (purchase-intent, mark-transferred); ADU-DB-01 v1.10 S18.5 - "No purchase surface exists at MVP... beta sellers pay nothing"; no document specifies the intent's lifecycle, reconciliation, or the no-subscription case
Found by:  building the billing group
Effect:    The endpoints exist on the wire with no ratified flow behind them.
Response:  WORKED AROUND (minimal transcription)
Action:    purchase-intent asserts step-up SUBSCRIPTION_CHANGE, prices from billing.price_schedule with the term discount, and opens a collection_record (provider_kind BANK_TRANSFER) against the EXISTING subscription - absent subscription or unscheduled tier is 404, fail closed. mark-transferred stamps marked_transferred_at, idempotently. Reconciliation stays operator work outside the contract, as S18.5 describes.
Ruling needed: the purchase lifecycle (intent expiry, reconciliation-to-ACTIVE, locked-rate write) when the surface ships for real.

### D-37 - Team/courier invite of a phone Adulis has never seen
Severity:  QUESTION
Phase:     C6
Source:    ADU-AUTH-01 v2.4 S12 - invited by phone, "authenticates with their own OTP"; no document says what happens when no account holds the phone
Found by:  building POST /v1/seller/team and /v1/seller/couriers
Effect:    seller_team_member.account_id is NOT NULL - there is nothing to attach an unknown phone to, and creating an identity on someone else's behalf would bypass the age declaration and consent of sign-up.
Response:  WORKED AROUND
Action:    Unknown phone is 404 NOT_FOUND: the invitee signs in once (creating their account with their own declaration), then the invite succeeds. No pending-invite table exists to complete into (Appendix B has none).
Ruling needed: whether a pending-invite flow is wanted; if so it needs a table and a notification.

### D-38 - 12.7's catalogue has no way to BEGIN a conversation
Severity:  MINOR
Phase:     C7
Source:    ADU-API-01 v1.6 S12.7 lists list/read/send/escalate; chat.conversation is UNIQUE (seller, buyer, market); nothing creates the row a message endpoint requires
Found by:  building the chat group
Effect:    A buyer who has never chatted with a seller has no conversation id to post into, and the send endpoint cannot invent one.
Response:  WORKED AROUND (additive endpoint)
Action:    POST /v1/conversations { seller_id } creates-or-returns the pair's one row - idempotent by the UNIQUE, additive to the contract, same class of omission the v1.1 catalogue had with claims.
Ruling needed: ADU-API-01 v1.7 to admit the endpoint (or name the intended bootstrap).

### D-39 - The bot's reply carries template_key and slots, but nothing rules what fills a slot
Severity:  QUESTION
Phase:     C7
Source:    ADU-API-01 v1.6 S12.7 - "template_key and slots, never assembled prose"; nlu.answer_template.slots text[]; a conversation carries NO product context to resolve a slot like {price} against
Found by:  building the cascade's answer path
Effect:    A sloted template is unfillable from a bare conversation, and a reply with holes is worse than none.
Response:  WORKED AROUND
Action:    Layers 1-2 answer only templates whose slots[] is empty; a sloted template ESCALATES (recorded as such in bot_turn). Bot messages store the template resource as body - never model output; chat.bot_turn still has no prose column. Layers 3-4 sit behind an inference adapter (Null bound until the integration lands), degrading exactly as S15.1's cap behaviour describes.
Ruling needed: the slot-resolution model (probably a product-anchored conversation context) before the chatbot ships for real.

### D-40 - Notification preferences: two endpoints, no table anywhere
Severity:  MINOR
Phase:     C8
Source:    ADU-API-01 v1.6 S12.14 (GET/PATCH /v1/seller/notification-preferences, the suppressible=false 422 invariant); no document gives preferences storage; Appendix B's 109 do not include one
Found by:  building the notifications group
Effect:    The endpoints cannot exist without a table, and the gate's own 422 test needs the PATCH to exist.
Response:  WORKED AROUND (the D-18 mechanism)
Action:    Migration 0024 adds core.notification_preference keyed (seller, account, template_key) - personal to the account within the seller context - and check 14 pins it by name as a second body-over-manifest exception. The PATCH refuses to disable NEW_DEVICE_SIGNIN or any PAYOUT_CHANGE class with 422 (the classes migrations 16/22 enqueue unsuppressibly).
Ruling needed: Appendix B to admit the row; the ruled preference-class vocabulary.

### D-41 - 12.14 requires read state; ADU-DB-01 S20's notification table has no read column
Severity:  MINOR
Phase:     C8
Source:    ADU-API-01 v1.6 S12.14 - "Read state syncs across surfaces - one list, two clients"; ADU-DB-01 v1.10 S20 lists no such column
Found by:  building POST /v1/notifications/{id}/read
Response:  FIXED (the D-27 way - the surface the later contract requires must exist)
Action:    0024 adds core.notification.read_at with a partial unread index.
Ruling needed: ADU-DB-01 v1.11 to print the column.

### D-42 - POST /v1/seller/analytics/export is not built
Severity:  PARKED
Phase:     C8
Source:    ADU-API-01 v1.6 S12.13 - "Async; returns a job handle, not a file. The job writes to R2 and the seller is notified"
Effect:    The worker process does not exist, no job table exists to mint a handle from, and R2 is not wired.
Action:    Parked with the section 24 worker slab. The DATA_EXPORT entitlement gate already exists in fn_effective_limit.

### D-43 - The storefront product path says {slug}; no slug column exists
Severity:  QUESTION
Phase:     C8
Source:    ADU-API-01 v1.6 S12.1 - GET /v1/storefronts/{handle}/products/{slug}; core.product has no slug in the 109-table schema
Response:  WORKED AROUND
Action:    The path parameter is served as the product id (a non-uuid is 404). A slug is a schema decision Appendix B has not made.
Ruling needed: whether products get a slug column, and its uniqueness scope.

### D-44 - 12.15's subject kinds and the frozen enum spell two values differently
Severity:  MINOR
Phase:     C8
Source:    ADU-API-01 v1.6 S12.15 - subject_kind closed set PRODUCT/STORE/REVIEW/MESSAGE/ACCOUNT; core.report_target_kind - PRODUCT/REVIEW/MESSAGE/SELLER/STOREFRONT
Response:  WORKED AROUND
Action:    The wire accepts 12.15's five and maps STORE -> STOREFRONT, ACCOUNT -> SELLER at the edge. The enum is frozen (check 16); the wire is the contract's.
Ruling needed: one taxonomy, in whichever document reissues first.

### D-45 - The two client-observed events were missing from the seeded definitions
Severity:  MINOR
Phase:     C8
Source:    ADU-API-01 v1.6 S12.16/S11 - the allow-list of two (NotificationOpened, PaymentInstructionsViewed); migration 16's seeded event_definition set carries neither snake-cased name
Found by:  building POST /v1/events - the key-validation trigger would refuse both
Response:  FIXED
Action:    0024 inserts notification_opened and payment_instructions_viewed at version 1 (the definition table is append-only; growth is an INSERT).

### D-46 - Ten callable SECURITY DEFINER functions were PUBLIC-executable, six of them boundary functions
Severity:  MAJOR
Phase:     D
Source:    PostgreSQL's default EXECUTE-to-PUBLIC grant; migrations 04, 10, 12, 13 predate the REVOKE discipline 0018+ follow
Found by:  the Phase D definer sweep "from the other side" (pg_proc x aclexplode over all 60 definer functions)
Effect:    Any connecting role - adulis_readonly, adulis_jobs, anything future - could call financial.render_payment_instructions / read_payment_evidence / write_payment_evidence and verification.read_attestation / write_attestation / id_hash_matches, NAMING ANY ACTOR (the actor is a parameter), plus the three ladder helpers and the lapse sweep. Ciphertext, not plaintext - but the boundary exists so lesser-role compromise does not reach evidence at all, and the access log would attribute the read to whoever the caller claimed to be.
Response:  FIXED
Action:    Migration 0025 revokes PUBLIC on all ten and re-grants intended callers by name. Check 10 gains a third assertion: no callable function in a boundary schema may be PUBLIC-executable (trigger-returning functions are uncallable and exempt). Full suite green after the revokes, proving the named grants are complete. SECURITY-REVIEW.md SR-1.
Ruling needed: none - but ADU-DB-01 v1.11 should state the REVOKE-on-CREATE discipline as a rule, since four migrations forgot what five later ones knew.

### D-47 - adulis_jobs had no USAGE on schema core, so every one of the twenty jobs was dead on arrival
Severity:  BLOCKER (for the worker; nothing in production depended on it because nothing ran)
Phase:     T4 E
Source:    Migration 01 grants USAGE on core to adulis_app and adulis_migrate and not to adulis_jobs; migration 0025 then granted EXECUTE on fn_confirmation_window_lapse to adulis_jobs, which cannot be called without it
Found by:  probing every grant AS the role, before writing a line of the worker
Effect:    Every job in ADU-DB-01 S24 would have failed on its first statement with 42501 "permission denied for schema core" - the expiry sweep, the confirmation window, the notification sender, all of them. The 48-hour reservation window would have stayed a promise nothing keeps, and the first symptom would have been a seller noticing.
Response:  FIXED
Action:    Migration 0026 grants USAGE, then every table privilege explicitly and narrowly, each line naming the job that fails without it. Proven as the role, not inferred.
Ruling needed: none. But ADU-DB-01 S3's grant table should name adulis_jobs' schema access explicitly, since S24 gives it twenty jobs and S3 never gives it a way to reach them.

### D-48 - The evidence purge needed a boundary function rather than a table grant
Severity:  MINOR (a design finding, recorded before it became a grant)
Phase:     T4 E
Source:    ADU-DB-01 S24 - "Scoped to financial.payment_evidence BY NAME, never to the schema - payout credentials share it and must not be purged"; WORK ORDER T4 S1.2 - "If a job needs a boundary function, that is a finding worth a register entry before it is a grant"
Effect:    The obvious implementation is GRANT DELETE ON financial.payment_evidence TO adulis_jobs, which puts a table privilege in the financial schema and leaves "by name" as a convention inside a WHERE clause - one edit away from purging payout credentials.
Response:  FIXED (by design)
Action:    Two SECURITY DEFINER functions owned by adulis_financial - list_purgeable_evidence and purge_payment_evidence - each naming the table literally. adulis_jobs holds NO table privilege in financial at all, so it cannot name payout_credential even by accident. The purge RE-EVALUATES the predicate rather than trusting the ids handed to it, so a claim opened between the list and the purge saves its evidence. A test asserts a payout credential survives a purge run.

### D-49 - analytics.event is owned by the bootstrap role, not by its schema's owner, so no definer can attach a partition
Severity:  MINOR
Phase:     T4 E
Source:    Migration 01 creates schema analytics AUTHORIZATION adulis_migrate, but migrations RUN as the bootstrap role, so every table in it is bootstrap-owned
Found by:  writing analytics.create_partition, which S24 names and migration 16's comment names and nothing had ever written
Effect:    A SECURITY DEFINER owned by adulis_migrate cannot attach a partition to a table it does not own ("must be owner of table event"), so S24's monthly job was unimplementable. Every event has landed in the DEFAULT partition since Tier 2.
Response:  FIXED
Action:    0026 re-owns the partitioned parent to adulis_migrate, aligning it with its own schema. Grants live in the ACL and survive; routed INSERTs are checked on the parent, so nothing the API does changes.
Ruling needed: none, but it is worth asking whether every table should be owned by its schema's owner rather than by whoever ran the migration. R19's future detach-and-export needs the same privilege.

### D-50 - core.fn_stats_on_reservation was a SECURITY DEFINER owned by the SUPERUSER
Severity:  MAJOR
Phase:     T4 E
Source:    Migration 0011 creates it SECURITY DEFINER and never issues the ALTER FUNCTION ... OWNER TO adulis_migrate that every one of its siblings got, so it defaulted to adulis_bootstrap - which is rolsuper and rolbypassrls
Found by:  a definer-ownership sweep while diagnosing an unrelated trigger privilege
Effect:    The function executed with SUPERUSER rights: it bypassed RLS and every privilege check in the database. Nothing exploits it today - it returns trigger, so it cannot be called directly, and its body touches one table - which is exactly why it survived four work orders unnoticed. It worked perfectly, forever.
Response:  FIXED
Action:    0026 re-owns it to adulis_migrate, matching fn_stats_on_order_completed beside it. adulis_migrate already held SELECT/INSERT/UPDATE on core.seller_public_stats, which is all the body needs. Verified afterwards: zero SECURITY DEFINER functions in the database are owned by a superuser.
Ruling needed: none - but SR-1's lesson repeats. ADU-DB-01 v1.11 should state the definer discipline as a rule (own it, revoke PUBLIC, grant by name), because migrations keep forgetting individually what the set knows collectively.

### D-51 - /healthz has two jobs that conflict exactly at a dead worker
Severity:  MINOR (decided; the decision is load-bearing)
Phase:     T4 E
Source:    ADU-CON-02 v3.0 S20.2 - "A worker heartbeat row every 5 minutes; /healthz reddens when stale"; S18 - the Render topology names /healthz as the API health check, so "a 503 here is what stops a bad instance taking traffic"
Effect:    Reddening a stale worker with a 503 would pull every HEALTHY API instance out of rotation, turning "orders stop expiring" into "the storefront is down" - a strictly worse outcome, caused by the monitoring rather than by the fault.
Response:  DECIDED
Action:    The status code answers only "can this instance serve?" and stays 200; the BODY carries status degraded and worker stale or never_started, which is what the uptime check alarms on. Tested both ways.
Ruling needed: ADU-CON-02's next reissue to say which signal "reddens" means, or to give the worker its own endpoint.

### D-52 - graphile-worker needs CREATE on the DATABASE to boot, and owns its tables under RLS
Severity:  MINOR (two findings, one cause: the queue library assumes it is privileged)
Phase:     T4 E
Source:    graphile-worker 0.17's installSchema issues a create-schema-if-not-exists, which requires CREATE on the database even when the schema exists; and it enables ROW-LEVEL SECURITY on its own tables with policies written for their owner
Found by:  booting the worker as adulis_jobs
Effect:    (a) The runtime role would need standing CREATE on the database - the kind of privilege T3/T4 spent two migrations removing. (b) With the tables owned by the DDL role, the worker BOOTS, logs healthy, and then fails on its first task with "new row violates row-level security policy" - a process that looks alive and does nothing.
Response:  WORKED AROUND
Action:    pnpm worker:install performs the DDL as the migrate role and then moves ownership of graphile's tables to adulis_jobs, which already owns the schema. The worker boots, finds jobs.migrations present, and skips its installer. The runtime test now enqueues a real job and waits for its EFFECT - registration alone had passed while nothing could run.
Ruling needed: none - but the deploy runbook must run this step, and it belongs in ADU-CON-02 S20.6's deploy runbook when that is written.

### D-53 - There is no KYC adapter, and identity attestation is written from client-supplied data
Severity:  MAJOR (trust; currently a load-bearing workaround)
Phase:     T4 F
Source:    ADU-PRD-01 S13.1 - "the KYC provider sits behind a vendor-agnostic interface", and a vendor must be integrated and load-tested before the gate drops; WORK ORDER T4 S3.2 - KYC is one of the five interfaces and has no vendor selected
Found by:  confirming the five adapter interfaces in Phase F
Effect:    POST /v1/seller/identity-verification takes verifier_kind, vendor_reference, legal_name, id_hash and verified_on FROM THE REQUEST BODY and calls verification.write_attestation with them. There is no callback to any vendor, because no vendor exists to call. A seller holding seller.identity:manage plus a step-up challenge can therefore assert their own ID verification - which is the IDENTITY eligibility path and, at Pro, the verified badge. "Payment never buys a badge" is enforced; self-assertion currently is not.
Response:  RECORDED, not worked around - building a vendor is out of scope (T4 S5), and inventing a verification protocol would be worse than naming the gap.
Action:    None in code. The interface is absent by consequence rather than by design, and the absence is now written where the next person will find it.
Ruling needed: BLOCKING BEFORE ANY REAL SELLER IS VERIFIED. Either select the KYC vendor and build the interface, or restrict identity-verification writes to an operator path until one exists.

### D-54 - device.purge_unbound has no market to take its retention period from
Severity:  MINOR
Phase:     T4 E
Source:    ADU-DB-01 S11.5 - "A device with no account_id and no activity beyond timing_config.media_retention is deleted"; core.device carries NO market_id, deliberately (S6.4: a device row holds no personal data and is registered before any identity exists)
Effect:    media_retention is per-market configuration and a device belongs to no market, so "the retention period" is undefined for the only job that needs it.
Response:  WORKED AROUND
Action:    The job uses the LONGEST media_retention in force across all markets - the only choice that cannot delete a device some market still considers live. Documented in the job body.
Ruling needed: confirm the longest-wins reading, or give devices a market - which would mean giving them something that says where a person is, and S6.4 exists to avoid exactly that.

### D-55 - S24's close_confirmation_window row conflates two windows and contradicts S12.4a
Severity:  MINOR (ruled by the founder at WORK ORDER T4 S1.1 before implementation)
Phase:     T4 E
Source:    ADU-DB-01 S24 - the job "cancels, releases stock and opens a claim when the 24h or 12h window ends (S12.4)"; S12.4a, written later - the order does NOT expire, stock STAYS HELD, and a SYSTEM claim opens
Effect:    Read literally, S24 would release stock a buyer had already paid for.
Response:  RULED (T4 S1.1), and built both ways
Action:    The 24h SELLER silence is S12.4a exactly - no cancellation, stock held, SYSTEM claim, missed window counted. The 12h BUYER silence after a first rejection is ordinary expiry - cancel, release, no claim - because nobody performed and nobody lost anything. Both branches live in one job, and the 12h branch shares the expiry routine with order.expire_sweep, which is a compare-and-set, so the two jobs seeing the same row is safe by construction.
Ruling needed: ADU-DB-01 v1.12 to correct S24's row, as the founder has already undertaken to do.

### D-56 - The register is cited at D-25 and D-28 from code, and neither entry exists
Severity:  MINOR (a hole in the audit trail, not in the schema)
Phase:     T4 G
Source:    apps/api/src/modules/catalogue/catalogue.schemas.ts cites register D-25; db/migrations/0022 and pg-error-translator.ts cite register D-28; DEFECT-REGISTER.md runs D-01 to D-24, then D-26, D-27, D-29 onward
Found by:  the Phase G triage, reading every entry
Effect:    Three citations point at nothing. Someone following D-28 to understand the payout-lock SQLSTATEs finds no entry, and cannot tell whether the reasoning was lost or never written.
Response:  RECORDED
Action:    None yet - the reasoning behind both is present in the code comments that cite them, so nothing is lost, but the numbers should either be back-filled or the citations corrected.
Ruling needed: none. Back-fill at the next register pass.

### D-57 - After G1.1, nothing creates the `core.person` row an INDIVIDUAL seller's attestation needs
Severity:  MAJOR (a consequence of the fix, not of the hole; the IDENTITY path is unreachable for individual sellers)
Phase:     T5
Source:    ADU-DB-01 v1.12 S7.3 (write_attestation takes `p_person_id` and creates nothing); S18's `core.fn_seller_attestation_person`, which resolves a COMPANY seller to `seller_company_detail.representative_person_id` and an INDIVIDUAL seller to `core.seller.person_id`
Found by:  removing the seller path and asking who supplies the subject the operator attests about
Effect:    The old endpoint body created a `core.person` row and set `core.seller.person_id` on it, for an individual seller verifying themselves. Operator-only removes that -- correctly, because an operator attesting about a person who does not exist is a mistake and not a signup -- and **nothing else in the codebase writes `core.person`.** A grep confirms it: the only other reference is the company path, which takes `representative_person_id` from the client. So for an INDIVIDUAL seller, `fn_seller_attestation_person` returns NULL forever, `IDENTITY_VERIFIED` can never be satisfied by an attestation, and `fn_evaluate_eligibility`'s IDENTITY arm can never be satisfied. **COMPANY sellers are unaffected** -- their representative person is named through company details, and an operator can attest about that person end to end.
Response:  RECORDED, not worked around
Action:    None. The fix requires ruling WHO links a person to an individual seller and by what act -- an operator step, a person-creation endpoint, or a column on the seller written elsewhere. Inventing one would be inventing an authorization path, which T5 S2.3 forbids in as many words.
Ruling needed: how an individual seller acquires a `core.person` row now that self-attestation is closed. **Not urgent:** ADU-PRD-01 S4.1 admits a seller on EITHER path, `id_verification_requirement` is `OPTIONAL` in the Ethiopian configuration, and AUDIENCE carries the beta (test 7 asserts exactly that). It becomes blocking the day a market sets `MANDATORY_ALL`, or the day an individual seller needs the Pro badge.

### D-58 - ADU-DB-01 v1.12's Appendix A omits the enum value v1.12 itself introduces
Severity:  MINOR (a documentation defect in the reissue, caught by building it)
Phase:     T5
Source:    v1.12 S0.1 ruling table, S7.3's ruling box and S7.3's prose all introduce `OPERATOR_ATTESTED` -- four mentions. Appendix A's catalogue row still reads `verification.verifier_kind | KYC_VENDOR, VIDEO_CALL`
Found by:  applying migration 0027 and running Appendix C check 16
Effect:    **Check 16 compares Appendix A against `pg_type` in BOTH directions**, so a database that carries the ruling disagrees with the appendix of the document that ruled it. The repository transcription `db/checks/fixtures/appendix-a.json` is what check 16 actually reads, so the build stays green -- which is the only reason this is MINOR rather than a failing gate. A reader reconciling the appendix by hand would remove the value.
Response:  WORKED AROUND -- the fixture is updated, the document is not (a document is never edited here)
Action:    `OPERATOR_ATTESTED` added to `db/checks/fixtures/appendix-a.json`. The withdrawn A1.1 block further down that file is untouched: it is history, not the catalogue.
Ruling needed: ADU-DB-01 v1.13 to add the value to Appendix A. **This is the third time this document has produced this exact shape** -- v1.10 announced a withdrawal it did not perform, v1.11 said so, and v1.12 says it again in S0.2: "an assertion in prose that nothing executes will drift."

### D-59 - Appendix B's reconciliation was declared and not performed
Severity:  MINOR
Phase:     T5
Source:    v1.12 S30 -- "D-18, D-40: Appendix B omits two tables the bodies require -> Both exist. **Appendix B reconciled**; check 14 bidirectional." S0.1 -- "112 tables (111 after D-18/D-40's two, plus `seller_courier_invite`)"
Found by:  diffing Appendix B's manifest against `information_schema` on the built database
Effect:    Appendix B names **neither** `core.category_market_availability` (D-18) **nor** `core.notification_preference` (D-40) -- the two tables it says it was reconciled for -- and does not name `core.seller_courier_invite` either, though S0.1's arithmetic counts it and S6.3a defines it. Its core heading reads **84** above a list of **85**. So the appendix that opens "the number is derived, not asserted" carries an asserted number, a heading that disagrees with its own list, and the omissions it claims to have closed.
Response:  RECORDED. Check 14 reads the repository fixture, not the document, so the build is unaffected and green.
Action:    None in code. `apps/api/CLAUDE.md` now states that the build's counts are the fixtures' and that v1.12's printed ones differ, so the next reader does not "correct" a green check against a stale appendix.
Ruling needed: ADU-DB-01 v1.13 to reconcile Appendix B **from the database**, as its own preamble says it is. **The lesson is the one v1.11 already drew about itself:** a correction announced in a change table and not performed in the body is indistinguishable, to the next reader, from one that was.

### D-60 - The FK trap ADU-DB-01 E6 warned about has ZERO instances, and the warning had drifted from the schema
Severity:  MINOR (the warning was wrong; the underlying risk is real and smaller)
Phase:     T6 A
Source:    ADU-DB-01 v1.10/v1.12 S6.9a E6 -- "ownership transfer needs ON UPDATE CASCADE ... every child FK referencing (seller_id, owner_account_id) needs the cascade or the transfer raises"; WORK ORDER T6 S1.1, which repeated it
Found by:  enumerating from pg_constraint before writing anything, exactly as S1.1 instructed
Effect:    There are 29 foreign keys into core.seller. **28 reference seller(id) alone and one references (id, entity_type).** NONE references (id, owner_account_id). The anchor `seller_id_owner UNIQUE (id, owner_account_id)` exists and nothing uses it. Independently confirmed by a second agent, which also established that confupdtype is 'a' for all 29 and that **no ON UPDATE action of any kind exists anywhere in this database.** So there is no cascade to add and the migration the warning called for would have been empty.
Response:  RESOLVED by AMENDMENT A1.1, which withdraws the warning
Action:    None in schema. The real surface is eight FUNCTIONS that resolve authority from owner_account_id -- fn_has_permission, fn_delete_seller, fn_delete_account, fn_cancel_line, fn_handoff_scan_validity, fn_notify_new_device, fn_notify_payout_change, financial.read_payment_evidence -- and no RLS policy. An ownership transfer changes eight authorization outcomes at the instant the column flips, which is the ruling working. Phase B asserts it with a live session crossing the activation boundary.
Ruling needed: none. A1.1 records the withdrawal. **The lesson is the founder's own:** a work order warning that documents drift from schemas contained a warning that had drifted from the schema, and the instruction to enumerate from the catalogue is what caught it.

### D-61 - Every deferred threshold on ladder_config is NOT NULL, so "deferred" was inexpressible
Severity:  MAJOR (it made a ruling unbuildable and a fail-closed guard decorative)
Phase:     T6 A
Source:    ADU-DB-01 v1.12 S5.5 prints new_level_transaction_cap_minor as "bigint NULL -- NULL = no cap" and the Group A thresholds as deferred; S12.3 says "the column is NULL and the check does not fire"; A1.3 says "all four trusted_* stay NULL, so TRUSTED remains unreachable"
Found by:  writing the test A1.3 asks for and watching the INSERT refuse
Effect:    Every threshold column on core.ladder_config was NOT NULL. Three consequences, none of which raises anything: (a) S12.3's transaction-cap ruling could not be expressed at all; (b) A1.3's stated mechanism for TRUSTED being unreachable was FALSE -- a configured market must supply all four trusted_* values, so TRUSTED became reachable at the market seed, the opposite of the ruling; (c) the `coalesce(..., false)` guards in fn_recompute_seller_level, which exist to make NULL never promote, were guarding against a value the schema forbade. The inertness that actually protected the ladder came from there being NO ladder_config row at all, and that protection ends at the market seed.
Response:  FIXED for the columns two rulings depend on
Action:    Migration 0028 drops NOT NULL on new_level_transaction_cap_minor (S12.3) and on the four trusted_* (A1.3), and the fail-closed guards become live. **The other deferred thresholds -- established_* (4), demotion_* (3), distinct_buyer_max_count -- are still NOT NULL**, so a market seed must still invent values ADU-VAL-01 marks OPEN.
Ruling needed: whether every ADU-VAL-01 OPEN threshold should be nullable, so that "not yet decided" is a state the schema can hold. **Today the Ethiopian market seed cannot be written without inventing eight numbers**, which is the thing rule 6 forbids.

### D-62 - fn_create_order takes four arguments, and a hand-written replacement would have re-run T5's trap
Severity:  MINOR (caught before it left my working tree; recorded because the method is the finding)
Phase:     T6 A
Source:    Migration 0028 had to change one line in core.fn_create_order
Found by:  extracting the function with pg_get_functiondef instead of trusting a reading of it
Effect:    My first draft reconstructed the function by hand from fragments and gave it THREE parameters; the real signature is `(p_cart_id uuid, p_buyer uuid, p_order_id uuid, p_expected jsonb)` -- four. Shipping that would have created a **NEW function object** with PostgreSQL's defaults (owner = whoever ran the migration, EXECUTE to PUBLIC) and left the four-argument original callable behind it. That is exactly the trap T5's S2.2 was written about, committed in the work order after the one that warned about it.
Response:  AVOIDED
Action:    0028 reproduces the function from pg_get_functiondef with a single line replaced by a scripted substitution asserting exactly one match. **The rule worth keeping: a plpgsql body that must change is EXTRACTED and patched, never retyped.** A 174-line function rewritten from memory is a silent behaviour change wearing a bug fix.

### D-63 - Three PostgreSQL defaults would each have made a correct database refusal read as a server error
Severity:  MINOR (three instances of one class, all closed)
Phase:     T6 A
Source:    Building G1.9's immutability trigger and G1.10's anchor CHECK
Found by:  the survey's adversarial pass, which read pg-error-translator.ts rather than assuming it
Effect:    (a) `REVOKE UPDATE (slug) ON core.product FROM adulis_app` is a SILENT NO-OP -- adulis_app holds TABLE-level UPDATE and a column-level REVOKE does not subtract from it, so the obvious immutability mechanism would have appeared to work and enforced nothing. (b) A restrict_violation from a write-once trigger falls through the 23001 branch's message-match ladder to `return null`, which the filter turns into INTERNAL: the database refusing correctly, reported as a 500. (c) 23514 is translated only for product_variant_stock_count_check, so the anchor CHECK would have done the same.
Response:  FIXED
Action:    Immutability is a write-once TRIGGER copying core.fn_reservation_price_write_once, and both new messages plus the new constraint name have branches in the translator. **The general shape: a new database-enforced refusal needs a translator entry in the same change, or enforcement that works reads as enforcement that is broken.**

### D-64 - device.purge_unbound could wedge permanently on a device a deleted account left behind
Severity:  MAJOR (a nightly job failing forever on the same rows, silently)
Phase:     T6 A
Source:    core.session.device_id and core.account_device.device_id both REFERENCE core.device(id) with NO ON DELETE; core.fn_delete_account (0023:439) un-binds a device by setting account_id = NULL and leaves its session rows
Found by:  the survey's adversarial pass on G1.11, while checking the query the ruling rewrites
Effect:    After any account deletion the device is `account_id IS NULL` with live session rows still pointing at it. devicePurgeUnbound selected it as stale and the DELETE raised 23503. **The batch is taken in the same order every night, so the job would have failed on the same rows forever** -- and a failing job is only visible through the heartbeat, which stays green because the worker is alive.
Response:  FIXED, and the fix rides with G1.11 because the ruling rewrote that exact query
Action:    Two `NOT EXISTS` guards on core.session and core.account_device, in both the selection and the re-asserted delete predicate, plus a test that plants the wedge and proves the job completes. The guards needed SELECT on both tables for adulis_jobs, which it did not hold -- the same class as D-47, found the same way.
Ruling needed: none for the guard. But **nothing purges an orphaned session row**, so a device whose account was deleted is now retained indefinitely rather than wedging. That is better and it is not what S11.5 describes.

### D-65 - The purge test could not detect the change G1.11 is about
Severity:  MINOR (a test that passes either way)
Phase:     T6 A
Source:    apps/api/test/e2-e6.jobs.spec.ts seeds two markets through one shared literal
Found by:  the survey's adversarial pass
Effect:    Both markets carried `media_retention = '90 days'`, so `max()` and `min()` over {90, 90} are the same number and the seeded device was stale under either. **An implementation that changed nothing, or that swapped max for min and got the per-device join backwards, would have shipped green.**
Response:  FIXED
Action:    A new suite gives every market a DIFFERENT retention -- 10 days and 400 days -- and asserts a marketless device is purged under the SHORT one. **That single assertion is the whole ruling**, and it is the one the old fixture was structurally unable to make.

### D-66 - G1.10's anchor is per buyer-seller PAIR, so the second product inherits the first product's anchor
Severity:  MAJOR (it defeats the purpose of the ruling, in the direction the ruling exists to prevent)
Phase:     T6 A
Source:    `one_conversation_per_pair UNIQUE (seller_id, buyer_account_id, market_id)` (0015:40), unchanged by G1.10; ADU-DB-01 S17.1 still says "Unique together"
Found by:  reading the constraint beside the column the ruling adds
Effect:    A buyer and a seller have exactly ONE conversation. Its anchor is set at creation and is immutable. **The second product that buyer asks about therefore reuses the first product's anchor** -- so a slotted answer template would fill confidently with the WRONG product rather than escalate. G1.10 exists because "containment then measures the missing anchor rather than the assistant"; a wrong anchor measures the assistant answering correctly about the wrong thing, which is worse than the problem it replaces.
Response:  RECORDED, not designed around. Widening the UNIQUE to include the anchor is a product decision no ruling makes.
Action:    The endpoint does NOT re-anchor an existing conversation, so the containment signal keeps its honest shape: an unanchored or wrongly-anchored conversation escalates rather than answering wrongly.
Ruling needed: **is a conversation per buyer-seller pair, or per anchor?** If per pair, G1.10 helps only the first product a buyer ever asks about. If per anchor, `one_conversation_per_pair` must widen and the chat list becomes a list rather than a row.

### D-67 - S6.3a's UNIQUE is total where its neighbour's is partial, so a revoked invite blocks that phone forever
Severity:  MINOR
Phase:     T6 A
Source:    ADU-DB-01 v1.12 S6.3a prints `UNIQUE (seller_id, phone)`; core.seller_courier beside it uses `seller_courier_live UNIQUE (seller_id, account_id) WHERE revoked_at IS NULL` (0005:178-179)
Found by:  the survey's adversarial pass, comparing the new table to the one it sits beside
Effect:    Once an invite is revoked or claimed its row remains, and that seller can **never invite that phone again**. The neighbouring table deliberately frees the pair on revocation. Two tables about the same relationship, with opposite rules, and the document does not acknowledge the difference.
Response:  TRANSCRIBED VERBATIM, not corrected
Action:    Migration 0029 builds exactly what S6.3a prints, including this and the two columns that carry no REFERENCES where every comparable column in core does. **A judgement call in SQL is the failure this project has paid for most**, and the correct response to a document that looks wrong is an amendment, not a deviation.
Ruling needed: should the invite UNIQUE be partial on `revoked_at IS NULL`, matching seller_courier? And should invited_by_account_id / claimed_by_account_id reference core.account(id)?

### D-68 - The intent G1.7 requires has no table in any document, so Appendix B owes a row

Severity:  MINOR (documentation debt, deliberately incurred)
Phase:     T6 B
Source:    ADU-API-01 v1.7 S12.12 (G1.7) rules "an intent expires after 24 hours" and "the rate is locked at intent creation"; ADU-DB-01 v1.12 S18.5 stops at `billing.collection_record` and prints no intent
Found by:  building G1.7 and finding nothing to build it in
Effect:    The collection record is the RECONCILIATION artifact -- the row an operator matches a bank line against -- and it has the opposite lifetime to a quote. Expiring it would void, under an operator's hands, the record they were matching. So the intent needs its own table, and `pnpm db:check` check 14 compares the live table set against Appendix B, which does not list one.
Response:  BUILT, and pinned by name
Action:    Migration 0033 creates `billing.purchase_intent`; `check-14-table-manifest.mjs` carries it in `BODY_OVER_MANIFEST` beside `core.category_market_availability` (D-18), `core.notification_preference` (D-40) and `core.seller_courier_invite` (D-59). Exactly D-40's mechanism: ADU-API-01 gave a capability endpoints and no document gave it a table.
Ruling needed: add `billing.purchase_intent` to ADU-DB-01 Appendix B, with its columns. The shipped shape is one row per open purchase, `collection_record_id UNIQUE`, tier/term/`price_schedule_version_id`/`amount_minor`/`currency` carrying the locked quote, and `created_at`/`expires_at`/`reconciled_at`/`cancelled_at` carrying its state as timestamps rather than as an enum (check 16 freezes the enum catalogue).

### D-69 - RULE: an endpoint whose failure must be indistinguishable from its success cannot fail inside the transaction holding its idempotency claim

Severity:  RULE (recorded here because this is where the build's hard-won invariants live)
Phase:     T6 B, from Work Order T6-B S3
Source:    G1.8's own second oracle -- `apps/api/test/t6-courier-invite-oracle.spec.ts` test 2
Found by:  closing the courier-invite oracle and discovering that the response body was only one of three channels
Effect:    **The idempotency record is a state channel.** `HandlerTransaction.runIdempotent` writes the record INSIDE the handler's transaction, deliberately, so a state-changing POST cannot forget one. The consequence is that a handler which throws writes NO record -- and a caller who replays the same Idempotency-Key then re-executes instead of replaying, with no `X-Adulis-Idempotent-Replay` header. Two requests distinguish the two branches whatever the first body said. G1.8's old 404-on-unknown-phone leaked exactly this way, and a body-shape fix alone would have left it open.
Response:  RECORDED AS A STANDING RULE, and added to `apps/api/CLAUDE.md` so it is in context for every backend session
Action:    Any endpoint that must not distinguish two inputs has to reach a COMMIT on both paths. Where a genuine refusal is required (a rate limit, a validation error) it must be one that is independent of the discriminating input -- which is why G1.8's rate limit is keyed on the SELLER and never on the phone. Where a side effect must be counted even though the transaction rolls back, it goes on its own connection: `RateLimitService.consume` already does.
Ruling needed: none. This is a build rule, not a specification question.

### D-70 - Ownership transfer is named in three documents and has no table, no signature and no shape

Severity:  MINOR (documentation debt, deliberately incurred)
Phase:     T6 B
Source:    ADU-DB-01 v1.12 names `core.fn_transfer_seller_ownership` at :195, :990 and :1022 and prints no arguments, no return type and no body anywhere; ADU-API-01 v1.7 S12.12 (G1.6) supplies the POLICY and no schema
Found by:  building G1.6
Effect:    A 24-hour delay needs a pending record, and no document gives it one. `pnpm db:check` check 14 compares the live table set against Appendix B.
Response:  BUILT, and pinned by name
Action:    Migration 0034 creates `core.seller_ownership_transfer` and five functions; check 14 carries the table in `BODY_OVER_MANIFEST`. State is three timestamps rather than an enum, because check 16 compares the enum catalogue against Appendix A in both directions.
Ruling needed: add `core.seller_ownership_transfer` to Appendix B, and print a signature for whatever ADU-DB-01 means by `fn_transfer_seller_ownership` -- the shipped set is `fn_request_ownership_transfer`, `fn_cancel_ownership_transfer`, `fn_activate_due_ownership_transfer`, `fn_ownership_transfer_blockers` and `fn_notify_ownership_transfer`, because the act has four moments and one function cannot hold them.

### D-71 - The ownership-transfer delay is a literal 24 hours; the payout delay it is modelled on is per-market configuration

Severity:  QUESTION
Phase:     T6 B
Source:    ADU-API-01 v1.7 S12.12 -- "Activation after **24 hours**" and "It is the same control as a payout change and for the same reason"; `core.timing_config.payout_activation_delay` is a per-market `interval`, seeded at 24 hours
Found by:  choosing between the two while writing `fn_request_ownership_transfer`
Effect:    The two values are equal today and are not the same decision. Reading `payout_activation_delay` would couple a flat ADU-API-01 rule to a per-market configurable, so a market that shortened its payout delay would silently shorten the window in which a compromised Owner session can be caught handing the store away. Writing the literal means a market that ever wants its own has no column to put it in.
Response:  LITERAL, and registered rather than assumed
Action:    Migration 0034 uses `now() + interval '24 hours'` with the reasoning in the function's comment, so the coupling is not discovered later by a reader who assumed it.
Ruling needed: is the ownership-transfer delay per-market? If yes, `core.timing_config` owes an `ownership_transfer_delay` column and Appendix B owes the change; if no, the literal is correct and ADU-DB-01 should say so beside the payout one.

### D-72 - core.rate_limit_subject_kind has no SELLER value, and T6-B S2's limit is per seller

Severity:  MINOR
Phase:     T6 B
Source:    `core.rate_limit_subject_kind AS ENUM ('ACCOUNT', 'DEVICE', 'PHONE_HASH', 'IP_HASH')` (0001:196); Work Order T6-B S2 -- "10 invites per hour per seller"
Found by:  applying the limit
Effect:    The subject of this limit is the STORE, not the person: an oracle walked from three Admin sessions on one store is one oracle, and a per-account limit would give it three budgets. There is no enum value for that subject, and Appendix C check 16 compares enum names and values against `db/checks/fixtures/appendix-a.json` in both directions -- so adding one is a document amendment, not a migration.
Response:  WORKED AROUND, and named
Action:    The bucket is written as `subject_kind = 'ACCOUNT'` carrying the SELLER id, under `bucket_key = 'seller-courier-invite'`. The primary key is `(subject_kind, subject_id, bucket_key, window_start)`, so a distinct bucket key makes collision with a genuine account bucket impossible; the only wrongness is the label. The reasoning is in `couriers.controller.ts` at the call site.
Ruling needed: add `SELLER` to `core.rate_limit_subject_kind` in Appendix A, or rule that seller-scoped limits are recorded as `ACCOUNT` with a namespacing bucket key.

### D-73 - D-66's real answer is that the anchor belongs to the MESSAGE, not to the conversation

Severity:  MAJOR (it is the shape of the fix, not a new defect)
Phase:     T6 B, from Work Order T6-B S4
Source:    D-66 above; `one_conversation_per_pair UNIQUE (seller_id, buyer_account_id, market_id)` (0015:40); ADU-DB-01 v1.12 S17.1's `chat.conversation.product_id` / `order_id`
Found by:  T6-B S4, which asked for the reasoning to be recorded and nothing to be built
Effect:    G1.10 puts the anchor on the CONVERSATION, and a conversation is per buyer-seller pair. A buyer asks about one product, then another, in the same thread -- which is what a thread IS. Under a per-conversation anchor the second question is answered against the FIRST product's slots. **That produces a wrong answer with BETTER containment metrics than the missing-anchor case it replaces: a regression that measures as an improvement**, and S15.3's improvement loop then optimises toward it. The missing anchor at least escalated, which is honest.
Response:  REGISTERED WITH THE REASONING. NOTHING BUILT.
Action:    `openConversation` does NOT re-anchor an existing conversation (`ON CONFLICT ... DO UPDATE SET last_message_at = chat.conversation.last_message_at`), so today's behaviour is the honest one: a second product's question runs against a stale anchor whose slots will not fill, and escalates. Moving the anchor to `chat.message` is a schema and a product decision that no ruling makes, and inventing it here would be the judgement call in SQL this project has paid for most.
Ruling needed: **does the anchor belong to the message?** The likely answer is yes -- an anchor is a property of what was asked, not of who is talking to whom -- in which case `chat.message` gains `product_id`/`order_id` with the same `num_nonnulls(...) <= 1` CHECK, `chat.conversation` keeps its pair uniqueness, and the assistant resolves slots from the anchor of the message it is answering. `chat.conversation`'s two columns then become the thread's most recent anchor, or are dropped.

### D-74 - A lazy activation inside the handler's transaction is undone by the request it activates on

Severity:  MAJOR (found and fixed in this phase; it would have shipped silently)
Phase:     T6 B
Source:    AMENDMENT A1.1 -- "a live session held by the outgoing owner across the activation boundary must lose those capabilities on its next request, with no re-authentication"; `HandlerTransaction`
Found by:  the test A1.1 asks for, on its first run
Effect:    G1.6's activation runs at the top of every seller-scoped transaction, so the OUTGOING OWNER'S own next request activates the transfer and is then judged by what the activation did -- `fn_has_permission` finds no relationship, raises `U0002`, and the endpoint 404s, correctly. **And the raise rolls the transaction back, taking the activation with it.** The observable behaviour is exactly right (404) and the store never moves: `owner_account_id` stays where it was, the memberships never change, both notifications are never queued, and every subsequent request by that owner repeats the cycle. The one case A1.1 names is precisely the case that cannot commit.
Response:  FIXED
Action:    `HandlerTransaction.run` and `.runIdempotent` attempt the activation inside the handler's transaction -- free, and correct whenever the handler succeeds -- and once more in a transaction of its own when the handler threw, before rethrowing. That second attempt swallows its own errors so it can never mask the handler's. A second transaction on every request would have been the simpler shape and is a real cost paid for a case that almost never happens.
Ruling needed: none. Worth reading beside `core.fn_activate_due_payout` (0022), which is lazy on `GET /v1/seller/payout` and has the same rollback exposure on any request that fails after it -- and, separately, activates only when somebody reads.

### D-75 - Closure requires ACTIVE, so the one blocker that leads to suspension locks the seller out of G1.3's escape hatch

Severity:  QUESTION (latent: nothing writes BILLING_SUSPENDED today)
Phase:     T6 B
Source:    `enterClosure` (`deletion.service.ts:226-229`) -- `UPDATE core.seller SET status='CLOSING' WHERE id = $1 AND status = 'ACTIVE'`; `fn_deletion_blockers`' sixth check is `SUBSCRIPTION_PAST_DUE`
Found by:  writing the G1.3 test and asking which blocker bites hardest
Effect:    G1.3 says "`POST /v1/seller/closure` remains available when `POST /v1/seller/deletion` is blocked ... closes now and deletes when the money settles". The blocker most obviously about money settling is `SUBSCRIPTION_PAST_DUE`, and a `PAST_DUE` subscription is what drives a seller to `BILLING_SUSPENDED` -- a status from which `enterClosure` returns `ILLEGAL_TRANSITION`. The escape hatch is closed in the one case the ruling describes.
Response:  REGISTERED, NOT FIXED
Action:    Nothing writes `BILLING_SUSPENDED` in this build, so the case is unreachable today. Fixing it is not one change but two, and the second is unruled: permitting `BILLING_SUSPENDED -> CLOSING` also requires deciding where `DELETE /v1/seller/closure` returns that seller to. Returning them to `ACTIVE` would launder a suspension -- close, reopen, suspended no more -- and recording the status they came from is a column no document gives. `apps/api/test/t6-closure-survives-block.spec.ts` proves the reachable case.
Ruling needed: may a `BILLING_SUSPENDED` seller close? May a `DRAFT` one? And when a suspended seller re-opens, what status do they re-open into?

### D-76 - Gate 0 -- "a CLOSING seller is blocked from forward-looking actions" -- is implemented in two functions out of an unenumerated set

Severity:  MAJOR
Phase:     T6 B
Source:    ADU-AUTH-01 v2.5 S14 -- "A fifth check sits above all four and is not authorization: the seller's own status. A `SAFETY_SUSPENDED` or **`CLOSING` seller is blocked from forward-looking actions regardless of who is asking**. That is a state gate, evaluated first." ADU-DB-01 v1.12:2303 restates it for order functions only
Found by:  the survey's adversarial pass, and confirmed while building G1.7's gate
Effect:    Before this phase exactly ONE function implemented it: `core.fn_create_order`. So "closure stops new obligations" was true of order creation and of nothing else. `core.fn_publish_product` (0020:57-124) checks readiness and the tier limit and never reads `core.seller.status`, so **a CLOSING store can still publish products**; the storefront lists `CLOSING` in `VISIBLE_STATES`, so those products are publicly browsable. The billing group read status nowhere at all, so a closing -- or draft, or billing-suspended -- store could open a collection record and start the seven-day SMS clock.
Response:  PARTLY FIXED, and the rest registered
Action:    `billing.fn_open_purchase_intent` now refuses `CLOSING`, `SAFETY_SUSPENDED` and `DELETED`, deliberately NOT `BILLING_SUSPENDED` (paying is how a seller leaves that state, so blocking the payment would be a trap with no exit). Product publication is untouched: it belongs to the catalogue's own ruling and adding a status gate there changes what a closing seller may do to their own shelf, which is a product decision.
Ruling needed: **enumerate the forward-looking actions.** Neither document lists them. Publication, broadcasts, courier invites, team invites and subscription purchase are all candidates and none is named.

### D-77 - Reconciliation has enforcement, no surface, and no role that could call it

Severity:  QUESTION
Phase:     T6 B
Source:    ADU-DB-01 S18.5 and D-36 -- reconciliation is "operator work outside this contract"; `adulis_app` holds DML on `billing.collection_record` and there is no endpoint; `adulis_jobs` holds `UPDATE (reminder_sent_at)` alone
Found by:  building G1.7's second rule and asking who performs it
Effect:    A subscription can only become `ACTIVE` through `billing.fn_reconcile_purchase`, and no runtime role holds `EXECUTE` on it. That is correct -- granting it to `adulis_app` would create the operator endpoint by accident -- but it means the act is performed by a human at a psql prompt, and the only thing standing between "can open a session" and "can activate a paid subscription" is the function's own `core.operator_grant` derivation.
Response:  BUILT AS ENFORCEMENT ONLY, with a runbook
Action:    `ops/runbooks/billing-reconciliation.md`, following the `grant-founder-operator.md` precedent. The function derives authority from a live `ADMIN` operator grant exactly as T5's `verification.write_attestation` does, so the psql session is not the authority.
Ruling needed: what is the operator surface, and which role serves it? This is the same question D-36 asks about the purchase surface, now with a function on the other side of it.

### D-78 - mark-transferred had no state guard, and coalesce() made the absence invisible

Severity:  MAJOR (fixed in this phase)
Phase:     T6 B
Source:    `billing.controller.ts` before this change -- `SET marked_transferred_at = coalesce(cr.marked_transferred_at, now())` with no predicate on `reconciled_at`
Found by:  the survey's adversarial pass
Effect:    A seller could assert a transfer against a record an operator had already reconciled, and the `coalesce` returned 200 as if nothing were odd. Once G1.7 gave records a closed state the same statement would have silently stamped a VOIDED record too.
Response:  FIXED
Action:    The UPDATE now carries `AND cr.reconciled_at IS NULL AND cr.voided_at IS NULL`. Zero rows is then two different facts and they earn different answers: a record that is not this seller's is 404 (S19 -- it must not be confirmed to exist), and one that is theirs and closed is 409 with `reason: COLLECTION_RECORD_CLOSED`.
Ruling needed: none.

### D-79 - GET /healthz answered 401 in the assembled application, and both its tests bypassed the guard

Severity:  BLOCKER (in deployment; it does not raise, it 401s, and nothing would have gone live)
Phase:     T6 C
Source:    `AuthGuard` is registered as `APP_GUARD` (`app.module.ts:110`); `HealthController.healthz` carried no `@Public()`; ADU-CON-02 v3.1 S18 names `/healthz` as the Render health check
Found by:  Work Order T6 S4 -- "write a test for each, even where no code changes." D-51's test, written against the REAL AppModule for the first time.
Effect:    `GET /healthz` returned **401 SESSION_EXPIRED**. Render polls it with no `Authorization` header to decide whether an instance may take traffic, so every instance would have been marked unhealthy and no deploy would ever have gone live. The whole T4 heartbeat feature and D-51's 200-versus-503 decision were being tested against a route that could not be reached.
Response:  FIXED
Action:    `@Public()` on the route, with the reasoning at the decorator. Public means AUTH-OPTIONAL, never auth-ignored -- a caller presenting a dead token is still refused; Render presents none. **The reason it went unseen is the finding**: `health.controller.spec.ts` and `worker-runtime.spec.ts` both build a standalone module (`DatabaseModule` + the controller), where no global guard exists. `t6-parked-decisions.spec.ts` builds the real `AppModule` and asserts the route answers at all before asserting anything about its body.
Ruling needed: none. Worth generalising in review: **a controller tested only in a standalone module is a controller whose global guards, filters and interceptors are untested.** `/healthz` is the only route in the repository with no e2e coverage through `AppModule`, and it was the only one that was wrong.

### D-80 - ops/render.yaml is named by the document, referenced by the topology, and has never existed

Severity:  MINOR
Phase:     T6 D
Source:    ADU-CON-02 v3.1 S18 -- "`render.yaml` keeps infrastructure in the repo" (:446) and "**Topology (`ops/render.yaml`)**" (:450)
Found by:  writing the deploy runbook and looking for the file it should point at
Effect:    The hosting topology -- `adulis-db` with PITR, `adulis-api` x2 on `/healthz`, `adulis-worker`, a pre-deploy `pnpm db:migrate` -- exists only as one sentence in a document. Infrastructure created by hand in a dashboard is infrastructure nobody can review, diff or restore.
Response:  REGISTERED, and the shape written down where it can be followed
Action:    `ops/runbooks/deploy.md` step 0 carries the topology verbatim and says the services are created by hand until the file exists. Writing it needs a Render account to verify against; inventing a `render.yaml` that has never been applied would be a file that looks authoritative and has never been true.
Ruling needed: none -- it is work, not a question. It is the first thing to do once an account exists.

### D-81 - ci:local and CI were two lists, and the difference was invisible until a push failed

Severity:  MAJOR (process; it has already cost one broken build)
Phase:     T6 D
Source:    root `package.json`'s `ci:local` ran eight gates; `.github/workflows/ci.yml` ran eighteen
Found by:  Work Order T6 S5.1 -- "The fix is not to add the missing step to `ci:local`. It is to stop maintaining two lists."
Effect:    T5 changed one `@ApiOperation` summary. `ci:local` went green; CI failed on `generate:openapi` + `git diff --exit-code`, a step `ci:local` did not have. **A green local run that means less than a green CI run is worse than no local run at all, because it is trusted.** Ten gates were CI-only: the extensions, migrate, worker:install, determinism, the permission matrix, the ASCII gate, Appendix C, both console build assertions, and the contract equality check.
Response:  CONVERGED ON ONE LIST
Action:    `ops/scripts/gates.mjs` holds the eighteen gates. `pnpm ci:local` runs it; the CI job runs the same script and keeps only SETUP -- checkout, node, pnpm, the four extensions, the LOGIN passwords -- which differs legitimately between a service container and docker-compose and cannot fail because someone wrote something wrong. The single real difference, CI's scoping of typecheck/build/test to changed packages (ADU-REPO-01 S7), is expressed once as `ADULIS_SCOPE_FILTER`. **Proved the way the dependency rules were proved**: an `@ApiOperation` summary was changed, `ci:local` was run, and it failed on `contract-current` with the instruction to regenerate and commit. The old `ci:local` was green on the same change.
Ruling needed: none. Note for ADU-CON-02's next reissue: S14.2 says `db:check` prints **fifteen** passes and S18 says **15** with check 14 = **107**; the code is at **sixteen** checks and check 14 at **109** manifest tables. The document is stale on all three numbers, and S18.2 is the gate a deploy depends on.

### D-82 - The premise that `ci:local` touches no database was false, and it is why the database gates stayed out

Severity:  MINOR (a belief, not a defect; it produced one)
Phase:     T6 D
Source:    `pnpm ci:local` -> `pnpm test` -> `apps/api` jest, whose twenty integration suites open a real `pg.Pool` from `DATABASE_URL_MIGRATE ?? DATABASE_URL` and **throw** rather than skip when it is unset (`migration-01-foundation.spec.ts:34`, `:63-70`, and four more)
Found by:  the survey's adversarial pass, and load-bearing for Phase D
Effect:    The argument for keeping `db:check`, `db:determinism` and the rest out of `ci:local` was that it should stay infrastructure-free. It never was. The real question was not whether `ci:local` may require Docker -- it already did -- but which gates it should therefore stop excluding.
Response:  RECORDED, and acted on
Action:    All ten database and build-output gates are in the shared list. `ops/scripts/gates.mjs` says so in its header, so the next person to reason about "keeping ci:local light" starts from what is true.
Ruling needed: none.

### D-83 - Two suites running one global sweep is a flake, and the suite carried four of them

Severity:  MAJOR (in the harness; it makes every gate re-runnable-until-green, which is the same failure as a gate people skip)
Phase:     T6 D
Source:    twelve instrumented full-suite runs while converging `ci:local` and CI
Found by:  Phase D. A converged gate list is worth nothing if it goes red at random, so the suite was run twelve times with the output saved rather than once.
Effect:    Five distinct intermittent failures, none of them about the behaviour under test. All the same shape: **a test asserting a global count, or driving a fleet-wide sweep, against a database shared with every other suite in the run.**
  1. `device.purge_unbound` was exercised by BOTH `e2-e6.jobs.spec.ts` and `t6-device-retention.spec.ts`. Run from two jest workers at once, one suite's `cart_line` INSERT lands between the other's `cart_line` DELETE and its `cart` DELETE, and the sweep dies on `cart_line_single_seller` -- in whichever suite happened to lose. `e2-e6` also asserted `devices_purged === 1`, a global count, and saw 3.
  2. `subscription.collect_reminder` was driven by both `e2-e6` and `t6-purchase-intent`.
  3. `analytics.create_partition` ran at a FIXED clock (T0 = 2026-06-01) whose "next two months" had drifted into the REAL current month. Any `analytics.event` another suite wrote for now sat in `event_default` and the CREATE failed with *"updated partition constraint for default partition would be violated by some row"*. Its `DROP TABLE` cleanup would then have taken that suite's rows with it.
  4. `stock_event` was read `ORDER BY occurred_at` where both rows share a statement-time -- not a total order, stable until the day it is not.
  5. `t6-parked-decisions` purged `core.rate_limit_bucket` by `bucket_key` alone to make room for two OTP requests, wiping every other suite's OTP budget mid-run.
Response:  FIXED, by one rule
Action:    **Exactly one suite may own a global sweep, and no test asserts a global count.**
  - `device.purge_unbound` belongs to `t6-device-retention.spec.ts` alone -- the file written at Phase A precisely because `e2-e6`'s version could not detect what G1.11 changed (D-65). `e2-e6`'s copy is removed, with the reasoning in its place.
  - `t6-purchase-intent` calls `billing.fn_close_stale_collections()` directly; `e2-e6` keeps the job.
  - The partition test drives a clock far enough ahead (2027-06) that nothing writes into its months.
  - The stock read tiebreaks on `resulting_count`.
  - `t6-parked-decisions` builds its two OTP challenges directly with `codeHash`, so it needs no budget and purges nothing; the courier-invite budget is purged **scoped to the seller** in both suites that hold one.
  Verified by twelve consecutive full-suite runs, 413/413 each, with every run's output kept.
Ruling needed: none. The rule is worth carrying: **a test that asserts a number the whole database contributes to is a test about other people's rows.** Assert your own row is gone; assert theirs is not.
### D-84 - ADU-RUL-02 is named as an installable document and its text was never supplied

Severity:  MINOR (documentation debt; the rulings themselves arrived in full)
Phase:     T7 - 1
Source:    WORK ORDER T7 S3 -- "Install first: `ADU-RUL-02...` to `docs/`"; ADU-VAL-01 v1.1 S0.2 quotes the ruling by name
Found by:  attempting the install
Effect:    The four Phase 1 rulings (D-66 message anchor, D-57 person row, D-67 partial unique, D-64 residual) and the nullability rule are specified in binding detail in the work order's own text and in ADU-VAL-01 v1.1 -- but the DOCUMENT those rulings live in was not attached, so `docs/` cannot receive it and a future reader who greps for ADU-RUL-02 finds citations with no file, exactly the shape ADU-RUL-01 had before T6 installed the amendment trail.
Response:  BUILT FROM THE WORK ORDER'S TEXT, install PARKED
Action:    Every implementation cites "T7 S3.x" beside "ADU-RUL-02" so the authority chain survives the missing file. ADU-VAL-01 v1.1 is installed at docs/registers/ and is GOVERNED by the ASCII gate.
Ruling needed: supply ADU-RUL-02's text for installation to docs/ -- or rule that T7's S3 text IS the document of record, in which case the citation form "ADU-RUL-02 via T7 S3" becomes permanent.

### D-85 - The slot vocabulary is ruled by nothing, so the anchor's READER is a seam and not a filler

Severity:  MINOR (deliberate under-build; the alternative was invention)
Phase:     T7 - 1
Source:    T7 S3.1 -- "slot resolution reads the anchor of the message being answered, not the thread's"; nlu.answer_template.slots text[] (0015:199); ADU-DB-01 v1.12 S17.2 prints the column and no vocabulary
Found by:  building D-66 and looking for what a slot NAME maps to
Effect:    No document defines which slot names exist or which product/order fields they draw from -- there is not one seeded template in any migration, and the assistant has always escalated on any template whose slots[] is non-empty. "Reads the anchor of the message" is therefore implemented as the SEAM: the cascade and answerWith now receive the answered message's own anchor (never the thread's -- the thread no longer has one), and the escalate-on-slots branch holds it at the exact point a filler would plug in.
Response:  SEAM BUILT, FILLER PARKED
Action:    chat.service.ts threads MessageAnchor from postMessage through cascade into answerWith; the branch comment names this entry. Filling a slot without a ruled vocabulary would answer confidently from an invented mapping -- the precise failure D-66 exists to prevent, one layer down.
Ruling needed: the slot vocabulary -- names, and the field each draws from the anchored product or order. RULINGS-NEEDED already carries the question as D-39's "what fills a template's slots"; D-66's landing narrows the answer to "the message's anchor" and leaves the vocabulary open.

### D-86 - Nothing forbids rewriting a message's anchor, and the ruling is silent

Severity:  QUESTION
Phase:     T7 - 1
Source:    chat.message carries table-level UPDATE for adulis_app (0015:270); T7 S3.1 rules storage, validation and reading, and says nothing about mutability; 0031's conversation-era write-once trigger died with the columns it guarded
Found by:  porting 0031's inventory and asking what replaces the write-once trigger
Effect:    No code path UPDATEs chat.message anywhere (verified: the only read_at writers are core.notification's), so the exposure is theoretical today -- but the grant permits it, and the conversation-era anchor earned an explicit immutability trigger for the same shape of risk. An anchor rewritten after the bot answered would falsify the containment record retroactively.
Response:  NOT BUILT, recorded
Action:    Building an unasked-for trigger is the "completing the schema" failure mode; the ruling's author decides whether message anchors are set-at-send. The translator's 23001 ladder is substring-keyed, so a future trigger's RAISE text must be unique across it (its ANCHOR_IMMUTABLE predecessor was removed with 0035).
Ruling needed: is a message's anchor immutable after send? If yes, a BEFORE UPDATE trigger mirroring 0031's, with a fresh message text and a translator branch in the same change.

### D-87 - Three governing-document passages now print the pre-T7 anchor and invite shapes

Severity:  MINOR (documentation debt, deliberately incurred; documents are never edited here)
Phase:     T7 - 1
Source:    ADU-API-01 v1.7:43 (change table: POST /v1/conversations "anchored on a product or an order"), :852 (the route row, "anchored on exactly one"), :862 (the G1.10 note); ADU-DB-01 v1.12 S17.1:2210-2214 (the anchor printed on chat.conversation), S6.3a:757 (the total UNIQUE (seller_id, phone))
Found by:  the T7 survey's adversarial pass, enumerated line by line
Effect:    A reader implementing from the printed documents rebuilds the conversation anchor and the total invite UNIQUE -- both now wrong. The rulings that supersede them (D-66, D-67 via T7 S3) live in this register and in migrations 0035/0037's headers until v1.13 and an ADU-API-01 reissue land.
Response:  RECORDED for the reissues
Action:    v1.13 owes: S17.1 anchor moved to chat.message; S6.3a partial UNIQUE plus the two account FKs; Appendix B rows unchanged (no table count change). ADU-API-01 owes: lines 43/852/862 re-anchored to the messages route.
Ruling needed: none -- reissue work, listed for the document owner.

### D-88 - Ownership transfer moves the store and leaves the person, and D-57's owner-reuse key must not follow it

Severity:  MAJOR (found by the adversarial pass on this phase; the narrow arm is fixed, the wide question is parked)
Phase:     T7 - 1 (adversarial pass)
Source:    0034 flips core.seller.owner_account_id and never touches person_id (no entity_type restriction -- INDIVIDUAL stores transfer); 0036/onboarding resolve "the owner's person" through the owner's current INDIVIDUAL sellers
Found by:  the Phase 1 conformance reviewer, reading D-57's reuse key against G1.6's transfer
Effect:    A transferred-in INDIVIDUAL store carries the PREVIOUS owner's person. Unfixed, the recipient's next declaration would have REUSED that person -- anchoring one human's stores to another human's person row, the merge-direction form of the split S4.4 forbids, and their attestations would have blended.
Response:  THE NARROW ARM FIXED, the wide interaction PARKED
Action:    The reuse lookup now excludes stores with an activated inbound transfer (onboarding.service.ts), and the same-account race is closed with FOR UPDATE on the account row. What remains unruled: what a transferred INDIVIDUAL store's person_id MEANS after transfer -- it still names the previous owner, fn_seller_attestation_person still reads it, so the store's IDENTITY_VERIFIED readiness rides the OLD owner's attestation. T6's survey flagged the same edge (do not assume person_id == current owner's person); nothing yet re-points or clears it.
Ruling needed: on activation of an INDIVIDUAL store's transfer, is person_id cleared (new owner re-anchors by their own declaration mechanism -- but no such act exists post-creation), re-pointed (to what? the recipient may have no person), or retained-with-meaning ("the store was verified by its founder")? Each answer changes what the eligibility badge asserts to buyers. AND the answer unlocks the database-side enforcement the adversarial pass sketched: btree_gist is among the four ruled extensions, so `EXCLUDE USING gist (owner_account_id WITH =, person_id WITH <>) WHERE (entity_type = 'INDIVIDUAL' AND person_id IS NOT NULL)` would hold one-person-per-owner structurally without touching NULL-person fixtures -- but TODAY it would make fn_activate_due_ownership_transfer RAISE on any transferred store whose founder verified, inside the one function that must never raise for an ordinary outcome (D-74). The constraint waits on the ruling; the service-level FOR UPDATE serialization holds the line until then.

### D-89 - A pending courier invite has no claim path: the sign-in leg 0029 and 0037 describe is built nowhere

Severity:  MAJOR (a feature's second half is missing and two migration headers describe it as existing)
Phase:     T7 - 1 (adversarial pass)
Source:    0029:53-54 and couriers.controller.ts describe the claim "at next sign-in"; core.seller_courier_invite is read by exactly one file (the controller); no auth path touches it
Found by:  the Phase 1 conformance reviewer, tracing the pending row's consumers
Effect:    An invite to a phone with NO account creates a PENDING row with no AUTOMATIC claim: when that person later signs up, no code matches their phone against pending invites. The one escape is manual -- the seller re-taps invite after the courier registers, and the pending row converts in that transaction -- but nothing tells the seller to do that, so in practice the relationship never forms and the seller waits forever. The G1.8 oracle work made the pending row indistinguishable from the claimed path on purpose -- which also made its dead-endedness invisible. D-67's arm-1 test blesses "fresh pending row" as the happy outcome of a path with no consumer.
Response:  RECORDED, not built
Action:    Building the claim-at-sign-in leg touches the auth path (otp/verify) for a courier feature no ruling has specified end-to-end -- the exact "helpful completion" failure mode. The invite surface remains correct for phones that already hold accounts (immediate claim, in the invite transaction).
Ruling needed: the claim mechanism -- at sign-in (which purposes? MOBILE only?), with what notification to the seller, and what expiry a pending invite carries (today: none -- a typo'd number is pending forever and shows in the list).

### D-90 - Three documents carry three different counts of the still-NOT-NULL deferred columns, and all three are wrong

Severity:  MINOR (prose drift; the schema was always the authority and now a gate reads it)
Phase:     T7 - 3
Source:    D-61:577 says 8 remain ("established_* (4), demotion_* (3), distinct_buyer_max_count" -- it forgot demotion_window and distinct_buyer_window); ADU-VAL-01 v1.1 S1.1:88 says "0028 made 5 of them so" (0028's fifth drop was new_to_established... -- no: new_level_transaction_cap_minor, an S2 row outside S1.1; only the four trusted_* count); information_schema said TEN of the fourteen were still NOT NULL
Found by:  enumerating from the schema before writing 0039, per v1.1 S0.3's own rule ("where the list and the schema disagree, the schema wins")
Effect:    An implementer transcribing any of the three prose counts drops NOT NULL on the wrong set and leaves one or two interval columns undeferrable -- the Ethiopian market seed still cannot be written without inventing values, which is D-61 half-closed and looking closed.
Response:  ENUMERATED FROM THE SCHEMA; 0039 alters exactly ten and its header names all three wrong counts
Action:    verify-deferred-values now holds the three forms together permanently, so the next drift is a red gate rather than a register entry. ADU-VAL-01 v1.2 owes the corrected sentence at S1.1:88.
Ruling needed: none -- reissue arithmetic, listed for the register owner.

### D-91 - ADU-VAL-01 v1.1 S2 places media_retention in legal_config; the schema and ADU-DB-01 both say timing_config

Severity:  MINOR
Phase:     T7 - 3
Source:    v1.1 S2's table row: "Media retention | `legal_config.media_retention` | 90 days"; the column lives at core.timing_config (0002:295) and legal_config (0002:399-418) carries evidence/chat/analytics retention and no media column; ADU-DB-01 v1.12:590 and :1467 agree with the schema
Found by:  the Phase 3 survey, checking every S2 row against the schema while S1.1 was being fixtured
Effect:    A reader following v1.1's S2 to tune media retention edits a column that does not exist where stated. S2 is not machine-read (only S1.1 is), so no gate catches the drift -- this entry is the catch.
Response:  RECORDED; the schema wins (v1.1 S0.3's own rule)
Action:    ADU-VAL-01 v1.2 owes the corrected table cell. Nothing in code changes: every consumer already reads timing_config.
Ruling needed: none -- a reissue correction.

### D-92 - follower_threshold's NULL means two opposite things in one governing register

Severity:  QUESTION (parked; the code fails closed today and ADU-RUL-02 blesses that reading)
Phase:     T7 - 3
Source:    ADU-VAL-01 v1.1 S0.2 / ADU-RUL-02: "every column in S1.1 is nullable, and its consumer FAILS CLOSED on NULL" -- row 15 is in S1.1. v1.1 S1.1's own note: "Row 15 is already nullable and PRD S4.1 rules that NULL means NO THRESHOLD" (fail OPEN). The code (0018:146, coalesce(v_best >= threshold, false)) fails CLOSED: a NULL threshold leaves the audience gate unsatisfied
Found by:  the Phase 3 survey, reading the two sentences against the one consumer
Effect:    Under fail-closed, a market with audience_required = true and follower_threshold NULL refuses every seller with FOLLOWER_THRESHOLD_NOT_MET -- the beta posture ("no threshold is enforced", ADU-CON-01:82) is only achievable by audience_required = false, never by a NULL threshold. Under PRD S4.1's reading, NULL should satisfy the gate. Both sentences are in force; they cannot both hold.
Response:  PARKED. The code stands as built (fail closed), the seed ships audience_required = false, and the deferred-values gate asserts nullability only -- never NULL semantics.
Ruling needed: which reading governs row 15. If PRD S4.1 (NULL = no threshold), fn_evaluate_eligibility's audience arm becomes coalesce(v_best >= threshold, TRUE) when the threshold is NULL -- one line, plus a test that a NULL-threshold market admits an audience-less seller.

### D-93 - The console build-output gates failed every scoped CI run that did not select the console

Severity:  MINOR (loud, not silent -- CI went red on the first qualifying PR)
Phase:     T7 - 3 (defect introduced at T6 Phase D)
Source:    ops/scripts/gates.mjs -- gates 'no-unsafe-eval' and 'production-react' hard-failed when apps/console/dist was absent; in CI the Build gate is scoped to `...[origin/main]`, so a diff selecting nothing the console depends on (PR #22: db, ops, apps/api, docs only) correctly skips the console build and produces no dist
Found by:  CI on PR #22 -- the first PR since the T6 convergence whose diff pulled in no console dependency (every earlier PR touched packages/locale or the console itself)
Effect:    Any backend-only PR failed gate 17 with "dist is absent - build first" -- a red that teaches people the gate lies, which is the exact failure class the one-list convergence exists to prevent.
Response:  FIXED
Action:    Under a scope filter, an absent dist now passes with a note naming why (the console was not selected; the assertion runs on every build that produces one). Unscoped -- every local run -- an absent dist stays a hard fail, because an unscoped build always produces one.
Ruling needed: none.

### D-94 - The ownership records named two handles who could review and zero who can: neither was ever a collaborator

Severity:  MAJOR (the outermost review layer was decorative since the day it was written)
Phase:     T7 - 4
Source:    WORK ORDER T7 S0 (the COO/CTO has left; ADU-REPO-01 S3 and ADU-CON-02 v3.1 S14.1 are now false); .github/CODEOWNERS (@naod, @abenezer); the GitHub API at T7
Found by:  Phase 4's verification pass -- T7 S6 warns "a file naming someone who has left requests review from nobody," and the API check showed it was ALREADY true for both names
Effect:    `@naod` and `@abenezer` both exist on GitHub -- as accounts (ids 5516146, 6717001) that are evidently not this project's people and were NEVER collaborators on this repository. The only collaborator is `NaodSolomon`, the handle every commit in history carries. GitHub silently ignores CODEOWNERS entries for users without access, so the file has requested review from nobody since T-something -- through every work order that assumed it was the outermost layer. Combined with ADU-CON-02 S21's standing fact (branch protection does not APPLY on the current plan), the review model was CI plus nothing, which is what T7 S0 now makes official with the adversarial pass added.
Response:  FIXED forward, and the stale documents recorded
Action:    CODEOWNERS now assigns every path to @NaodSolomon (one owner; the unstaffed-workstream doctrine is superseded while there is one human). apps/console/CLAUDE.md carries the ownership note and its stale citations are corrected (v3.1/v2.5/v1.7); the C-2 "against the mock" clause updated per T7 S7.1. Stale and owed to the CEO's reissues: ADU-REPO-01 S3 (CODEOWNERS split), ADU-CON-02 v3.1 S14.1 ("the other founder approves"), plus the ADU-REPO-01 file itself, which is cited across this repository and installed nowhere -- absent from docs/ and from DOCUMENT_AUTHORITY's supplied baseline, and recorded as missing here for the first time (this entry previously claimed a T6 MISSING_SOURCE record; no such record exists, and the adversarial pass caught the invented provenance).
What the adversarial pass found this entry had missed, all fixed in the same PR: the ROOT CLAUDE.md -- the file every session loads -- still carried the two-owner model (apps/console owned by COO/CTO, two rules requiring "both owners"), so the one record most likely to be read was the one record not corrected; the CODEOWNERS rewrite silently falsified ops/runbooks/storefront-import.md step 3 ("until then it has no CODEOWNERS line, which is deliberate") and apps/mobile/CLAUDE.md's start-up checklist ("it needs an owner in .github/CODEOWNERS"); and .claude/reference/DOCUMENT_AUTHORITY.md still routed build/operations sequencing to ADU-CON-02 v3.0 while v3.1 is the installed baseline and v3.0 sits in docs/superseded/. Also corrected here: the T7 S7.1 flip from the mock to the real API had been made in the console's file only, leaving the root CLAUDE.md, .env.example and packages/api-client's own error message still instructing the mock.
Ruling needed: reissue ADU-REPO-01 (S3, S9, and the file's own installation) and ADU-CON-02 (S14.1 review model; S21's branch-protection note gains "required approvals must be 0, not 1 -- nobody can approve their own PR, and 1 would deadlock every merge the day protection becomes enforceable").

### D-95 - core.device_platform has no value a web console can honestly register

Severity:  MAJOR (parked with a dev workaround; production console sign-in cannot register a device truthfully)
Phase:     T7 - 5
Source:    0003 -- core.device_platform is ANDROID | IOS, nothing else; POST /v1/devices takes { id, platform } (auth.controller.ts:273 under the global v1 prefix; auth.service.ts:328-332 -- an earlier draft of this entry wrote /v1/auth/devices, which is not a path key in the contract) and every core.device row must carry one of the two; ADU-CON-02 v3.1 S4.3 requires remember-device on the console; T7 S7.3 rule 6 bans localStorage, sessionStorage, and tokens in JavaScript wholesale
Found by:  Phase 5 C-2, wiring the sign-in flow to the real API
Effect:    Three constraints meet and no honest path exists between them: the console needs a device row to remember, the enum has no value that is true of a browser, and the storage ban leaves nowhere permitted to persist a minted device id across loads. What is built: the console mints a device id per app load (crypto.randomUUID()), VITE_DEVICE_ID carries the seeded device in development, and ops/scripts/seed.mjs provisions that device row labeled 'ANDROID' -- a value the seed's own header names as false and known. Durable remember-device still works END TO END because the credential that persists is the httpOnly __Host-adulis_device cookie (permitted -- it is not JS-readable storage), not the JS-side id; but a fresh production browser has no registered device row and cannot honestly create one.
Response:  PARKED; dev loop seeded, the lie confined to the seed and named there
Action:    None in console code -- inventing a platform value in the product path is exactly the invention rule 6's neighbours forbid. The seeded row keeps C-2 demonstrable.
Ruling needed: add WEB to core.device_platform (one enum migration) and rule whether CONSOLE-audience verify may auto-register an unseen device id, OR rule that console sessions never mint device rows and remember-device rides the device cookie alone.

### D-96 - No endpoint transmits the idle-session values the console must warn about

Severity:  MINOR (cosmetic mistiming only; the server stays authoritative)
Phase:     T7 - 5
Source:    ADU-CON-02 v3.1 S4.3 -- "the client shows the idle warning 5 minutes before either idle limit"; the limits are per-market configuration in core.timing_config; neither the otp/verify response nor GET /v1/auth/sessions nor /v1/bootstrap carries them (verified against the generated contract at T7)
Found by:  Phase 5 C-2, building IdleWarning against the real responses
Effect:    The console cannot warn at "5 minutes before the limit" without knowing the limit. Built: the timer uses the ADU-VAL-01 S3 shipped defaults (30 minutes unremembered, 8 hours remembered), named in session.tsx as exactly that. A market that retunes timing_config gets a warning at the wrong time until this lands; the session itself is never wrong -- an expired session 401s whatever the timer believed. NOTE: when this entry was written that last clause was ASPIRATIONAL -- the Phase 5 adversarial pass found the console had no 401 handling at all, so an expired session left a fully rendered shell in place. The api client now signs the session out on any 401, which is what makes this entry true.
Response:  BUILT with named defaults; constants marked for deletion
Action:    session.tsx carries the two constants and this entry's number; no invented endpoint, no probing heuristic.
Ruling needed: which surface carries the values -- the natural seam is GET /v1/auth/sessions gaining idle_timeout_seconds on the current row (it already returns expires_at and remembered). One field, then the constants are deleted.

### D-97 - The contract has no endpoint listing the caller's own sellers

Severity:  MINOR (C-1 scope: the store chooser cannot render a list)
Phase:     T7 - 5
Source:    the generated contract at T7 -- every /v1/seller/* operation is scoped to one store via X-Adulis-Seller; GET /v1/auth/sessions returns sessions, not stores; no operation returns "the stores this account owns or belongs to", though core.seller.owner_account_id and core.seller_team_member hold the answer
Found by:  Phase 5 C-1, building the shell's store context per T7 S7.3 rule 2 (seller id in the URL)
Effect:    The console's entry screen cannot enumerate stores to choose from. Built: a chooser that takes a pasted store id, with the gap named ON SCREEN (locale key console.chooser.gap cites this entry) rather than hidden -- a wireframe with a hole labeled as a hole. Deep links (/s/:sellerId/...) work fully; discovery does not.
Response:  BUILT AROUND, gap visible in the product surface itself
Action:    None in console code -- the endpoint's shape (owner stores only? team memberships? role per store?) is contract design, not console transcription.
Ruling needed: the listing endpoint. Natural shape: GET /v1/accounts/me/sellers returning { id, handle, display_name, role } per store, both owned and team-membered; needs an ADU-API-01 reissue or amendment.

### D-98 - The auth operations are schema-less in the generated contract

Severity:  MINOR (drift risk, typed locally and marked)
Phase:     T7 - 5
Source:    apps/api auth controller -- the Swagger decorators on otp/request, otp/verify, sessions, and sign-out carry no request/response body schemas, so openapi.json (generated only -- the unbending rule) and schema.d.ts give the console no types for the sign-in flow it must drive
Found by:  Phase 5 C-2, importing the contract types and finding none for auth
Effect:    apps/console/src/api/client.ts types the auth shapes LOCALLY, with a header stating they are to be DELETED in favour of the generated ones when the decorators land -- never reconciled. Until then, a wire-shape change on the API side compiles clean in the console and fails at runtime; the twelve-state screen contract turns that into a visible ERROR state rather than a blank page, which is containment, not immunity.
Response:  TYPED LOCALLY, marked for deletion
Action:    Owed on the API, not the console: ApiBody/ApiResponse decorators transcribing the existing zod schemas -- mechanical, no ruling required, any future phase may carry it.
Ruling needed: none.
### D-99 - The API process loads no .env, so the documented dev recipe cannot work from a clean shell

Severity:  MAJOR (a dev-loop defect with a security-shaped failure mode; nothing validates required configuration)
Phase:     T7 - 4 (defect stands since Tier 0; found while correcting Phase 4's own recipe)
Source:    apps/api/package.json -- "dev": "nest start --watch"; no dotenv, no @nestjs/config anywhere in apps/api or packages/config; main.ts:20 passes process.env['CONSOLE_ORIGIN'] ?? '' into configureApp; configure-app.ts:23-24 app.enableCors({ origin: consoleOrigin, credentials: true }); common/db/database.module.ts resolves process.env['DATABASE_URL'] ?? ''
Found by:  the Phase 4 adversarial pass, checking whether the build recipe this phase wrote into apps/console/CLAUDE.md actually works
Effect:    Every other entry point loads the file explicitly (db:migrate and friends use node --env-file-if-exists=.env); the API alone does not. From a clean shell `pnpm dev:api` therefore boots with an EMPTY DATABASE_URL -- the pool falls back to libpq defaults and every request fails at connect time, including /healthz, which ADU-CON-02 S20.2 requires to be a real round trip -- and an EMPTY CONSOLE_ORIGIN, which is the security-shaped half: cors@2.8.6 treats a falsy origin as '*', so the API answers a credentialed request with Access-Control-Allow-Origin: * (which the browser then refuses), and makeOriginMiddleware('') 403s every cookie-carried write. Nothing raises, nothing warns: the process starts, prints "api listening", and is wrong. The C-2 flow in Phase 5 succeeded ONLY because the environment was sourced into the shell by hand first.
Response:  RECORDED; the recipe now states the requirement instead of hiding it
Action:    apps/console/CLAUDE.md's build recipe names the full sequence and says in as many words that the API reads no .env of its own. No code change: making the API load a file, or fail loudly on absent required configuration, is a startup-contract decision with a production blast radius (in production the environment comes from the platform, and a fail-closed check could refuse a boot that is currently fine).
Ruling needed: which of the two -- load .env in the API's dev entry point (matching every other script), or assert required configuration at boot and refuse to start without it. The second is the one that also closes the wildcard-CORS fail-open, and it needs a decision about which variables are required in which NODE_ENV.

### D-100 - The endpoint count in three documents does not match the contract, and three different things are being counted

Severity:  MINOR (prose vs tree; the contract is machine-checked and authoritative)
Phase:     T7 - 4
Source:    contracts/openapi.json as built -- 110 path keys, 129 operations, every key under /v1; ADU-API-01 v1.7:49 "123 -> 124 catalogue entries"; ADU-CON-02 v3.1:372 "124 contract path keys" and :381 "Endpoints, 124 path keys" and :523 "124 endpoints"; ADU-VAL-01 v1.1:199 "124 endpoints"; TIER-STATUS.md:6 "109" (an explicitly dated T3 snapshot, weak evidence)
Found by:  the Phase 4 adversarial pass, checking the "110 /v1 path keys" claim this phase wrote into apps/console/CLAUDE.md
Effect:    ADU-API-01's 124 is a count of its own CATALOGUE -- the endpoints it specifies -- and is not necessarily wrong: it is consistent with 14 specified endpoints not yet built. What cannot stand is ADU-CON-02 v3.1 restating 124 as the count of what IS built and Complete (twice, once explicitly as "path keys"), and ADU-VAL-01 repeating it. A reader reconciling them concludes either that 14 endpoints vanished or that the contract is short, and neither is established. The three quantities in play -- catalogue entries, path keys, operations -- are counted as if interchangeable, and 110 vs 129 shows they are not.
Response:  RECORDED, not resolved -- resolving it means auditing ADU-API-01's catalogue against the contract endpoint by endpoint, which is a work order, not a drive-by
Action:    apps/console/CLAUDE.md's 110 now carries a pointer here. The contract in the tree remains the authority (it is CI-authored and gate-checked); no document was edited.
Ruling needed: an audit of ADU-API-01 v1.7's catalogue against contracts/openapi.json -- which entries have no path key, and whether the residue is unbuilt scope or a counting artifact -- then one corrected sentence in each of the three documents, stating WHICH quantity it counts.

### D-101 - A person without an account cannot sign in to the console: the age declaration has no control and no ruled copy

Severity:  MAJOR (SC-00's second half is unreachable; the seeded path hides it)
Phase:     T7 - 5
Source:    apps/api/src/modules/auth/auth.service.ts:78-82 -- when no core.account row exists for the phone, verify requires age_declared_over_18 === true or throws VALIDATION_FAILED; auth.schemas.ts:26 makes the field OPTIONAL, so zod does not catch its absence; ADU-AUTH-01 S13 (identity creation at first sign-in)
Found by:  the Phase 5 adversarial pass (three of four lenses independently)
Effect:    The console sends phone, code, audience, device_id, remember_device and nothing else. A NEW seller therefore receives a real SMS, types a correct code, and is told "The request is not valid." -- with no field to correct, because the slots.path naming age_declared_over_18 is never rendered and no such control exists on the screen. Every C-2 verification passed because ops/scripts/seed.mjs inserts core.account, so the demo path never touches the branch. This is the first-run experience of the product's only seller surface.
Response:  RECORDED, not built -- deliberately
Action:    The control is three lines; its LABEL is not. An age declaration is a legal attestation whose wording (and whose Amharic wording) is a decision with consequences outside this repository, and T7 S7.4 has machine-translated placeholders standing in for a translator who has not seen this file. Inventing the sentence a person legally affirms, and then machine-translating it, is exactly the invention the order forbids. The console fails closed instead: the seller sees a validation error rather than a silently-created account.
Ruling needed: the exact English and Amharic text of the age declaration, and whether it is a checkbox on SC-00's phone step or a separate screen before verify. One ruled sentence unblocks the build.

### D-102 - The console's device identity is shared by every browser that loads the bundle, which makes the new-device payout lock inert

Severity:  MAJOR (a security control silently does nothing; D-95 named the dishonesty, not this consequence)
Phase:     T7 - 5
Source:    apps/console/src/api/client.ts -- deviceId is VITE_DEVICE_ID ?? crypto.randomUUID(); a Vite env var is a BUILD-TIME constant, so every browser loading a given bundle sends the same X-Adulis-Device. db/migrations/0022_payout_and_reissue_functions.sql:95-102 locks payout changes while min(core.session.created_at) for (account_id, device_id) is inside new_device_payout_lock
Found by:  the Phase 5 adversarial pass, following D-95 into its consequences
Effect:    Two halves, both bad. WITH VITE_DEVICE_ID set (the dev loop, and any build that sets it), every console user shares one device id, so an attacker who obtains a victim's OTP and signs in from another machine inherits the victim's OLDEST session timestamp for that id and the 24-hour new-device payout lock never fires -- the control reads "known device" for a device it has never seen. WITHOUT it, each load mints a uuid that has no core.device row, and verify returns 400 before sign-in can happen at all (POST /v1/devices accepts only ANDROID | IOS). There is no configuration of the current design in which the console both signs in and preserves the lock.
Response:  RECORDED; no code change, because every available fix invents a rule
Action:    D-95 parks the enum question (no WEB value). This entry parks the SECURITY question underneath it, which is separate: what identifies a browser for the purposes of a payout lock, given that ADU-SEC-01 forbids the console persisting anything. The honest answers all live server-side (a device cookie already exists and is httpOnly), and choosing one is an ADU-AUTH-01 decision.
Ruling needed: whether the new-device payout lock keys on the __Host-adulis_device cookie rather than a client-supplied device id for CONSOLE sessions -- and if so, whether X-Adulis-Device is required at all on that surface. Until then the lock must be assumed non-functional for the console.

### D-103 - The console never calls /v1/bootstrap, so the market context it formats against is hardcoded

Severity:  MINOR (correct for the only market that exists; wrong the day a second one does)
Phase:     T7 - 5
Source:    apps/console/src/lib/intl.ts's own header cites "the market timezone from /v1/bootstrap (ADU-CON-03 S4.4)"; Shell.tsx passes timezone="Africa/Addis_Ababa" as a literal and IdleWarning hardcodes { currency: 'ETB', locale: 'en' }; no console module fetches /v1/bootstrap, though BootstrapResponseDto is in the generated contract and carries market.timezone, market.display_currency, locales and client_status
Found by:  the Phase 5 adversarial pass (two lenses)
Effect:    The console derives client-side a fact the server owns -- the rule S7.3 exists to prevent -- with no contract gap to excuse it, since the endpoint and its types are both built. A second market formats every time and every amount in the first market's timezone and currency. There is a second consequence: UPGRADE_REQUIRED, one of the twelve states, is triggered by client_status, which nothing reads, so that state is unreachable outside the demo screen.
Response:  RECORDED, not built -- C-1's scope is the shell, and a bootstrap fetch belongs with the provider that consumes it
Action:    None yet. The fix is a market-context provider fetching /v1/bootstrap at boot beside the session probe, feeding intl.ts and the UPGRADE_REQUIRED path; that is C-3 work and would be invented scope here.
Ruling needed: none -- this is owed build, not a decision. Listed so the next console phase starts from it rather than rediscovering it.

### D-104 - Identity creation picks "the live market" with an unordered LIMIT 1, and nothing keeps there being only one

Severity:  MAJOR (silent misassignment; found because it broke the test suite, not because anything raised)
Phase:     T7 - 5
Source:    apps/api/src/modules/auth/auth.service.ts:83-84 -- `SELECT id FROM core.market WHERE is_live LIMIT 1`, no ORDER BY; otp.service.ts:90 repeats the same fallback; db/migrations/0002_markets_and_configuration.sql:35 makes is_live a plain boolean with no unique or partial index. Contrast bootstrap.controller.ts:59 and orders.service.ts:71, which both use `ORDER BY is_live DESC, created_at ASC`
Found by:  the Phase 5 adversarial pass predicted it; the Phase 5 dev loop then reproduced it
Effect:    A new account is assigned to whichever live market the planner returns first. With one live market this is invisible. ops/scripts/seed.mjs created a SECOND one, and the consequence was immediate and confusing: the c6 suite's identity-creation tests began writing their accounts into the seed's market, where c6's own market-scoped teardown could not see them, so the NEXT run of c6 got 200 where 400 belongs ("identity creation without the age declaration is refused") and OTP_INVALID where OTP_EXPIRED belongs. Nothing raised; a green suite simply started failing on a database that had been seeded. In production the same lookup decides which market a real seller's account belongs to -- its currency, its timezone, its ladder configuration.
Response:  the reachable trigger is REMOVED; the underlying lookup is NOT changed
Action:    ops/scripts/seed.mjs now writes its market with is_live = false and re-asserts that on every run, so a database seeded by the earlier version corrects itself. That is sound because both live-market lookups are fallbacks used only when a phone has NO account, and the seed creates its account outright. The unordered SELECT itself is untouched: making it deterministic is a change to how every future account is assigned, which is a ruling, not a cleanup.
Ruling needed: whether more than one live market is legal. If NO, a partial unique index (`CREATE UNIQUE INDEX ... ON core.market ((true)) WHERE is_live`) makes the LIMIT 1 honest and turns a silent misassignment into a constraint violation. If YES, both lookups need a deterministic ORDER BY and a documented rule for which live market a new account joins -- and "the first one the planner returns" cannot be it.

### D-105 - NODE_ENV=production is set nowhere, so every guard on it was a no-op

Severity:  MAJOR (a class, not an instance; the [FAKE SMS] leak was one member of it)
Phase:     T8 - 1
Source:    ADU-RUL-03 S1, which names this finding and rules on it. ops/render.yaml does not exist (D-80), so nothing in this repository sets NODE_ENV=production -- and every `NODE_ENV === 'production'` check was therefore a no-op, INCLUDING WORK ORDER T7 S3.2's own rule that each fake adapter must refuse to run in production
Found by:  the CEO, generalising from the [FAKE SMS] defect T7 Phase 5 found
Effect:    Two halves. (1) console.warn bypasses Pino's redaction allow-list entirely, so ADU-CON-02 S20.2's guarantee -- fields are logged because they were named -- held only for code that used the logger, and nothing stopped any module writing a phone number and a live OTP to stdout. The allow-list was a control over one code path described as a control over logging. (2) A guard on an environment nobody sets is not a guard: the rule was true as written and false in effect, and the permissive default it fell through to was "print OTP codes".
Response:  BUILT (T8 Phase 1, 6b082eb)
Action:    A lint rule bans bare console.* in apps/api, proven by planting one. NODE_ENV is asserted at a boundary: common/env.ts reads it once, validates it against a closed set and refuses to start if it is unset or unrecognised, in BOTH entrypoints; call sites consult the memoised value rather than process.env. The fake-adapter refusal T7 S3.2 wrote is provable for the first time. D-106 records the ADU-CON-02 S13 deviation this forced; D-107 records the sweep of every other guard.
Ruling needed: none -- ADU-RUL-03 S1 is the ruling.

WRITTEN LATE, AND OUT OF ORDER, AND THAT IS THE POINT. This entry did not exist
until T8-R. ADU-RUL-03 S1 is titled after it, DOCUMENT_AUTHORITY.md cites it,
T8 Phase 1 was built to discharge it, and the register had no D-105 -- a number
cited in two documents and resolving to nothing, which is D-56's complaint in
its original direction. It is inserted at its numeric position rather than
appended, because a reader who follows the citation looks for the number, not
for the date it was written.

### D-106 - ADU-CON-02 S13's promise that the local SMS adapter prints OTPs to the terminal is no longer implementable

Severity:  MINOR (a deviation from an installed document, taken deliberately and recorded here rather than kept quietly)
Phase:     T8 - 1
Source:    ADU-CON-02 v3.1 S13 -- "the local SMS adapter prints OTPs to the terminal"; ADU-RUL-03 S1.1 -- console.* is banned in apps/api and the logger is the only egress; apps/api/src/common/logging.ts -- the allow-list emits a field BECAUSE it is named, and otpCode/phone/phoneNumber are on NEVER_LOG precisely so they are never named
Found by:  implementing ADU-RUL-03 S1.1: the two instructions cannot both be honoured
Effect:    S13 asks for an OTP on the terminal. The ruling forbids the only mechanism that put it there, and the sanctioned mechanism cannot carry it -- routing the code through pino's `msg` would satisfy the letter of "use the logger" while laundering exactly the value the allow-list exists to exclude, which is worse than the original defect because it would look compliant. There is no way to satisfy both sentences.
Response:  DEVIATED, deliberately, and the deviation is this entry
Action:    The fake SMS adapter appends to a file instead: `apps/api/.dev-sms.log` by default (overridable with DEV_SMS_LOG), gitignored, written only when NODE_ENV is exactly 'development'. The reasoning is that the risk in the original was not "a developer can read the code" but "the code reaches stdout", where every container log aggregator collects it. A file on a development machine is outside that path, and production cannot reach the code at all because production cannot construct the adapter -- a refusal that is now provable rather than merely written (see D-105's boundary). The logger still announces the PATH at construction, which is safe to log and tells a developer where to look. ops/scripts/seed.mjs's printed instructions point at the file.
Ruling needed: whether ADU-CON-02 v3.2 restates S13 as "writes OTPs to a development file" or specifies a different developer channel. Nothing is blocked either way; the dev loop works.

### D-107 - Every NODE_ENV guard in the tree was re-read, and one more was inverted the same way

Severity:  MINOR (all guards now sit behind the asserted boundary; recorded because ADU-RUL-03 S1 asks for the sweep's result)
Phase:     T8 - 1
Source:    ADU-RUL-03 S1 -- "Every existing NODE_ENV guard is now suspect and should be re-read... none has ever been exercised in the branch it guards"
Found by:  the Phase 1 sweep
Effect:    Five runtime guards existed. (1) fake-guard.ts's production refusal -- the T7 S3.2 rule; never exercised, now provable, and it additionally refuses when NODE_ENV is unset instead of silently permitting a fake. (2) sms.adapter.ts's development-only print -- rewritten (D-106). (3) ops/scripts/seed.mjs's production refusal -- an .mjs script outside the API process, so it reads process.env directly and stays that way; the boundary module is TypeScript and importing it into an ops script would couple the two builds. (4) and (5) ops/scripts/gates.mjs drops an inherited NODE_ENV=development and keeps production -- correct as written, and deliberately outside the boundary for the same reason as (3). The API's two ENTRYPOINTS both assert now: main.ts and worker.ts, because "the worker is the same codebase started differently" and it constructs the same adapters.
Response:  FIXED where the guard was in the API process; recorded where it is not
Action:    apps/api consults common/env.ts's memoised value, never process.env['NODE_ENV']. The ops scripts (.mjs) still read process.env because they are separate processes with their own lifecycle and no build step; that is a deliberate boundary, not an oversight.
Ruling needed: none.

### D-108 - core.device_platform gains WEB, and ADU-DB-01 v1.13 owes the value

Severity:  MINOR (documentation debt; the schema change itself is ruled)
Phase:     T8 - 2
Source:    ADU-RUL-03 S2 requires the server to CREATE the core.device row for a browser; core.device.platform is NOT NULL over an enum that held only ANDROID and IOS, so the ruling cannot be implemented without a third value. T8 Phase 2 S1 confirms it in as many words: "Add WEB."
Found by:  routing ADU-RUL-03 S2 before building it -- a row cannot exist without a value for a NOT NULL column
Effect:    Declaring a browser ANDROID to satisfy the constraint would put a false statement in a column the new-device payout lock's neighbourhood reads (S7.2). The same reasoning gave verification.verifier_kind its OPERATOR_ATTESTED value rather than reusing KYC_VENDOR: an audit-adjacent column that says something other than what happened is worse than one that says less. This also closes the D-95 question, which asked exactly this and was parked because no ruling had answered it.
Response:  BUILT (0040, alone in its file -- a new enum value cannot be USED in the transaction that adds it)
Action:    db/checks/fixtures/appendix-a.json carries WEB (66 types, 234 values), so check 16 and the migration-01 catalogue test both hold the new shape. The type's COMMENT states the two mechanisms and why there are two.
Ruling needed: none -- ADU-DB-01 v1.13 owes the enum value in Appendix A, per ADU-RUL-03 S6's list.

### D-109 - The console cannot satisfy ADU-CON-02 S13's dev-loop promise without a device it no longer has

Severity:  MINOR (dev-loop documentation; nothing in the product depends on it)
Phase:     T8 - 2
Source:    ops/scripts/seed.mjs seeded a core.device row and printed VITE_DEVICE_ID so a developer could sign the seeded seller into the console; ADU-RUL-03 S2 removes VITE_DEVICE_ID and mints the row at /v1/bootstrap
Found by:  implementing Phase 2 -- the seeded device had no consumer left
Effect:    None adverse: the dev loop is simpler, not harder. The seed no longer writes a device at all, which also retires the ANDROID label D-95 named as a knowing lie. A developer now starts the console and the first load is issued its own identity, so there is no device configuration step to get wrong.
Response:  REMOVED, and recorded because a runbook reader may look for the step
Action:    seed.mjs's header and printed instructions say the device comes from bootstrap; .env.example no longer carries VITE_DEVICE_ID and says why.
Ruling needed: none.

### D-110 - The idempotency key is still minted client-side, and T8 Phase 2's grep says it should not be

Severity:  QUESTION (a gate's wording against a documented rule; the code follows the rule)
Phase:     T8 - 2
Source:    T8 Phase 2 S6 -- "grep for VITE_DEVICE_ID and for crypto.randomUUID in apps/console/src returns nothing"; ADU-CON-02 v3.1 S7 and WORK ORDER T7 S7.3 rule 7 -- idempotency keys are minted WHEN THE CONTROL MOUNTS, by the client
Found by:  running the gate
Effect:    VITE_DEVICE_ID is gone (the one remaining hit is a comment recording that it used to exist). crypto.randomUUID has exactly one call left, in lib/idempotency.ts, and removing it would break a different rule: only the client knows when two taps are one intent, so only the client can mint the key that says so. The two mintings are different in kind -- an identity is a claim the server trusts about WHO this is, and a browser may not choose one for itself; an idempotency key is an opaque per-intent nonce the server never interprets. The gate's grep does not distinguish them.
Response:  KEPT, with the reasoning at the call site
Action:    The gate is met in intent and not in letter, and this entry is the letter. If the grep is meant literally, the console cannot mint idempotency keys and something else must -- which is a contract change, not a console change.
Ruling needed: confirm the grep targets device IDENTITY minting only, or rule where idempotency keys come from if not the client.

### D-111 - The device cookie is presented before any session exists, so only one of the two CSRF controls covers it

Severity:  QUESTION (not exploitable today; the doctrine no longer describes the request)
Phase:     T8 - 2
Source:    apps/api/src/common/http/origin.middleware.ts fires only when the request carries __Host-adulis_session, and its own header states the doctrine: "Two INDEPENDENT controls ... Neither is trusted alone." ADU-RUL-03 S2 introduces __Host-adulis_browser, which is presented on the sign-in request -- before any session exists
Found by:  the Phase 2 adversarial pass
Effect:    The exact Origin check is skipped for a request that carries a device identity, so that identity rides on SameSite=Strict alone. Strict does withhold the cookie cross-site, so there is no live exploit; what is gone is the second, independent control the file says it never relies on singly. The value at stake is not a credential -- stealing it authenticates nobody -- but it is what the new-device payout lock reads, so a forged one is a suppressed new-device signal rather than an account takeover.
Response:  RECORDED, not changed
Action:    None. Extending the middleware to fire on the device cookie would make every anonymous GET /v1/bootstrap Origin-checked, and bootstrap is the one call a client makes before it knows anything -- refusing it on a missing Origin would break the first request of every client to enforce a control against a value that is not a credential. That trade is a ruling, not a cleanup.
Ruling needed: whether the Origin check should extend to requests carrying only the device cookie, and if so what an absent Origin means on the anonymous bootstrap path.

### D-112 - Nothing seeds core.timing_config, so a freshly migrated database cannot complete a sign-in

Severity:  MINOR (development and first-deploy ergonomics; found while fixing a branch of Phase 2)
Phase:     T8 - 2
Source:    core.timing_config is written only by ops/scripts/seed.mjs and ops/load/db-loads.mjs; no migration inserts a row. The OTP paths resolve their configuration through it, and bootstrap derives the device cookie's Max-Age from media_retention
Found by:  the Phase 2 adversarial pass, checking the no-configuration branch
Effect:    On a database that has been migrated but not seeded there is no configuration in force, so the device cookie gets no Max-Age (it is now still SET, as a session cookie -- the earlier version omitted it entirely, which made console sign-in permanently impossible), and any OTP path whose phone has no account reaches a configuration lookup with no row. The values themselves are ADU-VAL-01's to rule, so a migration cannot simply invent them.
Response:  the cookie branch is FIXED; the configuration gap is RECORDED
Action:    bootstrap always sets the cookie now, with a session lifetime where no retention is configured, which fails toward deletion without disabling the flow. Nothing else changed: seeding real configuration is D-61's territory and inventing intervals in a migration is what ADU-VAL-01 exists to prevent.
Ruling needed: none for this phase -- but a deployment runbook step that asserts timing_config is in force before a market is opened would turn a confusing 500 into a refusal at the right moment.

### D-113 - POST /v1/devices is anonymous and unlimited, so the flood the mint limit stops is available one endpoint along

Severity:  MAJOR (an unauthenticated write with no budget; pre-existing, surfaced by fixing its neighbour)
Phase:     T8 - 2
Source:    apps/api/src/modules/auth/auth.controller.ts -- @Public() @Post('devices') inserts core.device on a CLIENT-CHOSEN id with no rate limit; measured at ~280 rows/second from one connection
Found by:  the skeptic pass on Phase 2's fixes, checking whether the new bootstrap-device-mint limit closed the class or only one instance
Effect:    Phase 2 rate-limited the bootstrap mint path because it was an unauthenticated unbounded write. The device registration endpoint is the same write with the same properties and no limit, so the rate limit closed one door of two. Each row survives until media_retention of inactivity expires it.
Response:  RECORDED, not fixed in this phase
Action:    None here. The endpoint is the MOBILE surface's device registration and belongs to that client's contract; adding a budget to it changes what a native app may do at install time, which is an ADU-AUTH-01 question rather than a console one. Phase 2's own door is closed and this entry is the other one.
Ruling needed: what budget POST /v1/devices carries, and per what subject -- IP is the only anonymous subject available and it is the wrong one behind a carrier NAT.

### D-114 - No trust-proxy setting, so every IP-keyed rate limit becomes a global one behind a proxy

Severity:  MAJOR (silently converts per-caller budgets into per-deployment ones)
Phase:     T8 - 2
Source:    grep for 'trust proxy' across apps/api returns nothing; req.ip is used as the rate-limit subject at bootstrap.controller.ts (bootstrap-device-mint) and, since before this phase, at auth.controller.ts (otp-request-ip, 10/hour)
Found by:  the skeptic pass on Phase 2's fixes
Effect:    Behind a CDN or a platform load balancer, Express reports the PROXY's address for every request unless trust proxy is configured. Every IP-keyed bucket then has one subject for the whole deployment: the 10/hour OTP limit becomes ten OTP requests per hour for all of Ethiopia, and the 600/hour mint limit becomes six hundred new browsers per hour in total. The failure is silent and looks like a working rate limiter.
Response:  RECORDED, not fixed
Action:    None in this phase. Setting trust proxy is a deployment-shaped decision -- it must name how many proxies are in front, because trusting one too many lets a client forge X-Forwarded-For and choose its own bucket, which is worse than the current state. D-80 is the neighbouring gap: no ops/render.yaml exists, so the deployment this depends on is not described anywhere.
Ruling needed: the deployment topology, then `app.set('trust proxy', <n>)` with n named rather than `true`.

### D-115 - A device row is nameable by any MOBILE client, and only WEB rows are now protected

Severity:  QUESTION (pre-existing; Phase 2 narrowed it rather than closing it)
Phase:     T8 - 2
Source:    apps/api/src/modules/auth/auth.service.ts -- a MOBILE verify names its device in the body, and the bind is `WHERE account_id IS NULL`, so a second account signing in on a device already bound to a first is refused the bind and given a session anyway
Found by:  the skeptic pass, testing whether the audience-scoped guard should apply to every audience
Effect:    Phase 2 makes a WEB row unnameable by any client under any audience, because those rows are server-minted. A MOBILE row is still client-chosen and client-named, so one client can claim another's device id and take a session anchored to it -- which pins that row against the retention purge. Refusing it outright was considered and rejected: two people sharing one phone is an ordinary case in this market, and S11.1's "binds at identity creation, never rebinds" reads as a first-identity record rather than an exclusive lock. Refusing would have broken the shared phone to close a gap that predates this phase.
Response:  NARROWED and recorded
Action:    None further. The WEB half is closed because those identities are the server's; the MOBILE half needs a rule about what a device row means when two accounts use one handset.
Ruling needed: whether a MOBILE device id is an exclusive claim (refuse a second account) or a first-identity record (today's behaviour), and if the latter, what stops a client naming a device it has never held.

### D-116 - The cart still chooses a market, so "exactly one place" is not yet true

Severity:  MINOR (deterministic, unlike D-104's; but it is a second place making the assumption)
Phase:     T8 - 3
Source:    ADU-RUL-03 S3 -- "there is exactly one place a market is chosen, and it is /v1/bootstrap ... D-20's warning stops being a warning, because there is no longer a second place making the assumption"; apps/api/src/modules/orders/orders.service.ts resolves a cart's market as coalesce(the account's market, the first market by is_live DESC, created_at ASC)
Found by:  the Phase 3 sweep, checking the ruling's own claim after removing the two auth lookups
Effect:    The ruling's headline is true of the AUTH path, which is what D-104 named, and not true of the tree. Cart creation still picks a market for an anonymous device, and it does so with a deterministic ORDER BY rather than D-104's unordered LIMIT 1 -- so it is the safer half of the same shape: it will not vary between calls, but the day a second market goes live it will quietly put every anonymous cart in the older one.
Response:  RECORDED, not changed
Action:    None. The one-line change is available and obvious -- the function already holds the device id, so it could read d.market_id exactly as identity creation now does -- but a cart for a device that has never bootstrapped would then be refused, and that is a change to the buyer flow rather than to the auth path this phase was given. Doing it silently inside a phase scoped to D-104 is how scope stops meaning anything.
Ruling needed: whether cart creation reads the device's market too (and refuses a device with none), or whether an anonymous cart is allowed a default market. If the former, the ruling's "exactly one place" becomes true; if the latter, S3's sentence should say "exactly one place a PERSON's market is chosen".

### D-117 - A global-count assertion in the jobs suite made an unrelated phase's tests fail

Severity:  MINOR (test fragility; the third instance of a rule this repository already wrote down)
Phase:     T8 - 3
Source:    apps/api/test/e2-e6.jobs.spec.ts -- "subscription.collect_reminder sends once and stamps the record" asserted the job's REPOSITORY-WIDE `sent` counter equals 1; D-83's rule is that no test may assert over a global sweep
Found by:  adding the Phase 3 suite, whose two live markets shifted parallel scheduling
Effect:    The assertion holds only while no other suite has an outstanding collection at that instant, so it fails on scheduling changes that have nothing to do with billing. The job's own SQL is correctly market-scoped -- the fragility is entirely in the test.
Response:  FIXED
Action:    The test now asserts what it is about: this record is stamped once, and this seller's phone receives one message. Both are scoped to its own fixtures, so no other suite can move them.
Ruling needed: none.

### D-118 - The order "register, then bootstrap" is required and written nowhere

Severity:  MINOR (a client that gets it wrong is locked out until it calls bootstrap again, with no message saying so)
Phase:     T8 - 3
Source:    /v1/bootstrap's app branch is `UPDATE core.device SET market_id = ... WHERE id = <header> AND market_id IS NULL`, a silent no-op when the row does not exist yet; POST /v1/devices inserts with no market; ADU-API-01 S3.1/S3.2 states no ordering between them
Found by:  the Phase 3 adversarial pass
Effect:    An app that calls bootstrap BEFORE registering gets a device row with a NULL market, and since Phase 3 that means every anonymous OTP path refuses it -- with slots.path 'bootstrap', naming a call the client has already made. Calling it a second time fixes it, and nothing tells the client that. The same trap catches a returning app whose unbound row was purged by retention and which re-registers before its next bootstrap. The reasoning in bootstrap's own comment ("the anonymous first call... failing it because a header was absent would break a client's first request") was sound while a device's market was cosmetic; it gates sign-in now.
Response:  RECORDED, not changed
Action:    None in this phase. Making bootstrap create the row would be minting a device for an app client, which is the console's mechanism and not the app's (ADU-RUL-03 S2 keeps them separate on purpose); making register resolve a market would put a second market choice back in the tree, which is what D-104 removed. The fix is a contract sentence, not code.
Ruling needed: state the order in ADU-API-01 S3 -- register, then bootstrap -- or rule that bootstrap may create an app device row on first sight of an unknown X-Adulis-Device.

### D-119 - The console cannot ask whether a phone is new, so the age declaration is shown to everyone

Severity:  MINOR (a product consequence of a security rule, recorded because it looks like a bug and is not)
Phase:     T8 - 4
Source:    ADU-RUL-03 S4 requires the declaration at FIRST sign-in; ADU-AUTH-01 S22 forbids any response that distinguishes a registered number from an unregistered one
Found by:  building the control
Effect:    The obvious design shows the declaration only to people creating an account. The console cannot know who they are without asking the server whether a phone is already registered -- which is precisely the enumeration oracle S22 forbids, and which T8 Phase 3 spent a commit closing after I opened it. So the box is shown to everyone on the code step: an existing seller leaves it alone and signs in, a new one cannot proceed without it. The server enforces the rule and the console never learns which case it is in.
Response:  BUILT this way deliberately
Action:    The checkbox is never pre-checked, is sent only when ticked, and the refusal is rendered from the server's own slots.path rather than guessed at. CORRECTED after the Phase 4 pass: the first version was unqualified and wrong in one case -- 'Change number' reset the step and the code but left BOTH the tick and the refusal standing, so the next number's code step arrived pre-checked, which is the one thing the ruling names. Both are reset there now, and the refusal is cleared per attempt rather than on success, because a standing refusal rendered underneath the NEXT error made an expired code read as 'You cannot create an account at this time.' A future design could move the declaration to a dedicated first-run screen, but only if something other than the phone tells the client it is a first run.
Ruling needed: none. Recorded so the next reader does not "fix" it into an oracle.

### D-120 - The rendered age control was not observed in a browser

Severity:  MINOR (verification gap, stated rather than papered over)
Phase:     T8 - 4
Source:    ADU-RUL-03 S5.1 -- "a report claim asserting verification names the command, file or artifact that produced it ... or it is not claimed"
Found by:  attempting the verification
Effect:    The declaration sits on the CODE step of sign-in, which a headless page load cannot reach: getting there needs a phone typed, a submit clicked and an OTP round trip, and this run has a browser that can load a URL and dump a DOM but no driver that can interact. What IS verified: both sentences appear verbatim in the shipped bundle (grep of apps/console/dist), the control's only initial state in source is false, the value is sent only when true, and the API refuses identity creation without it and records age_declared_at (t8-market-from-device.e2e.spec.ts). What is NOT verified: that the box renders unchecked on screen and that the refusal text appears where a person will look.
Response:  RECORDED as an unverified claim rather than asserted
Action:    Gate 20's boot smoke test (T8 Phase 5) brings a real driver into CI. The first interaction test belongs there, and this control is the obvious first customer.
Ruling needed: none.

### D-121 - The rule about what may not be machine-translated lived in the file machine translation edits

Severity:  MAJOR (the gate this phase exists to add could be disabled by deleting one comment)
Phase:     T8 - 4
Source:    the first version of ops/scripts/verify-mt-keys.mjs derived the HUMAN-REQUIRED class entirely from `// HUMAN-REQUIRED` markers in packages/locale/src/am.ts -- the file the translation pass rewrites
Found by:  the Phase 4 adversarial pass, which defeated the gate in one line
Effect:    Deleting the marker and supplying an Amharic string passed green, and the gate printed a SMALLER count as though a shrinking class were unremarkable. Both attacks I had proved -- a deleted manifest line, a swapped Amharic value -- left the marker in place, which is the case the staleness and equality checks already covered. The attack that removes the marker is the one a translation pass would actually perform, and it was silent. A rule about what may not be machine-translated cannot be enforced by data the machine translation edits.
Response:  FIXED
Action:    The membership is pinned in the gate script, with the ruling that put each key in the class. Marked-but-unlisted and listed-but-unmarked are both red now, so the class can only change where a person states why. Proven: marker removed + Amharic value + manifest regenerated now fails twice over.
Ruling needed: none. When terms acceptance, the seller agreement or the payout authorisation join the class, they are added to that list with their ruling.

### D-122 - A gate that repairs what it checks turns red into green on a re-run

Severity:  MINOR (fixed; recorded because it is a shape worth recognising)
Phase:     T8 - 4
Source:    the first verify-mt-keys.mjs read MT-KEYS.md, ran the generator (which OVERWRITES it), then compared the two -- so the first run failed and the second passed with the fix unstaged
Found by:  the Phase 4 adversarial pass
Effect:    The commit claimed the gate worked "like the contract gate". It did not: that one diffs against the COMMIT (`git diff --exit-code HEAD`) and is idempotent. This one diffed against a file it had just rewritten, so a developer who ran it twice saw it pass and could commit the stale manifest anyway -- the failure surviving only in the first run's scrollback. On a PASS the rewrite is byte-identical, so the tree stayed clean and no clean-tree check broke; it is only red runs that mutated anything.
Response:  FIXED
Action:    The gate restores the file it read before failing. Red stays red across runs, and the fix has to be made deliberately.
Ruling needed: none.
### D-123 - No adversarial review was ever committed, and the register cites their findings

Severity:  MAJOR (the evidence for a large part of this register does not exist in the tree)
Phase:     T8-R
Source:    `git log --diff-filter=A -- docs/build-status` lists ten files and no review; `git log --diff-filter=A` repo-wide matches no path containing "review" but the skills pack, the reviews module, migration 0014 and SECURITY-REVIEW.md; docs/build-status/reviews/ did not exist
Found by:  WORK ORDER T8-R, which asked the question
Effect:    Every adversarial pass this project has run -- the primary review control since T7 S0, and the thing that found the console bundle that never booted, the enumeration oracle, the gate defeated by deleting a comment -- lived in a session and vanished with it. The register cites their findings by number; the evidence for each, the measured tables and response codes and byte offsets, existed nowhere a reader could reach. This is D-56 from the other side: D-56 is a citation pointing at no entry, this was an entry pointing at no evidence. It also means nobody can audit a review's REASONING, only its outcome -- and two of those reviews were wrong in ways a later pass caught, which is exactly the case where reasoning matters.
Response:  FIXED forward, and back-filled as far as the tree allows
Action:    docs/build-status/reviews/ is the convention (T8-R S3): a review lands as a committed artifact, written before the fixes it prompts, naming the ref it ran against, and every register entry it produces cites it by path. Four T7 reviews were recovered VERBATIM from run artifacts that happened to survive on disk (Phase 1's six reviewers, Phase 3, Phase 4, Phase 5's four skeptic verdicts). Six more are stubs recording what was found, which commit applied it and which entries it produced, each stating plainly that the text is lost. No stub reconstructs a reviewer's reasoning: a fabricated review is worse than a missing one, because the next reader cannot tell.
Ruling needed: none. The convention is stated in docs/build-status/reviews/README.md and holds from T8 Phase 5 onward.

### D-124 - main's full local test run is intermittently red, and the fix is on an unmerged branch

Severity:  MINOR (test infrastructure; CI is unaffected, which is why it went unnoticed)
Phase:     T8-R
Source:    the OTP rate limiter's IP-keyed buckets (otp-request-ip, 10/hour) are shared by every suite, because every suite comes from the same address; jest runs suites in parallel
Found by:  T8-R, running the full suite on main while auditing the records
Effect:    On main at 9fad3d7 a full `npx jest` run failed two tests -- one in each T8 suite, both OTP-dependent -- while each suite passed in isolation. Purging the two OTP buckets and re-running gave 455/455. So the failure is contention DURING a run rather than leftover state, and it is intermittent: whichever suite happens to spend the tenth request in the hour sees a 429 about nothing. CI has not shown it, because CI starts from an empty database with different scheduling, which is exactly how a local-only flake survives.
Response:  RECORDED here; already FIXED on the T8 Phase 4 branch
Action:    Phase 4 (PR #28, unmerged at the time of writing) adds a per-test purge of those two buckets to both T8 suites, with the reasoning that nothing asserts them -- the 429s that ARE asserted belong to the probe endpoint, the per-challenge attempt counter and the courier-invite bucket. Merging #28 removes the flake from main. Nothing is done here, because T8-R is a records order and this is a code change.
Ruling needed: none for the flake. The underlying shape is D-114's: an IP is the wrong subject when every caller shares one, and that is true of the tests for the same reason it is true behind a carrier NAT.

### D-125 - ADU-RUL-04 and ADU-RUL-05 are cited as governing and were never supplied

Severity:  MINOR (documentation debt; the work order restates every rule it cites, so nothing is blocked)
Phase:     T8-C
Source:    WORK ORDER T8-C cites ADU-RUL-05 S1.1 (comparator pins), S2 (gate lists are append-only), S3 (db:reset) and ADU-RUL-04 S3 (a suite deletes what it created, by id). Neither document is in docs/, and `git grep` finds neither name anywhere in the tree
Found by:  routing T8-C before building it
Effect:    Four rules are cited by section number against documents a reader cannot open. This is D-84 exactly -- ADU-RUL-02 was named as installable and its text never arrived -- and the same resolution applies: the work order states each rule in full, so the rule is followed and the CITATION is the thing that dangles. Every comment written under them in this order therefore reads "ADU-RUL-05 via T8-C S1.1" rather than pretending to quote a document I have never seen.
Response:  PARKED, and the citation form records the gap
Action:    None buildable. The rules themselves are implemented: the comparator pin (S1.1), the append-only gate list (S2, and gate 21 appended rather than swapped), db:reset (S3), and the teardown fix (ADU-RUL-04 S3).
Ruling needed: supply ADU-RUL-04 and ADU-RUL-05, or confirm the via-T8-C citation form stands permanently. ADU-RUL-03 arrived as a file and is GOVERNED; these two are cited as though they had.

### D-126 - verify:deferred-values asserted that two forms agree, not what they agree about

Severity:  MAJOR (a gate that goes green while the thing it guards empties)
Phase:     T8-C
Source:    ops/scripts/verify-deferred-values.mjs compared S1.1's table against db/checks/fixtures/deferred-values.json in both directions and asserted only that the row count was non-zero
Found by:  T8-C S1, attacking it deliberately rather than reading it
Effect:    MEASURED, not supposed. Deleting core.ladder_config.established_min_handoffs from BOTH ADU-VAL-01 S1.1 and the fixture produced: "PASS S1.1 parsed: 15 rows", "PASS fixture and S1.1 agree on all 15 rows, both directions", "PASS three forms agree", exit 0. A deferred value can leave the register and the fixture together and the gate calls it agreement -- which is D-121's class arriving at a second gate: a rule whose membership lives in something a person edits directly.
Response:  FIXED
Action:    EXPECTED_ROWS = 16 is pinned in the gate, with what fixes the number (S1.1's fourteen ladder_config columns, follower_threshold, and the embedding whose deferral is the vector dimension). Both forms are checked against it. Proven by replanting the exact attack: it now fails twice and exits 1. The same attack was run against verify:permission-doc and it went RED on TWELVE checks -- four counts, all six per-role totals, `twelve permissions are mobile-reachable` and `OWNER holds all 42`. That gate pins 42 permissions, 139 grants, six per-role totals and the eight step-up codes by name, so it was never exposed. (This entry first said EIGHT. The number was wrong and the gate prints the right one in its own summary line: `FAIL  12 check(s) failed.` It was caught by an adversarial pass that re-planted the attack instead of reading the claim, and corrected in place before this entry reached main -- an entry badged MEASURED is worth exactly its numbers.) Checks 14 and 16 are not exposed either, and the reason is the general rule, now recorded in gates.mjs: their expected side is the live database, and nothing leaves it without a migration.
Ruling needed: none. When ADU-VAL-01 v1.2 changes the count, it moves the pin in the same commit.

### D-127 - A ruling minted a register number, and the register had to break append-only to honour it

Severity:  MINOR (recorded so the exception does not read as the rule bending quietly)
Phase:     T8-C
Source:    ADU-RUL-03 S1's heading names D-105; DOCUMENT_AUTHORITY.md cites it; the register skipped from D-104 to D-106 until T8-R wrote the entry
Found by:  the CEO, correcting himself in T8-C S4
Effect:    A ruling document minted a number in the register's space, so the citation existed before anything it could point at. The register then had two bad options: append D-105 after D-124, where a reader following the citation would not find it, or insert it at its numeric position and stop being strictly append-only. T8-R chose the insertion, because a reader looks for the number rather than the date -- and that choice cost the file its strongest property.
Response:  RECORDED, and the rule it produced is the fix
Action:    The ruling: rulings NAME findings; the register ASSIGNS numbers. A ruling document that mints a D- number creates a citation with nothing behind it. Nothing in the tree changes -- D-105 stays where it was inserted, and this entry is the note saying the exception was taken deliberately and once.
Ruling needed: none. The rule is stated in T8-C S4.

### D-128 - A suite created 179 markets and deleted none, until a console sign-in could not complete locally

Severity:  MAJOR (development environment; it makes every finding made against that environment suspect)
Phase:     T8-C
Source:    apps/api/test/migration-06-07-catalogue-and-stock.spec.ts, the concurrent-decrement race test. It creates market, account, seller, product and variant on a raw pool connection deliberately -- two connections have to contend for the same row -- and `afterAll` did `await pool.end()` and nothing else
Found by:  the CEO, observing that a console sign-in would not complete locally; T8-C S2 traced it to its source
Effect:    MEASURED, before the reset: 180 markets, 180 accounts, 180 sellers, 458 devices, and exactly ONE `timing_config` row in force -- the seeded one. 179 of those markets are named 'Race' and were created one per full test run. `/v1/bootstrap` assigns a market by `(is_live DESC, created_at ASC)`, so a fresh browser could be assigned any leftover, and the OTP request that follows fails on the missing timing row. That is D-112's defect at the scale the leak gave it: a market without a `timing_config` is unusable, and the leak manufactured 179 of them. The environment had degraded until the product did not run in it.
Response:  FIXED at the source, and the environment rebuilt
Action:    `afterAll` now deletes what the test created, by id, in dependency order (stock_event, variant, product, seller, account, market) under `SET session_replication_role = replica`. The replica setting is required rather than convenient: `core.stock_event` is append-only and its trigger raises on DELETE for every role, so the append-only guarantee and the teardown cannot both hold on the same connection unless triggers are off for it. Proven by running the suite twice: 25/25 both times, and the count of 'Race' markets stayed at 179 instead of reaching 181. Then `pnpm db:reset` (new, `ops/scripts/db-reset.mjs`) rebuilt the database from migrations plus seed: after, `markets 1, accounts 1, sellers 1, devices 0, timing_config in force 1`. A console sign-in was then driven in headless Edge against it -- bootstrap, otp/request, the code read from `apps/api/.dev-sms.log`, otp/verify, `GET /v1/auth/sessions` -- and returned `sessions=200 current=true remembered=true`, leaving one WEB device and one live session.
           MEASURED AFTER THE FIX, on the reset database: a full `pnpm --filter @adulis/api test` run passed 459/459 and left `markets 1, accounts 1, sellers 1, products 0` -- the same counts the seed produces. It also left THREE unclaimed `core.device` rows (IOS, ANDROID, ANDROID, all `account_id NULL`), created by the bootstrap suites and not deleted. That is the same defect at a size that does not break anything: a device with no account is never assigned to a sign-in and carries no `timing_config` dependency, so it accumulates without degrading the environment. It is recorded rather than fixed because fixing it belongs to whichever order touches those suites, and inventing a teardown for a suite this PR does not otherwise change would put an untested edit in a records-heavy branch.
Ruling needed: none. The rule is ADU-RUL-04 S3 via T8-C: a suite deletes what it created, by id.

### D-129 - D-124 and D-114 are one defect at two scales, and both are how local and CI diverge in STATE

Severity:  MAJOR (inherits D-114's; recorded as a class so the two are not fixed as though they were unrelated)
Phase:     T8-C
Source:    D-114 (no `trust proxy`, so `req.ip` is the proxy's address for every request) and D-124 (jest suites share one address, so they share the `otp-request-ip` bucket)
Found by:  T8-C S2, asked to state the connection
Effect:    They are the same defect. An IP is the rate limiter's subject, and an IP stops identifying a caller whenever callers share one. In the test run they share one because every suite runs on this machine. In production they share one because every request arrives through the CDN, or because a whole city is behind one carrier NAT -- the commonest network shape in the market this is built for. The 429 a suite sees about nothing is the production defect running at a scale small enough to observe, which is the only reason it was observed at all.
           The second thing the pair shows is how the two environments come apart. **Local and CI diverge in STATE, not in configuration.** Same code, same migrations, same `.env` shape; what differs is that CI builds its database from empty on every run and this machine has been accumulating since Tier 1. That direction of drift hides defects in both directions: D-124 was red locally and green in CI, because CI's scheduling never spends the tenth request in an hour; D-128 was red locally and green in CI, because CI never has 179 leftover markets to assign. Neither would have been caught by comparing configuration files, and a green CI is not evidence about the environment findings are actually made in.
Response:  RECORDED as the class. The instances stay where they live
Action:    D-124 is fixed by the per-test bucket purge merged in #28. D-128 is fixed at its source in this PR. D-114 stays PARKED, and correctly: setting `trust proxy` needs the deployment topology named, because trusting one hop too many lets a client forge `X-Forwarded-For` and choose its own bucket -- worse than the current state, not better. `pnpm db:reset` is what makes the state divergence testable: it is now possible to ask whether a local failure survives a fresh database, and that question was previously unanswerable.
Ruling needed: D-114's, unchanged -- the deployment topology, then `app.set('trust proxy', <n>)` with n named rather than `true`. The class adds one to it: when the subject collapses anyway, what identifies a caller for the OTP budget? The phone is already the subject of the per-challenge counter; whether it should also be the subject of the hourly one is a decision about enumeration cost, not a code change to make quietly.

### D-130 - ADU-CON-02 v3.1 S13 does not describe db:reset, and the command now exists

Severity:  MINOR (documentation debt; the command is documented in the repo, so nothing is blocked)
Phase:     T8-C
Source:    ADU-CON-02_Seller_Console_System_Design_v3_1.md S13 is the setup script the README says it follows; `pnpm db:reset` was added in T8-C S2 and appears in neither
Found by:  T8-C S2, writing the command down
Effect:    Small, and the same shape as every entry of this kind: the governed document describes a setup that is no longer the whole setup, so a reader following S13 alone recovers nothing when their environment drifts (D-128). The document is governed and is not edited here.
Response:  RECORDED; documented in the repo instead
Action:    README S"Day-one setup" now carries `pnpm db:reset` -- what it drops, that it takes the runtime-role password from `.env` rather than inventing one, that it refuses `NODE_ENV=production` and a non-local host, and when to reach for it. The section states plainly which parts still diverge from S13 rather than implying agreement. The same section was stale in two other ways and is now accurate: it described `db:check` as empty and `db:seed` as a stub that cannot sign a seller in, both true at Tier 0 and false since Tier 1.
Ruling needed: ADU-CON-02 v3.2 S13 adds `db:reset`, or rules that the repo README is where operational commands live and S13 stops being the source.

### D-131 - `pnpm test` never loaded .env, so the README's own day-one script could not work on a fresh clone

Severity:  MINOR (developer experience; CI and `pnpm ci:local` were both unaffected, which is why it survived eight tiers)
Phase:     T8-C
Source:    apps/api/package.json ran `"test": "jest"`, and apps/api/jest.config.js has no `setupFiles`, no `globalSetup` and nothing that reads a `.env`
Found by:  T8-C S2, running the suite from a shell that had not exported the environment
Effect:    MEASURED: `pnpm --filter @adulis/api test` from a clean shell failed 420 of 459 tests with `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` -- pg being handed `undefined` for a password. Two things hid it. CI sets `DATABASE_URL` and friends in the workflow `env:` block, so it never reads a file. And `pnpm ci:local` runs `node --env-file-if-exists=.env ops/scripts/gates.mjs`, so every gate the script spawns INHERITS an environment the script loaded -- including the test gate. The only way to meet the defect is to run the command the README tells a new developer to run, which is a thing no one on this project had done since Tier 0.
Response:  FIXED
Action:    `"test": "node --env-file-if-exists=../../.env node_modules/jest/bin/jest.js"`. `--env-file-if-exists` rather than `--env-file` for the reason install-worker-schema.mjs already gives in its own comment: CI has no `.env` and its absence must not be an error, or the command fails on every machine that supplies its environment properly. Proven by running the full suite from a shell with nothing exported: 459/459. This is the same pattern as `pnpm gates` and `ops/scripts/*.mjs`, so the repository now loads its environment one way rather than two.
Ruling needed: none.

### D-132 - db:reset printed PASS unconditionally, and two documents said it checked

Severity:  MAJOR (a green that does not depend on the thing it names -- the class T8-C S1 was raised to attack)
Phase:     T8-C
Source:    ops/scripts/db-reset.mjs printed `PASS  the database is what ... gives` immediately after printing the row counts. Nothing between the counts and the print read the counts
Found by:  the T8-C S2 adversarial pass (docs/build-status/reviews/T8-C-S2-db-reset-and-the-test-leak.md, F1), run against 719f448
Effect:    The seed could produce zero markets, or no `timing_config` row, and the script would print PASS and exit 0. That matters here more than it would elsewhere: a market without a timing row is precisely D-128's symptom -- bootstrap succeeds, the OTP request fails, and a console sign-in cannot complete. The reset existed to recover from that state and would have certified it. Worse than the missing check: README and the S2 commit message BOTH claimed "fails if the result is not what a fresh clone gives", so the repository documented a verification that did not exist. This is S1's finding one section later by a different door, written by the same hand that had just fixed S1's.
Response:  FIXED
Action:    The counts are compared against `EXPECTED = { markets: 1, accounts: 1, sellers: 1, devices: 0, timing: 1 }` -- pinned on S1's rule, with db/seeds named as what fixes them and the requirement that a seed change moves the pin in the same commit. A mismatch prints each wrong count with expected and got, and exits 1. PROVEN by planting: changing the seed's `WHERE NOT EXISTS ...` to `WHERE false AND NOT EXISTS ...` -- so the seed still runs cleanly and simply writes no timing row -- gave `FAIL ... timing: expected 1, got 0`, exit 1. The first plant attempt is worth recording too: a deliberate SQL syntax error made `pnpm db:seed` throw, the script died at the seed step with exit 1, and that exit code proved nothing about the assertion. A plant has to leave the checked thing REACHABLE.
Ruling needed: none.

### D-133 - The destructive script refused only the literal 'production', inside the order that banned that pattern

Severity:  MAJOR (D-105's defect, in a script that drops every schema)
Phase:     T8-C
Source:    ops/scripts/db-reset.mjs guarded `if (process.env.NODE_ENV === 'production')` and nothing else
Found by:  the T8-C S2 adversarial pass (F2), run against 719f448
Effect:    An unset `NODE_ENV` proceeded. So did `staging`, `prod`, and any typo. ADU-RUL-03 S1 -- the ruling this entire work order implements -- says a service that cannot determine its environment must not pick the permissive default, and D-105 made the API refuse to boot without one. A script written inside that order, whose only job is destruction, took the permissive default. The host allow-list is a second guard and in practice the stronger one, which is the argument for fixing this rather than against: the guard whose absence is survivable is the one that gets copied into the next script.
Response:  FIXED
Action:    Inverted to an allow-list: `RESETTABLE = ['development', 'test']`, and anything else -- including unset -- exits 2 naming what it saw. PROVEN both ways: `NODE_ENV=staging` gives "NODE_ENV is 'staging'; this script runs only under development or test"; running with `NODE_ENV` unset and `DATABASE_URL_MIGRATE` supplied by hand gives "NODE_ENV is unset". The same pass produced three smaller fixes, recorded in the review rather than here: `before:` and `after:` printed different units under paired labels (F3); a `DATABASE_URL_JOBS` set without a password silently received the app role's (F4); and the header called the host check "the only thing between it and a database somebody cares about", which oversells a guard a port-forward defeats (F5).
Ruling needed: none.

### D-134 - The teardown deleted the seller and left behind the row a trigger had made for it

Severity:  BLOCKER (referential corruption in the development database, introduced by the fix for D-128)
Phase:     T8-C
Source:    apps/api/test/migration-06-07-catalogue-and-stock.spec.ts, the `afterAll` added in this PR. `core.seller_public_stats.seller_id` is `uuid PRIMARY KEY REFERENCES core.seller(id)` with no ON DELETE (0010:155-156), and `trg_create_public_stats` (0010:191) writes one row per seller AFTER INSERT
Found by:  the T8-C S2 adversarial pass, second round -- docs/build-status/reviews/T8-C-S2-db-reset-and-the-test-leak.md, run against 719f448 and 99c49a6
Effect:    MEASURED, not supposed. `session_replication_role = replica` suppresses the foreign key's referential-integrity triggers along with the append-only one, so `DELETE FROM core.seller` succeeded and left the stats row pointing at a seller that no longer exists. A query across all 98 single-column foreign keys into core.seller/account/market/product/product_variant found exactly one such row. The first teardown therefore did not close D-128's leak so much as change its shape: from a whole tree of live rows to one orphan per run, in a table read on every storefront page load. It is worse than what it replaced in one respect -- a leaked market is visible as a market, and an orphaned stats row is visible only to a query nobody runs.
Response:  FIXED
Action:    `DELETE FROM core.seller_public_stats WHERE seller_id = $1` before the seller, with the reasoning in the code: deleting what you created means what your INSERT CAUSED, not only what your INSERT named. Proven by measurement: the pre-existing orphan was removed, the suite ran 25/25, and the orphan count stayed at 0 -- where before the fix it grew by one per run. The two comments four lines apart that still said the test "cannot delete the stock events it made" and that "the fixture is small and left behind deliberately" are corrected in the same commit; they were the justification a later reader would have used to remove the `replica` line.
Ruling needed: none.

### D-135 - Suites delete their market under replica, orphaning devices other suites minted

Severity:  MAJOR (pre-existing; the same class as D-134 and not introduced by it)
Phase:     T8-C
Source:    roughly twenty suites take the same teardown shape -- `SET session_replication_role = replica`, delete, `SET ... DEFAULT` -- and ten of them end with `DELETE FROM core.market WHERE id = ...` (c1..c8, e1, e2-e6). `core.device.market_id` references `core.market(id)`
Found by:  T8-C S2, checking every foreign key for orphans after fixing D-134
Effect:    MEASURED: 6 orphaned `core.device` rows before a full suite run and **9 after** -- three per run, growing. These are the same three unclaimed device rows D-128 recorded as harmless residue, which is the correction this entry makes to that one: they are not merely unclaimed, they point at markets that no longer exist. The mechanism is D-134's exactly -- replica mode suppresses the FK triggers as well as the append-only one, so a market delete that would have been refused succeeds and leaves the reference dangling. Which suite orphans which device is NOT established here: it would need a run instrumented per suite, and attributing it without that would be a guess in a register entry.
Response:  RECORDED, not fixed
Action:    None in this PR, deliberately. The fix is a teardown change in ten suites this PR does not otherwise touch, and an untested edit to ten files does not belong in a branch whose subject is a leak in one. What this PR does contribute is the method: after any teardown that runs under `replica`, check every foreign key into the tables it deleted from, because the setting that lets the delete succeed is the same setting that stops the database telling you it should not have.
Ruling needed: none. It is buildable work: either each suite deletes its dependents by id, or the shared teardown becomes a helper that does it once and correctly.

### D-136 - Gates were cited by position, so the list could not be reordered and the records disagree about a number

Severity:  MINOR (records and maintainability; no runtime effect)
Phase:     T8-C
Source:    `gate 16 of the one list` (docs/amendments/README.md), `gates 17 and 18` (apps/console/CLAUDE.md, ADU-RUL-03 S5.2), `gate 18` (apps/console/vite.config.ts), `gate 17` (ops/scripts/gates.mjs), `Gate 20's boot smoke test` (D-120)
Found by:  T8-C S3, adding a gate to a list that had already been forced to grow only at the end
Effect:    A position is not a name. `mt-keys` had to be APPENDED in T8 Phase 4 rather than placed beside the console gates it belongs with, because inserting it would have renumbered five live citations -- one of them inside ADU-RUL-03, a governed document this repository does not edit. So the list became append-only to protect numbers that should never have been written down, and the ordering of gates is now decided by citation debt rather than by subject. The records also drifted while nobody was watching: T8-REPORT.md and D-120 both call the boot smoke test "gate 20", which was true when they were written and stopped being true when `mt-keys` took that position. The smoke gate is **21**.
Response:  FIXED for every citation this repository owns; the governed documents keep the debt
Action:    Five citations converted to gate ids: `deferred-values`, `no-unsafe-eval`, `production-react` (three sites) and `boot-smoke`. The rule is recorded above `const GATES` in ops/scripts/gates.mjs -- cite a gate by its id, never by its position -- and `pnpm gates --list` prints the ids. NOT edited: ADU-RUL-03 S5.2 (governed, and its "Gates 17 and 18" is still true because `mt-keys` and `boot-smoke` were both appended); DEFECT-REGISTER entries and docs/build-status reports (records of what was true when written, and this entry is the correction rather than a rewrite); docs/superseded and _superseded. ADU-DB-01's "gate 0 / gate 4" is a different subject entirely -- permission checks inside a function -- and is untouched.
Ruling needed: ADU-RUL-03 S5.2 gains the gate ids at its next reissue, at which point the list stops being append-only for citation reasons and can be ordered by subject.

### D-137 - The new gate reintroduced D-93: a backend-only PR would have gone red on an absent console dist

Severity:  MAJOR (a false red in CI, on PRs with nothing wrong with them)
Phase:     T8-C
Source:    ops/scripts/gates.mjs registered `boot-smoke` as a plain `cmd` entry shelling at ops/scripts/verify-boot-smoke.mjs, whose first statement is `if (!existsSync(DIST/index.html)) process.exit(1)`
Found by:  the T8-C S3 adversarial pass, second round -- two independent reviewers, then verified by re-reading the runner
Effect:    CI runs `pnpm gates` with `ADULIS_SCOPE_FILTER`. On a PR whose diff selects nothing the console depends on -- db/ops/api/docs only, the exact shape of PR #22 -- the `build` gate correctly does not select @adulis/console, and apps/console/dist is gitignored, so no dist exists. `no-unsafe-eval` and `production-react` handle this: both route through `consoleDistAbsent()`, which under a scope filter passes WITH A NOTE. The third console gate did not, so it would have failed the run outright. That is D-93 verbatim -- "a red that teaches people the gate lies, which is the exact failure class the one-list convergence exists to prevent" -- reintroduced by the branch that added the gate, and reintroduced BECAUSE the new gate was a different shape from the two it sits beside.
Response:  FIXED
Action:    `boot-smoke` is now an `fn` gate, `assertConsoleBoots`, which calls `consoleDistAbsent(dist/index.html)` first and only then shells at the script -- the same shape as the two gates above it. PROVEN by simulating a backend-only PR: `apps/console/dist` moved away, `ADULIS_SCOPE_FILTER='@adulis/api...' pnpm gates` gave `PASS  console not selected by the scope filter (...index.html absent)` at gate 21 and `PASS  all 21 gates`, exit 0. Unscoped, an absent dist is still a hard fail, because an unscoped build always produces one.
Ruling needed: none. The general lesson is in gates.mjs: a new gate over the console build inherits the scope contract of the ones beside it, or it is not the same kind of gate.

### D-138 - boot-smoke does not exercise connect-src, and its header said the wrong reason why

Severity:  MINOR (a limitation stated wrongly; the gate's load-time assertions are unaffected)
Phase:     T8-C
Source:    ops/scripts/verify-boot-smoke.mjs's header claimed zero CSP violations "because the sign-in page makes no API call until a person acts", and the S3 review repeated it
Found by:  the T8-C S3 adversarial pass, second round
Effect:    The console makes two API calls on mount: apps/console/src/auth/session.tsx:80-95 awaits `/bootstrap` then `/auth/sessions`, and its own comment reads "FIRST CALL, ALWAYS". No person has acted. The real reason nothing is blocked is that CI builds without `VITE_API_BASE_URL`, so `apiBase()` throws inside `resolveApiBaseUrl` BEFORE `fetch` is reached and the app turns it into an ApiError('CONFIG'). So `connect-src` -- the one directive in this policy constraining what the console does at RUNTIME rather than at load -- is never exercised, and the claim that this is "the only place in CI where the policy and the bundle meet" holds only for load-time directives. A gate that quietly benefits from a misconfiguration it does not name is this repository's recurring shape.
Response:  the CLAIM is FIXED; the GAP is recorded, not closed
Action:    The header and the review now state what is and is not exercised. Closing the gap needs a decision rather than a patch: exercising `connect-src` means building the console with a base URL and either standing an API up inside the gate or pointing it at an origin the policy forbids and asserting the violation fires. The second is cheap and tests the policy rather than the app, and it also means the gate would assert on a bundle nobody ships.
Ruling needed: whether `boot-smoke` should build a second, throwaway bundle with `VITE_API_BASE_URL` set to a forbidden origin purely to prove `connect-src` blocks it -- or whether that belongs to the console harness owed at C-3.

### D-139 - The report named an instrument that could not have produced the finding it credited

Severity:  MINOR (records; the finding and its fix are unaffected)
Phase:     T8-C
Source:    docs/build-status/T8-REPORT.md, the WORK ORDER T8-C REPORT block, S2 paragraph -- "Three defects in it were found by **running** it: ... and an unconditional `PASS` ... (D-132)"
Found by:  the T8-C S6 adversarial pass, second round -- raised twice independently
Effect:    D-132 is precisely the defect that running `db:reset` cannot expose. There was no branch between the counts and the print, so every run -- correct or not -- printed PASS and exited 0. The S2 commit says "two defects ... both found by running it rather than by reading it" and lists the other two; the review records D-132's verdict as "CONFIRMED by reading, and by construction"; the register entry says "Found by: the T8-C S2 adversarial pass". Three artifacts agree, and the report contradicted all three -- in a block whose second line is "Every claim below names what produced it (ADU-RUL-03 S5.1)". A reader following the named instrument would run the script, see PASS, and conclude the entry was wrong.
Response:  FIXED
Action:    The paragraph now says two were found by running and one by reading, and states why the distinction is the rule the block opens with. The lesson is narrower than "check your facts": ADU-RUL-03 S5.1 asks a claim to name its instrument, and naming ONE instrument for a group of findings is how a wrong one gets attached to the member that does not share it. Three findings, three instruments, or the sentence splits.
Ruling needed: none.

### D-140 - MISSING_SOURCE: the four documents WORK ORDER T9 Phase 2 installs did not arrive

Severity:  BLOCKER for T9 Phase 2, and for two of Phase 3's three gate changes
Phase:     T9 - 2
Source:    WORK ORDER T9 S2 names `ADU-DB-01_..._v1_13_ASCII.md`, `ADU-REPO-01_..._v1_3.md`, `ADU-CON-02_..._v3_2_ASCII.md` and `ADU-VAL-01_..._v1_2.md`
Found by:  T9 Phase 2, looking for them before installing them
Effect:    None of the four is on this machine. `find` across the working tree, `docs/`, `docs/registers/`, `_staging/` (which holds one file, `Adulis_Claude_Skills_Pack_v1.1.zip`) and the parent directory returns nothing for any of the four names, and nothing was attached to the order. The installed baseline is unchanged: ADU-DB-01 **v1.12**, ADU-CON-02 **v3.1**, ADU-VAL-01 **v1.1**, and ADU-REPO-01 **absent entirely**.
           This blocks Phase 3.1 and 3.2, and not for want of trying. **3.1** moves `verify:deferred-values` from 16 to 14 because ADU-VAL-01 v1.2 removes two rows -- but that gate compares three forms, and one of them IS the document's S1.1 table. Moving the pin to 14 while the installed v1.1 still lists 16 makes the gate red on a correct tree, which is the failure class this repository has spent two work orders removing. **3.2** adds a comparator over ADU-DB-01 v1.13's generated Appendix A and B; v1.12's appendices are not generated from the fixtures and are not what the gate is specified against.
           What is NOT blocked was built instead, and is in the Phase 3 PR: the D-92 ruling (3.1's other half, stated in full in the order), the destructive-script NODE_ENV rule (3.3, likewise), and the `appendix-a.json` `_provenance` defect (3.2's sub-item, which is about a fixture that IS here).
Response:  PARKED. Do not invent a governed document
Action:    None buildable. The four are the CEO's to supply; every rule T9 states in its own text has been followed, because the order restates each one -- which is D-84's and D-125's pattern for the third time: a rule arrives in a work order, is followed, and the DOCUMENT it belongs to does not arrive.
           One number worth recording while this is open, because it is larger than "a citation dangles": ADU-REPO-01 is cited **77 times across 33 files** -- `.dependency-cruiser.cjs`, `.github/CODEOWNERS`, `.github/workflows/ci.yml`, the root and per-app `CLAUDE.md`, `apps/api/src/generate-openapi.ts`, and the title of gate `deps` ("Dependency rules (ADU-REPO-01 S4)"). A CI gate names a section of a document nobody in this repository can open. D-94 recorded the absence; this records its size.
Ruling needed: supply the four files, or rule which of Phase 3's changes proceed against the order's own restatement of the rules rather than against the documents.

### D-141 - The eligibility register's own defect: D-92 is ruled, and NULL there means no bar

Severity:  MAJOR (a market configured for the beta posture refused every seller)
Phase:     T9 - 3
Source:    D-92, PARKED since T7 Phase 3 with two governing sentences that could not both hold. WORK ORDER T9 S3.1 rules it: PRD S4.1 governs, `follower_threshold` NULL is a DECIDED value -- "this market sets no bar" -- and the consumer fails OPEN
Found by:  the CEO, ruling D-92 in T9 S3.1
Effect:    `core.fn_evaluate_eligibility`'s audience arm read `v_audience := coalesce(v_best >= v_cfg.follower_threshold, false)`. `v_best >= NULL` is NULL, coalesced to false, so a market with `audience_required = true` and no threshold refused EVERY seller for FOLLOWER_THRESHOLD_NOT_MET -- the exact opposite of what an absent bar means, and the reason the beta posture was reachable only through `audience_required = false`.
           This also removes the row from ADU-VAL-01's machine-read table, which is why T9 moves the `deferred-values` pin from 16 to 14: a NULL that is DECIDED is not a deferral, and the register was carrying it as one. That half is blocked on ADU-VAL-01 v1.2 (D-140).
Response:  BUILT
Action:    Migration `0041_d92_follower_threshold_fails_open.sql`. The body was EXTRACTED with `pg_get_functiondef` and patched -- one statement replaced, everything else byte-for-byte as the database holds it; 0005 is merged and is not edited. THE TWO NULLS ARE KEPT APART, which is the part a one-line fix gets wrong: a NULL threshold is an absent RULE and now passes; a NULL `v_best` is absent EVIDENCE and still fails closed. The old single `coalesce` collapsed both into "no".
           `apps/api/test/t9-d92-follower-threshold.spec.ts` pins both arms, and was PROVEN RED before being trusted: reverting the live function to the pre-0041 body gives `Expected "SATISFIED", Received "NOT_SATISFIED"` on the no-bar arm, while the absent-evidence arm passes under BOTH definitions -- which is what shows the fix did not simply open the gate.
Ruling needed: none. D-92 is closed by T9 S3.1.

### D-142 - An exemption made a class, and nothing re-checked what fell into it later

Severity:  MAJOR (two destructive scripts, one of them running DROP DATABASE, took the permissive default)
Phase:     T9 - 3
Source:    D-107 exempted ops scripts from the NODE_ENV boundary assertion, having enumerated five guards and found them sound. WORK ORDER T9 S3.3 rules the exemption covers scripts that READ and not scripts that DESTROY
Found by:  T9 S3.3, grepping for `DROP|TRUNCATE|DELETE FROM` across ops/ and db/
Effect:    **The generalisable half, and it is the point of this entry: an exemption creates a class where the rule does not apply, and nobody re-checks what falls into that class later.** D-107's five scripts were all read-only when it was written. `ops/scripts/db-reset.mjs` did not exist yet (D-133), and neither did anyone re-examine `ops/scripts/db-determinism.mjs`, which has always run `DROP DATABASE IF EXISTS` on two databases, or `ops/load/db-loads.mjs`, which DELETEs from eight core tables. Both proceeded on an unset NODE_ENV.
Response:  FIXED
Action:    Both now validate NODE_ENV against `['development', 'test']` and exit 2 on anything else, including unset -- DUPLICATED rather than imported, per the ruling: reaching into apps/api's env module would recreate the coupling D-107 avoided, and five lines are cheaper than that. In `db-determinism.mjs` the guard is lifted ABOVE the DATABASE_URL check, because the environment is the first thing a destructive script must be sure of. `db/checks/check-10` matched the grep and is a FALSE POSITIVE: its "TRUNCATE" is a privilege name in a SQL VALUES list.
           THE CALLER NOW DECLARES. CI deliberately leaves NODE_ENV unset (an inherited `development` ships a development console bundle), so the `determinism` gate would have refused. `gates.mjs` gained per-gate `env` and that gate declares `NODE_ENV: 'test'` -- both rules were right, and what was missing was anyone SAYING which environment a CI gate run is. Proven: unset and `production` both refused with exit 2; the gate green with NODE_ENV unset in the parent process.
Ruling needed: none.

### D-143 - The Phase D load harness has not been runnable since product.slug landed

Severity:  MINOR (a measurement harness, not a shipped path; nothing depends on it)
Phase:     T9 - 3
Source:    `ops/load/db-loads.mjs`, found while adding D-142's guard to it
Effect:    Running it fails on `null value in column "slug" of relation "product" violates not-null constraint`. The script inserts synthetic products without a slug, and `core.product.slug` became NOT NULL at T6 (G1.9). So ADU-CON-02-A1 S6's three DB-level loads -- the expiry sweep against 1M orders, the stats-trigger path at 100 scans/s, the 08:00 dispatch at 10k notifications -- have not been measurable since, and nothing noticed because no gate runs this file. It is the same shape as D-121 and D-126 one level out: a thing nothing executes drifts from the schema it reads.
Response:  RECORDED, not fixed
Action:    None here. The guard was added (D-142) and the breakage found by running the guarded script; fixing the harness is a separate change with its own verification, and this PR's subject is the gates. Worth knowing before the next capacity question is asked: the answer currently cannot be produced.
Ruling needed: none. Buildable whenever the capacity numbers are wanted.

### D-144 - C-3's thirty-two keys carry English in am.ts, and are not machine translations

Severity:  MINOR (recorded so the manifest stays true; AM_ENABLED is off either way)
Phase:     T9 - 4
Source:    packages/locale/src/am.ts, the C-3 block; packages/locale/MT-KEYS.md
Found by:  T9 Phase 4, attempting to write the Amharic
Effect:    The first attempt at these strings produced CORRUPTED Amharic -- truncated unicode escapes mid-word, which the tooling refused to parse and which would have shipped mojibake to sellers if it had parsed. That is the honest finding: this agent cannot produce Amharic it can verify, and unverifiable text in a seller's own language is worse than text they can plainly see is untranslated. The keys therefore carry the ENGLISH.
           They are NOT marked HUMAN-REQUIRED. That class is a legal one (ADU-RUL-03 S4 -- a person cannot attest, in a language they read, to a sentence nobody has checked) and these are ordinary strings awaiting the translation pass. The marker would have put thirty-two ordinary keys into a gate meant for two.
Response:  RECORDED, and the manifest corrected so it does not lie
Action:    MT-KEYS.md's own sentence used to read "Every key below carries a MACHINE-TRANSLATION placeholder in am.ts", which these thirty-two would have made false. The generator now says the list is everything AWAITING THE HUMAN PASS -- most a machine placeholder, C-3's the untranslated English -- and that neither is a translation. 182 machine-translated + 2 HUMAN-REQUIRED; `pnpm verify:mt-keys` green.
Ruling needed: none. The translation pass replaces both kinds and deletes them from the list.

### D-145 - The market-context provider exists, and D-103's literals were still in the tree

Severity:  MAJOR (the defect the change claimed to fix, surviving the change)
Phase:     T9 - 4
Source:    apps/console/src/layout/Shell.tsx passed `timezone="Africa/Addis_Ababa"`; apps/console/src/auth/IdleWarning.tsx paired it with a hardcoded `currency: 'ETB'`
Found by:  the T9 Phase 4 adversarial pass, F2 -- grepping for the literals the new provider was supposed to remove
Effect:    D-103 says the console never calls /v1/bootstrap, so the market timezone and currency are literals. Phase 4 built `lib/market.tsx`, which calls it and keeps the answer -- and then NOTHING CONSUMED IT. The one sentence in this console that prints a TIME (the idle warning: "You will be signed out at {time}") was still formatted against a hardcoded zone. A provider nothing reads is not a fix; it is the same defect with a new file beside it.
Response:  FIXED
Action:    `IdleWarning` now takes the `MarketContext` the server sent and renders NOTHING while it is null, rather than falling back to a default. A sign-out time in the wrong zone is worse than no sign-out time, because a seller acts on it. `Shell` passes `useMarketContext()`. The literals are gone from the tree.
Ruling needed: none.

### D-146 - Four of the six resolving links on SC-01 navigated the seller back to where they started

Severity:  MAJOR (the primary control on the stage's primary screen)
Phase:     T9 - 4
Source:    apps/console/src/features/entry/Home.tsx's ACTION_ROUTE named `eligibility`, `profile`, `payouts`, `fulfilment` and `products`; only `products` was a route
Found by:  the T9 Phase 4 adversarial pass, F1
Effect:    The router's catch-all is `<Navigate to=".." relative="path" replace />`, so "Complete this" on four of the six outstanding items navigated straight back to Home. Worse than a dead link or a 404: a control that appears to work, does nothing visible, and teaches the seller that the readiness list is decorative. The code's own comment claimed "the link is never dead and never lies about being ready", which is what makes this a defect rather than an omission.
Response:  FIXED
Action:    The four screens ADU-CON-03 S6's table names are now routes, as placeholders: SC-22 (eligibility and identity), SC-17 (company details and store profile), SC-24 (payout), SC-18 (fulfilment). Verified by loading each in a browser and reading which screen answered. An action code with no route still renders -- as its own code, unlinked -- because a readiness row the seller cannot see is a block they cannot clear.
Ruling needed: none.

### D-147 - UPGRADE_REQUIRED is now reachable in the client and unreachable in production

Severity:  MINOR (a state that cannot fire; the client half is correct and inert)
Phase:     T9 - 4
Source:    apps/api/src/modules/bootstrap/bootstrap.controller.ts returns `client_status: 'OK'` as a LITERAL, beside `MIN_SUPPORTED_CLIENT = '0.0.0'`. No comparison is performed
Found by:  the T9 Phase 4 adversarial pass, F3 -- trying to prove the new gate fires
Effect:    C-3 added `UpgradeGate` above the router so the state can honour S3's "reload prompt, no other content". The claim that this makes UPGRADE_REQUIRED reachable is FALSE: the only thing that can produce the value is a field the server never varies. D-20 already recorded the floor as a value-arrives-later ("floored at 0.0.0 so every client passes until a floor is ruled"); what was not recorded is that a whole UI state depends on it.
Response:  the CLAIM is corrected; the client half is PROVEN; the server gap is RECORDED
Action:    Proven by planting `client_status: 'UPGRADE_REQUIRED'` in the controller, rebuilding and loading the console: `data-state="UPGRADE_REQUIRED"`, zero readiness rows, no sign-in form, reload control present -- "no other content" holds. The plant was reverted and `git diff` on that file is empty. Nothing in the API changes here: choosing a floor is a product decision, not a patch.
Ruling needed: the `min_supported_client` floor, and whether the server compares `X-Adulis-Client` against it. Until then this gate is correct and cannot fire.

### D-148 - SC-01's second life is not built, and the reason is a forbidden control

Severity:  MINOR (stage scope, stated rather than stubbed quietly)
Phase:     T9 - 4
Source:    ADU-CON-03 v1.1 S6, SC-01 "Life 2 -- daily brief"
Found by:  T9 Phase 4, scoping the stage against C-3's done-clause
Effect:    C-3's done-clause is the readiness hub, and that is built and verified. The daily brief needs `GET /v1/seller/orders?status=needs_action`, `/v1/seller/analytics/overview` and `/v1/notifications` -- all of which exist -- but every row also needs SC-03's clock rules, and those are C-4's. The countdown means a different thing in each order state, and at PAYMENT_CONFIRMED there must be NO countdown at all: ADU-CON-03 S16 lists "a countdown on a confirmed order" among the forbidden controls. Building the brief as a list of numbers before those rules exist is precisely how that control ships.
Response:  NOT BUILT, and the screen says so in one line rather than rendering a plausible fake
Action:    None. It belongs with C-4, beside the clock treatments its rows depend on. R23 is already transcribed in the code that will carry it: rolling 7 days against the preceding 7, fixed, no picker -- the picker belongs on SC-12.
Ruling needed: none.

### D-152 - The harness's own regression test passed against the regression it was written for

Severity:  MAJOR (a test that cannot fail is worse than no test, because it is trusted)
Phase:     T10 - 4
Source:    apps/console/e2e/readiness.spec.ts, first version -- it asserted that Home's readiness list was ABSENT after following a resolving link
Found by:  T10 Phase 4, planting D-146's exact regression (deleting the `payouts` route) to prove the new harness fires
Effect:    MEASURED. With the route removed the router's catch-all -- `<Navigate to=".." relative="path" replace />` -- sends the seller straight back to Home, which is D-146 precisely. The suite reported **8 passed.**
           The assertion was true at the moment it ran and false a moment later: `page.goto(href)` resolves before the catch-all's `<Navigate>` has run, so `[data-item]` really is absent right then. **A redirect is a thing that happens slightly later**, and a test that checks the destination's contents rather than the destination itself races it.
           This is the harness's whole justification arriving on its first day. The reason C-3 needed one is that T9's three defects were not found by reading; the reason a harness needs PROVING is that a test written from the same understanding as the code inherits the same blind spot. **The plant is not a formality.**
Response:  FIXED
Action:    The assertion is now `expect(page).toHaveURL(...)` -- where the browser ENDED UP, which is stable under a redirect because Playwright retries it -- with the readiness-list check kept as a second, weaker statement. Proven both ways: with the `payouts` route deleted the suite reports `1 failed, 7 passed` and the message names the item and the href; with it restored, `8 passed`.
Ruling needed: none. The general form is worth carrying: **an assertion about a page's contents cannot catch a navigation defect, because contents are what the wrong page also lacks for an instant.** Assert the URL.
