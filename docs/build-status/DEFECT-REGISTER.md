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
