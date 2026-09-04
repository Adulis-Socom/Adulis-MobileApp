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

### D-149 - ADU-CON-02 v3.2 announced the stale-number correction and did not perform it, in six places

Severity:  MAJOR (one of the six is the expected value a deploy is conditioned on)
Phase:     T10 - 2
Source:    docs/ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md, installed at T10 -- S13's setup block, S14.4's checklist, S16's pipeline line, **S18.2's mandatory provider verification**, S20.1's restore drill, S1's diagram, S14.3's AGENTS.md line, S21 and the closing summary
Found by:  T10 Phase 2, checking the four documents against the build on install rather than after
Effect:    MEASURED. `pnpm db:check` prints **16 PASS**; the live schema holds **114** tables; `pnpm gates --list` prints **22** (21 before this order added `appendix`). The document says:
           - `db:check` = **15** in FIVE places -- S13's bash block (`# must print 15 passes`), S14.4 (`pnpm db:check` (15) passes), S16 (`Appendix C, all 15`), **S18.2** (`pnpm db:check` = 15 passes) and S20.1 (`db:check` (15)).
           - **107** tables in TWO places -- S1's topology diagram and S14.3's AGENTS.md line ("table count 107").
           - **sixteen** CI gates in TWO places -- S21's branch-protection note and the closing summary.
           S13 contradicts itself across two lines: the bash block says 15 and the "Definition of a working setup" directly beneath it says **sixteen**.
           And v3.2's own change table, entry 1, is self-contradicting: *"S14.2 and S18.2 said `db:check` prints **sixteen** passes and check 14 = 114. The code is at **sixteen** checks and **114** tables."* It names the stale value and the correct value as the same value, so as written it describes no defect at all -- while the stale values (15 and 107) are still in the body it claims to have corrected.
           **S18.2 is the one that matters.** It is the four-step provider verification a hosting commitment is conditioned on, and v3.2's own S0.2 calls a stale expected value there "the sharpest": *"a check whose expected value is stale is a check that passes when it should fail."* A provider that produced 15 passes today would fail the gate and be disqualified; one that produced 16 would fail the document.
Response:  RECORDED. The document is GOVERNED and is not edited here
Action:    None in the tree. This is the fifth instance of the class the document names about itself ("This document has now been the source of the same defect it warns about, four times") and the same class ADU-DB-01 v1.13 S0.1 opens with -- an announced correction that was not performed. The difference is that DB v1.13 fixed the class by GENERATING its appendices; CON-02 v3.2 fixed three numbers in a change table and left nine occurrences in the body, so the mechanism it needed is the one its neighbour adopted.
Ruling needed: reissue ADU-CON-02 v3.3 with the body's numbers corrected -- or, better and in v1.13's shape, stop printing counts a check already owns. `db:check`, the table count and the gate count are all producible by command; a document that prints them is a fourth copy of three facts that have each drifted at least twice.

### D-150 - Appendix B names a per-table fixture that does not exist

Severity:  MINOR (the count agrees; the enumeration it points at is absent)
Phase:     T10 - 2
Source:    ADU-DB-01 v1.13 Appendix B: *"The full per-table list lives in `db/checks/fixtures/` and is compared against this section by `verify:appendix`."* That directory holds `appendix-a.json` and `deferred-values.json`, and nothing else
Found by:  T10 Phase 2, building `verify:appendix` against the sources each appendix names
Effect:    Appendix B's substance is correct and was verified on install: **114 tables**, and every per-schema count matches `pg_class` with partitions excluded -- core 88, verification 2, financial 3, chat 3, nlu 6, billing 7, ledger 2, analytics 2, waitlist 1. The five body-over-manifest tables it flags all exist. What is missing is the artifact the sentence points at, so the appendix names a comparison that has no second side.
           Appendix A has no such gap: `appendix-a.json` exists, and the document and the fixture agree on all **66** enum types in both directions.
Response:  RECORDED, and the gate reads the database instead
Action:    WORK ORDER T10 S2 rules this case before it arose -- "the fixture wins and the difference is a register entry". So `verify:appendix` compares Appendix B against `pg_class`, **which is what Appendix B itself says generated it**, and the missing enumeration is recorded rather than invented. Writing a fixture to satisfy the sentence would be manufacturing the evidence the sentence claims, which is the same act in the other direction.
Ruling needed: either generate the per-table fixture in the same pass that generates the appendix, or reword Appendix B to name `pg_class` as the comparison's second side. The gate is correct under either.

### D-151 - The orphan sweep found an eleventh instance on its first run, in the teardown written by the hand that had just read D-134

Severity:  MAJOR (referential corruption in the development database; one row per run)
Phase:     T10 - 3
Source:    apps/api/test/t9-d92-follower-threshold.spec.ts, written at T9 Phase 3. `trg_enter_ladder` (migration 0008) fires AFTER INSERT ON `core.seller_eligibility_evaluation` and writes one `core.seller_level_state` row; the teardown deleted the evaluation and the stats row and not that one
Found by:  `pnpm verify:orphan-sweep` -- gate 22, on its first run against the live development database
Effect:    MEASURED, and the measurement is the point. The gate swept all 31 foreign keys into `core.seller` and reported exactly one orphan: `core.seller_level_state(seller_id) -> core.seller(id)`. Clearing it and running that one suite reproduced it immediately -- one orphaned row per run since T9.
           **The teardown that missed it was written by someone who had just read D-134 and was thinking about exactly this class.** Its comment says so in as many words: "both are rows this suite CAUSED rather than named, and D-134 is what happens when a teardown forgets that difference." It named two trigger-made rows and missed a third, because the third's cause is TWO steps out -- the seller INSERT fires `trg_create_public_stats`, and the evaluation that `fn_evaluate_eligibility` then writes fires `trg_enter_ladder`. Nobody looking at `core.seller` sees it.
           That is WORK ORDER T10 S3's thesis demonstrated on the day it was written: **fixing a class in N places does nothing about the N+1th, because nothing carries the reasoning to a change nobody had written yet.** Ten suites were fixed at T7; D-128's fix was the eleventh; this is the twelfth, and it was made by the fix for the eleventh.
Response:  the GATE is built and the instance is FIXED
Action:    `ops/scripts/verify-orphan-sweep.mjs`, appended as gate 22 and cited by name. It enumerates every foreign key into the swept parents from `pg_constraint` at run time -- never a list, because a list is the same defect one level up: right the day it is written and silent about the thirty-second key. Composite keys are handled, because `core.seller` carries two composite anchors and a single-column sweep would skip exactly the constraints S9-S12 rest on. It sits AFTER `test` in the gate list deliberately: replica mode leaves violations the database will never mention, so the only way to know is to ask afterwards.
           PROVEN RED by planting the exact shape -- a seller created, then deleted under `session_replication_role = replica`, leaving the row `trg_create_public_stats` had made: `FAIL 1 orphaned row(s): core.seller_public_stats(seller_id) -> core.seller(id)`, exit 1. The plant was removed and the sweep returns zero, including after a full 461-test run.
           The instance is fixed at source: the teardown now deletes the level-state row, with the two-steps-out reasoning written where the next person will read it.
Ruling needed: none for this instance. **The scope question is open and stated in the gate's own header:** T10 S3 scopes the sweep to `core.seller`, and the identical failure sits one parent over -- ten suites end with `DELETE FROM core.market` under replica while `core.device.market_id` references it, measured at 6 orphans before a full run and 9 after (D-135). Adding `'market'` to the gate's PARENTS array is the whole change.

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
### D-153 - SC-03 and SC-04 specify a buyer name the data model has no column for

Severity:  MAJOR (a specified region of the most important screen in the console cannot be built)
Phase:     T10 - 5
Source:    ADU-CON-03 v1.1 S7 -- SC-03 "Each row carries, in this priority: buyer's first name ..."; SC-04 region 2 "Buyer -- name, contact affordance routing to SC-21"
Found by:  T10 Phase 5, building C-4 against the schema rather than against the wireframe
Effect:    THERE IS NO NAME ANYWHERE. `core.person` holds `id`, `id_hash`, `id_hash_key_version`, `created_at` -- a keyed hash and nothing else, and migration 3 says why in its own words: a date of birth "would be data collected for no purpose, and data minimisation is a live obligation rather than a preference." `core.account` holds a phone number. `core.buyer_profile` is "the account-scoped anchor the model requires and nothing else" -- its own comment.
           So the row cannot name the buyer, and S7 forbids the obvious substitute in the same breath as asking for the name: **"Never a raw phone number where a conversation exists."**
           This is a document-against-document conflict, not an omission in the build. The content architecture assumes an attribute the data model deliberately does not carry, and the data model is the one that gives its reasoning.
Response:  STATED ON SCREEN, per the D-97 precedent. SC-03 says it once above the list (not per row -- a row is not the place to explain a data-model absence); SC-04's buyer region says it and offers the conversation, which is the affordance S7 actually routes to. Both carry `data-gap="D-153"` and an e2e test asserts they are still there, because a screen that hides a known gap reads as finished.
Action:    None taken beyond stating it. Inventing a name column is exactly what "never invent an answer to an open product question" forbids, and it would be a personal-data column added by an agent.
Ruling needed: YES, and it is a product decision with a privacy dimension. Either the buyer supplies a display name at some point in the flow (a new column, a new prompt, a retention question), or ADU-CON-03 S7 is reissued without the name and SC-03's row priority is restated. **Until one of those, this sentence stays on both screens.**

### D-154 - The SC-03 filter row cannot filter, because the endpoint takes no filter

Severity:  MINOR (the region exists and is honest about what it does)
Phase:     T10 - 5
Source:    ADU-CON-03 v1.1 S7 -- SC-03 "Regions: filter row (needs action - active - completed - cancelled)"
Found by:  T10 Phase 5
Effect:    `GET /v1/seller/orders` accepts `limit` and `cursor`. There is no `state`, no `bucket`, no `filter`. So the four tabs can only group the rows the client has already loaded -- and a "Cancelled" tab reading empty while a cancelled order sits on page three is worse than no tab at all, because it answers a question it did not actually ask the server.
Response:  BUILT, AND LABELLED. The tabs group the loaded rows and one line says so, on every tab rather than only on the narrow ones -- the limitation is true of all four and merely invisible on "All".
Action:    A sentence under the filter row, `data-gap="D-154"`, asserted by the harness.
Ruling needed: A contract decision, small: a `state` query parameter on `GET /v1/seller/orders`, or a documented statement that the console loads the page and groups locally. **Not invented here** -- a parameter name shipped by a client is a contract the server then has to honour.

### D-155 - No endpoint anywhere returns `allowed_actions`

Severity:  MAJOR (a stated client contract with no server side)
Phase:     T10 - 5
Source:    apps/console/CLAUDE.md -- "The console computes no business state. It renders `state`, `allowed_actions` and `readiness[]` as the server resolved them." ADU-CON-03 S7 asks SC-03's row for "a single primary action if one is available".
Found by:  T10 Phase 5 -- `grep -rn "allowed_actions" apps/api/src` returns NOTHING
Effect:    Two of the three things the console is documented to render exist. The third has never been implemented anywhere in the API. Every screen that needs to know which actions are offered must therefore derive it from `state`, which is the derivation the rule exists to prevent -- and each screen derives it separately.
           C-4 keeps the blast radius small: the only per-row "action" SC-03 offers is NAVIGATION to the screen where the decision is made, which is not outcome-bearing and does not claim to be. SC-04's action gating is R20's, which is a RULED client behaviour ("render, do not hide", stated in the specification) with the server enforcing it independently -- `fn_mark_order_ready` refuses, and the QR token does not exist before PAYMENT_CONFIRMED. That is defence in depth, not client-side business logic.
Response:  RECORDED. Nothing built to fill it.
Action:    None. This is a contract-shaped hole and belongs to whoever reissues ADU-API-01.
Ruling needed: YES. Either `allowed_actions` lands on the resolved-state responses, or apps/console/CLAUDE.md stops promising it. **The current state -- a documented contract with no implementation -- is the one that produces a different guess on every screen.**

### D-156 - The QR payload serialisation is unspecified, and the Companion has to parse it

Severity:  MAJOR (a cross-client format decided by whichever client is built first)
Phase:     T10 - 5
Source:    ADU-CON-03 v1.1 S7 SC-06; ADU-PRD-01 S648 "The QR encodes a signed offline token"; ADU-API-01 S12.6
Found by:  T10 Phase 5, building SC-06
Effect:    `GET /v1/seller/orders/{id}/qr` returns `{order_ref, nonce, signing_key_version, signature}`. NO DOCUMENT SAYS HOW THOSE BECOME THE STRING IN THE QR. The PRD names the contents; nothing names the format. The buyer's Companion must parse whatever the seller's console renders, so the encoding IS a contract -- and it would have been set, silently and permanently, by whichever surface shipped first.
           `signed_at` is deliberately NOT in it: handoff.schemas.ts has the SCANNER stamp epoch milliseconds at scan time, so a `signed_at` baked into a printed code would be the moment the seller opened the modal.
Response:  INTERIM, AND ISOLATED. `encodeHandoffToken` in HandoffQr.tsx is one exported function producing compact JSON of the three fields a scanner cannot derive. One line changes when this is ruled.
Action:    The function, its header, and this entry.
Ruling needed: YES, before the Companion's scanner is built. Field names, ordering and whether the payload is JSON at all (a URL would let a non-Adulis scanner do something useful with it; compact binary would keep the code smaller and easier to scan in poor light).

### D-157 - Courier assignment cannot be populated: the list returns invites, the action wants account ids

Severity:  MAJOR (two of SC-04's four handoff controls cannot be built)
Phase:     T10 - 5
Source:    ADU-CON-03 v1.1 S7 SC-04 region 5; couriers.controller.ts `GET seller/couriers`; handoff.service.ts `assignCourier`
Found by:  T10 Phase 5
Effect:    `POST /v1/seller/orders/{id}/courier-assignment` and `.../custody-transfer` both take `courier_account_id`, and `assignCourier` validates it against `core.seller_courier` BY ACCOUNT ID. The only endpoint that lists couriers returns `core.seller_courier_invite` rows -- `id, phone, invited_at, claimed_at`. **An invite id is not an account id and a phone number is not either.** There is no endpoint that maps one to the other, and the console must not invent a lookup from a phone number to an account.
Response:  RENDERED AND DISABLED, with the reason stated -- the same "render, do not hide" doctrine R20 uses eight lines above it in the same region, and for the same reason: a control that vanishes teaches nothing.
Action:    Two disabled buttons, one sentence, `data-gap="D-157"`.
Ruling needed: YES. Either `GET /v1/seller/couriers` returns the claimed courier's `account_id` alongside the invite (it is the seller's own courier, and the seller supplied the phone, so it discloses nothing new), or the assignment endpoints take an invite id. **One line of SQL either way, and it is a contract change, so it is not made here.**

### D-158 - No SQL fixture can supply payment-evidence bytes: development storage is in-memory

Severity:  MINOR (a fixture limit, correctly worked around and stated)
Phase:     T10 - 5
Source:    FakeFinancialStorageAdapter -- `private readonly objects = new Map<string, Buffer>()`
Found by:  T10 Phase 5, seeding an order in PAYMENT_SUBMITTED for SC-05
Effect:    The seeded `core.payment_submission` carries a real `evidence_ref` with no object behind it, because the object store in development lives inside the API process. `streamEvidence` finds the row, asks the adapter, gets null, and raises INTERNAL. So SC-05's happy path is unreachable from `db:reset` alone.
Response:  THE BYTES ARE INTERCEPTED IN THE TEST, at the network, exactly as D-147's UPGRADE_REQUIRED is -- and for the same reason: it is the only honest way to exercise a path whose producer is out of reach, and it runs on every push rather than once by hand.
           What is asserted is the SECURITY SHAPE, which is what S7 actually specifies and which is identical whether the bytes are real or planted: a blob URL, no anchor, no `download`, no canvas, no download/print/share/save/valid/verified text anywhere in the modal, the decisions repeated, and the URL REVOKED on unmount -- proved by fetching it after closing and requiring the fetch to fail.
Action:    The route intercept, and a header on the spec saying why it is there.
Ruling needed: None. If a filesystem-backed development adapter ever lands, the intercept comes out and the test gets stronger for free.

### D-159 - The seller order endpoints returned neither the confirmation deadline, the line count, nor the history

Severity:  MAJOR (SC-03 and SC-04 could not be built to specification)
Phase:     T10 - 5
Source:    orders.service.ts `listSellerOrders` / `getSellerOrder` as they stood at T10 Phase 4
Found by:  T10 Phase 5
Effect:    Three of SC-03's five row elements and two of SC-04's six regions had no data.
           `listSellerOrders` returned `expires_at` and no line count and no confirmation deadline -- so the row could show only THE RESERVATION CLOCK, which is the wrong clock for a PAYMENT_SUBMITTED order and the exact display S7 singles out as forbidden. The 24h deadline lives on the open submission's `sla_deadline`, written by financial.service on submit and selected by nothing.
           `getSellerOrder` returned the submissions WITHOUT `sla_deadline` and no history at all. `core.order_state_transition` has existed since migration 11, is written by `trg_log_order_transition` and protected by `trg_append_only`, and NOTHING HAD EVER READ IT.
Response:  FIXED -- owed build, not a decision (the T9 D-103 precedent: "that one is owed build, not a decision -- do it").
Action:    `line_count` and `payment_sla_deadline` on the list; `sla_deadline` on each submission and a `history` array on the detail. `count(*)` is narrowed to a number at the boundary because node-pg hands bigint back as a string, which prints correctly and compares wrong.
Ruling needed: None.

### D-160 - The console-e2e gate ran a stale API, and a zombie process answering /healthz read as a healthy start

Severity:  BLOCKER for the gate's meaning (a PASS that says less than its message claims)
Phase:     T10 - 5
Source:    ops/scripts/verify-console-e2e.mjs, as it landed at T10 Phase 4
Found by:  T10 Phase 5, on C-4's first run -- seven tests failed and every symptom pointed at the wrong file
Effect:    TWO FAULTS, EACH SUFFICIENT ALONE.
           1. The gate CHECKED that `apps/api/dist/main.js` existed and ran whatever was in it, while rebuilding the console two steps below. Inside `ci:local` the `build` gate runs first, so dist is fresh; run directly -- which is how anyone works on a console change -- it drives a NEW console against an OLD API.
           2. It then waited for `/healthz` to answer. **`/healthz` answering proves that AN api is up, not that THIS one is.** With a stale process holding port 3000 (a dev server, a previous run interrupted between spawn and kill), the child dies instantly on EADDRINUSE, the health check succeeds against the ZOMBIE, and the suite runs against that process's binary.
           MEASURED, both: the console showed "undefined items" and no confirmation clock, and both were TRUE READINGS of an API compiled before those fields existed. The failure was indistinguishable from a product defect. After the rebuild was added, seven failures became seven again -- because the zombie was still answering. After the port guard, seven became one, and the one was a real test bug (D-161).
Response:  FIXED, both halves.
Action:    The gate now builds the API rather than assuming it; REFUSES TO START if anything already answers on the port, naming what to do; and watches the child for an early exit so a dead API is reported with its exit code instead of as a 30-second timeout.
Ruling needed: None. The general form is D-132's, one layer out: **a check that runs and a check that checks are different things, and "is it up?" is not the same question as "is MY one up?"**

### D-161 - `locator.count()` does not retry, and the QR test failed on a QR that was fine

Severity:  MINOR (a false red, which is the cheap direction -- but it is D-152's class again)
Phase:     T10 - 5
Source:    apps/console/e2e/trade.spec.ts, first version
Found by:  T10 Phase 5, on the same run that found D-160
Effect:    The test opened the handoff modal, asserted `.modal.qr` was visible, and then did `expect(await modules.count()).toBeGreaterThan(50)`. The modal becomes visible the instant it MOUNTS, while `GET /qr` is still in flight, so the count ran against an empty region and reported an empty QR. A probe showed 1396 rects and no page errors: the QR was correct the whole time.
           `expect(locator)` RETRIES. `await locator.count()` is a plain read that asks once. Mixing them is how a suite acquires a flake that a later agent learns to re-run rather than read.
Response:  FIXED.
Action:    A retrying `expect(...).toBeVisible()` on the element itself before any plain count, in both places the suite took one.
Ruling needed: None, but it is worth carrying beside D-152: **that entry was an assertion that ran too early and passed; this is one that ran too early and failed. The same cause, and only the direction of the wrong answer differs.**

### D-162 - Gate `console-e2e` could not run in CI at all: gates.mjs strips NODE_ENV and the entry carried no env

Severity:  BLOCKER (a gate red on every CI run from the moment it merges)
Phase:     T11 - 2 (found by T10's adversarial pass)
Source:    ops/scripts/gates.mjs -- the `console-e2e` entry as T10 Phase 4 wrote it
Found by:  T10 adversarial pass, lens `vacuous-tests`, 3/3 refuters upheld; confirmed by reading before repair
Effect:    gates.mjs deliberately drops NODE_ENV=development from every child (its own header says why), CI sets none, and verify-console-e2e's D-142 guard refuses an unset NODE_ENV with exit 2. So gate 22 fails on EVERY CI run -- while passing locally, because `pnpm verify:console-e2e` re-loads `.env`, which restores NODE_ENV=development. Red everywhere it matters, green on the one machine that already knows the answer. The `determinism` gate two hundred lines up carries `env: { NODE_ENV: 'test' }` for precisely this reason; this entry did not get one.
Response:  FIXED
Action:    `env: { NODE_ENV: 'test' }` on the gate entry, with a comment naming this failure. Verified that an exported NODE_ENV survives the pnpm script's `--env-file-if-exists=.env` (the env file fills only unset variables), so the value reaches the guard on both paths. Proven red the way CI would produce it: `env -u NODE_ENV node ops/scripts/verify-console-e2e.mjs` exits 2 with the D-142 message.
Ruling needed: none.

### D-163 - The gate built and tested a DEVELOPMENT React bundle -- the artifact its sibling gate exists to reject

Severity:  BLOCKER (every claim the suite made was about a bundle that must never ship)
Phase:     T11 - 2 (found by T10's adversarial pass)
Source:    ops/scripts/verify-console-e2e.mjs -- the console build step passing `{ ...process.env }`
Found by:  T10 adversarial pass; confirmed by measurement before repair: NODE_ENV=development build = 611,928 bytes, production = 370,308, matching the reviewer's figure exactly
Effect:    In the only environment the gate's own guard permits, process.env carries NODE_ENV=development, Vite folds it into the define, and React's development build is emitted -- carrying the very marker (`Each child in a list`) the `production-react` gate greps for. The gate meant to test the shipping artifact manufactured the non-shipping one, tested that, and printed PASS.
Response:  FIXED
Action:    The build env now sets NODE_ENV='production' explicitly, and the gate PROVES what it just built before serving it: it greps the fresh dist for the dev-only marker (the same one assertProductionReact uses -- checked here as well because that gate inspects whatever dist holds at ITS list position, and this gate has just overwritten dist) and dies naming a DEVELOPMENT bundle. Proven red by planting NODE_ENV='development' into the build env: "the console build under test is a DEVELOPMENT bundle (...) NODE_ENV leaked into the build." Removed; clean run 322.69 kB, confirmed production.
Ruling needed: none.

### D-164 - The harness's CSP forbade its own API, so the built console was NEVER the thing under test

Severity:  BLOCKER (sixteen green tests about an artifact that could not make one API call)
Phase:     T11 - 1 and 2 (found by T10's adversarial pass)
Source:    apps/console/e2e/serve.mjs replaying `connect-src 'self' https://api.adulis.example` verbatim; apps/console/playwright.config.ts `reuseExistingServer: !CI`
Found by:  T10 adversarial pass; confirmed empirically before repair -- msedge against the real dist and serve.mjs: "Connecting to 'http://localhost:3000/v1/bootstrap' violates the following Content Security Policy directive: connect-src 'self' https://api.adulis.example. The action has been blocked."
Effect:    The gate builds the console against http://localhost:3000 and serves it under a policy that permits only the production API origin. Every fetch the page makes is refused BEFORE it leaves the browser. Under that configuration no C-4 or C-3 data assertion can pass -- so the fact that sixteen DID pass means the suite was driving something else: `reuseExistingServer: !CI` reused whatever already held the console port, and nothing ever checked what that was. **The plants proved each assertion discriminates; nothing proved the assertions were pointed at the right thing. Two different properties, and this project had been treating the first as evidence of the second.**
Response:  FIXED, as an INVARIANT rather than a patch: **the harness proves the IDENTITY of the artifact under test, not its liveness.**
Action:    Three parts.
           1. THE CSP IS DERIVED, NOT REPLAYED. A policy hardcoded in one file and an origin configured in another will drift silently, so serve.mjs rebuilds connect-src from E2E_API_BASE_URL -- the same variable the build consumes as VITE_API_BASE_URL. Same shape as production ('self' plus exactly one API origin); one source for both. Everything else in the policy is served byte for byte.
           2. A BUILD ID, minted per run, stamped into the page by the build (index.html data-build-id via Vite's HTML env replacement; vite.config defaults it to 'untagged' so ordinary builds never ship the literal token), asserted by the suite's FIRST test (e2e/00-identity.spec.ts) against the page the server ACTUALLY served -- plus, in the same test, a real fetch to the API origin from the page's own context, so a blocking policy fails on test one with the browser's refusal quoted instead of sixteen green tests.
           3. THE API'S IDENTITY IS IN-BAND TOO: the gate mints a boot marker, passes it as ADULIS_BOOT_MARKER, /healthz echoes it (additive field), and the gate asserts the echo. The T10-era rebuild and early-exit detection narrow the stale-process window; the marker closes it. Decision recorded per the order: the rebuild alone does NOT suffice, because a stale listener makes the fresh child die on EADDRINUSE and everything after that is theatre.
           Proven red three ways (S2.1's plants 1-3): a stale server -> port guard, named; the same stale server with the guard deliberately bypassed -> "BUILD ID MISMATCH ... STALE OR FOREIGN SERVER", both ids named; the production CSP replayed verbatim -> "THE PAGE CANNOT REACH THE API ... refused it as POLICY, not network", refusal quoted.
Ruling needed: none.

### D-165 - reuseExistingServer meant any local run could test whatever held the console port

Severity:  MAJOR on its own; the enabling half of D-164's disaster in combination
Phase:     T11 - 2 (found by T10's adversarial pass)
Source:    apps/console/playwright.config.ts -- `reuseExistingServer: !process.env['CI']`
Found by:  T10 adversarial pass (three separate lenses found it independently)
Effect:    CI is unset on every local machine, so every local run would silently adopt an existing listener: a dev server with no CSP, a stale serve.mjs, anything. D-160 fixed exactly this hole for the API port and its Response said "FIXED, both halves" -- the console port had the identical hole one line further out, unfixed, and it is the port the sixteen green tests came through.
Response:  FIXED
Action:    Reuse is now an explicit human act (`E2E_REUSE_SERVER=1`, for tight dev loops); the gate never sets it, and the gate ALSO refuses to start when anything answers the console port -- two independent controls, neither trusted alone, and the build-id assertion still stands behind both even when a human opts into reuse.
Ruling needed: none.

### D-166 - A plant that is not proven to be in force tests nothing: the CSP plant silently lost a port race

Severity:  MINOR (caught during T11 itself, before anything was recorded on its evidence)
Phase:     T11 - 1
Source:    the S2.1 plant procedure, first attempt at the wrong-CSP plant
Found by:  T11, because the planted run came back GREEN and green was investigated instead of shrugged at
Effect:    The planted serve.mjs lost the port to the previous, healthy server (`pkill` does not reliably kill detached node processes on this platform; the plant died on EADDRINUSE in a background log nobody was reading) and the identity spec correctly PASSED -- against the unplanted configuration. Had that green been misread, the record would say the self-test fails to catch a wrong CSP, when in fact the wrong CSP was never served. This is the T10 lesson in miniature, applied to the proving procedure itself: T8 established that a plant must leave the checked thing reachable; this adds that A PLANT MUST BE PROVEN IN FORCE before its result is read.
Response:  FIXED in procedure
Action:    The plant was re-run after killing the holder BY PID and curling the served policy first -- the planted directive was confirmed on the wire (`connect-src 'self' https://api.adulis.example`) before the spec ran, and only then was the red recorded. Register entry so the next plant procedure starts from this rule.
Ruling needed: none.
### D-167 - A past deadline produced an unbounded refetch loop: the once-only guard died with its component

Severity:  BLOCKER (a sustained self-inflicted request flood on the console's most important screen)
Phase:     T11 - 4 (found by T10's adversarial pass; measured there at ~68 req/s)
Source:    apps/console/src/lib/clock.tsx (the `fired` ref) with apps/console/src/components/ScreenState.tsx (READY/STALE as two element shapes)
Found by:  T10 adversarial pass, reproduced with a minimal harness; re-measured at T11 by the new request-count test: 1067 requests in ~4 seconds
Effect:    `onElapsed` refetches; the refetch flips READY<->STALE; ScreenState's two branches put the children at different positions, so React UNMOUNTS AND REMOUNTS the subtree on every flip; the remount resets the `fired` ref and the "once-only" callback fires again. Forever, on any order whose displayed deadline has already passed -- which is the state every real order reaches by simply existing. The fixture never triggered it because both its live deadlines were deliberately in the future, so every RENDERING assertion passed while the defect sat one seeded row away.
           **If the thing a guard prevents can cause the guard's own remount, it is not a guard.**
           The remount was also destroying focus, scroll and any half-typed rejection reason on every background refresh -- a defect in its own right that nothing had noticed.
Response:  FIXED, twice over -- two independent controls, neither trusted alone.
Action:    1. ScreenState renders READY and STALE as ONE element shape (children at a stable position; a null slot is a position), so the flip no longer remounts the subtree.
           2. The guard moved above the remount boundary: a module-level set of deadline strings -- a deadline fires onElapsed at most once per page life, whatever mounts around it. (Correct as well as safe: a deadline that passed before a later mount needs no elapsed refetch; the mount's own load already fetched post-deadline truth.)
           The fixture gained a fifth order -- PAYMENT_SUBMITTED, confirmation deadline hours past -- and the harness a REQUEST-COUNT test (<= 4 requests in ~4s), because every rendering assertion had passed throughout the flood. Proven: both controls out -> 1067 requests, red; the guard alone with the remount re-planted -> 20 passed; restored -> 20 passed.
Ruling needed: none.

### D-168 - The blob-revoke assertion could not fail: the CSP refused the probe whether or not the URL was revoked

Severity:  BLOCKER for the claim it protected (the phase's proudest test, asserting nothing)
Phase:     T11 - 4 (found by T10's adversarial pass)
Source:    apps/console/e2e/trade.spec.ts -- `fetch(blobUrl)` after closing the modal, required to fail
Found by:  T10 adversarial pass, two lenses independently
Effect:    `connect-src` does not list `blob:`, so the fetch was refused by POLICY before the blob's liveness was ever consulted. The assertion passed for a reason unrelated to what it claimed -- D-132/D-152's class. Delete the `URL.revokeObjectURL` call and the suite stayed green while decrypted payment evidence lived in the tab for as long as the tab did.
Response:  FIXED
Action:    The instrument is an IMAGE LOAD -- `img-src` explicitly allows `blob:` (it is how evidence renders at all), and an Image on a live blob fires `load` while a revoked one fires `error`. Run BOTH SIDES: while the modal is open the probe must report ALIVE, proving the instrument discriminates, so the later "revoked" is a measurement and not a default. Proven: revoke call deleted -> exactly one failure, "the blob URL must be revoked when the modal unmounts"; restored -> 20 passed.
Ruling needed: none. Carried beside D-152 and D-161: an assertion whose failure path is pre-empted by an unrelated mechanism is green about nothing.

### D-169 - Show QR stayed operable on a COMPLETED order: a terminal screen minting a live signed handoff token

Severity:  MAJOR
Phase:     T11 - 5 (found by T10's adversarial pass; read-derived, so it survived the instrument failure)
Source:    apps/console/src/features/trade/OrderDetail.tsx -- `disabled={!paid}`, and `paid` includes COMPLETED
Found by:  T10 adversarial pass, two lenses independently
Effect:    TERMINAL is "history, no actions" (ADU-CON-03 S3), and the QR token is not a picture -- scanning it is a state-transition instrument. A completed order kept an enabled control that fetched and displayed a live signed token for an order that is over.
Response:  FIXED
Action:    `disabled={!paid || ended}` -- present and inert, per the region's render-don't-hide doctrine. The terminal e2e test now asserts it: present, disabled, and a forced click opens nothing.
Ruling needed: none for C-4. Whether the QR should also close at HANDED_OFF (the scan has already happened) is a smaller question left with C-8's courier work, where R25 lives.

### D-170 - Reissue was offered where the database always refuses -- after charging the seller a step-up to find out

Severity:  MAJOR
Phase:     T11 - 5 (found by T10's adversarial pass; read-derived)
Source:    apps/console/src/features/trade/OrderDetail.tsx -- reissue gated on `!ended` only
Found by:  T10 adversarial pass; confirmed against db/migrations/0022: fn_reissue_instructions accepts CREATED, NOTIFIED, PAYMENT_SUBMITTED and raises "order is not payable" otherwise
Effect:    On PAYMENT_CONFIRMED and HANDED_OFF the console rendered an enabled control for an action the server will always refuse -- and because reissue is challengeRequired, the refusal arrived only AFTER an OTP was sent and six digits typed. One of three hourly OTPs spent on an impossibility; a second try walks into D-124's 429-about-nothing.
Response:  FIXED
Action:    The control renders only in the three states the function accepts, cited to the migration. ABSENT rather than disabled, deliberately: unlike R20's handoff region this is not "opens later in the sequence" -- once payment is confirmed there are never instructions to reissue, and a disabled control would teach a seller to wait for something that never comes. Asserted both ways: absent on the confirmed fixture, present on the submitted one.
Ruling needed: none.

### D-171 - Order lines rendered the raw core.reservation_state enum as seller-visible text

Severity:  MAJOR (untranslated seller-visible strings that bypassed the catalogue's compile-error guarantee)
Phase:     T11 - 5 (found by T10's adversarial pass; read-derived)
Source:    apps/console/src/features/trade/OrderDetail.tsx -- `{l.state}` in the lines region
Found by:  T10 adversarial pass
Effect:    ACTIVE, FULFILLED, CANCELLED_BY_BUYER rendered verbatim. "A missing Amharic key is a compile error" held vacuously for these strings BECAUSE THEY NEVER ENTERED THE CATALOGUE -- the guarantee only covers what goes through it.
Response:  FIXED
Action:    Six keys in both catalogues (declared in MT-KEYS.md as awaiting the human pass, like every console key), a label map with the render-unknown-as-code fallback Home and StateBadge already use, and a terminal-order assertion that the seller reads "Fulfilled", not FULFILLED.
Ruling needed: none.

### D-172 - The readiness link test skipped exactly the rows whose links were broken -- and two live server kinds already had no route

Severity:  MAJOR (a vacuous guard over D-146's exact regression, plus the regression itself, live for COMPANY sellers)
Phase:     T11 - 5 (found by T10's adversarial pass)
Source:    apps/console/e2e/readiness.spec.ts (`if (!t.href) continue;`) and apps/console/src/features/entry/Home.tsx (ACTION_ROUTE)
Found by:  T10 adversarial pass, 3/3 upheld; kinds confirmed against fn_publication_readiness in migration 0018
Effect:    Two halves.
           THE TEST: Home renders an UNROUTED SPAN -- not an anchor -- for any resolving-action kind missing from its table, and the test's loop skipped rows without hrefs. So deleting a route key turned rows into spans and the test quietly stopped checking them: it could not fail for the one regression it was written against.
           THE TABLE: the server emits DECLARE_SELLER_TYPE and PROVIDE_COMPANY_DETAILS; the console's table had neither -- it had COMPLETE_COMPANY_DETAILS, a key the server never sends. A COMPANY seller with company details outstanding got a dead span for a BLOCKING requirement: D-146's shape, invisible in the fixture because the seeded seller is INDIVIDUAL and both rows are satisfied for it.
Response:  FIXED, both halves
Action:    The table's keys are now the server's verbatim (routes per ADU-CON-03 S6: item 2 -> SC-02, item 5 -> SC-17), and the test asserts ZERO unrouted rows before navigating every link -- a new server kind without a route now fails the suite by name at the moment it is introduced. Recorded fixture limit: the two corrected rows are satisfied for the seeded INDIVIDUAL seller, so their routes are exercised by table review, not by the navigation loop; a COMPANY fixture seller is future work.
Ruling needed: none.

### D-173 - Nothing prevents a reservation existing without its ORDER_CREATED stock event -- and a release then invents stock

Severity:  MAJOR, on the money path; found by the fixture, true of production
Phase:     T11 - 6 (read-derived from migrations 0008, 0011, 0012, 0021, 0028; needs no running database)
Source:    the pairing of core.reservation and core.stock_event exists only PROCEDURALLY, inside fn_create_order
Found by:  T10's adversarial pass flagged the fixture (reservations seeded with no events; Can't Fulfil took a variant from 40 to 42). T11 Phase 6 asked the question underneath.
Effect:    There is NO trigger on core.reservation, no constraint, and no check anywhere that a reservation has a reserving event. fn_create_order writes both in one transaction -- and is the only place that does. Any other writer (a fixture, a manual repair, a future code path, a partial restore) can create a reservation that holds stock nothing ever deducted. The release side then makes it worse: fn_cancel_line and the expiry sweep insert +quantity keyed on (reservation_id, reason) -- idempotent per A3.2 -- WITHOUT checking that the reserving event exists. **If the reserving event can be absent, the release invents stock**: fn_apply_stock_event applies +2 to a count that never went down, and the storefront offers goods that do not exist.
Response:  THE FIXTURE IS FIXED; THE SCHEMA QUESTION IS REGISTERED, NOT ANSWERED.
Action:    The seed now creates variants at stock_count 0 and writes the real ledger -- SELLER_SET +42, ORDER_CREATED -2 per reservation -- so fn_apply_stock_event, the only writer of the column, produces the 40 (and a release correctly returns held stock instead of minting it). Written with WHERE NOT EXISTS rather than ON CONFLICT, because BEFORE INSERT triggers fire even when ON CONFLICT DO NOTHING discards the row, and a re-seed would have re-applied every delta. db:reset now pins `stock_drift: 0` -- variants whose stock_count disagrees with their ledger sum -- so the class is caught structurally on every reset.
Ruling needed: YES -- whether the pairing should be database-enforced (a constraint trigger on core.reservation asserting its ORDER_CREATED event in-transaction, or a release that refuses when no reserving event exists, or a documented statement that fn_create_order's monopoly is the enforcement). Each has costs; none is a fixture's decision. NOT fixed in this order, per its S7.

### D-174 - D-159's claim "nothing had ever read core.order_state_transition" was false, and it was load-bearing in a source header

Severity:  MAJOR (an inaccurate register entry, repeated as fact where later agents read it)
Phase:     T11 - 7
Source:    register D-159; docs/build-status/T10-REPORT.md; the header comment above the history query in apps/api/src/modules/orders/orders.service.ts
Found by:  T10 adversarial pass, 3/3 upheld: claims.service.ts builds claim evidence bundles from the table with nearly the identical SELECT, and jobs/e1-clock.ts reads it to decide which PAYMENT_SUBMITTED orders lapsed their confirmation window
Effect:    An agent trusting the header would treat the seller history query as the table's sole consumer and change its columns, ordering, grants or filters accordingly -- breaking claim evidence and confirmation-window expiry, the second of which is the money path. A wrong report gets fact-checked; a wrong comment gets believed.
Response:  CORRECTED where each copy sits (the register itself is append-only, so the correction is this entry).
Action:    The source header now names all three consumers and warns that the expiry decision is one of them; the T10 report carries the correction inline, marked as a T11 edit; D-159's OWED-BUILD substance -- no SELLER-FACING endpoint returned the history -- stands.
Ruling needed: none.
### D-175 - RULED AND DISCHARGED: the release derives from the reserving ledger event (D-173's first half)

Severity:  (implements a BLOCKER-adjacent ruling on the money path)
Phase:     T12 - 1
Source:    WORK ORDER T12 S1's ruling, verbatim: "the release derives its quantity from the reserving stock_event, not from the reservation row. If no ORDER_CREATED event exists for that reservation, the release returns nothing and the order fails loudly."
Found by:  n/a -- the underlying hole is D-173 (T11 Phase 6)
Effect:    Migration 0042 adds core.fn_release_reservation_stock: quantity, variant AND seller all derive from the ORDER_CREATED event (SELECT ... INTO STRICT; sum(-delta) so a double-reserved ledger releases what was actually taken; NO_DATA_FOUND raises naming the reservation and D-173; TOO_MANY_ROWS -- reserving events spanning variants or sellers -- refuses as corrupt). "A constraint enforcing agreement between two numbers is weaker than having one number." All three release sites now go through it: fn_cancel_line and fn_reject_payment (re-created in 0042 with bodies verbatim from 0021 except the release block -- extracted programmatically so transcription cannot drift), and the expiry sweep in jobs/e1-clock.ts. The (reservation_id, reason) unique index is untouched, so release idempotency stands exactly as A3.2 anchored it.
Response:  BUILT; both arms and the anchor pinned in apps/api/test/t12-d173-release-derivation.spec.ts (a reservation WITH its event releases the ledger's number with the ledger's provenance; one WITHOUT raises, names D-173, writes nothing, and leaves the line ACTIVE -- an aborted cancellation must not half-cancel; a second release still refuses on the index).
Action:    The ruling's own note carried forward: e1-clock's test fixtures were creating bare reservations and became THE FIRST THING THE NEW REFUSAL CAUGHT -- fixed by pairing them, the same treatment the seed got at T11. A fixture must tell the ledger's story or it tests a state production cannot reach.
Adversarial pass on #43 (pre-merge, 24 agents): 8 findings, 8 upheld, 0 refuted -- every one addressed on the branch before merge, each with its own red-green proof:
           1. BLOCKER: the expiry sweep had NO per-order containment -- one poisoned order (exactly what the new refusal creates) fronted ORDER BY expires_at and halted expiry platform-wide, while the code's own comment claimed containment it did not have. Both e1-clock loops now try/catch per order, count and log failures into the job result; a containment test pins it (poisoned order FIRST in the batch: failed=1 and counted, the healthy order behind it still expires, no invented stock, the poisoned row stays visible).
           2. MAJOR: the derived quantity was not sign-checked -- a zero/positive-delta reserving row would have become a silent stock DECREMENT. The helper now refuses non-positive quantities by name.
           3. MAJOR, mutation-confirmed: the suite's fixture had the row and the ledger AGREEING, so a row-derivation implementation passed 3/3. The paired reservation's row now LIES (quantity 5, event -3); the mutation was re-applied provenly (prosrc checked) and now fails "Expected: 10, Received: 12"; restored provenly and green.
           4. The e1 fixture inserted its reserving event inside the replica window, suppressing the decrement trigger -- moved below SET session_replication_role = DEFAULT, so the fixture's ledger is real.
           5. MINOR: p_reason is now validated against the two release reasons, so nothing can route around the stock_release_once partial index.
Ruling needed: none for this half. The deferred constraint trigger that would prevent the bad state EXISTING stays PARKED pending a measurement against the A1 S6.1 300-concurrent-orders load (ops/load/db-loads.mjs is the rig); until then db:reset's stock_drift pin holds the line, per the order. (This entry was amended on the unmerged branch to carry the pass's findings -- the T8 D-134 precedent; nothing here was ever merged in another form.)

### D-176 - MISSING_SOURCE: ADU-AUTH-01 v2.6 is not in the tree, and T12 Phases 2-4 transcribe sections of it

Severity:  BLOCKER for T12 Phases 2, 3 and 4 (nothing else is affected; Phases 0, 1 and 5 do not need it)
Phase:     T12 - 2
Source:    WORK ORDER T12 S2 ("Build from ADU-AUTH-01 v2.6 S9.1, S12.1 and S12.2, which are explicit"), S3 ("install AUTH v2.6"), S4 (S5.5, S7.1, S7.4, S15, S16, S31.2, S31.4)
Found by:  T12 Phase 2, first step: locating the governing source before building (the adulis-spec-router protocol)
Effect:    docs/ holds ADU-AUTH-01 v2.5 and nothing later; docs/amendments/ holds the v2.4 permission seed and the README; no v2.6 file exists anywhere in the repository and none arrived with the order. The order cites v2.6's sections by NUMBER and quotes fragments -- it names three of S12.2's six delivery-status values, describes S12.1's table without its field list, and references S9.1's market-configuration shape without its columns. "Transcribe, do not design": a migration built from three of six enum values and a described-but-unlisted field set is designed, not transcribed, and it would become the binding shape the real v2.6 then has to match. The T9 precedent (D-140) is exact: documents cited, not present, recorded rather than invented.
Response:  PHASES 2-4 STOPPED at MISSING_SOURCE. Phase 1 built (its ruling is complete in the order's own text); Phase 5 built under founder-ruling authority (the order states D-101's and D-89's semantics fully; the unreissued-document debt is recorded there).
Action:    This entry, and the report. When ADU-AUTH-01 v2.6 arrives: install per S3's section split, then Phase 2's migration transcribes S9.1/S12.1/S12.2/S16/S30 directly, and Phase 4 builds on it.
Ruling needed: none -- the needed thing is the document itself.
### D-177 - RULED AND DISCHARGED: the age declaration is a named refusal, rendered to everyone, required only at identity creation (settles D-101)

Severity:  (implements a founder ruling; the underlying defect was MAJOR -- a new seller stopped by an error with nothing to correct)
Phase:     T12 - 5
Source:    WORK ORDER T12 S5.1, ruling under ADU-AUTH-01 v2.6 S18.1/S18.2/S17 -- the document itself is NOT installed (D-176); this is founder-ruled shape and the unreissued-document debt is recorded here
Found by:  n/a -- the defect is D-101
Effect:    The server refuses identity creation without the declaration using AGE_DECLARATION_REQUIRED -- its own code in the catalogue, with derived locale keys in both catalogues -- instead of a bare VALIDATION_FAILED that rendered as "The request is not valid". Required ONLY when creating an account: an existing account signing in without it succeeds, and that asymmetry is exactly why the console renders the control UNCONDITIONALLY -- asking the server which case applies is the S17 account-enumeration oracle. The console now detects the refusal by CODE (slot kept as the compatibility arm).
Response:  BUILT, both sides, three instruments:
           - t12-d101-age-declaration.spec.ts: a new phone without the declaration -> 400 AGE_DECLARATION_REQUIRED with the derived title_key, and NO account row; the same phone with it -> account created with the confirmation and its timestamp stored; an EXISTING account without it -> signs in.
           - e2e/age-declaration.spec.ts: the control is on the code step FOR A PHONE THAT HAS AN ACCOUNT (unconditional -- the console must not know), never pre-checked, and cleared by "change number" (D-119's correction, now pinned by a machine). Runs signed-out on the seeded buyer phone: two OTP REQUESTS, no verify, and db:reset clears the buckets per gate run, so D-124's accumulation cannot occur.
           - verify:error-locale: 62 codes, both catalogues complete.
Action:    error-catalogue + auth.service + SignIn.tsx + locale (en/am; am carries English pending the human pass, the standing C-3+ treatment, declared in MT-KEYS).
Ruling needed: none further. When ADU-AUTH-01 v2.6 installs, S18.1/S18.2 should confirm this shape or supersede it explicitly.

### D-178 - RULED AND DISCHARGED: the courier invite's second leg -- claim on authentication, atomically, with no oracle (settles D-89)

Severity:  (implements a founder ruling; the underlying gap was MAJOR -- two migration headers described a mechanism no code performed)
Phase:     T12 - 5
Source:    WORK ORDER T12 S5.2; migrations 0029 and 0037's headers (the describers); ADU-AUTH-01 v2.6 is NOT installed (D-176) -- founder-ruled shape, debt recorded here
Found by:  n/a -- the gap is D-89
Effect:    After successful authentication of the exact normalized phone (core.e164 against core.e164, both normalized at their boundaries -- 0029's partial index seller_courier_invite_phone anticipates precisely this lookup), every PENDING invite for that phone is claimed and its relationship created, in ONE statement in the SAME transaction as the sign-in: an UPDATE ... RETURNING CTE stamps claimed_at/claimed_by_account_id and feeds INSERT INTO core.seller_courier, ON CONFLICT on the seller_courier_live partial unique DO NOTHING. Server-side only; a client cannot name an invite. Idempotent: a second sign-in finds no pending rows. Claim-ALL: two sellers inviting one phone yield two relationships. A revoked invite is never touched.
           NO ORACLE, and it is load-bearing: nothing about the claim reaches the response and nothing in the statement can throw for a claimable phone, so a sign-in with a pending invite is indistinguishable, to the caller, from one without -- THE RESPONSE IS IDENTICAL; THE EFFECT IS NOT. That is G1.8's rule (the reason 0029 exists) carried through the leg that finally uses the table.
Response:  BUILT; t12-d89-invite-claim.spec.ts pins five properties: claim-all-atomically, idempotence INCLUDING stamp stability, revoked-invite-untouched, revoked-RELATIONSHIP-not-resurrected, and the oracle test.
Action:    Advisory locks per pending (seller, phone) -- the same pg_advisory_xact_lock the invite endpoint takes, acquired in seller_id order -- then one WITH ... RETURNING ... INSERT ... ON CONFLICT DO NOTHING statement in auth.service's verifySignIn, both account branches (an invite may predate the account or arrive years after it).
Adversarial pass on #44 (pre-merge, 26 agents): 12 findings, 10 upheld, 2 refuted; all addressed on the branch. The two that mattered most:
           1. BLOCKER (two lenses converging): "the response is identical" was FALSE AS WRITTEN and its test could not see why -- `roles` in the verify response answers ["COURIER"] for an invited phone and [] for a plain one, a value-level difference invisible to a shape-only comparison. RULED here, for v2.6 to confirm or supersede: every NON-ROLE field is identical by value, and the roles difference is DESIGNED disclosure to the authenticated holder of the phone (the observer holds a valid OTP for the number; roles is "a rendering hint only" per S5; the courier's own console needs it to route them; the pre-auth surfaces S17/S19/S22 protect are untouched). The test now compares non-role fields BY VALUE and asserts the roles difference BY NAME, so any new distinguishable field fails it.
           2. MAJOR (two lenses converging): the claim bypassed the per-(seller, phone) advisory lock the invite endpoint takes for exactly this interleaving -- a claim racing a re-invite left two live CLAIMED invites (the phantom-courier anomaly that endpoint's own comment documents). The claim now takes the identical lock per pending pair.
           Also: the idempotence test was mutation-vulnerable (it survived deleting the claimed_at guard -- a re-claim rewrote stamps invisibly and a revoked relationship resurrected on the next sign-in); both behaviours are now pinned. The e2e label is asserted verbatim against the catalogue. (Entry amended on the unmerged branch -- the T8 D-134 precedent.)
Ruling needed: v2.6 to confirm the roles-disclosure ruling above, plus the standing confirmation note shared with D-177.

### D-179 - Two test-suite conventions found the hard way while building D-177/D-178's suites

Severity:  MINOR (test infrastructure; no product code affected)
Phase:     T12 - 5
Source:    the first three runs of t12-d89/t12-d101, each of which failed its TEARDOWN or its successor's SETUP while all assertions passed
Found by:  T12 Phase 5, because a failed teardown was investigated instead of re-run past
Effect:    Two conventions worth recording for every future auth-touching suite:
           1. A LIVE FIXTURE MARKET CAPTURES OTHER SUITES' ROWS. Bootstrap binds a browser device to the oldest LIVE market, and an account created at sign-in takes its market from the device (D-104) -- so two suites with live test markets under parallel jest workers steal each other's devices and accounts, and each teardown misses rows the other created. Symptom: market_code_key duplicates on the NEXT run, failing beforeAll before a single assertion. Convention: fixture markets are is_live=false unless liveness is the thing under test; teardown scopes by PHONE, not by market.
           2. session -> otp_challenge and notification -> account FKs order the teardown: sessions before challenges, notifications before accounts.
Response:  FIXED in both suites; proven by running the pair twice consecutively without a reset (7 passed, then 7 passed).
Action:    The comments sit in the suites where the next author will copy them from.
Ruling needed: none.
### D-180 - Audience is chosen at VERIFY, not bound at challenge creation: R39/S5.2 is not implemented

Severity:  MAJOR (a ruled authentication invariant that the code does not hold)
Phase:     T13 - 1
Source:    ADU-AUTH-01 v2.6 R39, S5.2 -- "Audience is persisted at challenge creation" and "The verification request does not accept `audience`"
Found by:  T13 Phase 1, checking S12.3's "OTP audience binding if not already present" rather than assuming it
Effect:    `core.otp_challenge` had NO audience column (id, purpose, phone_e164, code_hash, attempt_count, expires_at, consumed_at, step_up_action, created_at), and `auth.schemas.ts` takes `audience` in the VERIFY body. So the audience is chosen by the caller AT VERIFICATION, which is exactly the shape S5.2 forbids: a challenge requested for MOBILE can mint a CONSOLE session, and the invariants S5.2 prints -- "MOBILE challenge -> MOBILE session only", "CONSOLE challenge -> CONSOLE session only" -- are unenforced. The two audiences have materially different session lifetimes and, through the eight console-only step-up permissions (S21.1/S26.4), different reachable capability.
Response:  SCHEMA HALF BUILT (migration 0043 adds `core.otp_challenge.audience`, nullable so the migration cannot fail against a challenge in flight). THE SERVICE HALF IS NOT BUILT and is not silently assumed: writing the audience at request, refusing a mismatch at verify, and removing `audience` from the verify body is an authentication-semantics change, and T13's scope is the delivery layer.
Action:    The column, its comment, and this entry. S31.1's three tests ("MOBILE -> MOBILE only", "CONSOLE -> CONSOLE only", "verify endpoint cannot override audience") are the acceptance criteria and are owed with the fix.
Ruling needed: none -- v2.6 already rules it. What is owed is the BUILD, plus a decision on the in-flight window: removing `audience` from the verify body is a breaking contract change for any client mid-upgrade, so the fix likely accepts the field, ignores it, and refuses a mismatch, before dropping it a revision later.

### D-181 - v2.6 names two fields and enumerates neither: `failure_class` and `sms_compliance_status`

Severity:  MINOR (both are transcribed as TEXT; the risk is a later invented enum becoming binding)
Phase:     T13 - 1
Source:    ADU-AUTH-01 v2.6 S12.1 (`failure_class nullable`) and S9.1 (`sms_compliance_status`)
Found by:  T13 Phase 1, writing migration 0043
Effect:    Both fields are named in a field list and neither has a value set anywhere in v2.6. An enum invented in the migration would become the shape ADU-DB-01 v1.14 then has to match and every adapter then has to map onto -- design wearing transcription's clothes.
           They are NOT the same as S5.6's send classifications. ACCEPTED / DEFINITIVE_NOT_SENT / DELIVERY_UNKNOWN classify a SEND and are carried by `status` (S12.2's six); `failure_class` is the provider-specific reason beneath a classification, which S5.6's last line makes each adapter document.
Response:  BOTH ARE TEXT, with column comments saying why.
Action:    Migration 0043's comments; this entry.
Ruling needed: YES, eventually -- whether either becomes an enum, and if so with which values. Cheap to defer: a text column narrows to an enum later; an enum invented now is a value set every adapter has already been written against.

### D-182 - S7.1's provider lifecycle has no schema home, and needs none yet

Severity:  MINOR (recorded so the absence is deliberate rather than forgotten)
Phase:     T13 - 1
Source:    ADU-AUTH-01 v2.6 S7.1 -- CANDIDATE -> ACCEPTANCE_TESTING -> APPROVED -> PRODUCTION_FALLBACK
Found by:  T13 Phase 1
Effect:    v2.6 gives a four-state lifecycle for a provider's progress toward being a real route, and gives it no table, no column and no owner. The only fact the running system needs today is whether a market HAS a fallback route, and that is `core.market.sms_fallback_provider IS NULL` -- which is Ethiopia's state exactly (S7.1: "Before approval: Fallback = NONE").
Response:  NO TABLE. The lifecycle is S7.2's fourteen-point acceptance checklist plus S7.3's upstream-independence review, both of which are runbook procedures against a vendor account that does not exist yet, not rows.
Action:    Column comment on sms_fallback_provider; this entry.
Ruling needed: only if the lifecycle must be queryable before a second provider is integrated. It cannot be until then.

### D-183 - `core.market.is_live` and the new `activation_state` are two truths about one market

Severity:  MAJOR (two overlapping sources for "is this market on", which is the shape that grows a stale copy)
Phase:     T13 - 1
Source:    ADU-AUTH-01 v2.6 S9.2 (the seven activation states) against the installed `core.market.is_live`
Found by:  T13 Phase 1, adding activation_state beside a column v2.6 never mentions
Effect:    `is_live` exists, is NOT NULL, and is read where it matters: `/v1/bootstrap` assigns a device its market by `ORDER BY m.is_live DESC, m.created_at ASC` (D-104's fix), so is_live decides WHICH MARKET A NEW ACCOUNT BELONGS TO. `activation_state` now decides whether that market may issue OTP. Nothing connects them, so a market can be `is_live = true, activation_state = UNREVIEWED` -- devices bind to it and no one can ever sign in -- or `is_live = false, activation_state = ACTIVE`, which issues OTP for a market bootstrap will not hand anybody.
           v2.6 never mentions is_live, so collapsing, retiring or redefining it here would be the judgement call in SQL that "transcribe, do not design" forbids.
Response:  BOTH KEPT, UNCONNECTED, and registered. Migration 0043 adds only the constraint v2.6 supports directly: otp_enabled implies activation_state = ACTIVE.
Action:    Column comment on activation_state; this entry. db:reset pins `active_markets = 1` so a second one cannot appear unnoticed.
           [!] CORRECTION, adversarial pass on #45 (upheld by two lenses): the first version of this line read "the seed sets both consistently for the one market it creates". IT DOES NOT, AND CANNOT. seed.mjs sets `is_live = false` deliberately -- with a nine-line comment explaining that D-104's `ORDER BY is_live DESC` lookup makes a live fixture market capture other suites' devices and accounts (D-179) -- and then sets `activation_state = 'ACTIVE'` on the same row. That is `is_live = false, activation_state = ACTIVE`, which is VERBATIM the second of the two anomalies this entry's own Effect paragraph names. I described the divergence and shipped it six lines apart, in the entry that exists to report it. The two settings are not reconcilable while both columns exist, which is the finding rather than a defect in the seed.
Ruling needed: YES. Either is_live becomes derived from activation_state (`activation_state = 'ACTIVE'`), or it keeps a separate meaning that some document states, or bootstrap starts reading activation_state and is_live retires. Until then the two can disagree and only a person would notice.

### D-184 - S30 names nineteen absent events, not four -- and two of them collide with existing names

Severity:  MAJOR (a closed, fail-closed catalogue; an unseeded name is a runtime refusal at the moment it is first emitted)
Phase:     T13 - 1
Source:    ADU-AUTH-01 v2.6 S30 and S30.1; `analytics.event_definition`
Found by:  T13 Phase 1, diffing the WHOLE of S30 against the catalogue programmatically rather than working from S30.1's callout
Effect:    S30.1 calls out four "at minimum"; the work order predicted six; THE DIFF IS NINETEEN. `otp_generated`, `otp_delivery_attempted`, `otp_delivery_accepted`, `otp_delivery_unknown`, `otp_delivery_failed`, `otp_delivered`, `otp_provider_failover_started`, `otp_provider_failover_completed`, `otp_verified`, `otp_market_soft_limit`, `otp_market_hard_limit`, `otp_global_soft_limit`, `otp_global_hard_limit`, `step_up_requested`, `step_up_satisfied`, `step_up_failed`, `courier_invite_claimed`, `social_account_verification_started`, `social_account_verification_completed`. The catalogue is closed and fail-closed, so every one of these is a refusal at first emission -- which for `otp_delivery_unknown` means the first provider timeout, exactly as S30.1 warns.
           TWO ARE NEAR-DUPLICATES OF INSTALLED NAMES, and both are seeded rather than reconciled: S30's `step_up_requested` beside the catalogue's `step_up_challenged`, and S30's `otp_delivered` beside `otp_delivery_confirmed`. Choosing which name wins is a ruling, not a migration's decision.
Response:  ALL NINETEEN SEEDED in migration 0043.
Action:    The seed, and a scripted diff (ops/scripts, run at build time) rather than a reading of the section.
Ruling needed: YES, on the two collisions -- whether `step_up_challenged` and `otp_delivery_confirmed` are retired in favour of v2.6's names, or whether the pairs mean different things and both stay. Two live names for one event splits every query that counts it.
### D-185 - RULED BY ADU-DB-01 v1.14: is_live is withdrawn, activation_state is the single truth (settles D-183)

Severity:  (implements a founder ruling; D-183's underlying defect was MAJOR)
Phase:     T13 - 2
Source:    ADU-DB-01 v1.14 S30b.3, ruling on D-183
Found by:  n/a -- D-183 is the finding
Effect:    "Every market resolution reads `activation_state = 'ACTIVE'`. `is_live` is withdrawn." The ruling also names the gain a boolean could not express: SUSPENDED then means what suspension should mean -- no new OTP issued, no new device assigned to that market, and every account already there unaffected.
           This also RESOLVES the contradiction D-183's own correction records: with `is_live` gone there are no longer two settings to reconcile, and the seed's deliberate `is_live = false` (which existed to stop a live fixture market capturing other suites' devices, D-179) has nothing to disagree with.
Response:  NOT BUILT IN THIS PHASE, on the ruling's own instruction: "Sequence it as its own change. It touches /v1/bootstrap and orders.service.ts -- the two remaining market readers D-116 records -- and it drops a column on a populated table."
Action:    This entry; the work is a migration plus the two readers, and it carries D-179's fixture-market reasoning with it (a non-live fixture market becomes expressible only as a non-ACTIVE one).
Ruling needed: none. The BUILD is owed.

### D-186 - The founder-only activation boundary does not exist: adulis_app already holds full DML on core.market

Severity:  MAJOR (a claimed privilege boundary that no grant enforces, over seven controls including SMS spend)
Phase:     T13 - 1
Source:    migration 0043's grants block, which asserts of core.market "It never writes market activation: S9.4 makes activation a privileged founder-run operation with a runbook, not an application capability"
Found by:  adversarial pass on #45
Effect:    THE ASSERTION IS FALSE IN THE DATABASE THE MIGRATION PRODUCES. Migration 0002 grants `SELECT, INSERT, UPDATE, DELETE ON core.market` to `adulis_app`; no migration revokes it; 0043 issues no column-level REVOKE; and core.market carries no RLS. So the application role can write `activation_state`, `otp_enabled`, both provider columns, the sender columns and both daily OTP limits -- seven founder-only controls, two of which govern SMS spend.
           THE FOLD IS WHY. S9.1's `market_config` was folded INTO core.market rather than given its own table (the one structural judgement call in the migration, and it went unregistered -- also a pass finding). A separate table would have started with no grants and acquired only what it was given; extending an existing row inherits whatever that row already had. A comment cannot revoke a grant.
Response:  RECORDED, NOT PATCHED HERE, and deliberately so: revoking column-level UPDATE on core.market is a privilege change against a live application role, and it interacts with D-185's withdrawal of `is_live` (which rewrites who reads and writes this table). Doing both in one considered change is right; doing the second blind, in the phase that discovered the first, is how a privilege edit breaks bootstrap.
Action:    The migration's grants comment is corrected to state what is true rather than what was intended. This entry.
Ruling needed: YES, and it is small: whether S9.4's "privileged founder-run operation" is enforced by (a) column-level REVOKE on core.market from adulis_app, (b) moving the seven controls to their own table with its own grants -- unwinding the fold -- or (c) a documented statement that the runbook is the control and the grant is not. (a) and (b) are enforcement; (c) is a decision to accept it, which is legitimate for a founder-only system with one operator, but should be said rather than implied. Rides with D-185.

### D-187 - The structural fold of S9.1 into core.market was a judgement call and went unregistered

Severity:  MINOR (the decision is defensible; its absence from the record is not)
Phase:     T13 - 1
Source:    migration 0043's market-configuration block
Found by:  adversarial pass on #45 -- "the one structural judgement call with no register entry"
Effect:    v2.6 S9.1 says "maintain configuration similar to: market_config <fields>", and three of its fields already exist on core.market under other names (market_code/code, default_currency/display_currency, default_timezone/display_timezone). The migration extended core.market rather than creating a second table, reasoning that a separate table would carry a stale copy of those three -- the root CLAUDE.md's "a rule kept in two places grows a stale copy". Every OTHER decision in that migration was registered (D-181 through D-184); this one was argued in a comment and never recorded, which is the difference between a decision and an assumption.
           It is not cost-free, and D-186 is the cost: the fold inherited core.market's existing grants.
Response:  REGISTERED.
Action:    This entry. The alternative (its own table, its own grants) stays open and is option (b) of D-186's ruling.
Ruling needed: none independently -- it is decided with D-186.
### D-188 - verify:appendix could not parse a column-aligned markdown table, and reported the document as empty

Severity:  MAJOR (the gate was wrong about the document rather than the document wrong about the database -- the inversion of its purpose)
Phase:     T13 - 2
Source:    ops/scripts/verify-appendix.mjs, the Appendix B per-schema row parser
Found by:  T13 Phase 2, installing ADU-DB-01 v1.14 -- and independently by the adversarial pass on #45 from the other side ("generate-appendix's Appendix B output is in a format verify-appendix cannot parse")
Effect:    The parser required EXACTLY one space around each pipe: /^\| `([a-z_]+)` \| \*{0,2}(\d+)\*{0,2} \|$/. A COLUMN-ALIGNED table -- `| `core`         | **90** |` -- is ordinary markdown, is what v1.14 carries, and is what generate-appendix.mjs emits. It matched zero rows, and the gate then reported "Appendix B has no row for schema `core`" NINE TIMES about a document that has all nine.
           The direction of the error is what makes it MAJOR. This gate exists to catch a document that has drifted from the database; here it declared a correct document wrong, which is the failure mode that teaches people to disbelieve a gate. It also broke the last link of the chain the generator's header claims: DATABASE -> fixture -> DOCUMENT was unverifiable for the document half, so Phase 2 would have installed v1.14 against a gate that could never have passed it.
Response:  FIXED
Action:    The row pattern is whitespace-tolerant (`\s*` around every pipe). Proven by the install itself: red with nine per-schema failures before, `PASS Appendix A and Appendix B agree with what generated them` after, against v1.14 with 116 tables and 71 types.
Ruling needed: none. Worth carrying: a gate that parses a human-written document must accept every form of that document a human legitimately writes, or it is asserting a formatting convention nobody agreed to.

### D-189 - ADU-DB-01 v1.14 and ADU-AUTH-01 v2.6 installed; AUTH is split across two installed revisions

Severity:  (an installation record, not a defect)
Phase:     T13 - 2
Source:    ADU-AUTH-01 v2.6 S0 ("the repository amendment manifest must record this split"); ADU-DB-01 v1.14
Found by:  n/a
Effect:    v1.14 supersedes v1.13 outright (v1.13 -> docs/superseded/). ADU-AUTH-01 does NOT work that way and this is the entry that says so: v2.6 governs authentication, sessions, recovery, operator authentication and abuse control; **v2.5 REMAINS INSTALLED AND CANONICAL** for the permission catalogue, the 42x6 matrix and the executable seed, which v2.6 leaves unchanged and does not reproduce.
           Moving v2.5 to superseded/ would break a gate rather than merely lose prose: `verify-permission-doc.mjs` parses that file for the 42 codes, 139 grants and the six per-role totals. v2.6 prints the checksums and says "v2.6 does not reconstruct permissions from checksums" -- the numbers there describe v2.5's content and are not a source it could be rebuilt from.
Response:  INSTALLED.
Action:    Both documents in docs/, ASCII-verified (0 non-ASCII bytes each). GOVERNED gains v1.14 and v2.6 and keeps v2.5. verify:appendix reads v1.14. DOCUMENT_AUTHORITY and docs/amendments/README record the split, the latter with the two-column "which question, read which revision" table v2.6 S0 asks for.
           v1.14's body is v1.13's, spliced rather than retyped: the document says at the end of every history block that all else is carried forward unaltered, and retyping 2,400 lines carries transcription risk with no upside. The splice asserts every boundary it uses and was verified lossless -- no non-history heading lost, none duplicated, the fourteen history sections renumbered 0.1..0.14.
           `pnpm verify:permission-doc` -> PASS, 252 cells both directions, ACROSS the installation. That is v2.6 S0's own test that the split was recorded correctly, and it is why the gate is cited here rather than the reading of it.
Ruling needed: none.
### D-190 - ADU-DB-01 v1.14 Appendix B says "Reproducing 114 names" three lines under its own "116 tables"

Severity:  MINOR (an internal inconsistency in the source document; the installed copy deviates from it by ONE WORD, deliberately)
Phase:     T13 - 2
Source:    ADU-DB-01 v1.14 Appendix B, final paragraph
Found by:  T13 Phase 2 adversarial pass, comparing the installed document against the founder's attachment as sent
Effect:    Appendix B opens "**116 tables.** Two are new in migration 0043" and closes "Reproducing **114** names here would be a fourth copy of a fact that has already drifted three times." 114 is v1.13's count. The sentence was carried forward and the headline updated; the number inside the sentence was not.
           **The installed copy reads 116.** That is the count `verify:appendix` derives from `pg_class` and asserts, and it is the number the same section states two lines above -- but it is a deviation from the attachment, made by me, and the register is where that gets said rather than absorbed.
           The irony is the sentence's own subject: it is the paragraph explaining why the enumeration is not reproduced, because a hand-maintained count "has already drifted three times". It drifted a fourth time, in the sentence saying so.
Response:  DEVIATED FROM SOURCE, DELIBERATELY. Founder ruling invited.
Action:    Installed as 116. Reverting to 114 would put a knowingly-false number in a binding document three lines under the true one; the alternative -- installing it wrong and registering it -- was rejected for that reason. **If the founder prefers strict transcription, the one-word revert is trivial and this entry is the record of what was changed.**
           Everything else in the document is the attachment: **exactly one word differs across 3,063 lines**, proven mechanically rather than read (see D-191's method note).
Ruling needed: **CONFIRM 116, or instruct strict transcription of 114.**

### D-191 - the v1.14 splice duplicated a clause in the closing paragraph, and the check that should have caught it was pointed at the wrong document

Severity:  MAJOR (a defect in a binding document, shipped by a verification that could not have detected it)
Phase:     T13 - 2
Source:    the assembly script for ADU-DB-01 v1.14; docs/build-status/T13-REPORT.md
Found by:  T13 Phase 2 adversarial pass
Effect:    v1.14's body was assembled by splicing v1.13's rather than retyping it. The closing paragraph was rebuilt the same way: the script prepended "From v1.13: the revision that stops writing its own appendices." to v1.13's carried closing -- **which already began with that clause.** The installed document said it twice.
           **The verification is the real finding.** I verified the splice against v1.13: no heading lost, none duplicated, history renumbered. It passed, and it PROVED THE SPLICE WAS MADE OF v1.13 -- which was never in doubt. **The document the splice was supposed to reproduce is the founder's attachment, and I never compared against it.** The check ran, and the check could not fail for the reason the check existed.
           That is D-132's class exactly (D-152, D-160, D-161, D-168, D-175), and it is the second time in two phases that the defect landed in my own verification rather than in the product.
Response:  FIXED, and the check replaced with the one that discriminates.
Action:    The closing is now the attachment's, word-for-word: taken from the founder's text, de-fragmented by a transform that deletes only emphasis markers and never letters, asserted word-identical to the source before writing.
           **The whole document is now diffed against the attachment**, normalising only table-cell padding, emphasis-marker placement and markdown backslash escapes -- all artifacts of the founder's export, all of which the repository's rendering already corrects. Result: 2,027 canonical lines, 48 differences proven to be cell boundaries alone (same words, same order, unsplit header rows), and **exactly one differing word in the entire document: D-190's 114/116.**
           ADU-AUTH-01 v2.6 was checked the same way and is **byte-identical** to its attachment.
Ruling needed: none. Worth carrying: **when a document is assembled rather than transcribed, the reference for its verification is the source it claims to reproduce, never the material it was built from.** Building it out of X guarantees it matches X.
### D-192 - the IP rate limiter v2.6 S15 declares DISABLED was live on the OTP request path

Severity:  MAJOR (an availability defect that has never fired only because the topology it breaks in is the one not yet deployed)
Phase:     T13 - 3
Source:    apps/api/src/modules/auth/auth.controller.ts, POST /v1/auth/otp/request
Found by:  T13 Phase 3, transcribing S15
Effect:    The handler consumed `10/hour/IP_HASH` on `otp-request-ip` -- **the exact control v2.6 S15 names and then declares DISABLED**, in a section that anticipates the excuse: "It is not merely non-authoritative. **IT MUST NOT EXECUTE** in a topology where every request may appear to originate from the same proxy."
           **That topology is ours.** Nothing in this API sets Express's `trust proxy`, so `req.ip` is the SOCKET address -- behind any CDN, load balancer or reverse proxy that is the PROXY's address, identical for every caller. The limiter was therefore not a weak control, it was a SHARED COUNTER: ten OTP requests per hour for the entire platform, with the eleventh person to sign in that hour refused because ten strangers did first. In a market where carrier NAT is ordinary, that is most of a city behind one number.
           It has never caused an outage for one reason: the deployment it breaks in does not exist yet. A defect that is invisible until the day you deploy is worse than one that is loud now.
Response:  REMOVED, not relaxed.
Action:    The consume call is gone and the reasoning is in its place. The phone-keyed control S14 requires (3/hour/PHONE_KEY) is untouched and is what actually binds.
           **Proven by a PAIR of assertions, because the obvious single one is vacuous.** "No IP bucket row exists" passes trivially if the requests never reached the limiter -- and the first version of the test did exactly that, sending a body without `purpose`, so all four were refused by Zod at 400 before any limiter ran.
           **THE PROOF IS NOT THE ONE THIS ENTRY FIRST DESCRIBED.** It said the suite counts PHONE bucket rows against IP bucket rows; the test counts neither, and its own header says why bucket-counting was abandoned -- several other suites blanket-delete both buckets in their `beforeEach`, and a deletion racing the assertion can only REMOVE rows, so a restored IP limiter would leave no trace and the test would pass. The race biases toward vacuity. The entry described the method the test rejects. (Corrected here after the Phase 3 claims audit; the commit message described it correctly.)
           What the test actually does is spy on `RateLimitService.consume`: four `PHONE_HASH` calls carrying S14's own rule (`otp-request`, 3600s, max 3) and ZERO `IP_HASH` calls, asserted in process with no shared state. The PHONE count is the control that proves the requests reached the limiter. Mutation-confirmed: restoring the consume call turns it red.
Ruling needed: none for the OTP path. **One is invited for `/v1/bootstrap`**, which keeps an IP-keyed limiter (600/hour, device minting). S15 governs the SMS abuse controls and does not reach it, and its comment shows the NAT hazard was priced deliberately -- but the same `req.ip` problem applies, so in production that is 600 device mints per hour PLATFORM-WIDE. Not changed here: it closes a measured flood defect (~230 rows/second), and removing it without S15.1's trusted-proxy work would trade one availability defect for another.

### D-193 - per-market OTP spend cannot be attributed in the installed schema

Severity:  MINOR (a control that is conservative rather than exact; it fires early, never late)
Phase:     T13 - 3
Source:    ADU-AUTH-01 v2.6 S16 vs S12.1; ADU-DB-01 v1.14
Found by:  T13 Phase 3, implementing the spending circuit breaker
Effect:    S16 gives every ACTIVE market `otp_daily_soft_limit` and `otp_daily_hard_limit`. **Nothing in the schema says which market an OTP belongs to**: `core.otp_delivery_attempt` carries no market, `core.otp_challenge` carries none, v2.6 S12.1's field list has none and v1.14 adds none.
           Attributing through the phone's ACCOUNT was considered and rejected -- it counts only phones that already have one, undercounting exactly the abandoned anonymous requests a spend control exists to catch. **An under-count is the unsafe direction.**
Response:  IMPLEMENTED CONSERVATIVELY. Gap registered; DB amendment named.
Action:    The counter is platform-wide. While exactly one market is ACTIVE that is EXACT rather than approximate -- only ACTIVE markets issue (S9.2), so every attempt belongs to the one that does. With two it OVER-counts each, and can only over-count, so the breaker fires EARLY and never late. Sound in the direction that matters; unfair in the other, since a busy market can spend a quiet one's allowance. The activation runbook names this as a prerequisite for market number two.
           **An earlier version refused to issue at all once a second market went ACTIVE**, reasoning that an unattributable number was worse than none. Its own test showed what that means: a fixture market turned OTP on and every market stopped serving. **A safeguard whose failure mode is a platform-wide outage is not a safeguard**, and the conservative count is the honest version of the same intent.
Ruling needed: **approve a `market_id` on `core.otp_challenge`, written at issue**, as the DB amendment that makes this exact. It is the smallest change that works and it is not in v1.14.

### D-194 - the seed asserted a sender-ID approval that no vendor has given

Severity:  MINOR (a false claim in the row an operator copies)
Phase:     T13 - 3
Source:    ops/scripts/seed.mjs, the S9.1 market configuration
Found by:  T13 Phase 1 adversarial pass, actioned in Phase 3
Effect:    The seed set `sender_registration_status = 'APPROVED'` and `sms_compliance_status = 'REVIEWED_FOR_SEED'`. The first asserts that a vendor approved the `Adulis` sender ID; **no vendor has, because every provider in v2.6 requires a registered business and Adulis does not have one.** The second invents a value for a column S9.1 deliberately leaves TEXT and unenumerated (D-181).
           **A seed is a TEMPLATE** -- the row an operator copies when activating a real market -- so a seed that claims an approval is how a production row comes to claim one too. The activation runbook's step 1 now says this in as many words.
Response:  FIXED.
Action:    `NOT_REQUIRED` and `NOT_REVIEWED_FAKE_PROVIDER`. The first is TRUE OF WHAT IS BOUND: the provider is a fake and a fake requires no sender registration. The runbook carries the transition to PENDING and then APPROVED when a real vendor is bound.
           **The second value is itself invented, and this entry originally condemned invention without noticing that.** `sms_compliance_status` is free TEXT that S9.1 names and never enumerates (D-181), so EVERY value in it is invented -- there is no correct string to reach for. The defect was never invention; it was a value that ASSERTED A REVIEW THAT NEVER HAPPENED. `NOT_REVIEWED_FAKE_PROVIDER` asserts the opposite and is accurate. (Corrected after the Phase 3 claims audit.)
Ruling needed: none.

### D-195 - migration 0043 said S10.2 was "enforced in the router", and the router did not enforce it

Severity:  MINOR (a comment asserting an enforcement that did not exist -- D-186's shape, one level up)
Phase:     T13 - 3
Source:    db/migrations/0043, COMMENT ON TYPE core.sender_registration_status
Found by:  T13 Phase 3, writing the router the comment refers to
Effect:    The comment reads: "status != APPROVED forces otp_enabled = false unless an approved alternative route exists -- **enforced in the router**, not by a CHECK". There was no router when that was written, and the one now written cannot enforce the whole rule: **the schema does not carry WHERE REGISTRATION IS MANDATORY**, which the comment's own last clause admits.
           This is the register's signature defect in miniature and in my own text: a claim of enforcement is not an enforcement, and a reader who trusts the comment stops looking.
Response:  PARTIALLY ENFORCED, and the remainder named rather than implied.
Action:    REFUSED AT ISSUE, in `OtpIssuancePolicy.assertMarketIssuesOtp`, and again in the router before transport.
           **The router alone was the wrong place and this entry originally claimed it was enough.** S10.2's rule is "status != APPROVED forces `otp_enabled` = false" -- a refusal to ISSUE. The router runs AFTER the challenge has committed, so a REJECTED sender produced a live, verifiable, undeliverable code, a burnt 3/hour budget slot, no attempt row, and a 500 on an endpoint contracted at 202. It also had no test: no arm set `sender_registration_status`, and it was not among the six mutations. (Corrected after the Phase 3 claims audit; the issuing arm is now tested both ways -- REJECTED refuses, PENDING does not.)
           `PENDING` and `NOT_REQUIRED` are NOT refused and cannot be; whether a pending registration may serve is a per-market compliance decision, which is items 3 and 5 of S9.3's activation checklist, where a human makes it. The runbook carries it.
Ruling needed: none. Worth carrying: **when a comment says a rule is enforced elsewhere, the elsewhere is what to check.**

### D-196 - the wire cannot say "issued but not transported", and cannot say "this market is unavailable"

Severity:  MINOR (two gaps in a closed taxonomy, both handled by reuse rather than invention)
Phase:     T13 - 3
Source:    ADU-API-01 S7.1's closed code taxonomy vs ADU-AUTH-01 v2.6 S9.2, S12
Found by:  T13 Phase 3
Effect:    Two refusals v2.6 requires have no code in a taxonomy whose own header says "a code invented in a service is a code with no catalogue entry... **never a decision taken in a pull request**":
             1. **an inactive market refusing OTP** (S9.2). No `MARKET_UNAVAILABLE` exists.
             2. **a challenge issued but transported by nobody** -- every provider refused, or the only provider is down with no fallback (S7.4). The endpoint's contract is 202 and the delivery ledger holds the truth, but the caller is told nothing.
Response:  REUSED, REGISTERED, AMENDMENT OWED. The precedent is OTP_SUPERSEDED and AGE_DECLARATION_REQUIRED.
Action:    (1) raises `VALIDATION_FAILED` with `path: bootstrap` -- **the IDENTICAL refusal a device with no market already gets**, which is better than a placeholder rather than merely tolerable: an inactive market and an unbootstrapped device now answer the same thing, so the surface distinguishes nothing S17 did not already permit. A new code would have made it MORE informative.
           (2) is not raised at all: raising would tell a caller no code exists when one does.
           **TWO SENTENCES OF THIS ENTRY WERE FALSE AS FIRST WRITTEN**, and the Phase 3 adversarial pass proved both. "`OtpDeliveryService.deliver` does not throw" was true only of transport OUTCOMES -- `deliver`'s FIRST statement is `routeFor`, which raises for a market with no primary provider, a provider with no bound adapter and a REJECTED sender; and "every outcome is written to `core.otp_delivery_attempt`" was false on exactly those paths, because they precede the INSERT and leave the ledger empty. The activation runbook's own troubleshooting table contradicted the entry ("`INTERNAL` on every send in one market").
           The consequence was worse than a 500: the caller retries with the same Idempotency-Key, the stored 202 replays, and no SMS is ever sent while the client counts down. **`transport()` now catches everything and logs at error level**, so the claim is true of the entry point every caller uses; the CHECK `market_otp_requires_route` removes the commonest cause; and the ruling below is what closes it properly.
           **Correcting a claim is not the same as it having been harmless.** This is the second time in this tier that my own prose asserted an enforcement the code did not have (D-186, D-195), and the second time an adversarial pass rather than a gate is what caught it.
Ruling needed: **whether ADU-API-01 gains `MARKET_UNAVAILABLE` (403) and a delivery-failure code**, or whether both refusals stay as they are. The second matters more than it looks: today a user whose SMS was never sent waits for a message with no way to learn it is not coming.
           **And a correction to how this entry cited the taxonomy.** It quoted S7.1 as forbidding a new code "by name", splicing two sentences into one. They are separate and say different things: "A code invented in a service is a code with no catalogue entry, which renders to the buyer as a generic apology in the one moment they needed to be told what to do", and "**Adding a code within `/v1` is additive** -- old clients render it through the S7.2 fallback -- but it is a change to this document, not a decision taken in a pull request." **The document PERMITS a new code and names the route.** What it forbids is inventing one in a service. The action taken here was right; the justification misquoted the source it leaned on.
### D-197 - D-178's roles disclosure is now BOUNDED: the difference may appear only after a successful verify

Severity:  (tightens a founder-ruled disclosure; no defect was present)
Phase:     T13 - 4
Source:    WORK ORDER T13 S4; ADU-AUTH-01 v2.6 S17; D-178's ruling
Found by:  n/a -- the founder's own tightening of a ruling he had just confirmed
Effect:    D-178 ruled that `roles: ["COURIER"]` in the VERIFY response is designed disclosure: the observer holds a valid OTP for that exact number, so telling the person who controls a phone that someone invited them discloses nothing they are not entitled to.
           **The rule that makes it clean is a BOUNDARY, and a boundary needs a test on both sides.** v2.6 S17 admits no difference at all before authentication and says so with no "where practical" clause, naming OTP request, resend AND verify together. So the same value one step earlier is not a smaller version of the same decision -- **it is the opposite one.**
             BEFORE authentication   nothing distinguishes a known phone from an unknown one
             AFTER  authentication   the account's own facts are the account's to see
Response:  ASSERTED. Nothing in the product changed; the ruling was already implemented correctly.
Action:    A test added beside D-178's, not folded into it, covering three legs -- `otp/request`, `otp/resend`, and A FAILED VERIFY, which is BEFORE the boundary rather than after it and is the leg most easily mistaken for the ruled one.
           For each leg the two phones' responses are compared BY VALUE: identical status, identical body, `request_id` dropped as the only exclusion because it is a fresh uuid on every envelope and carries nothing about the phone. Then the disclosure is named -- no `roles` key and no `COURIER` anywhere in the serialised body -- so a body that gained a role for BOTH phones fails too. That second assertion is not redundant: it is the same class of leak (telling an unauthenticated caller what the platform knows about a number) and the equality alone would pass it.
           **Mutation-confirmed.** Making `otp/request` answer `roles: ["COURIER"]` when an account exists for the phone -- the real shape of the defect -- turns the test red; reverted, green. The resend leg needed the challenge rows AGED rather than deleted, because `core.session` references the challenge it was created from and the suite signs in four times before this test runs.
Ruling needed: none. D-178's ruling stands as written and is now bounded by a test rather than by a sentence.
### D-198 - BLOCKER: a raise in OTP transport, after the commit, left the caller PERMANENTLY unable to receive a code

Severity:  BLOCKER (a 500 that a correct client turns into silence forever)
Phase:     T13 - 3, found by the pass; fixed on the Phase 4 branch
Source:    apps/api/src/modules/auth/otp-delivery.service.ts; auth.controller.ts; deletion.controller.ts
Found by:  T13 Phase 3 adversarial pass (two lenses converging)
Effect:    `deliver()` is no-throw for transport OUTCOMES. It was never no-throw: its FIRST statement is `routeFor`, which raises `INTERNAL` for a market with no `sms_primary_provider`, for a configured provider with no bound adapter, and for a REJECTED sender registration -- and either attempt statement can raise on any SQL error. Every one of those happens AFTER `runIdempotent` committed the challenge AND the idempotency record.
           **The 500 was not the defect. The RETRY was.** `INTERNAL` is `retryable: true`, so a well-behaved client retries -- with the same Idempotency-Key. The stored 202 replays, `issued` is null, `transport(null)` sends nothing, and the console advances to the code step and starts a countdown for a message nobody will ever send. The console's sign-in does not remint its key on an error path, so the retry is ALWAYS a replay. That is verbatim the failure that file's own comment records as fixed once before.
           The caller has also burned one of 3 per hour per PHONE_KEY, and three such attempts in fifteen minutes lock them out for 900 seconds having received nothing.
Response:  FIXED.
Action:    `transport()` -- the entry point all four OTP paths use -- catches everything and logs at error level naming no phone and no code. A vendor outage, a misrouted market and a rolled-back challenge now all mean "no SMS, recorded", never "500 then silence".
           **And the commonest cause is removed at the level that can hold it**: migration 0043 gains `CHECK (NOT otp_enabled OR sms_primary_provider IS NOT NULL)`. Nothing tied the two before, so an operator could activate a market and forget the route -- a rule the database can hold, the database holds.
Ruling needed: none for the fix. D-196's outstanding ruling is what closes the hole properly: the wire still cannot say "issued, not transported".

### D-199 - two requests on one Idempotency-Key made the LOSER transport a challenge that had rolled back

Severity:  MAJOR (a 500 on the one path whose whole purpose is to answer gracefully)
Phase:     T13 - 3, found by the pass; fixed on the Phase 4 branch
Source:    apps/api/src/common/db/handler-transaction.ts (runIdempotent's 23505 catch); the three keyed OTP paths
Found by:  T13 Phase 3 adversarial pass (two lenses converging)
Effect:    Two concurrent requests carrying one key both pass the idempotency check and both run the closure, so both assign `issued`. The loser's `idempotency.record` raises 23505; its transaction rolls back, so its `core.otp_challenge` row never exists. `runIdempotent` SWALLOWS that and returns the winner's stored body -- correctly -- and the controller then transported the loser's `issued`, whose challenge id is gone. The attempt INSERT violated its foreign key and the caller got 500 on a request the server had already decided was a replay.
           **The base branch had the same stale `issued` and it showed as a DUPLICATE SMS with a correct 202.** The delivery layer converted a cosmetic defect into a 500 -- which is worth recording as its own lesson: adding a ledger turns silent duplication into loud failure, and that is an improvement only if the loud failure is handled.
Response:  FIXED, by the same catch as D-198, and correctly rather than incidentally: a replay MUST transport nothing, so swallowing the FK violation is the specified behaviour, not damage control.
Action:    Covered by `transport()`'s catch. The underlying stale `issued` is left as it is: the closure genuinely ran, and clearing it would need `runIdempotent` to tell its caller which branch it took -- a change to a shared primitive that four other endpoints depend on, for no behaviour the catch does not already give.
Ruling needed: none.

### D-200 - the market-activation gate blocked STEP-UP, which is exactly what D-183's ruling says suspension must not do

Severity:  MAJOR (suspending a market would have taken payout confirmation from sellers already inside it)
Phase:     T13 - 3, found by the pass; fixed on the Phase 4 branch
Source:    apps/api/src/modules/auth/otp.service.ts, issueChallenge
Found by:  T13 Phase 3 adversarial pass
Effect:    `assertMarketIssuesOtp` was called unconditionally; only the BUDGET received the `anonymous` flag. So a SUSPENDED market would have refused step-up codes to signed-in sellers -- payout confirmation, session revocation, every step-up action -- while `otp-issuance.policy.ts` argued at length, one file away, that blocking step-up is "the safeguard becoming the attack". S9.2's own words are "only ACTIVE markets may receive ordinary new OTP ISSUANCE", and D-183's ruling is "no new entry, existing trade continues, every account already there unaffected".
           **The carve-out was written for the budget and forgotten for activation** -- in the same function, four lines apart.
Response:  FIXED.
Action:    `if (anonymous) await this.policy.assertMarketIssuesOtp(...)`, matching the budget's hard limit beside it. Mutation-confirmed by the existing S16.2 arm's shape; the activation arm's own limits are recorded honestly in D-201's neighbour note below.
Ruling needed: none. Worth carrying: **when a rule has an exception, apply it to every gate the rule governs in one edit, or the second gate will be found by someone else.**

### D-201 - the attempt-row UPDATE was a blind overwrite that would have erased every delivery callback

Severity:  MAJOR (latent today; it would corrupt the ledger on the day the mechanism it was built for arrives)
Phase:     T13 - 3, found by the pass; fixed on the Phase 4 branch
Source:    apps/api/src/modules/auth/otp-delivery.service.ts, record()
Found by:  T13 Phase 3 adversarial pass
Effect:    `CASE WHEN c THEN now() END` carries an implicit `ELSE NULL`. The statement therefore wrote NULL into `accepted_at` on every non-ACCEPTED outcome and NULL into `finalized_at` on every outcome but one, and overwrote `provider_message_id` and `failure_class` unconditionally, with no guard on the row's current status.
           **The row is inserted BEFORE the vendor call specifically so an S13 callback arriving first has somewhere to land** -- and in that ordering this UPDATE runs LAST. A callback's `DELIVERED` would have reverted to `ACCEPTED`, its `FAILED_FINAL` to `DELIVERY_UNKNOWN`, its timestamps to NULL, and its `provider_message_id` to NULL, because the throw path hardcodes null for it. The design's own reason for existing was the thing that broke it.
Response:  FIXED.
Action:    `WHERE id = ... AND status = 'PENDING'`, and `coalesce` on both timestamps and both nullable columns, so the write is once-only and additive. A row already moved past PENDING is left exactly as it is.
Ruling needed: none.

### D-202 - core.platform_otp_budget was created empty and CROSS JOINed on every sign-in

Severity:  MAJOR (any environment migrated without the seed answers 500 to every OTP request, including step-up)
Phase:     T13 - 3, found by the pass; fixed on the Phase 4 branch
Source:    db/migrations/0043; ops/scripts/seed.mjs; apps/api/src/modules/auth/otp-issuance.policy.ts
Found by:  T13 Phase 3 adversarial pass
Effect:    The migration creates the table and inserts nothing; only the development seed populated it. `assertWithinBudget` CROSS JOINs it, so an empty table is not a missing setting -- it is no rows, no budget row, `INTERNAL`, on every OTP path. **A one-row table whose row is optional is a dependency nobody declared**, and the whole e2e suite silently depended on `db:reset` having run the seed.
Response:  FIXED.
Action:    The INSERT moves into migration 0043, where the table is. Values are deliberately generous rather than tuned: S16 gives no numbers, a ceiling is a business decision, and a migration inventing a tight one would throttle production on the day it ran. The activation runbook is where an operator sets the real ones.
Ruling needed: **confirm the platform ceiling** (2000 soft / 5000 hard). It is a spend decision and I have picked a placeholder.

### D-203 - anonymous OTP read its timing from the ACCOUNT's market, and the attempt budget is a countable oracle

Severity:  MAJOR (an S17 violation needing no misconfiguration -- only two markets configured differently)
Phase:     T13 - 3, found by the pass; fixed on the Phase 4 branch
Source:    apps/api/src/modules/auth/otp.service.ts, timingFor
Found by:  T13 Phase 3 adversarial pass
Effect:    `timingFor` coalesced the ACCOUNT's market over the DEVICE's on every path including the anonymous ones. `otp_max_attempts` is per-market configuration, and `verifyCode` answers OTP_INVALID until the budget is spent and OTP_ATTEMPTS_EXCEEDED after -- so **the number of wrong guesses before the 429 IS the resolved market's setting.** Two markets with different values, and counting refusals tells an unauthenticated caller which market answered, which is whether the phone has an account. `otp_ttl` leaks identically through the expiry. The attacker needs no valid code and no SMS access.
           A second arm needed no differing values at all: the refusal after the `timing_config` lookup fired when the ACCOUNT's market had no live row while an unknown phone fell through to the device's and succeeded. Nothing seeds `timing_config`, and its `EXCLUDE USING gist` leaves a gap whenever an operator rotates one.
           **This file's own header describes the oracle it had already fixed once**, in the same function, for the device-missing refusal. The account-derived VALUES were left.
Response:  FIXED, and the ruling invited rather than assumed.
Action:    Every ANONYMOUS path resolves one market -- the caller's own device's -- for timing as well as for the gates. The account's market governs only where the caller is already authenticated (step-up, `requireDevice: false`). That is the boundary D-197 states: before authentication nothing distinguishes a known phone; after it, the account's own facts are the account's.
           **Today it changes nothing**: Ethiopia is the only ACTIVE market, so the two values are always the same. It is done now because it stops being a no-op on the day a second market activates, which is the same day it becomes exploitable.
Ruling needed: **confirm that an anonymous OTP is governed by the DEVICE's market timing, not the account's.** The alternative reading -- that a person's account names their market for everything -- is defensible and is what the code said before; it cannot coexist with S17 once two markets differ.

### D-204 - six findings from the Phase 3 pass, carried rather than fixed

Severity:  (a carrying entry; individual severities below)
Phase:     T13 - 3
Source:    T13 Phase 3 adversarial pass
Found by:  the pass
Effect:    Each is real, none is fixed here, and each names why.
           1. **MAJOR -- a resend destroys a live code before delivery can fail.** `issueChallenge` expires every live challenge for (phone, purpose) INSIDE the transaction; transport happens after commit. Primary down with no fallback -- Ethiopia's configured state -- and the user is left with 202, a destroyed working code, and no new one. Not fixed because the alternative (supersede only after transport succeeds) contradicts S5.3's one-live-challenge invariant and is a design decision. **RULING NEEDED.**
           2. **MAJOR -- `assertWithinBudget` is an unindexed full-table count on the sign-in hot path.** `count(*) FROM core.otp_delivery_attempt WHERE created_at >= ...` with no index leading on `created_at`, inside the request transaction, on a table that grows with every SMS and is never purged. Not fixed because an index is a schema decision v1.14 does not carry, and nothing purges the table either. **RULING NEEDED** on both.
           3. **MAJOR -- bootstrap can place a device in a market that cannot issue OTP.** `/v1/bootstrap` orders by `is_live DESC, created_at ASC` and never reads `activation_state` or `otp_enabled`, so a device can land where the OTP gate will refuse it -- and re-bootstrapping returns the same market. Unchanged by this tier, newly reachable because of it. Rides with D-185's withdrawal of `is_live`, which rewrites that query anyway.
           4. **MINOR -- transport is awaited inline**, so a real vendor's latency becomes the 202's latency, and a failover is two vendor round-trips inside the request. The queue exists (graphile-worker); moving delivery onto it is a design change. **RULING NEEDED.**
           5. **MINOR -- nothing reconciles a PENDING or resolves a DELIVERY_UNKNOWN.** No callback route exists (no vendor), no reaper runs, and `assertWithinBudget` counts PENDING rows against the ceiling. The ledger records what WE did, never what arrived -- now stated in the file rather than implied.
           6. **MINOR -- console copy for two newly reachable refusals.** An inactive market renders as "The request is not valid", and the budget breaker's Retry-After can be up to 86400 seconds fed into a countdown written for the 30-to-900 second resend ladder. Console is a separate workstream; the API half is honest, the rendering is not yet.
Response:  CARRIED.
Action:    none in this tier beyond the record.
Ruling needed: items 1, 2 and 4 above.
### D-205 - the Phase 3 suite was substantially vacuous, and the headline claim was the only part that held

Severity:  MAJOR (a suite that certified a layer it was not testing)
Phase:     T13 - 3, found by the pass; rebuilt on the Phase 4 branch
Source:    apps/api/test/t13-delivery-layer.spec.ts
Found by:  T13 Phase 3 adversarial pass, by MUTATION rather than by reading
Effect:    The pass ran a positive control first -- inverting the failover classification turned 4 of 13 red -- so the file's headline claim held: the fakes are distinguishable and the classification is tested. **Everything else it claimed was weaker than stated.**
             1. **THE GATES COULD BE UNWIRED ENTIRELY.** Guarding both `policy.` calls in `issueChallenge` with a false condition left **487 of 487 tests in the repository green.** Tests 8-11 called the policy directly on the injected provider and nothing asserted that the production path calls it. Asserting a unit and asserting that anything USES it are different things -- this register's oldest defect class in a new costume.
             2. **The SUSPENDED-market test was vacuous by construction and cannot be written as intended.** The fixture was `SUSPENDED` AND `otp_enabled = false`, two sources agreeing; and `market_otp_requires_active` makes the discriminating row (non-ACTIVE with OTP enabled) IMPOSSIBLE TO INSERT. Deleting the service's `activation_state` clause left all 487 green, and always would.
             3. **The seeded-Ethiopia test was a tautology that could not pass in CI.** It asserted the four values `ops/scripts/seed.mjs` writes, in the same commit, with no production code executing -- and `pnpm db:seed` is not in the gate list, so it was green locally only because someone had run `db:reset`.
             4. **Soft and hard were indistinguishable** (both set to 1), so turning the soft ALERT into a control -- the one thing its own comment forbids -- passed. **The global ceiling was asserted by nothing**: deleting the `Math.min` against it passed, and a market with NULL limits then has no ceiling at all.
             5. **The primary provider column was never varied.** A router that ignored `sms_primary_provider` and hardcoded AFROMESSAGE passed every test. "Routing comes from market configuration" was verified for the fallback half only.
             6. Two "an already-issued code is untouched" assertions re-read a row the test had inserted three lines earlier, and nothing in the code under test can write `core.otp_challenge` -- unfalsifiable. The same-code assertion compared one object to itself: `message()` builds one object and `deliver` hands the SAME REFERENCE to both attempts.
Response:  REBUILT. 13 tests became 22, and every gap above is now mutation-proven.
Action:    End-to-end arms drive `/v1/auth/otp/request` against a device in a non-issuing market and against a crossed hard limit, so unwiring the gates is caught. The SUSPENDED claim is asserted WHERE THE INVARIANT LIVES -- the CHECK constraint is exercised directly, and the service clause is documented as defence against that constraint being dropped rather than as a second enforcement. The seed tautology is replaced by the migration's own defaults (`UNREVIEWED`, `otp_enabled false`, providers NULL) plus the gate refusing them, which is production shape and needs no seed. Soft is separated from hard; the global ceiling is exercised with the market's limits NULL; the primary column is varied to INFOBIP/TWILIO; the budget arms create their own spend instead of relying on ambient rows; and the market row is restored in `beforeEach` rather than in each `finally`, because a jest timeout aborts a body mid-await and `finally` does not save the next test.
           **Nine mutations, eight caught by the tests and one recorded as uncatchable** (the activation clause, for the reason in item 2). The unwiring mutation is written in a form that TYPE-CHECKS, because an earlier attempt was caught by `tsc` rather than by a test and that proves nothing about the suite.
Ruling needed: none. Worth carrying: **run the positive control first.** The pass believed its own null results only because inverting the classification turned four tests red before it started.

### D-206 - a concurrent adversarial agent's restore silently reverted a BLOCKER fix in the working tree

Severity:  MINOR (process; caught within the hour, but it is the shape that matters)
Phase:     T13 - 3/4
Source:    the adversarial pass method itself
Found by:  a test failing for a fix that had been applied and verified
Effect:    Five review agents ran against the SAME working tree while I was editing it. Two of them applied source mutations and restored from a snapshot they had read earlier -- and one of those restores overwrote `otp-delivery.service.ts` with a copy that PREDATED D-198's fix. The `transport()` catch simply vanished. Two agents also reported reading a version of `otp-issuance.policy.ts` that never existed in any commit, which is the same collision seen from the other side.
           It surfaced because a test I had just written failed. **Had that test not existed, the BLOCKER fix would have been silently absent from the commit** -- and the commit message would have claimed it.
Response:  RECOVERED, and audited.
Action:    Every fix from the pass was checked individually against the tree rather than assumed present; one of twelve was missing and was reapplied. This is T11's mirror rule arriving from a new direction: **a restore that is not proven in force un-tests the fix**, and here the restore was someone else's.
           The method changes: review agents may READ the working tree, and anything that MUTATES it must either run on its own copy or run when nothing else is writing. The mutation passes I run myself already assert their own restores; that is not enough when a second writer exists.
Ruling needed: none.
### D-207 - RESOLVED (ADU-RUL-06 S2): the challenge is stamped, not resolved -- D-180, D-193, D-203 are one column

Severity:  (implements a founder ruling; the underlying defects were MAJOR)
Phase:     T14 - A3
Source:    ADU-RUL-06 v1.0 S2; WORK ORDER T14 S3; migration 0044
Found by:  three lenses across T13, unified by the ruling
Effect:    Three defects found separately were one: a value the challenge should have carried was re-resolved later, from a source that could differ. Audience from the verify body (D-180); the attempt budget from a live market lookup, and the market from the ACCOUNT (D-203); per-market spend unattributable because nothing named a market (D-193).
Response:  BUILT. migration 0044 adds core.otp_challenge.market_id and max_attempts; audience (0043) is now written at request and read at verify.
Action:    issueChallenge STAMPS audience, market and max_attempts at creation. verifyCode and verifyChallengeById READ the row and resolve nothing -- no timingFor, no market lookup on any verify path. The attempt budget is the stamped one; the lockout counts each row against its own stamped budget. Spend is attributed through otp_challenge.market_id, so D-193's per-market counting is exact rather than the conservative platform-wide over-count T13 shipped, and a NULL-limit market is bound by the global ceiling alone. A pre-0044 row (max_attempts NULL) is answered EXPIRED -- true, since a resend stamps, and the window is one TTL wide.
           The controller REJECTS an audience field at verify by name (S31.1's third test), rather than letting zod strip it: a field silently discarded is a field a client keeps sending, and this one decided which surface a session was minted for. Device coherence now rests on the CHANNEL the id arrived through (cookie vs body), which a caller cannot fake, and the challenge's stamp -- not on a body audience the caller fills in. t14-a3-stamped-audience.spec.ts pins S31.1's three arms; the sweep updated 8 suites (audience moves from verify to request).
Ruling needed: none. Built to the ruling.

### D-208 - S5.3's live-challenge tuple is (phone, purpose, AUDIENCE), and supersession does not yet honour the third term

Severity:  MINOR (a behaviour narrower than the spec permits, not a leak; PARKED per T14 S0.1)
Phase:     T14 - A3
Source:    ADU-AUTH-01 v2.6 S5.3; WORK ORDER T14 S3's "[!] Check S5.3's tuple" -- flagged as a SECOND finding
Found by:  the order, while ruling the stamp
Effect:    S5.3: "Exactly one live challenge exists for the applicable (phone, purpose, audience) tuple." Before 0044 the audience was not stored, so supersession and the live-challenge lookup keyed on (phone, purpose) ALONE -- expiring across audiences. That is NARROWER than the spec, not weaker: a person requesting a CONSOLE code killed their live MOBILE code, when the tuple says the two may coexist.
           Now that audience IS stamped, per-audience supersession is POSSIBLE for the first time. This tier did not take it: issueChallenge's supersede and verifyCode's live lookup still key on (phone, purpose), which is the pre-existing, conservative behaviour and changes nothing I built.
Response:  PARKED. The stamp is the prerequisite; whether to use it here is a behaviour change and a ruling.
Action:    none this tier.
Ruling needed: SHOULD supersession and the live-challenge lookup scope to (phone, purpose, audience)? It would let a person hold a live MOBILE and a live CONSOLE code at once -- useful for someone signing in on both, and exactly what the tuple describes. The cost is that a stale code on the other surface stays live for its TTL. Founder call.

### D-209 - the platform-scoped mint limiter (ADU-RUL-06 S6, D-192)

Severity:  (implements a founder ruling)
Phase:     T14 - A6
Source:    ADU-RUL-06 v1.0 S6; WORK ORDER T14 S6
Found by:  the T13 Phase 3 pass (D-192), ruled by the founder
Effect:    /v1/bootstrap's device-mint limiter keyed on req.ip, and nothing sets Express trust-proxy, so behind a proxy it was a platform-wide counter WEARING a per-IP label. The ruling: make it platform-scoped on purpose, at a ceiling sized for the platform.
Response:  BUILT.
Action:    The consume call keys on a FIXED subject ('platform', DEVICE kind) rather than req.ip, ceiling 50000/hour -- far above any plausible beta hour, orders of magnitude below the measured ~230 rows/second flood. Recorded as the SECOND platform-scoped control beside core.platform_otp_budget, in the code and here. When S15.1's trusted-proxy work lands it becomes per-IP at this ceiling, a config change not a redesign.
           NOT a new subject_kind enum value: PLATFORM would be a schema + Appendix A + check-16 change out of this phase's scope. The DEVICE kind is honest (this counts device minting) and the constant id says in the row that there is one subject. `subjectHash` and `rateLimitKey` fell out of bootstrap.controller unused and were removed.
Ruling needed: none. Worth carrying: a limiter that collapses to one subject behind a proxy should collapse there BY DESIGN, so it bounds what it counts honestly instead of lying about the label.

### D-210 - the transcription gate, and it caught its own parser before it ever compared anything

Severity:  (a gate, closing "the migration is the only witness to itself")
Phase:     T14 - A6
Source:    WORK ORDER T14 S6; ops/scripts/verify-transcription.mjs
Found by:  the order asked whether a transcription gate landed in T13 -- it did NOT (I said I would add one and the register/gate list show none)
Effect:    Migration 0043 transcribes ADU-AUTH-01 v2.6's delivery layer and nothing compared the migration to the document, so a dropped value or renamed status would ship green.
Response:  BUILT and widened per S6: five enums (four fenced-value blocks plus S6.1's provider set), the six delivery statuses exactly, S12.1's ten fields on core.otp_delivery_attempt, and S9.1's fifteen columns on core.market (three renamed, mapped by name). Compared LIVE SCHEMA against INSTALLED DOCUMENT, both ways.
Action:    IT ASSERTS ITS OWN PARSE FIRST, which is the anti-vacuity requirement S6 states: a gate that finds nothing compares empty to empty and goes green the day the document changes shape. Each section's fenced block must yield at least (or exactly) the expected count before any comparison runs.
           The self-check earned its place immediately: S12.1's field list is the SECOND fenced block under the heading (the first is the table name), and the parser took the first -- zero fields. Rather than compare nothing and pass, the gate FAILED its own self-check and named the shape mismatch, which is how I found the bug. Fixed (fencedAfter takes an occurrence index).
           Proven red from BOTH sides: a value removed from the document (FAIL: document names X, database does not), a value removed from the live enum (FAIL: database has X, document does not). Green against a clean db:reset. Appended to gates.mjs by name; 25 gates now.
Ruling needed: none.
### D-211 - RESOLVED (ADU-RUL-06 S5): transport before supersession -- a failed resend no longer strands two dead codes

Severity:  (implements a founder ruling; the underlying defect was the two-dead-codes hole D-204.1 named)
Phase:     T14 - A4
Source:    ADU-RUL-06 v1.0 S5; WORK ORDER T14 S4; migration 0045
Found by:  D-204.1, ruled by the founder
Effect:    issueChallenge superseded the prior code AT MINT -- expired it the instant the new one was inserted, before the new one was transported. A resend whose delivery then failed (Ethiopia's configured no-fallback state, a vendor outage) left TWO DEAD CODES: the old destroyed, the new undelivered, a late-arriving first SMS worthless.
Response:  BUILT. migration 0045 adds core.otp_challenge.transported_at; supersession moves to transport ACCEPTANCE.
Action:    issueChallenge no longer supersedes at mint; the new challenge is minted with transported_at NULL -- not verifiable, superseding nothing. The delivery service calls OtpService.markTransported the moment a provider ACCEPTS (attempt 1 OR the failover attempt 2), which in one place marks the accepted challenge transported and expires every sibling live challenge for (phone, purpose). verifyCode and verifyChallengeById require transported_at IS NOT NULL to treat a row as the live code.
           SO A FAILED RESEND LEAVES THE PREVIOUS CODE LIVE: the new challenge never becomes verifiable, the old is never expired. Exactly one verifiable challenge at every instant, which is what S5.3 protects -- and validity is gated on the CHALLENGE's own transported_at, NOT on otp_delivery_status, because S12.2 forbids deriving validity from transport status. markTransported is two statements rather than a data-modifying CTE against the same table (the CTE left siblings un-expired in practice; the two-statement form is unambiguous and the window between them is safe -- a verify landing in it sees the old code still live).
           t14-a4-transport-supersession.spec.ts pins four arms: un-transported not verifiable, acceptance makes it verifiable, a FAILED resend leaves the previous code live, a SUCCESSFUL resend supersedes at acceptance. Rides with D-198's transport catch, as the ruling said it would.
Ruling needed: none. Built to the ruling. (D-208 -- whether supersession should also scope to audience -- remains parked; this tier scopes it to (phone, purpose), unchanged.)
### D-212 - BLOCKER-adjacent MAJOR: markTransported could zero out both codes -- a targeted sign-in/step-up DoS

Severity:  MAJOR (a transient auth denial an attacker can aim at a victim's public phone number, <=3/hour)
Phase:     T14 - A, found by the pass on #49
Source:    apps/api/src/modules/auth/otp.service.ts, markTransported (ADU-RUL-06 S5)
Found by:  the Phase A adversarial pass (transport-gating lens)
Effect:    markTransported enforced "exactly one verifiable challenge at every instant" in TWO unlocked autocommit statements: mark self transported, then expire siblings. Two accepted deliveries for one (phone, purpose) interleaving as C1.mark, C2.mark, C1.expire(C2), C2.expire(C1) left BOTH expired -- zero verifiable codes -- even though a provider ACCEPTED and the SMS went out.
           Reachable: two concurrent POST /auth/otp/request with DIFFERENT Idempotency-Keys both pass (the phone limit is consumed on a separate connection), both issue, both transport. Aimed at a victim mid-sign-in, it zeroes their real code. Same shape on /auth/step-up/request -> payout-change step-up denial. The DB did not backstop it: 0045's otp_challenge_live index is non-unique, and a unique "live" index is impossible because the predicate needs expires_at > now(), which is not IMMUTABLE.
           The in-code comment reasoned only about a concurrent VERIFY in the inter-statement window and called it safe; it never considered a concurrent second markTransported, which was the actual hazard. My "the tiny window is safe" was wrong.
Response:  FIXED.
Action:    markTransported is now one TRANSACTION, serialized per (phone, purpose) by pg_advisory_xact_lock, and NEWEST-WINS: a code that finds a newer transported sibling expires ITSELF; otherwise it marks transported and expires every other transported-live sibling (all necessarily older). Exactly one verifiable at every instant, never zero. t14-a4 gains a CONCURRENCY arm that fires two deliveries with Promise.all and asserts exactly one live challenge survives and verifies; run three times, stable.
Ruling needed: none.

### D-213 - the device-channel "cannot be faked" claim was false, and the MOBILE arm lacked the account-binding the CONSOLE arm had

Severity:  MAJOR (an overstated security claim) + MINOR (the missing account clause)
Phase:     T14 - A, found by the pass on #49
Source:    apps/api/src/modules/auth/auth.controller.ts, auth.service.ts (deviceUnusable)
Found by:  the Phase A adversarial pass (surface-conversion lens)
Effect:    THE INVARIANT THAT MATTERS HOLDS and the pass confirmed it: a MOBILE-stamped challenge mints only a MOBILE session and CONSOLE only CONSOLE (S5.2), and every session is the phone's own account, OTP-gated -- no device trick crosses an account.
           WHAT I CLAIMED FALSELY: that the device CHANNEL (cookie vs body) "cannot be faked" and "no longer depends on the caller's honesty". A __Host- cookie is httpOnly to browser JS, but any raw HTTP client reads its own bootstrap Set-Cookie and can present it, and a browser can omit its cookie and send a body device_id. So a caller can self-select which surface's credential FORM it receives FOR ITS OWN ACCOUNT. That is a limitation inherent to not being able to attest a client TYPE -- the same limitation the pre-stamp design had -- not a property the channel provides. This is the register's recurring defect (a claim of enforcement stronger than the code) in my own comment.
           And the MOBILE arm of the coherence check omitted the account-binding clause the CONSOLE arm enforced: a MOBILE verify naming a body device bound to ANOTHER account minted a session anchored to a stranger's device row (no cross-account access; a D-64-residue mis-anchoring).
Response:  CORRECTED and FIXED.
Action:    The comments now state what actually holds (the challenge->session audience binding and the account boundary) and what does not (client-type attestation, which is not achievable here). The account-binding clause is hoisted to apply on BOTH audiences. t14-a3 gains an arm proving a stranger-bound device is refused on the MOBILE path and no session is anchored to it.
Ruling needed: none for the fix. Worth carrying for the founder: the surface separation cannot be made client-type-attested over HTTP; if that property is wanted, it needs a mechanism the current design does not have (e.g. attested app integrity), and that is a decision, not a bug.

### D-214 - the transcription gate was one-directional where it claimed "both ways", and checked the provider enum against a constant

Severity:  MINOR (a gate weaker than its own header claimed -- two real misses)
Phase:     T14 - A6, found by the pass on #49
Source:    ops/scripts/verify-transcription.mjs
Found by:  the Phase A adversarial pass (claims-audit lens)
Effect:    Two constructible misses, both in the gate I built to close "the migration is the only witness to itself":
             1. core.sms_provider was asserted against a HARDCODED ['AFROMESSAGE'...] constant, not parsed from the document. A change to S6.1's router promoting a provider would not be caught -- the gate compared the migration to a copy of the migration, the exact defect it exists to abolish.
             2. the S12.1 field and S9.1 column checks were DOCUMENT -> DATABASE only, so an EXTRA database column was invisible, while the header claimed "both ways".
           The header also said "five enum blocks" when four are parsed (the fifth was the constant).
Response:  FIXED where a fix is sound, and made HONEST where it is not.
Action:    Providers are now PARSED from S6.1's router config (the UPPER_SNAKE values after Primary =/Fallback =), compared both ways -- proven red by promoting a router provider the DB lacks. core.otp_delivery_attempt is now bidirectional, because the table IS exactly S12.1's field set. core.market STAYS document->database and the header SAYS SO: S9.1 is "configuration similar to", a subset of the market table, so an extra market column is not a drift. The "five blocks / both ways" header is corrected to state directionality per check.
Ruling needed: none. Worth carrying: a gate's header is a claim like any other, and "both ways" is false the moment one direction is a filter that only runs one way.
### D-215 - RESOLVED (ADU-RUL-06, D-183): is_live is withdrawn; every market resolution reads activation_state = 'ACTIVE'

Severity:  (implements a founder ruling; the underlying overlap was D-104/D-183's)
Phase:     T14 - A5
Source:    ADU-RUL-06 v1.0 (D-183 ruling); WORK ORDER T14 S5; migration 0046
Found by:  D-183, ruled by the founder
Effect:    is_live and activation_state were two truths about one market, and is_live was the one deciding which market a new account joins (D-104's territory, which v2.6 never mentions). One boolean cannot express SUSPENDED -- no new entry, existing trade continues -- and activation_state can.
Response:  BUILT. migration 0046 drops core.market.is_live and moves the 12.2.1 guard onto activation_state.
Action:    fn_guard_market_live now fires on the transition INTO activation_state = 'ACTIVE' (was: setting is_live), same invariant, same ERRCODE, and check 13 confirms it stays attached. The two D-116 readers move to `WHERE activation_state = 'ACTIVE' ORDER BY created_at ASC`: /v1/bootstrap and orders.service's cart resolver. The seed stops writing is_live; ~35 test fixtures had it removed (30 by a shape-A sweep, 5 hand-fixed where the column sat mid-list or the value aligned to created_at).
           THE STRUCTURAL TEST IS EXTENDED as the order required: beside the existing assertion that the AUTH path reads no market, a new arm pins that the two readers read `activation_state = 'ACTIVE'` and never is_live. Its own filter now strips SQL line-comments too, because a `-- is_live withdrawn` note in a reader would otherwise trip it.
           `db:determinism` converges (11,625 lines), Appendix A/pg_type unchanged (dropping a column changes no type or table count), 507 API tests green from a clean reset.
Ruling needed: none. Built to the ruling. SUSPENDED now means what it should: no new OTP and no new device assigned there (the issuance gate, D-207's neighbour), while every account already in the market is unaffected.
### D-216 - the is_live sweep missed two writers outside apps/api/test, and left three drift artifacts

Severity:  MAJOR (two runtime-raising writers) + MINOR x3
Phase:     T14 - A5, found by the pass on #50
Source:    the sweep's scope; ops/load/db-loads.mjs; apps/api/test-load/api.loadtest.ts
Found by:  the Phase A5 adversarial pass (both lenses converged on the load files)
Effect:    1. TWO LEFTOVER WRITERS raised `column "is_live" does not exist` the moment they ran: apps/api/test-load/api.loadtest.ts and ops/load/db-loads.mjs. They survived because jest's testRegex is `.*\.spec\.ts$` and the load harness is `.loadtest.ts` / a manual `.mjs` -- so the gated suite stayed green while the load path was broken. My "~35 test fixtures" scope and the "507 passed, clean reset" evidence BOTH stopped at apps/api/test, and the pass named the gap: 507-green cannot vindicate files the runner never loads.
           2. The generated type apps/api/src/common/db/database.types.generated.ts still declares is_live on CoreMarket. Nothing in src reads `.is_live` (0 occurrences), so no runtime break and no gate (codegen freshness is ungated) -- but it contradicts the drop.
           3. ADU-DB-01 v1.14's prose still lists is_live as a live column (S5.1's core.market table) and still shows the old guard body (S9.1), while the same document's S30b.3 RULES the withdrawal. verify:appendix compares only TYPES and TABLE COUNTS, and dropping a boolean changes neither, so a column-level drift is invisible to it -- the "prose nothing executes will drift" hazard the document names about itself.
           4. bootstrap now 503s when NO market is ACTIVE (it filters activation_state = 'ACTIVE'); before, `ORDER BY is_live DESC` with no WHERE always returned some market. Latent in Phase 1 (one ACTIVE market), but it means a fully-SUSPENDED single-market deployment refuses /v1/bootstrap for everyone -- which sits awkwardly beside the ruling's "SUSPENDED: existing trade continues".
Response:  1 and the comment FIXED; 2, 3, 4 handled honestly.
Action:    (1) is_live removed from both load writers -- proven zero remain in load-path SQL. The t8-device-bootstrap comment corrected: its market is ACTIVE now, and isolation rests on the SEED market being the oldest ACTIVE (created by db:seed before any test), so bootstrap resolves SEED and never a test market -- the same outcome as when both were is_live=false and ordering fell through to created_at.
           (2) kysely-codegen mis-connects in this Windows shell (it introspected a 114-table database while the live schema, verified by pg, has is_live dropped and 0044-0046 applied), so the file was NOT regenerated to a wrong 114-table shape and NOT hand-edited (root CLAUDE.md forbids editing generated files). CI codegen against a correctly-migrated database removes the one stale line; nothing reads it meanwhile.
           (3) is ADU-DB-01 v1.15's prose, which WORK ORDER T14 S9 assigns to the founder ("mine, not yours"). Recorded here so v1.15 removes is_live from S5.1 and updates S9.1's guard body to activation_state.
           (4) PARKED as a ruling, below.
Ruling needed: SHOULD /v1/bootstrap serve a returning device from its OWN (possibly SUSPENDED) market rather than 503 when no market is ACTIVE? Today the market lookup runs unconditionally and picks the oldest ACTIVE; a returning device could instead be served from its device.market_id, making "existing trade continues" true for a suspended-market deployment while new-device minting still requires ACTIVE. It is a bootstrap change beyond this column withdrawal, so it is parked rather than folded in.
### D-217 - the API test gate flakes under default parallelism on a single shared Postgres

Severity:  MINOR (test infrastructure; environmental, not a product or test-logic defect)
Phase:     T14 - A (observed across the tier's gate runs)
Source:    apps/api jest default worker count vs one shared local Postgres
Found by:  repeated ci:local runs late in a very long session
Effect:    ci:local's `test` gate intermittently reports a suite "failed to run" or one-off assertion failures under the DEFAULT jest worker count (cores-1), and a DIFFERENT suite fails each run -- t8-market's enumeration, E4 retention, t6-purchase-intent, t8-device + t14-a3 have each flaked once. EVERY implicated suite passes in ISOLATION, and the full suite passes 507/507 from a clean reset at `--maxWorkers=2`. The cause is contention on one local Postgres (connections, transaction load, the per-(phone,purpose) advisory lock added in D-211) when a dozen workers hammer it -- worsened by a machine that has run db:reset and the full suite dozens of times across the session.
           It is NOT introduced by this tier: the shared-DB/parallel-worker tension is documented in several suites' own teardown comments (D-124, D-179), the failing suites are mostly unrelated to the auth changes (slug, retention, purchase-intent), and #49's and #50's FIRST ci:local runs both passed all 25 gates cleanly before the machine accumulated load.
Response:  Recorded; each affected commit verified by the equivalent commands rather than a single flaky ci:local.
Action:    The tier's gates are confirmed green by running the post-test gates individually (determinism, permission-doc, docs-ascii, db:check, deferred-values, appendix, orphan-sweep, transcription, mt-keys all PASS on the current tree), the pre-test gates via ci:local's own sequence up to the test gate, and the full API suite at `--maxWorkers=2` (507/507 from clean). A claim of "all 25 gates" in a commit names those commands rather than a single ci:local when the flake bit.
Ruling needed: none required to proceed. Worth carrying for whoever hardens CI: cap the API test gate's workers, or give it its own database, so the gate measures the code and not the machine. A gate that fails on load rather than on logic teaches people to re-run rather than to read.
### D-218 - C-5 catalogue: five regions ADU-CON-03 v1.2 asks for that the catalogue endpoints do not supply

Severity:  (build-against-absence, per T14-C S5.1 and ADU-CON-03 v1.2 S17 -- each inference registered, not absorbed)
Phase:     T14-C - C-5
Source:    apps/console/src/features/catalogue/*; contracts/openapi.json
Found by:  building SC-07..SC-11 against the committed contract
Effect:    The catalogue endpoints are schema-less in the contract (the D-98 class), and the SERVICE shapes they actually return omit fields the screens specify. Each region below is built against the absence and NAMED on screen, never faked and never silently dropped. (AMENDED on this unmerged branch -- the D-134 precedent -- after the C-5 pass proved the first version of this sentence false for regions 2-4, which were named only in code comments. The naming is real now, one key each: region 2 `products.row_summary_owed`, region 3 `variants.labels_owed`, region 4 `stock.confidence_owed`; regions 1 and 5 were named from the start.):
             1. SC-07's CAP COUNTER. `GET /v1/seller/products` returns no effective limit, and the console computes no business state, so it cannot derive "N of 10" from the tier -- and "N of unlimited" is the bug report S8 warns about. Rendered as a plain statement that the server owns the limit; it becomes "N of M -- <what binds>" when allowed_actions / an effective-limit field lands (D-155).
             2. SC-07 per-row VARIANT COUNT, AGGREGATE STOCK + CONFIDENCE, PRIMARY IMAGE. Absent from the list shape; fetching each product to compute them is the N+1 the payload budget forbids. The row shows name, publication state and price; the editor (SC-08) carries the rest and the row links to it.
             3. SC-09 variant ATTRIBUTE LABELS. getProduct returns each variant's `variant_key` (the canonical serialisation), not its defining attributes as labelled values, so a variant reads by its key rather than "Size: L, Colour: red". Splitting a key back into attributes on the client is guessing at a format the server owns.
             4. SC-11 stock CONFIDENCE LEVEL and its per-tier consequences. These are the server's v_stock_confidence and entitlement; neither the product read nor the stock endpoints return them. The screen shows stock_confirmed_at as a fact and does NOT derive a level (computing business state) or name a consequence a tier cannot experience (S4.3).
             5. SC-08 the STRUCTURED-ATTRIBUTE editor (the two-layer descriptive/variant-defining distinction) needs the category attribute_definition catalogue the read does not return; name and description are editable, the structured editor is registered as owed.
Response:  Built honestly; each gap is stated in the screen's own copy and registered here.
Ruling needed: none new. All are the D-155 family (the console renders what the server resolved, and the server does not yet resolve these). When `allowed_actions` and richer list/variant reads land, these regions fill in without a redesign.

### D-219 - C-5: the media UPLOAD pipeline (browser resize + signed PUT + commit) is a subsystem, deferred with the section stated

Severity:  (a named owed piece within a built stage, not a defect)
Phase:     T14-C - C-5
Source:    apps/console/src/features/catalogue/Media.tsx
Found by:  building SC-10
Effect:    SC-10 requires an image upload that resizes to THREE derivatives IN THE BROWSER, signs a PUT per derivative (REQUEST_UPLOAD), then COMMITs -- canvas resize, three PUTs, progress across them. It is a real client subsystem, larger than the rest of SC-10 combined. The Media section renders and manages the media that EXISTS (display, delete, whole-order reorder in one request per the UNIQUE(product_id, position) rule) and states the upload as not-yet-on-this-screen rather than stubbing a control that pretends to work.
Response:  Media display/delete/reorder built and rendered; the upload pipeline is its own unit.
Ruling needed: none. Worth carrying: an upload control that looked done would be worse than its honest absence -- a seller who taps it and nothing lands learns the screen lies.
### D-220 - v1.15 RULES two parked items, and their service half is now owed: D-208 and D-216.4

Severity:  (two founder rulings landing inside an installed document; implementation owed, out of T14-C's scope)
Phase:     T14-C - install
Source:    docs/ADU-DB-01_Database_and_Data_Model_v1_15_ASCII.md S30b.7 and S30b.3
Found by:  installing v1.15
Effect:    Two items this register carried as PARKED are ruled by the newly installed data model, and the code does not yet do either:
             1. S30b.7: "RULING D-208 -- audience joins S5.3's one-live-challenge tuple. The rule always read (phone, purpose, audience) and the column did not exist, so the rule was never wrong -- only unimplementable. Stamping makes it expressible." The build still supersedes and selects the live challenge by (phone, purpose): issueChallenge's supersede-at-acceptance sweep and verifyCode's live lookup both omit audience. Implementing it lets one phone hold a live MOBILE and a live CONSOLE code at once, which is what the tuple describes.
             2. S30b.3: "RULING D-216.4 -- bootstrap SERVES a returning device from a SUSPENDED market. It does not 503... Only the assignment of a NEW device is refused." The build's bootstrap resolves the oldest ACTIVE market UNCONDITIONALLY, so a deployment whose only market is SUSPENDED refuses /v1/bootstrap to everyone -- including a returning device the ruling says must be served from its own market.
Response:  REGISTERED as owed, not implemented here. T14-C's scope is the console (its S0 table and S6 not-in-scope list); folding two auth/bootstrap service changes into a console stage would be the scope creep the stage-per-PR rule exists to prevent. Both are small, bounded backend changes with the rulings' text as their acceptance criteria.
Ruling needed: none -- both ARE the rulings. What is owed is the service half of each, in the next backend slot, with tests: (1) two live challenges, one per audience, each verifiable only through its own door; (2) a returning device served from a SUSPENDED market while a NEW device is refused assignment into it.
### D-221 - the C-5 pass: the happy path was built against the spec, the error path against nothing, and the e2e walked only the happy path

Severity:  4 BLOCKERs + 7 MAJORs, all in-phase, ALL FIXED before the stage was left for merge
Phase:     T14-C - C-5, found by the adversarial pass on #52
Source:    apps/console/src/features/catalogue/*
Found by:  the pass, by tracing the wire and the error paths -- tsc and eslint were clean throughout, which is exactly why it shipped
Effect / Response, each:
  B1 FIXED   Media reorder sent `[{id, position}]` where the server takes `order: string[]` (ids in order, positions assigned 1..n). EVERY reorder 400'd and the failure rendered nothing -- the feature had never worked against the real API, and the e2e never clicked it, so it shipped green. Now: id-array body, moves operate on DISPLAY INDEX (immune to the position gaps deletes leave -- the server does not renumber on delete), and any reorder renumbers contiguously. The thumbnail label follows position 1 and the copy says when no image holds it.
  B2 FIXED   Mutation VALIDATION and 403 rendered NOTHING: ScreenState's VALIDATION branch is null without validationErrors and NO_PERMISSION is null by design -- right for a screen, wrong for a tapped button. Every catalogue mutation failure now renders a ProblemBanner (title from message_key, visible-key fallback).
  B3 FIXED   ProductEditor's READY branch never rendered `problem`; a failed save or unpublish was silent. The banner renders above the fields now, and stale publish blockers clear on reload.
  B4 FIXED   `Number('') === 0`: clearing the stock field and tapping Set count ZEROED a live variant's stock, and a blank price created a 0.00 product/variant, all silently. Blank or non-numeric input now REFUSES with a field error that says "a blank count/price is not zero".
  M1 FIXED   Two per-click `crypto.randomUUID()` idempotency keys (PATCH product, PUT reorder) -- keys minted on click violate the mount-minted rule, AND neither call needs a key: ADU-API-01 S8 requires one on state-changing POST and nothing else. Both dropped; lib/idempotency.ts's "one call" claim is true again.
  M2 FIXED   SC-07 rendered its header, cap note, New-product link and filter row around a null list on 403. S3.4: NOTHING renders. Early return null on NO_PERMISSION.
  M3 FIXED   by B1's index-based moves (the position-keyed swap died on the gaps deletes guarantee).
  M4 FIXED   SC-11's specified route (/products/:productId/stock) did not exist while the router's comment said it did -- a deep link fell through the catch-all to Home, the D-146 class the router lectures about. StockScreen added and routed.
  M5 FIXED   Publish blockers rendered RAW CODES ("NO_IMAGE") while the server sent message_key and the English existed -- and the button stayed enabled. Messages render via the catalogue (visible-key fallback), publish disables while blockers stand, and TIER_/LEVEL_LIMIT_REACHED messages are the one place the server says which limit binds -- no longer thrown away. AND the first REAL 409 the arm drew showed the message_key alone is not enough: every readiness item shares the one generic sentence, so five different blockers rendered five identical lines. The distinguishing fact is slots.item, and it is SC-01's own vocabulary -- ITEM_LABEL moved from Home.tsx to lib/readiness.ts (one mapping, not a second copy) and a blocker carrying slots.item renders its readiness label. Links per item ride on resolving_action when the payload carries one; registered otherwise.
  M6 FIXED   D-218's "named on screen" was false for 3 of 5 regions (code comments are not a screen). The three on-screen lines exist now and D-218 is amended to name their keys.
  M7 FIXED   No price was editable anywhere after creation -- the one PATCH the spec lists (price on the variant) had no control. Per-variant price editing added.
  minors     filtered-empty state added (S3.2); slot filling moved to fillTemplate; Stock's permission comment corrected to seller.stock:read; the stock-input clobber-on-refetch accepted as a known MINOR.
  B5 FIXED   found by the arm's own first run, which is the point of the arm: createProduct returns { product_id } and ProductNew read `created.id` -- every create navigated to /products/undefined, whose GET 400s, and the malformed-URL load renders BLANK (a 400 maps to VALIDATION, which S3.4 defines as field errors + summary, so a fieldless load-400 renders null). The shape is fixed and create lands in the editor. Which of the twelve states a LOAD-time 400 should render is a vocabulary question S3.4 does not answer for GETs -- PARKED, not invented; until ruled, a hand-mangled product URL renders an empty main inside the shell.
  e2e        extended with a SELF-CONTAINED mutation arm -- create a product, add a variant, refuse a blank price, set stock (asserting the count and the history event), refuse a blank count, confirm stock, and publish -- which the REAL server 409s, because the seed satisfies four of nine readiness items (its product was published by SQL, never through fn_publish_product): the arm asserts the blockers render as readiness LABELS, never raw codes, and publish disables. A second, PLANTED 409 (the upgrade-required.spec.ts pattern) covers the shapes the seed cannot produce: a LEVEL_LIMIT_REACHED message and an item with no slots.item. All on products no other test touches, so the arm cannot race the render tests. The arm caught B5 on its very first run.
Ruling needed: none. Worth carrying, in the pass's own words: THE HAPPY PATH WAS BUILT AGAINST THE SPEC, THE ERROR PATH WAS BUILT AGAINST NOTHING, AND THE E2E ONLY WALKED THE HAPPY PATH. A green tsc, lint and e2e certified a reorder that had never once succeeded against the real API.

### D-222 - the install audit: two live authority files still named superseded documents, and three record defects

Severity:  MAJOR (a fail-closed spec-router reading superseded baselines) + MINORs
Phase:     T14-C - install, found by the audit on #52
Source:    .claude/reference/DOCUMENT_AUTHORITY.md; apps/api/CLAUDE.md; db/migrations/0046; docs/amendments/README.md; docs/ADU-DB-01 v1.15
Found by:  the install-audit lens
Effect / Response:
  1 FIXED    DOCUMENT_AUTHORITY.md -- the spec-router's own input, whose rule is "use exact filenames" -- still named v1.14 and v1.7 as binding (and v1.13 in one line, stale two revisions before this install), and carried no ADU-CON-03 at any version. A fail-closed session routed to superseded text or MISSING_SOURCE. Advanced to v1.15/v1.8; CON-03 v1.2 and RUL-06/07 added.
  2 FIXED    apps/api/CLAUDE.md declared v1.14/v1.7 governing; the console CLAUDE.md's C-4 section cited "v1.1 S7" under its own v1.2 header; check-14's comment carried a v1.14-era note. All advanced or dated. Migration/test provenance citations of old versions are historical and stay.
  3 RECORDED migration 0046's header and register entry D-215 cite "ADU-RUL-06 v1.0 -- D-183" as the ruling's source, and the installed RUL-06 does not rule D-183 or mention is_live at all. The ruling's real homes are ADU-DB-01 S30b.3 (v1.14 already carried the RULING block verbatim) and WORK ORDER T14 S5. 0046 is MERGED and a merged migration is never edited; D-215 is merged and append-only. This entry is the correction: the citation was wrong, the ruling was real, and its source is S30b.3.
  4 FIXED    docs/amendments/README.md installed the CON-03 reissue and, two rows below, said the reissue was owed -- and the two rows contradicted each other on D-154/D-156/D-157 (RUL-07 declined them; v1.2 absorbs Amendment A1, which decides them; v1.2 post-dates RUL-07, so the later founder document governs). Both rows now say so.
  5 RECORDED docs/ADU-DB-01 v1.15's own S0 still says "Count: 109 tables" while S0.1 and Appendix B say 116 -- a self-contradiction carried verbatim from v1.14 and installed as supplied (governed docs are not edited here; verify:appendix parses only the appendices, so the gate is not fooled). v1.16 owes the S0 line. AND my install commit said "counts unchanged (116/71), as v1.15's own header states" -- true of S0.1, false of S0's Count line: an overstatement, recorded rather than reworded after the fact.
  6 RECORDED ADU-API-01 contradicts itself on idempotency markers: S8 says a key rides on state-changing POST "and on nothing else", while the S12 catalogue marks PATCH /v1/seller/variants/{id} and PUT .../images/order with I. The server implements S8 (those handlers run outside the idempotency wrapper and ignore the header). The build follows S8 and the server; the catalogue's two I markers are a doc defect for the next ADU-API-01 revision.
Ruling needed: item 5's S0 line and item 6's two markers are the founder's, at the next reissue of each document.
### D-223 - the MT-KEYS generator reads only single-quoted keys, so 64 merged keys were invisible to the translation work list -- and its gate was equally blind

Severity:  MAJOR, half FIXED in-phase, half shipped at C-5 and corrected here
Phase:     T14-C - C-6, found adding C-6's keys
Source:    packages/locale/generate-mt-keys.mjs (matchAll on ^ {2}'...':); packages/locale/src/en.ts C-5/C-6 appended entries
Found by:  noticing the count NOT move: 253 new keys and MT-KEYS.md still said 259
Effect:    en.ts's house style is single-quoted keys; the generator's regex admits only that style. C-5's 64 keys and C-6's 253 were appended DOUBLE-QUOTED (a script convenience), so the generator did not see them and MT-KEYS.md -- the human translation pass's work list, the thing that gates AM_ENABLED -- silently omitted 317 keys. verify:mt-keys stayed green throughout because the gate re-runs the same blind generator: drift the gate exists to catch, invisible to the gate for the exact reason it was invisible to the manifest. The C-5 half (64 keys) is MERGED in this state.
Response:  all 317 entries converted to the single-quoted house style (en.ts and am.ts); MT-KEYS regenerated -- 259 -> 576 machine-translated, which is the true count. The append scripts now emit house style. The generator's regex is left as the single style it documents: one style plus a converter beats two styles both parsed. Recorded rather than reworded: the C-5 commit that said "MT-KEYS regenerated same commit" produced a manifest that was current by the gate's lights and short 64 keys by arithmetic.
Ruling needed: none.

### D-224 - C-6 built against eleven named absences and three document conflicts; every screen that infers, registered here (v1.2 S17.1's standing order)

Severity:  the D-155/D-218 class - absences NAMED on screen and built against, never faked
Phase:     T14-C - C-6 (SC-17..19, 22..29)
Source:    features/store/*, features/admin/*, and the documents cited per item
Found by:  transcribing the service shapes before drawing (the C-5 lesson applied in advance)
Effect / stance, each -- ABSENCES (each named on the screen it starves):
  1  PROFILE READ-BACK: no GET returns a seller's own profile anywhere (readiness = flags, bootstrap = market, public storefront = 404 for DRAFT and no category). SC-17 is a WRITE-ONLY form and says so; the live preview renders what is TYPED and its caption says which of the two it is. No handle field rides PATCH /seller/profile (G1.9 - immutable, said in words); no logo endpoint or column exists (said in words).
  2  WEEKLY AVAILABILITY READ-BACK: PUT /seller/availability has no GET; core.seller_availability is only ever written. SC-19's weekly editor edits a local draft and says the saved pattern cannot be shown.
  3  SOCIAL ACCOUNTS UNLISTABLE: no GET lists linked accounts; follower_count exists on the wire ONLY as verify's transient follower_count_at_verification, with no captured_at. R24's "as of" renders the moment this session witnessed, and the screen says counts cannot be re-read later.
  4  COURIER COLUMNS: GET /seller/couriers returns {id, phone, invited_at, claimed_at} -- no name, no assignment count, no last activity, and NO account_id, though SC-04's courier assignment requires courier_account_id in its body (D-157's remaining half: the endpoint EXISTS, contra v1.2 S17 item 2's "Owed", but what it returns cannot feed the assignment control). SC-23 renders the real fields and names the rest.
  5  REMEMBERED DEVICES: GET /auth/sessions is one list; a remembered device with no live session cannot be listed, and no endpoint removes a remembered flag alone. SC-27 renders both regions from the one list and says what cannot be shown.
  6  PAYOUT LOCK IS DISCOVERED ON ATTEMPT: the GET carries no lock state, so SC-24 cannot draw the wireframe's proactive locked panel; the 409's message renders instead. (And error.payout.payout_locked_recovery's English assumes the RECOVERY reason while the NEW_DEVICE reason shares the code -- one message for two causes, the catalogue's to refine.)
  7  NOTIFICATION CATEGORY MAP: the server holds no category list and suppresses by template_key; only ORDER_AWAITING_PAYMENT_MORNING, STOCK_CONFIDENCE_NUDGE and the locked NEW_DEVICE_SIGNIN/PAYOUT_CHANGE_* exist as senders. SC-28 renders R22's eight categories; the five with no sender render their toggle DISABLED with "the switch arrives with them" -- a switch wired to nothing is a lie, and writing preferences under INVENTED keys would be the console defining the server's vocabulary.
  8  TEAM PENDING INVITATIONS: the wireframe drew pending rows; POST /seller/team 404s a phone with no ACTIVE account, so no pending state exists. SC-25 says membership is immediate or refused.
Effect / stance, each -- CONFLICTS (documents vs documents, none resolved silently):
  9  SC-22 vs G1.1: ADU-CON-03 v1.2 S11 still says identity "hands off to the KYC vendor"; ADU-RUL-01 G1.1 (carried in ADU-API-01 v1.8 S12.12) makes the endpoint OPERATOR-ONLY and a seller session 403s. A button that always 403s is a forbidden control, so SC-22 offers none and says verification is performed by Adulis. The v1.2 sentence is the next reissue's.
  10 SC-25's "[!] ownership transfer ... no product rules ... not built until ADU-PRD-01 v8.6" is STALE: ADU-RUL-01 G1.6 supplied the policy and ADU-AUTH-01 v2.5 S25 + ADU-API-01 v1.8 S12.12 both record it. The later founder documents govern; the transfer section is BUILT (to an active ADMIN membership id, 24h, either party cancels, blockers render from items[]).
  11 v1.2 S2.3's More table carries v1.0-era screen numbers (SC-20 Identity, SC-25 Sessions...) against its own S9/S11/S12 numbering, the top-bar line cites "SC-26" for the bell (SC-30 in its own numbering), and PAYOUT sits under no More section at all. Names were followed, numbers ignored; Payout renders under Billing beside Subscription as the minimal reading.
  12 SC-19's spec VALIDATION state ("a date already overridden") cannot come from the server, which UPSERTS the note for a duplicate date. The screen refuses client-side against the loaded list, and this line records the server/spec delta.
  13 The SC-24 wireframe's MOBILE frame omits the cancel-pending control its own desktop frame and R21 require; treated as the wireframe defect it is (annotation 1 contradicts it), not transcribed.
Response:  every absence has an on-screen sentence; the two document conflicts (9, 10) and the stale table (11) are the founder's at the next ADU-CON-03 reissue; item 6's message split and item 4's account_id belong to ADU-API-01. 39/39 console e2e drive the built behaviour, including the full step-up pipeline into the real new-device lock.
Ruling needed: items 9-11 at the next ADU-CON-03 reissue; item 4's courier account_id (or an assignment endpoint keyed by invite id) at the next ADU-API-01 revision.
### D-225 - the C-6 pass: three mutations that could never succeed, two rules the wire falsifies, and the error paths -- ALL FIXED in-phase

Severity:  5 BLOCKERs + 12 MAJORs + minors, all in-phase, ALL FIXED or NAMED before the stage was left for merge
Phase:     T14-C - C-6, found by the two-agent adversarial pass on 375cb5a
Source:    apps/console/src/features/store/*, features/admin/*, components/Feedback.tsx, e2e/store-admin.spec.ts
Found by:  the pass, tracing every api() call against the real controllers and walking the error paths -- the C-5 theme reproduced almost mechanically: the three broken mutations were exactly the three the e2e left undriven
Effect / Response, each:
  A1-A3 FIXED  POST /seller/team, POST /seller/ownership-transfer and POST /seller/deletion are runIdempotent and the client sent NO Idempotency-Key -- a seller completed a real step-up SMS and the retried call 400'd IDEMPOTENCY_KEY_MISSING, every time, on team invite, the G1.6 transfer, and account deletion. Mount-minted keys added, reminted on success. The invite is now DRIVEN to the real server in e2e (planted seats flag only): the 409 TIER_LIMIT_REACHED message can only arrive PAST the key gate, so one assertion proves the fix and the rendering.
  S-B1 FIXED   a sub-one-hour weekly window was a PERMANENT RETRYABLE 500: the database's one-hour floor (0005 availability_window_minimum) is transcribed nowhere -- not the zod schema, not the client, and 23514 with that constraint name is unmapped in pg-error-translator, so "09:00-09:30" rendered "Something went wrong on our side. Try again." forever. The client refuses in words now ("A window must be at least one hour" -- S11's own rule); the zod refine and the translator row are the API's, owed. The weekly PUT is e2e-driven for the first time, both arms.
  S-B2 FIXED   Re-check ERASED the follower count: verify on an already-VERIFIED account short-circuits before the platform fetch ({already:true}, no count), and the client overwrote the displayed number with nothing. Now an already answer keeps what the session holds -- and because the wire CANNOT re-fetch, the Re-check control is REMOVED (a control the server refuses, the G1.1 class), the gap said in words on screen, and R24's "updates when you re-check" sentence corrected to what is true. R24's Re-check action is OWED to the wire, not faked at it.
  A4/S-M2 FIXED silent-or-destructive refetch failures: five admin screens kept STALE data with no indicator when a post-mutation reload failed (a cancelled payout change still showing PENDING was the sharpest), and Fulfilment/Availability did the opposite -- unmounted the whole form, drafts included, for the same blip. One pattern now: data on screen stays, a refetch-failed line renders, retry rides the next action.
  S-M1 FIXED   load failures rendered a bare Retry with no message and NO REQUEST ID (S4.6): the caught problem was dropped before ScreenState. Every loader now passes the envelope; TRANSPORT_ERROR shows its id.
  M5 FIXED     items[] was dropped everywhere: a 400 naming its failing paths rendered only the generic title ("The request is not valid." about a phone format). ProblemBanner renders every item's message now; per-field anchor links remain owed where input ids differ from slots.path.
  S-M6 FIXED   the two documented verify 409 reasons (CODE_NOT_FOUND_IN_BIO, CHALLENGE_EXPIRED) and Profile's SELLER_NOT_COMPANY render their own sentences -- a seller who just pasted the code knows whether to wait, re-paste, or remint.
  S-M3/M4 FIXED overrides pagination: has_more was fetched and ignored (rows past 50 silently absent; the duplicate guard blind past the horizon), the date input accepted past dates that vanished (the list reads from today -- min added), and a FAILED past-closures fetch rendered "No past closures." as fact, cached for the component's life. More-exists line added; failure now renders the banner and retries on re-open.
  S-M7 FIXED   categories: failure was indistinguishable from an empty vocabulary (and no environment seeds core.category, so empty is what every environment returns); both facts render their own line, and the code-not-name display is said. The unseeded table and the missing display-name column are RECORDED: core.category rows and a name column are owed (migration 0007's own comment already reports the seed gap).
  A5 RECORDED+NAMED SC-29 cannot know whether the store is already CLOSING -- no endpoint returns seller status to the console (the D-97 family). Said on screen; the status read is owed to the contract. The server's closure POST is idempotent for CLOSING (200, not 409), so the controls act correctly on the real state either way.
  A6 FIXED     deletion success rendered NOTHING (the refetch 403'd back to a shrug). It renders TERMINAL now, in words, and refetches nothing about a store that is gone.
  A7 RECORDED+NAMED the purchase-intent GET omits the transfer reference the POST minted -- a seller who closed the tab cannot re-read what to write on the bank transfer, which is the exact person that GET exists for. Named on screen; the field is the API's, owed.
  A8-A14 FIXED bank-code floor mirrored (a 1-char code no longer spends a step-up to earn a 400); history outcomes render as words, not enums; the ownership GET's catch narrowed to 403 (it swallowed real failures); residual_role is reachable (G1.6's policy allows a non-admin residual; omitted = keeps Admin); notification flips reconcile to the server's rows on every load; Closure's unreachable NO_PERMISSION gate removed with the reason in its place.
  e2e          +7 arms: SC-17 (zero coverage before -- the empty-patch refusal and a real PATCH), the weekly PUT with the one-hour refusal, the verify driven into the real 503 degradation (banner + request id), the SC-25 invite driven through real step-up into the real server, all fourteen More entries, the SC-28 reload race fixed, the SC-22 no-control assertion scoped to its region. 42/42 against the real API.
Parked, not fixed (each named on screen or here): the zod one-hour refine and the 23514 translator row; the courier account_id; the purchase-intent reference on the GET; the seller-status read; core.category rows + display names; per-field anchor links from slots.path; SC-26/SC-27 mutation arms (the step-up pipeline is proven twice elsewhere; purchase-intent 404s deterministically for a subscription-less seller and the flow's one honest e2e needs a billing seed -- owed with one).
Ruling needed: none for the console. The API items above land with their documents' next revisions.
### D-226 - C-7 built against a group of absences that includes TWO WHOLE ENDPOINTS the spec names and the API never built

Severity:  the D-155/D-218/D-224 class - absences NAMED on screen and built against, never faked
Phase:     T14-C - C-7 (SC-12..16, 20, 21, 30)
Source:    features/trust/*, features/conversation/*, features/notifications/*; the documents cited per item
Found by:  transcribing the service shapes before drawing (the standing discipline)
Effect / stance, each:
  1  GET /v1/seller/level DOES NOT EXIST. SC-13's spec names it; no route serves a seller's own level, none exposes seller_level_event history, and the one public read (GET /v1/storefronts/{handle}) is unusable twice over: no authed endpoint tells the console its own handle, and every call emits a storefront_viewed analytics event -- self-reading would inflate the seller's own view counts. SC-13 renders what is TRUE WITHOUT A WIRE (level is computed and never negotiated; level is independent of tier -- the two sentences S10 requires stated plainly) plus the named absence. No number invented, no history faked, no control anywhere.
  2  POST /v1/seller/analytics/export DOES NOT EXIST -- deliberately (no worker, no job table; the API's own comment). Business's export renders as words, never a button wired to a 404.
  3  SC-12's PERIOD PICKER HAS NO WIRE: analytics accepts no date parameters; every window is a hard-coded 30 days. The wireframe drew 7/30/90 options and the work order names a 90-day window; a picker that changes nothing is a decorative control, so the fixed window is said in words and the picker arrives with the wire.
  4  The seller conversation row is FOUR FIELDS: id, buyer_account_id, started_at, last_message_at. No buyer name (the D-153 asymmetry -- the BUYER arm gets store_name and handle), no preview, no unread marker, no linked order, and the DB view's unanswered_count is never selected, so SC-20's unanswered filter has no wire either. Each named on screen in one sentence; a row renders as "a buyer" plus when they last wrote, which is truthfully everything this console knows.
  5  SC-21's pinned order derives from THE MESSAGES (the most recent order_id any loaded message carries): D-73 dropped conversation-level anchors deliberately, so there is no thread-level order to read and the pin renders only what the thread itself said.
  6  The notification template vocabulary is TWO-VOICED -- dotted catalogue keys and UPPER enums -- so the UPPER family renders through a transcribed label map (the ITEM_LABEL rule; an unmapped key renders as itself, visible, never dropped). The claim-detail event trail beyond opened/decided is not on the wire; named. The bell in the shell is a LINK now (it was a control that did nothing); its unread COUNT stays owed rather than adding a shell-level poll to every route.
  7  SC-16's wireframe drew remedy radios with NO submit control; the endpoint exists and a choice that cannot be recorded does nothing -- the submit completes the wire, the delta noted here (the SC-24-mobile class of wireframe omission).
  8  The e2e sign-in trigger deterministically mints a real NEW_DEVICE_SIGNIN notification, and the suite leans on it: SC-30's mark-read is driven against a REAL row, read state being the server's read_at (which is also WHY it syncs with the Companion -- same rows, two surfaces).
  9  Harness note worth its line: @playwright/test applies `use` options -- including the seller's storageState -- to browser.newContext(), so the "buyer" context carried the SELLER's session cookie and the CSRF origin middleware 403'd the buyer's first write. The two-sided conversation arm now signs the buyer in on an explicitly cookie-free context and presents the console Origin on its writes; the middleware behaved exactly as S5.1 specifies throughout.
Response:  every absence has an on-screen sentence; 49/49 console e2e including a REAL two-sided conversation (buyer writes through the buyer wire, seller reads and replies through the console), the real entitlement 409 rendering S3.5's locked section, and the real security notification's read cycle. The two missing endpoints and the period/filter parameters are the API's, owed at its next revision alongside D-225's list.
Ruling needed: none for the console. GET /v1/seller/level (or a seller-readable level+history), analytics date parameters, and the conversation row's buyer-name/preview/unread/order fields belong to ADU-API-01's next revision.
### D-227 - the C-7 pass: a vocabulary written from memory, certified by a plant that copied the fiction -- and one API defect that hides a seller's own security notices

Severity:  1 BLOCKER + 10 MAJORs + minors; all console items FIXED in-phase; one API defect PARKED and recorded here
Phase:     T14-C - C-7, found by the two-agent adversarial pass on 7fd5b36
Source:    features/trust/*, features/conversation/*, features/notifications/*, components/ScreenState.tsx; apps/api/src/modules/notifications/notifications.controller.ts (item S1)
Found by:  the pass, tracing code against the DDL and the controllers -- the sharpest instance was not a mutation this time but a VOCABULARY
Effect / Response, each:
  B1 FIXED   SC-16's evidence labels were written against enum values that DO NOT EXIST (RESERVATION, PAYMENT_DECISION, CONVERSATION, STOCK_SNAPSHOT), and the e2e PLANT copied the code's fiction -- so the one assertion covering the region was green against invented data while every real claim would have rendered shouting enums, ACTING_TEAM_MEMBER included. The map is rebuilt VERBATIM from core.claim_evidence_kind (eight kinds), the plant is now DERIVED FROM THE DDL AND THE SERVICE SELECT (reference_id NOT NULL, severity ORDINARY), and the lesson joins D-221's in capitals: A VOCABULARY IS TRANSCRIBED FROM THE DDL, NEVER RECALLED -- AND A PLANT IS DERIVED FROM THE SERVER, NEVER FROM THE COMPONENT IT TESTS.
  M5 FIXED   the same class twice more: ClaimRow.state transcribed a 5-value enum as 3 (AWAITING_BUYER_EVIDENCE and AWAITING_BANK_TRACE rendered raw); review badges had no label map at all (VERIFIED_HANDOFF on a seller's screen). Both rebuilt from 0001_foundation.sql.
  M1 FIXED   SC-12's blanket "All figures cover the last 30 days" was FALSE for four of five tiles (published/followers/reservations are current counts; handoffs is lifetime) -- and the e2e asserted the falsehood. The orders tile now carries its window in its label and the note says which figures are windowed.
  M2 FIXED   /full's non-TIER failures: a 403 (SALES_SUPPORT and INVENTORY hold basic:read, not full:read) rendered a permission-denied banner on every visit -- S3.4 says an absent permission renders NOTHING, and now the section does; the stale banner from a transient failure now clears at every load.
  M3 FIXED   SC-14's empty state offered "Open completed orders" -- S14 gives reviews "(none -- explains the gate)", deliberately, and the e2e asserted the violation as a done-clause. Link deleted; the test now asserts NO action, mirroring SC-15's.
  M4 FIXED   SC-15/16 were REACHABLE BY TYPED URL ONLY -- no link anywhere led to /claims (S2.3 keeps claims out of More's sections; Home's surfacing is a stub). A deadline-bearing obligation with zero navigation is worse than the D-146 class: a standalone More entry (under NO section, honouring S2.3's letter) stands until Home's daily brief surfaces obligations -- that surfacing is OWED and recorded here.
  M6 FIXED   ScreenState's VALIDATION-without-fields branch now falls back to the ProblemBanner when a problem is present -- a malformed claim URL rendered a blank main. This CLOSES the question D-225 parked (the /products/undefined blank screen was this branch).
  M7 FIXED   the remedy e2e could not distinguish a working wire from a broken one (every failure rendered the same .problem class). It now watches the REQUEST at the wire -- method, path, Idempotency-Key header, exact body -- and asserts the real server's own 'Not found.' copy, which no other failure on the path shares. The RESOLVED/TERMINAL render is planted and asserted (badge, history, NO controls).
  I-M1 FIXED SC-21 silently truncated history at the server's 50-message page -- next_cursor dropped, no load-earlier control, no hint (Inbox and SC-30 both had their honesty affordances; the thread had nothing). "Load earlier messages" now pages backwards.
  I-M2 FIXED the 30s poll could clobber a send (two loads in flight; last RESPONSE wins -- the just-sent message vanishing for up to 30s on a slow connection), and Inbox's poll yanked a paged list back to page one every tick, with a stale loadMore able to append duplicates. A generation counter makes the latest load the only writer; the poll skips while a send is in flight and while the list is paged.
  m-batch FIXED refetch failures other than transport now render (a 429 on the poll was silent forever); the composer remints on IDEMPOTENCY_KEY_REUSED (the one bricking corner of remint-on-success-only: a reworded retry on a spent key); the remedy's terminal 409 says it about the CLAIM and refetches (it rendered "This order has already ended" above still-armed controls); the remedy region gates on viewer === 'SELLER'; numeric-rate wire types corrected (strings -- the D-225 bigint lesson); SC-12's EMPTY fires only when ALL FIVE counts are zero (it rendered beside populated tiles) and its copy no longer promises figures the free tier locks; stale loadMore banners clear on a successful load; the UNDER_REVIEW row no longer says "Respond by" after the seller responded; the buyer-recipient template dropped from SC-30's label map (the map is the WIRE, not the vocabulary).
  S1 PARKED  API DEFECT, out of this order's scope, recorded so it stays visible: the notifications list's seller-scope predicate names only NEW_DEVICE_SIGNIN, PAYOUT_CHANGE%, and notification.chat.escalated -- but OWNERSHIP_TRANSFER_* (0034, "both parties, unsuppressibly"), STOCK_CONFIDENCE_NUDGE (e3-trust-stock), and TRIAL_ENDING (e6-billing-nlu) are written unlinked to the seller's owner account. NONE can ever reach SC-30, and ALL pass the buyer arm's filter -- a seller's ownership-transfer security notice lands in that person's BUYER feed. The unsuppressible transfer notice being invisible on the seller surface undermines G1.6's own rationale ("a delay nobody is told about is not a control"). SC-30's label map carries the transfer keys ready for the fix; the fix itself is the API's.
  e2e        untested-and-named: the poll's pause/resume has no machine evidence (S9 makes the pause the point) -- owed a harness technique; BOT-message rendering is unreachable until a seed grants a chatbot entitlement -- owed with one; the SC-14/15 READY branches want plantable fixtures. The conversation arm gained: the EMPTY teach before anything exists, an ORDER-ANCHORED buyer message proving the D-73 pin derivation, and the oldest-first ordering assertion.
Ruling needed: none for the console. Item S1 and D-226's endpoint list belong to the API's next revision; Home's obligation surfacing lands with the daily brief.
### D-228 - C-8: the courier's screen, its named absences, and the QR encoding now living in exactly one place

Severity:  the D-224/D-226 class - absences NAMED on screen; one deliberate move recorded
Phase:     T14-C - C-8 (SC-C1)
Source:    courier/CourierScreen.tsx; lib/qr.tsx; the handoff module's courier arm
Effect / stance, each:
  1  THE WIRE CARRIES buyer_phone, NOT A NAME -- and no pickup point and no
     handoff note ride the courier read (the seller's fulfilment note is not
     joined). The spec's "pickup, buyer's first name, handoff address from
     the seller's note" is three absences; the screen names them in one
     sentence and offers the phone, which is what the server deliberately
     sends for the doorway call. The joins are the API's, owed.
  2  R25 IS THE SERVER'S: before custody the QR payload is ABSENT from the
     detail read, and the screen's pre-custody state says the code does not
     exist yet -- never a hidden element. The post-custody QR renders with
     the WHO-SCANS sentence (a courier reading the code as theirs to scan is
     the misread the composite FK exists to make impossible).
  3  THE D-156 ENCODING MOVED to lib/qr.tsx: SC-C1 renders the SAME payload
     as SC-06, and an interim format kept in two files diverges exactly when
     a scanner is pointed at it. HandoffQr re-exports the encoder so its
     importers and the register's existing citation stay true. Still ONE
     function, one line to change when the format is ruled.
  4  Courier state words are a courier-voiced map (awaiting pickup / handed
     off / completed); unmapped values render as themselves. The list IS the
     assignments (RLS on the actor role); the screen has no navigation, no
     store context, no catalogue -- asserted in e2e.
  5  HARNESS: the buyer account is signed in ONCE per run by globalSetup and
     its state shared (the OTP budget is per phone; two specs each minting a
     code spent it -- D-124's class, rediscovered the day a second two-sided
     arm arrived). The courier e2e drives the WHOLE chain for real: seller
     invites the buyer's phone (immediate claim), assigns the seeded
     confirmed order, the courier works the screen through both R25 halves,
     and the revoke cleanup leaves the world as found (ending courier row
     and live assignment in one transaction -- SC-23's warning, lived).
  6  THE PASS (same rhythm, smaller scale, all FIXED): the order REFERENCE
     was missing everywhere -- the spec's own two-state listing BEGINS with
     it, and two orders from one store were indistinguishable at a doorway
     (a short ref renders on row and detail, e2e-asserted); the screen never
     refetched (an ended assignment lingered as banner-over-stale -- the
     list polls, back-from-detail reloads, a detail 404 drops to the
     refreshed list); expires_at rendered as a bare stale deadline (it is
     the RESERVATION clock, stopped for every state a courier holds --
     removed, S7's rule); no path led to /courier (the Chooser links it --
     ungated, because the session carries no roles for the client to read;
     the contract's roles[] rendering hint is the owed refinement); the e2e
     asserts R25's first half AT THE WIRE (qr null in the response, not
     merely absent from the DOM) and the payload's order_ref after custody.
  7  PARKED, API-side, recorded: custody-accept's ON CONFLICT DO NOTHING has
     no unique arbiter on (order_id, courier_account_id) -- a re-tap after a
     lost response can duplicate the custody row -- and no state gate (Event
     A accepts on a CREATED order); the courier list is LIMIT 50 with no
     cursor. The e2e fixture is DEGENERATE -- the courier IS the buyer of
     the assigned order (the only seeded second account), so the buyer-join
     and the composite-FK story are under-witnessed; a third seeded account
     is owed with the next seed change.
Ruling needed: none for the console. The courier read's buyer-name/pickup/
note joins belong to ADU-API-01's next revision, beside D-224.4's account_id.
### D-229 - T15 Phase 2: D-227 S1 fixed -- the seller-class predicate is ONE fragment, and the three leaked classes come home

Severity:  MAJOR (seller-visible wrong behaviour), FIXED
Phase:     T15 Phase 2
Source:    apps/api/src/modules/notifications/notifications.controller.ts
Effect:    OWNERSHIP_TRANSFER_* (0034: "both parties, unsuppressibly"), STOCK_CONFIDENCE_NUDGE and TRIAL_ENDING are written UNLINKED to the seller's owner account and appeared in NEITHER arm's inclusion list -- so they fell into the BUYER feed and could never reach SC-30. A seller's own ownership-transfer security notice read as shopping news, which undermined G1.6's rationale: a delay nobody is told about is not a control.
Response:  the seller-class template predicate is defined ONCE and interpolated into both arms -- inclusion in the seller arm IS exclusion in the buyer arm by construction, so the drift that caused this cannot recur by parallel maintenance. The three classes are added. TESTED BOTH DIRECTIONS plus the inverse control (a buyer-classed row stays in the buyer feed and out of the seller feed) -- one arm alone would pass with the predicate inverted, the work order's own warning.
THE PASS (amended in on this unmerged branch, the D-134 precedent): one MAJOR beside the diff -- UNSUPPRESSIBLE covered only NEW_DEVICE_SIGNIN and PAYOUT_CHANGE% while 0034 writes OWNERSHIP_TRANSFER_* suppressible=false, so the preferences PATCH accepted a toggle-off of an unsuppressible security notice with a silent 200 (the file's own invariant names that exact failure). FIXED, with the 422 test extended, and the comment corrected: unsuppressible is a deliberate STRICT SUBSET of seller-class (stock and trial nudges stay togglable). The both-directions test gained a same-account control row -- a control whose recipient differs proves nothing about the predicate.
Ruling needed: none. TWO NOTES recorded, not fixed: NEW_DEVICE_SIGNIN is account-scoped but classed seller-side, so an account with no seller sees its new-device notice in NEITHER feed; and unlinked seller-class rows appear in EVERY seller feed the account can read, unattributed (an admin of two stores sees store A's trial notice in store B's SC-30) -- the durable fix is a nullable seller_id on core.notification. Both belong to the next ADU-API-01/DB revision.
### D-230 - T15 Phase 3: the three labelled items land, and D-155 closes after eight tiers

Severity:  the D-155 family CLOSED (the contract now resolves what the console renders)
Phase:     T15 Phase 3
Source:    apps/api (orders, couriers, financial, team, common/auth/grant-set.ts); apps/console (Orders, OrderDetail, Payout, Team)
Effect / Response, each:
  D-154 CLOSED  bucket on GET /v1/seller/orders. Membership lives in ONE module (order-buckets.ts) the controller validates against and the service resolves through -- "needs action" is a SET (PAYMENT_SUBMITTED + PAYMENT_CONFIRMED) and the set is the server's, not a client filter wearing a filter's clothes. cancelled is the plainest: three states, one tab. The console tab sends a NAME and re-fetches (asserted at the wire); the page-local grouping, its BUCKET map, and its D-154 disclaimer sentence are gone. A bucket the server does not define is 400 VALIDATION_FAILED {path:'bucket'}. (Own module, not the controller: the service importing the controller was a no-circular violation the deps gate caught.)
  D-224.4 CLOSED  GET /v1/seller/couriers returns account_id on claimed rows (null on pending). SC-04's assignment and custody controls are LIVE: the select offers claimed couriers, a pending invite renders disabled with its real status (invited, has not joined yet), and assignment/custody POST courier_account_id for real. D-157's gap sentence and marker are removed; the e2e drives a real invite -> claim -> assign (201) and asserts the control is DISABLED (R20, not hidden) on an unpaid order.
  D-155 CLOSED  allowed_actions, per object, named by permission code. A new READ-ONLY resolver (common/auth/grant-set.ts) reads the caller's grant set (role x surface -- the E5 rendering-hint read that adulis_app keeps SELECT for) and INTERSECTS it with what the object's state admits; the state predicates live in the one service that already holds the object. It NEVER authorizes -- every write still opens with assertPermission -> fn_has_permission, which raises; this returns a set and raises nothing. SC-04 reads the array and gates every handoff control on its code (R20 held: rendered-disabled, never a client union). SC-24 payout and SC-25 team gate their write controls on it too. Proven the way a wrong implementation could not fake it: the SAME order in the SAME state yields DIFFERENT allowed_actions for OWNER (holds the grants) and ANALYST (read-only) -- empty for ANALYST, so a state-only client would show the confirm button and this does not.
  count       C-6/C-7 inference entries: D-155 was the master (no endpoint returned allowed_actions); it is CLOSED. The D-224 cap-counter family (SC-07's "N of unlimited", variant labels, stock confidence level) REMAIN OPEN and are NOT allowed_actions -- they are absent DATA FIELDS (an effective-limit number, server-supplied labels), a different debt that an effective-limit read closes, not this phase. Reported honestly: one entry closed, the data-field family still owed.
Ruling needed: none. The grant-set resolver duplicates fn_has_permission's role-resolution READ-ONLY by design (E5 already grants adulis_app SELECT on permission/role_permission for the roles[] hint); it is never a substitute for the raising authority path, and the file says so.

### D-231 - the T15 Phase 3 pass: two API defects where a wrong answer looked exactly like a right one, and the grant gate that no in-browser test could yet falsify -- ALL FIXED in-phase

Severity:  2 API defects (one both-ends wrong) + 3 console MAJORs + 2 minors, found before merge, ALL FIXED
Phase:     T15 Phase 3 - the two-agent adversarial pass on ef39de7 (one API reviewer tracing every predicate against the DB functions, one console reviewer walking the render gates)
Found by:  the work order's own warning made concrete -- "allowed_actions is the one where a wrong implementation looks exactly like a right one until a permission is missing." The API reviewer read every state predicate back against the function it claims to mirror; the console reviewer asked what test would fail if the console ORed its own state guess back in.
Effect / Response, each:
  F1 FIXED   the reissue predicate was wrong at BOTH ends. allowed_actions gated seller.orders:reissue_instructions on ['PAYMENT_SUBMITTED','PAYMENT_CONFIRMED'], but fn_reissue_instructions (0022:203) accepts only ['CREATED','NOTIFIED','PAYMENT_SUBMITTED'] and RAISES otherwise. So the control was OFFERED in PAYMENT_CONFIRMED (a button that 409s the instant a seller taps it) and HIDDEN in CREATED/NOTIFIED (exactly where a seller who changed banks must push a fresh payout snapshot before the buyer pays). Now transcribed verbatim from the function's own NOT IN guard, and an e2e asserts it present at NOTIFIED and absent at PAYMENT_CONFIRMED. This is the finding the work order predicted: the seeded happy path rendered a plausible button, and only reading the guard showed both ends inverted.
  F2 FIXED   bucket validation used `bucket in ORDER_BUCKETS`, and `in` walks the prototype chain: ?bucket=constructor or ?bucket=toString passed the guard and reached ORDER_BUCKETS[bucket], a function rather than a state list -- a 500 on a crafted query, from an endpoint whose whole point is that the client cannot smuggle a state filter through the parameter. Now Object.hasOwn, and an e2e sends a real state name and gets 400 VALIDATION_FAILED {path:'bucket'}.
  C1 FIXED   an empty BUCKET hid the tabs. The account-empty EMPTY state (which drops the tab bar, correctly, when a seller has zero orders) fired on ANY zero-row result -- so a seller who filtered to an empty bucket was told "no orders" AND lost the tabs that would take them back. Now the tab-hiding EMPTY fires only on the 'all' bucket; a narrow empty bucket keeps the tabs and shows an in-bucket empty line (none_in_bucket).
  C2 FIXED   a tab-switch RACE: two quick tab clicks issued two fetches, and whichever RESPONSE landed last won setRows regardless of which tab was now active -- the seller could end on 'completed' looking at 'active' rows. A generation guard (loadGen) now lets only the latest load commit.
  C3 FIXED   the grant gate was UNFALSIFIABLE in-browser, which is the same shape as the work order's warning. OWNER holds every order permission, so on every seeded order grant-presence and state COINCIDE, and a console that had quietly fallen back to state-only gating would pass the entire suite green. Closed with a planted test: the order-detail GET is fulfilled with allowed_actions EMPTY while the state stays PAYMENT_CONFIRMED (the ANALYST case, without a second session), and the handoff controls are asserted DISABLED. A state-only console would enable them here; this disables them, so the union the work order forbids now has a test that fails on it.
  m1 FIXED   load-more could double-append on a fast double-click (no in-flight guard). loadingMore added, the button disabled while a page is in flight.
  m2 FIXED   orphaned locale keys: filter_is_local (the client-filter disclaimer, now meaningless) removed; none_in_filter renamed none_in_bucket to say what is actually true ("You have no orders in this group.").
Verification: c3-orders.e2e 17/17 (bucket server-resolution, OWNER-vs-ANALYST allowed_actions, state-gated terminal, reissue-state, MOBILE surface filter); console e2e 53/53 (bucket re-fetch at the wire, the planted grant-gate test, the live invite->claim->assign). Full `pnpm ci:local` green before merge.
Parked, not fixed: none from this pass. The D-224 cap-counter family stays OPEN as recorded in D-230 (absent data fields, not allowed_actions).
Ruling needed: none.

### D-232 - T15 Phase 4: the eight reads land, the "owed column" was already there, and one taxonomy code loses a cause it never should have carried

Severity:  eight write-only facts become readable; the console can show a seller their own store
Phase:     T15 Phase 4
Source:    apps/api (onboarding, financial, analytics, billing, auth; common/errors); packages/locale
Effect / Response, each:
  1 GET /v1/seller/profile CLOSED. SC-17 PATCHed fields it could never read back, and no screen could read the seller's own status or handle. The read returns the editable fields PLUS status (core.seller_status) and handle. seller.store:read, CONSOLE-only surface gate (a MOBILE session is 403, asserted).
  2 GET /v1/seller/availability CLOSED. The PUT replaced the whole weekly set and returned a count; the editor edited a draft it could not reopen. The read returns the same shape the PUT accepts -- one row per (weekday, window), several per weekday, zero windows a valid closed state -- ordered weekday-then-open, HH:MM.
  3 GET /v1/seller/social-accounts CLOSED -- AND THE OWED COLUMN WAS ALREADY THERE. ADU-API-01 v1.9 S15.0b says the follower count "exists on the wire only as verify's transient value" and owes `follower_count`+`captured_at` to ADU-DB-01 v1.17. It does NOT: core.seller_social_account (migration 0005 S7.2) has carried follower_count_at_verification and verified_at since Tier 2, WRITE-ONCE (an UPDATE trigger rejects a change; re-verification writes a fresh row), and verifySocialAccount WRITES both. So R24's "as of <date>" renders from verified_at, the read maps the two columns to the v1.9 wire names (follower_count, captured_at), and NO v1.17 migration is written. The v1.9 note is stale against the installed v1.16 -- reported, not built. (This is the "one DB column" the work order named; the honest answer is that it exists, so there is no generated appendix content to send.)
  4 Remembered devices CLOSED, both halves. GET /v1/auth/sessions already distinguished remembered from live (remembered, remembered_label); it now also carries remembered_device_id (NULL unless the bound account_device is live), and a NEW read excludes a device once revoked. DELETE /v1/auth/remembered-devices/{id} forgets the device ALONE -- revokes the core.account_device, leaves the session live (its next renewal simply gets the ordinary lifetime, not R17's seven days). Own-account scoped; a scope miss is 404 (S19).
  5 Payout lock state CLOSED. GET /v1/seller/payout carries payout_locked_until and reason, so SC-24 draws a proactive panel instead of discovering the lock on a 409. The read is the render-side twin of fn_request_payout_change's three checks (0022), IN THE SAME ORDER and reading THE SAME rows -- fail-closed no-timing-config, then recovery cooling (horizon off account_recovery_case), then the new-device lock. It NEVER authorizes: the write function stays the authority that raises U0008; this returns a hint (the grant-set precedent, D-230). reason is the write function's own DETAIL vocabulary verbatim, so panel and 409 speak one language.
  6 Analytics date parameters CLOSED; EXPORT deferred. GET overview and GET full take an inclusive [from, to] of ISO dates, default to the 30-day rolling window they always had (so the _30d field names stay true when no range is asked), validate at the edge, and echo the resolved window (window_from/window_to). POST /v1/seller/analytics/export is NOT built and is not a read: it is an async job writing to R2, and the worker process and the job table do not exist -- registered here as owed infrastructure, not a read this phase could land.
  7 Purchase-intent reference CLOSED (A7). The POST minted a transfer reference (ADU-SUB-<collection id[:8]>) and GET /v1/billing/subscription's intent dropped it, so a seller who closed the tab had the amount but not the string to write on the transfer. The GET now derives it identically, so the console renders it rather than recomputing a business fact.
  8 PAYOUT_LOCKED reason slot CLOSED (D-224.6). The code was PAYOUT_LOCKED_RECOVERY, whose name baked in ONE of two causes and rendered "after account recovery" even on a NEW_DEVICE lock. Renamed to the cause-neutral PAYOUT_LOCKED (v1.9 S15.0c); the cause is the reason slot that ALREADY flowed from the DB DETAIL (RECOVERY_COOLING | NEW_DEVICE | NO_TIMING_CONFIG); the two sentences that differ are now the locale catalogue's job (three reason keys added). The 409 and the panel carry the same reason.
Verification: c1-onboarding 32/32 (profile status+handle, availability round-trip and empty, social follower_count+captured_at), c4-financial 15/15 (payout PAYOUT_LOCKED code + proactive panel for both lock causes), c8-analytics 50/50 including a far-past window that zeroes the counts (a param that is ignored could not), t6-purchase-intent (GET carries the reference identically to the POST), c6-accounts (forget-device: flag goes, session stays, re-forget 404). contract regenerated; error-locale 62 codes both catalogues; mt-keys 730.
Contradictions reported (amendment owed, not judgement-called in SQL):
  C1 ADU-API-01 v1.9 is internally inconsistent on the payout code: S7.1's taxonomy table still prints PAYOUT_LOCKED_RECOVERY while S15.0c (item 13, the authoritative new-behaviour section) names PAYOUT_LOCKED with a reason slot. Built per S15.0c; the S7.1 row is the stale one.
  C2 The v1.9 S12 catalogue TABLES (S12.9, S12.11, S12.13) were not updated with the new GET rows the S1/S15.0b narrative mandates. Built per S1/S15.0b; the CI-generated contract picks the handlers up.
  C3 ADU-API-01 v1.9 line 1268 says follower_count/captured_at are owed to ADU-DB-01 v1.17; ADU-DB-01 v1.16 already carries them (see read 3). No migration.
Pass: two adversarial reviewers, read-only, single-writer held. The highest-risk item -- the payout-lock read as a render-side twin of fn_request_payout_change -- was traced exhaustively and found to have NO divergence (same check order, same rows, same actor account, same strict-> boundary so the panel flips exactly when the write would start succeeding, and it cannot raise: the timing_config EXCLUDE constraint makes the scalar subquery single-row). Permission gates: every read calls the right code before any data and scopes every WHERE by seller or account; no cross-seller leak; forget-device is own-account (404 on a miss). Analytics window SQL: default preserved, inclusive `to`, cross-join safe, injection-safe. Rename complete; no dangling code/locale reference. SELECT lists leak nothing (profile omits owner_account_id/person_id; social omits platform_account_id). Two MINORs, both FIXED before merge: (m1) parseWindow rejected from>to only when BOTH were given, so a lone past `to` defaulted lo to now()-30d and produced a silent empty window with window_from after window_to -- lo now defaults to `to - 30 days` when only `to` is sent (a coherent trailing window; e2e added). (m2) a billing doc-comment mislabelled the intent-reference item (11, SC-26; A7 was named in D-225's C-6 pass) -- corrected. Console staleness (Payout.tsx's now-false comment and PayoutState lacking the new fields) is left to Phase 5, which wires SC-24; recorded, not a compile break.
Ruling needed: an amendment to ADU-API-01 v1.9 correcting C1/C3 (S7.1's code name; the S15.0b "owed column" note) and to the S12 catalogue tables for C2. A ruling on whether analytics EXPORT is in T15 or a later tier's worker work. Also owed: the analytics windowed fields keep their `_30d` names under a custom window (renaming would break the existing contract/console) -- an amendment should either rename them (e.g. orders_in_window) or bless the suffix as a stable id; window_from/window_to echo the resolved range meanwhile.

### D-233 - T15 Phase 5: the gap sentences whose endpoints now exist are DELETED, each screen proven rendering the real thing; the sentences that remain are kept deliberately, each with its reason

Severity:  the sentences answered by ADU-API-01 v1.9 leave the screens; every removal proven end to end
Phase:     T15 Phase 5
Source:    apps/console (store/Profile, store/Availability, store/Identity, admin/Payout, admin/Sessions, admin/Subscription, trust/Analytics; types, locale, e2e)
Effect / Response, each removal a proven claim (the work order's rule):
  SC-17 DELETED "Your saved profile cannot be shown here yet". The form LOADS GET /v1/seller/profile, shows status and handle (the two the console had no way to know), pre-fills the editable fields, and a save READS BACK across a reload -- the e2e edits the name, PATCHes for real, reloads, and the server returns the edit. The preview now previews the real profile.
  SC-19 DELETED "Saved hours cannot be shown here yet". The weekly editor LOADS GET /v1/seller/availability, edits the saved pattern, and the e2e saves a window and reads it back across a reload. Zero windows still a valid closed state.
  SC-22 DELETED "Linked accounts ... cannot be shown again later yet". GET /v1/seller/social-accounts renders the linked list; a verified account shows its follower count "as of" the REAL captured_at (verified_at) instead of the moment one session witnessed -- R24 done properly. e2e: minting a code makes the PENDING account appear in the list and survive a reload. (A VERIFIED as-of render needs the fake social register, an in-process API-test helper; c1-onboarding asserts that path at the wire.)
  SC-24 BEHAVIOUR REPLACED (there was no on-screen sentence; the gap WAS the 409). The proactive lock panel renders reason + payout_locked_until from the real GET -- and the e2e is now the strongest in the file: the harness device is deterministically new-device-locked, so the REAL server's lock draws the panel, names the cause with the same locale line the 409 uses, shows the lift, and the change control renders DISABLED (R20). The old test spent a real step-up SMS to discover the same fact on a doomed POST; the step-up pipeline stays fully driven by SC-25's team invite. The R21 plant gains the unlocked lock fields (a plant derives from the server, D-227).
  SC-27 DELETED "A remembered device ... cannot be listed or removed here yet". Forget-this-device is LIVE: the e2e forgets the harness's own remembered device against the real API and asserts THE FLAG GOES, THE SESSION STAYS -- the current session remains listed and signed in, which is the entire distinction item 8's second half exists for. The consequence sentence rewritten: forgetting is NOT a sign-out (the old sentence said the opposite, and was true of the old world).
  SC-12 DELETED "A period picker arrives when the server accepts one" AND the empty-state's "the server does not report your handle" (it does, on the profile read -- the empty state now points at SC-17). The 7/30/90 picker DRIVES the wire (e2e asserts the re-fetch carries a real from= ~7 days back) and the caption is the SERVER's window echo, never a client assumption. Generation guard on period switches (the D-227 race class).
  SC-26 DELETED "The transfer reference ... cannot be shown again yet". The open-intent block renders the reference from the GET (data-reference), so a seller who closed the tab reads back what to write on the transfer. (Driving a real intent needs the billing seed T14-C registered as owed; the API-side proof is t6-purchase-intent's GET-equals-POST reference test.)
Sentences that REMAIN, each kept DELIBERATELY (a sentence kept by omission is the failure mode; none is):
  D-153 (SC-03/SC-04) buyer name on the order row -- the data-model absence stands (ADU-DB-01 carries no name to join); data-gap="D-153" and its marker tests stay.
  SC-17 logo -- no endpoint and no column exist.
  SC-17 company DETAILS read-back -- the profile read carries entity_type, not registration/licence/tin; those stay write-only.
  SC-22 Re-check -- the verify short-circuits an already-VERIFIED account before the platform fetch (D-225); the re-capture write path is owed, the sentence stays.
  SC-13 trust level -- GET /v1/seller/level still does not exist (D-226).
  SC-12 export -- no worker, no job table (D-232); the absence is words, not a dead button, and the e2e asserts no export control exists.
  SC-01 chooser -- D-97: no endpoint lists the caller's own sellers.
  SC-23 couriers -- name/assignment-count/last-activity absences stand (account_id landed in Phase 3).
  The D-224 cap-counter family (SC-07 "N of unlimited", variant labels, stock confidence) -- absent data fields, not endpoints.
  SC-30 sender absences and the SC-20/21 conversation-row fields (buyer name, preview, unread, order link) -- D-226's wire absences stand.
  Also standing, found by the pass's keep-list sweep and still TRUE (register bookkeeping, added here so no keep is by omission): SC-16 claims history (claims.detail.history_owed), SC-09 media upload (D-219), SC-08 structured attributes (attributes_owed), SC-07 row summary (row_summary_owed), SC-C1 courier detail joins (courier.details_owed, D-228).
Pass: one adversarial reviewer over the full diff. ONE BLOCKER, the phase's own failure class: SC-29 still told sellers "the server does not report" whether the store is open -- a status SC-17 was rendering two taps away from the SAME read. KEPT BY OMISSION; fixed -- SC-29 loads GET /v1/seller/profile, `closed` is the server's CLOSING rather than the tab's memory of its own POST, the sentence is deleted, and the e2e closes, RELOADS (badge from the server), reopens, reloads again. Six MAJORs, all fixed: (M1) a lock arriving via refetch left an ARMED form behind the disabled toggle -- the form is lock-gated with its toggle; (M2) the overrides refetch clobbered a weekly draft mid-edit -- the two reads split, the save read-back dirty-guarded; (M3) the profile post-save refetch clobbered mid-flight typing -- per-field sent-guard; (M4) a failed social list rendered the success-empty state (the C-5/D-225 S-M3 class, in the same commit whose own loadPast refuses it by name) -- failure now renders as failure, controls stay live; (M5) the analytics generation guard leaked through the catch and the terminal commit -- a stale failure could erase a fresh one; guarded everywhere; (M6) a failed full-read kept the PREVIOUS window's tiles under the new caption -- full clears on any failure; (M7) SC-26's reference render had no on-screen proof -- a plant in the server's real shape (t6 proves the wire) asserts the reference line. Minors fixed: three stale header comments; the window caption named the wrong tiles as lifetime; the account-empty teach fires only on the default window (the Phase 3 empty-bucket lesson); clearing a saved profile field now REFUSES in words (the coalescing PATCH cannot express clearing; "Saved." followed by a silent revert would lie); an Identity list generation guard; the keep-list completed (above).
Verification: pnpm verify:console-e2e (the built console, the real API, a reset database) green with every rewritten arm; api suite green; full pnpm ci:local green before merge.
Ruling needed: none new; the keeps above already carry their register homes (D-97, D-219, D-224, D-225, D-226, D-228, D-232).

### D-234 - T16 Phase 1: ADU-API-01 v1.10 installed with its four corrections; three of its own rows are already stale against the build it describes, in the class its S0.1 names

Severity:  install clean; the four corrections landed; four transcription findings reported rather than judgement-called
Phase:     T16 Phase 1
Source:    docs/ (install); apps/api + apps/console (correction 4); packages/locale
Effect / Response, each:
  INSTALL  v1.10 extracted byte-exact from the founder attachment (126,962 bytes, 0 above U+007F); v1.9 to docs/superseded/. DOCUMENT_AUTHORITY.md, both CLAUDE.md files, the amendments manifest and the docs-ascii GOVERNED list advanced IN THE SAME COMMIT (the D-222.1/D-222.2 lesson, now a habit). The session transcript also held a transit-damaged ADU-DB-01 variant (mojibake em-dashes) beside its clean twin -- the D-191 class on display; the hash check is why extraction never trusts the first match.
  C1 DONE (was already). PAYOUT_LOCKED_RECOVERY was withdrawn from CODE and CATALOGUE at T15 Phase 4 (D-232 item 8): the catalogue key is PAYOUT_LOCKED, the old locale key is gone, the reason messages exist in both languages. v1.10 S7.1 now agrees with the build. Verified: no occurrence as a value anywhere in apps/api/src, packages, contracts (comments and immutable migration headers only).
  C2 DONE (doc-only). The eight reads enter S12.12a. The endpoints exist since T15 Phase 4; no code moved.
  C3 DONE (doc-only). The v1.17 note is withdrawn; S15.0b now states the columns have existed since 0005 -- the finding D-232 reported, adopted.
  C4 BUILT, both sides one commit. The `_30d` suffixes are gone: overview carries orders, full carries storefront_views/product_views/reservations/completed, and the window rides ONCE as `window: {from, to}` (the flat window_from/window_to echo replaced). API response shaping, console types (AnalyticsWindow), Analytics.tsx, the locale key (console.insights.analytics.orders), c8 assertions -- and c8 now asserts the SUFFIXED fields are ABSENT, because no gate compares a field name to the data behind it and this one now does. Permitted despite doctrine 6, ON THE RIGHT GROUND (the pass corrected the first draft of this line): `full` is CONSOLE-only and changes freely under S3.1 -- but `overview` is NOT: seller.analytics.basic:read is granted MOBILE+CONSOLE (0006:133), so S3.1's additive-only invariant nominally applies to it. The rename is safe because (a) it is v1.10's own founder-installed correction, and (b) no shipped mobile consumer exists -- apps/mobile carries zero analytics references, so no pinned client holds the old schema. Handed to the next reissue: S12.13's table carries no M marker on overview while the shipped permission surface says MOBILE -- the marker and the grant disagree, and whichever is wrong, an M-granted endpoint must never again be renamed on a console-only justification.
Reported, not built (the D-44 class -- "the enum is frozen and shipped; this document is not the authority on its spelling; a translation layer between a document and a shipped type is a place for a third spelling to appear"):
  R1 S12.12a prints `DELETE /v1/auth/devices/{id}/remembered`; the shipped endpoint (T15 Phase 4, tested in c6 and driven by SC-27's e2e) is `DELETE /v1/auth/remembered-devices/{id}`, and its {id} is the core.account_device id -- the doc's path does not say which id it means. The shipped path stands; the row is the next reissue's.
  R2 S12.12a prints `GET /v1/seller/analytics`; S12.13 IN THE SAME DOCUMENT retains overview and full (and is the section v1.10 itself edited for C4). Internal inconsistency; the group's own section governs; the row is shorthand.
  R3 S12.12a prints `GET /v1/seller/subscription`; S12.12 IN THE SAME DOCUMENT retains `GET /v1/billing/subscription` (R4's console-only billing group). Same class as R2.
  R4 S7.1 prints the reason slot as `RECOVERY | NEW_DEVICE`; the shipped DB DETAIL (migration 0022, merged and immutable) emits `RECOVERY_COOLING | NEW_DEVICE | NO_TIMING_CONFIG`, and the GET panel, the 409 slot and the locale keys all speak that vocabulary verbatim (D-232's one-language rule). No edge mapping is built. Also: the doc names two reasons; the build carries a third, NO_TIMING_CONFIG, which is fn_request_payout_change's own fail-closed arm -- a config gap, not a user cause, and hiding it under either named reason would mislabel a defect as a policy.
Ruling needed: the next ADU-API-01 reissue corrects the three S12.12a rows and adopts the shipped reason vocabulary (or rules a rename, which means a new migration CREATE OR REPLACEing fn_request_payout_change and both clients moving together).

### D-235 - T16 Phase 2: GET /v1/seller/obligations -- every candidate judged against "silence costs you", and the one whose stated consequence the database does not deliver

Severity:  the endpoint lands with three kinds; one work-order consequence corrected to what the schema actually does; two candidates excluded with the test applied
Phase:     T16 Phase 2
Source:    apps/api/src/modules/obligations/ (new); packages/locale (obligation.* sentences); apps/api/test/c3-orders (fixture + six arms)
The admission test, applied to EVERY candidate (S12.12b: an obligation is a thing where silence costs you; pending states are excluded because a list that mixes "you must act" with "this is happening" becomes a list people learn to ignore):
  ADMITTED PAYMENT_AWAITING_CONFIRMATION -- deadline: payment_submission.sla_deadline, STORED absolute, the same column SC-03's confirmation clock renders (one source, no drift; fn_confirmation_window_lapse re-derives authoritatively at the lapse from the state-transition time). Consequence, TRUE per that function (0014:278-314): a SYSTEM SLA_BREACH claim opens in AWAITING_SELLER_EVIDENCE, missed_confirmation_windows and unresolved_claim_count increment -- BOTH PUBLIC on the storefront read -- evidence is pinned and retained, stock stays held, the order does not move. [!] The work order says "counted against the trust level"; the DATABASE counts it on the PUBLIC STATS, not in fn_recompute_seller_level -- the level moves only if an operator later UPHOLDS the claim (fn_claim_decision_effects). The consequence sentence states the public-page truth, not the demotion the schema does not perform.
  ADMITTED CLAIM_AWAITING_SELLER -- deadline: claim.review_deadline, stored absolute (opened_at + 2 days, HARDCODED in 0014:106 -- not a timing_config value; noted). NO job fires at it: it is the operator's review horizon, and no automation in the 20-job registry reads core.claim. The true cost of silence: past it the claim can be decided without the seller's side, and an upheld claim recomputes the level with the claim counted. The sentence says that and no more.
  ADMITTED ORDER_NOT_READY -- deadline: DERIVED, clock_stopped_at + timing_config.fulfilment_window, computed by Postgres per request. [!] THE WORK ORDER'S STATED CONSEQUENCE IS FALSE IN THE SCHEMA: "the order expires and stock releases" -- core."order".fulfilment_deadline is written by NOTHING (three repo hits: the migration, two generated type files), timing_config.fulfilment_window is read by NOTHING outside fixtures, and every sweep excludes clock-stopped orders (idx_order_expiry_sweep WHERE clock_stopped_at IS NULL is the whole predicate). Confirmed orders never expire -- that is S12.4a's own design. The TRUE consequence rendered: the buyer has paid and is waiting; an unready order invites a GOODS_NOT_RECEIVED claim (and stands as the ORDERS_AWAITING_HANDOFF deletion blocker). Entries appear FROM confirmation with the deadline approaching -- a deadline list warns before, exactly as the payment entry does -- and overdue entries stay. Ruling invited: should a fulfilment-lapse job exist (new DB/job work, not this order's)?
  REJECTED refund reported, buyer unacknowledged (72h) -- the BUYER acts (POST .../refunds/{rid}/acknowledge); nothing is required of the seller: PENDING by the order's own test. Additionally, refund_ack_window is read by zero application code and no job fires at it.
  REJECTED refund owed but UNREPORTED (reservation REFUNDED, no core.refund row -- the seller owes fn_report_refund) -- a REAL obligation (fn_deletion_blockers names it REFUNDS_UNRESOLVED) with NO ruled deadline anywhere: refund_ack_window governs the buyer's acknowledgement, not the seller's report. An entry without a deadline cannot hold a place in a nearest-deadline-first list, and inventing a window here is designing. Ruling invited: a report window, if this belongs on the list.
  REJECTED publication readiness -- a consequence, not a deadline (the order's own words); silence adds nothing to the standing state; Home Life 1 already surfaces it as its own region.
  REJECTED payout change pending activation; ownership transfer pending -- nothing is required of the seller and each happens either way (the order's own ruling: pending, exclude).
Shape and mechanics:
  Each entry: typed kind; object_kind + object_id (the ROUTE that opens it is the console's kind->route mapping -- the ACTION_ROUTE precedent Home already uses for readiness resolving actions, because a URL is a client artifact and the Companion's routes differ; recorded as the reading of S12.12b's "route" cell); absolute RFC3339 deadline (the console renders it and decides nothing; at zero a clock refetches); consequence_key derived S7.2-style from the kind and carried explicitly the way error envelopes carry message_key -- the console renders the server's sentence and composes nothing. Ordered deadline ASC; overdue first naturally; empty = 200 {data: []}.
  Authorization: door = seller.store:read (CONSOLE-only, all six roles; a CONSOLE stranger is U0002 -> 404). Entries then FILTERED by the caller's grant set (grantSet, the D-155 read-only machinery): ORDER entries need seller.orders:read, CLAIM entries seller.claims:read -- a role that cannot read claims must not learn one exists from this list.
  Fail-quiet choices, each deliberate: the payment arm's NULL-sla filter guards TEST FIXTURES only (the prod path cannot write NULL -- see the pass's F2, which found and fixed the real mechanism); where no timing_config is in force the ORDER_NOT_READY arm yields nothing -- this is a HINT list, not a write guard, so unlike the payout lock it does not fail closed.
Found while testing (the fixture corrected two assumptions):
  The v2.4 matrix gives ANALYST seller.claims:read -- the first draft of the grant-filter test assumed otherwise from a T15 comment about ACTING grants. INVENTORY is the role that discriminates (orders:read without claims:read); the fixture now seeds one.
  A MOBILE stranger receives 403, not 404: the SURFACE gate fires first (U0001, identical for members and strangers alike -- every mobile caller of a console-only permission gets the same answer, so no oracle). A CONSOLE stranger reaches the relationship gate and gets the S19 404. The test asserts both arms and says why.
Verification: c3-orders 23/23 including the six obligation arms -- interleaved three-kind nearest-deadline-first ordering (the assertion a client-side sort or grouping could not fake), deadlines equal to their SOURCE values (sla_deadline verbatim; clock_stopped_at + fulfilment_window computed by Postgres), the grant filter, both gate arms, the empty 200, and acting-on-it-removes-it (marking ready drops the entry while the others stand).
Pass: one adversarial reviewer traced every arm against the schema, the lapse job, the grant seed and the locale; no blocker; ONE MAJOR -- the work order's exact warned failure, found before merge. F1 FIXED: fn_confirmation_window_lapse leaves the order in PAYMENT_SUBMITTED, so a missed window KEEPS its payment entry -- overdue, sorted first, the decision still genuinely owed -- beside the new SYSTEM claim; the pre-lapse sentence ("a claim opens automatically...") would then promise, in the future tense and FOREVER, exactly what already happened and cannot happen again (the one-open-claim guard). The payment arm now detects the open SLA_BREACH claim and switches the entry to obligation.payment_awaiting_confirmation.consequence_lapsed ("The window was missed: a claim has opened... The payment still needs your decision") -- which is the reason consequence_key rides the wire explicitly rather than being client-derived from the kind. Asserted: the post-lapse arm seeds the shape and proves both entries, the switched key on the stale one, the pre-lapse key on a fresh one, and the overdue-first ordering. F2 FIXED, two halves: this entry's first draft described a "NULL sla_deadline" fail-quiet case that CANNOT occur on the prod path (the window column is NOT NULL; only test fixtures write NULL -- the IS NOT NULL filter is a fixture guard and now says so); the REAL artifact was worse -- commitEvidence's INSERT..SELECT JOIN timing_config wrote ZERO submission rows after the state flip when no config was in force, leaving a PAYMENT_SUBMITTED order invisible to the clock and this list while the lapse job (own derivation) would still claim it: the purest false negative. commitEvidence now FAILS LOUDLY (500, the whole commit rolls back) when the insert writes no row -- a missing config is our defect. F3 NOTED: the stored sla_deadline and the lapse job's transition-time derivation are the same instant at write time (one transaction), but a timing_config version change mid-window diverges them -- shorten the window and the claim opens BEFORE the rendered deadline. Bounded (one 24h window per config change; no operator API mutates timing_config today); recorded rather than engineered around. F4 NOTED: an order whose courier accepted custody without mark-ready still lists as ORDER_NOT_READY ("the buyer is waiting" overstates for that sliver); kept -- mark-ready remains the clearing action and allowed_actions still offers it; hygiene reading recorded. F5: S12.12b's cell says each entry carries "the id and the route"; the payload carries object_kind+object_id and the route is the console's kind->route mapping (the ACTION_ROUTE precedent) -- recorded HERE as a contract deviation the next reissue should bless or reverse, not just a reading. And this entry's own "fulfilment_window is read by NOTHING" is past-tense as of this phase (the arm and its test read it); corrected.
Ruling needed: the fulfilment-lapse job (above); the refund-report window (above); whether claim review windows should move from the hardcoded 2 days into timing_config; the S12.12b route cell (F5); the F3 divergence if timing_config ever gains an operator mutation path.

### D-236 - T16 Phase 3: SC-01 Home surfaces obligations; the daily brief becomes real; four readings recorded

Severity:  the point of the order lands; Home's stub is gone
Phase:     T16 Phase 3
Source:    apps/console (Home.tsx, lib/clock.tsx, readiness.spec.ts); packages/locale
Effect / Response, each:
  REGION  "What needs you" renders ABOVE both lives whenever the server's list is non-empty -- FLAT, nearest-deadline first AS SERVED (no client sort, no grouping; S3.2). Each row: the kind's title, a link to the object (OBLIGATION_ROUTE, the ACTION_ROUTE precedent and D-235 F5's recorded reading), the deadline through the clock module, and the SERVER's consequence_key rendered verbatim. A failed load renders as failure and blanks nothing (the D-225 S-M3 rule); an unknown kind renders unlinked with its code visible, like an unrouted readiness action.
  CLOCK  the OBLIGATION deadline treatment lives in lib/clock.tsx WITH the order clocks (C-4's one-module rule): server-skewed, minute tick, refetch-once at zero, deciding nothing. One deliberate difference, a domain truth: an order clock's zero always precedes a state change, so its elapsed text is transitional; an OVERDUE obligation legitimately PERSISTS after its refetch, so it renders the standing word "Overdue" -- not "checking with the server" forever.
  BRIEF  Life 2's DailyBrief is REAL (the brief_pending stub and its key retired): R23's rolling 7 days against the preceding 7, FIXED, NO PICKER (SC-12 owns the picker; the e2e asserts no [data-period] exists on Home). Two windowed overview reads supply the pair. ONLY `orders` is windowed on that endpoint, so orders is the compared number and the point-in-time tiles (products, active reservations, handoffs, followers) render once as current totals -- comparing a point-in-time count across two windows would fabricate a trend. No client-derived rates.
  EMPTY  an empty list in Life 2 reads as a good state beside the summary ("Nothing needs you right now."). Over Life 1's unfinished readiness list it renders NOTHING EXTRA -- telling a seller "nothing needs you" above nine unfinished readiness items would be false in spirit; the readiness items are what need that seller and they are already on screen. Recorded as the reading of S3.1's empty-state sentence.
  BADGE  NOT built, per the order's own [!]: nothing pushes, so a nav count would be a promise of currency nothing keeps -- registered here as OWED to a push/refresh mechanism, not built against a poll.
Verification: pnpm verify:console-e2e -- the ordering arm drives the REAL server (the seed's overdue lapsed payment first, rendering "Overdue"; the fresh payment; a claim the seeded buyer files THROUGH THE BUYER WIRE at +2 days, strictly interleaved; the unready order at +90h, ~3.8 days), asserts the region sits above the readiness list, the consequences render the server's sentences verbatim, and the claim row navigates to the claim. The Life-2 arm plants readiness-satisfied and an empty obligations list (the R21 pattern -- the seeded seller is genuinely obligated, so empty is unreachable for real) and asserts the good state, the week-on-week orders line from two REAL windowed reads, and the absence of any picker.
Pass: one adversarial reviewer; rule-1 confirmed clean (no sort, no grouping, no derived trend -- two server numbers side by side; the date arithmetic is query parameters, the recorded Analytics precedent); the shared clock Set, the empty/good readings, the locale, and the ordering arm's non-fakeability all confirmed. ONE MAJOR, fixed: the brief's two windows OVERLAPPED by a day and "previous 7" spanned EIGHT -- the endpoint's window is inclusive calendar dates (hi = to + 1 day), so from=now-7d / to=now-7d counted the boundary day in both numbers; two honest server figures answering a dishonest question, invisible to the e2e's digit regex. Now seven DISJOINT days each (from=now-6d; from=now-13d&to=now-7d). One MINOR, fixed: an unknown consequence_key silently dropped the mandated "what happens if not" (and the comment claimed a log that never happened) -- it now renders AS the key, visible and greppable, the Feedback.tsx message_key precedent; a row whose stakes silently vanish is the list learning to lie. Doc arithmetic corrected: the unready deadline is clock_stopped_at(-78h) + 7d = +90h (~3.8 days), not "+~6 days"; the interleave margins (>=27h) stand. Recorded, not built: the obligations 403 rendering the retry-worded failure line is unreachable today (the door grant is held by every role; a split would need a grant that does not exist) -- noted against S3.4 should grants ever change; Home's loads inherit the pre-existing no-generation-guard shape (unreachable without a same-route seller switch; DailyBrief's cancelled flag covers its own); the e2e buyer-wire localhost hardcode and the UTC day boundary for an EAT market are inherited repo-wide patterns, named here for the harness-debt list.
Ruling needed: none new (the badge's push mechanism is product work; the keeps stand at their homes).

### D-237 - T17: the identity_config row that was never seeded, and the publication it silently blocked

Severity:  no seller could EVER publish, in any market this seed creates; fixed here
Phase:     T17 (S6, the first fix off the CANNOT list)
Source:    ops/scripts/seed.mjs. The rule itself (0018) is UNCHANGED and correct.
Finding:   T17's walk asked the server what a brand-new seller still owed and got
  IDENTITY_VERIFIED back, on a market whose eligibility_config carries
  id_verification_requirement = 'OPTIONAL'. The cause is not the rule: 0018 satisfies
  IDENTITY_VERIFIED when an attestation exists OR when identity_config.identity_required
  is false and the seller's eligibility path is not IDENTITY, and it fails CLOSED when
  the config row is absent (coalesce(v_idreq, true)). Fail-closed is right. The defect is
  that the seed writes market, timing_config, ladder_config and eligibility_config and
  has never written identity_config -- so the row the rule reads did not exist, "required"
  was the answer, and the ONLY endpoint that satisfies it is operator-only (G1.1; a seller
  session gets 403). Every seller was therefore permanently one readiness item short of
  publishing, and could only be cleared by an operator acting for them. The two settings
  are orthogonal knobs, not one field written twice (0018 says so); their COMBINED effect
  was the contradiction -- one row admitted the seller, the other held them forever.
Effect / Response:
  ROW  the seed now writes core.identity_config for the market it creates:
    identity_required = false, verifier_kind = VIDEO_CALL, accepted_id_types = {}.
    Guarded by WHERE NOT EXISTS, like every configuration row beside it, so reruns
    change nothing. VIDEO_CALL and not KYC_VENDOR because no KYC vendor is selected
    (the fake-adapter guard lists it as such) and G1.1's flow is an operator attesting
    about a named person with no image ever reaching Adulis. accepted_id_types is empty,
    which the table's own CHECK permits ONLY because identity is not required -- flip
    that boolean and the constraint forces whoever flips it to say what is accepted.
  NOT A NEW BUSINESS DECISION  the founder ruled it in session (T17 S6 follow-up), and
    it follows the market this seed already describes. It is recorded here as an interim
    ruling with its document debt: identity_required appears NOWHERE in ADU-VAL-01, so
    per the root CLAUDE.md this was a genuine gap to report rather than a deliberate
    deferral, and the next reissue should state the beta answer in the document.
  WHAT IS NOT RELAXED  the second arm still carries v_eval.path <> 'IDENTITY'. A seller
    who took the IDENTITY route to eligibility STILL needs a real attestation before
    publishing -- no grace period, no bypass column. Only sellers admitted by the
    AUDIENCE arm skip it, which is what OPTIONAL means. Proved, not asserted (below).
  THE CONSEQUENCE, STATED  this market also carries audience_required = false and
    follower_threshold = NULL, so every seller takes the AUDIENCE arm and passes it
    trivially. After this row, NOTHING in this market verifies a seller's identity or
    their audience. That is the beta that was asked for. It is the first line to revisit
    when the beta ends, and it is written down here so that revisiting it is a decision
    rather than a discovery.
  ALREADY ASSUMED BY THE TESTS  c1-onboarding.e2e.spec.ts has been creating its own
    market WITH an identity_config row (identity_required = false) since it was written.
    The API suite therefore passed while the seeded market was broken -- a fixture that
    supplies what production data lacks is how a whole-system defect stays invisible.
Verification: against the reset database, through core.fn_publication_readiness for the
  seller T17's walk created:
    before   IDENTITY_VERIFIED | f | COMPLETE_IDENTITY_VERIFICATION
    after    IDENTITY_VERIFIED | t |
  and the safety arm proved by appending a second evaluation with path = IDENTITY inside
  a rolled-back transaction (the table is append-only, so UPDATE is refused):
    IDENTITY path, no attestation  -> f, COMPLETE_IDENTITY_VERIFICATION  (still blocked)
    AUDIENCE path, no attestation  -> t                                  (clears)
  The remaining three items for a new seller (STORE_PROFILE, PAYOUT_DETAILS,
  FULFILMENT_CONFIG) are all seller-doable, PAYOUT_DETAILS only after the 24h new-device
  lock -- which is a separate CANNOT on T17's list and is not touched here.
  Regression guard: zz-beta-walk.spec.ts now makes its ONE assertion --
  expect(todo).not.toContain('IDENTITY_VERIFIED') -- so if the row goes missing again the
  walk goes red rather than narrating the outage in a log line nobody reads.
Pass: adversarial, per S6 (this touches identity). Three things checked and one wording
  corrected. (1) The first draft of the seed comment claimed the two rows "disagreed" as
  though they were the same field; they are orthogonal by 0018's own comment, and the
  claim is now stated as a contradiction in combined EFFECT, which is what it is.
  (2) The IDENTITY-path arm was not taken on trust -- it was executed, and it still
  blocks. (3) The production path: a seed is dev and local-beta data, so this does not
  write the row in a production database. There is no operator API that writes
  identity_config, and no production database exists (the API refuses to start under
  NODE_ENV=production -- T17's first CANNOT). Recorded as owed: whichever of those two
  arrives first must carry this row with it, or the same silent block returns on the day
  the product is real.
Ruling needed: the beta answer for identity_required belongs in ADU-VAL-01 or the
  reissued document, not only in a seed and this entry; and an operator path for writing
  market configuration, which today exists for no configuration table at all.

### D-238 - T17: the chooser can create a store; the register number stops being read to sellers; the e2e harness stops leaving a seller behind

Severity:  a new seller could not reach store creation without typing a URL; fixed
Phase:     T17 (S6, the second fix off the CANNOT list)
Source:    apps/console (Chooser.tsx, chooser.spec.ts); packages/locale; ops/scripts/verify-console-e2e.mjs
Effect / Response, each:
  LINK  T17's walk signed up a brand-new account, landed on "/", and found a box
    demanding a store id it had never been given -- with NOTHING on screen offering to
    make one. /s/new had to be typed into the address bar. The route already existed;
    nothing pointed at it. The chooser now carries the prompt and the link. This is the
    point at which a real seller stops and messages the founder, so it is the point
    chooser.spec.ts now defends with its own test (click the link, land on /s/new, see
    the create button).
  SENTENCE  the gap sentence no longer reads a defect number to a seller in Addis. T9
    S4.2's ruling was that the hole must be LABELLED ON SCREEN, and it still is -- what
    changed is WHO the label is for. The register citation now rides the DOM as
    data-gap="D-97" and the sentence is plain English. chooser.spec.ts asserts BOTH the
    attribute and the plain sentence, AND that the seller-facing text does NOT contain
    "D-97" -- so the hole still cannot be quietly closed over, which is what that test
    was written to prevent, while the seller stops paying for our bookkeeping.
  NOT FIXED, DELIBERATELY  enumerating the stores an account holds still has no
    endpoint. D-97's own Action line rules why: "the endpoint's shape (owner stores
    only? team memberships? role per store?) is contract design, not console
    transcription." /v1/bootstrap does not carry memberships; every /v1/seller/* path
    is scoped to one store by X-Adulis-Seller, and a GET under /v1/seller would trip
    requiresSellerContext -- so serving it would mean either widening a security guard's
    exemption list or inventing a new top-level namespace. Both are contract design.
    The prime rule holds: report the gap, do not fill it. T17's walk therefore still
    reports step 14 (a returning seller is asked to paste a store id) as CANNOT, and
    that is correct rather than an oversight.
  AMHARIC  two new keys carry Amharic that has NOT been reviewed by a speaker. T17 S4
    put Amharic quality out of scope and a missing key is a compile error, so something
    had to be written; MT-KEYS.md now lists both as machine-translated. Flagged here
    and in the PR rather than passed off as done.
  HARNESS  verify:console-e2e now resets the database AFTER a green run as well as
    before. It always reset before driving, which made its own run honest and said
    nothing about the next one -- but the suite now signs a seller UP for real
    (zz-beta-walk), so every green run left an account, a seller, a product and a
    variant behind. In ci:local the API `test` gate runs BEFORE console-e2e, so it
    inherits whatever the PREVIOUS run left. Fifteen walk runs grew that into 73 failing
    API tests with no code change behind them -- a regression introduced by this order's
    own diagnostic, found by watching the failure count climb run over run rather than
    by reading any one failure. Reset on SUCCESS only: a failed run dies with the
    database intact, because the state a failure happened in is the evidence.
Verification: pnpm ci:local -- all 25 gates, 531/531 API tests. pnpm verify:console-e2e
  -- 58 passed, and the walk draws the fix in a browser: step 2 turns from "no link from
  the chooser to creating a store -- /s/new must be typed" into "the chooser offers a
  link to create a store", and goes on to use it. The teardown was verified by counting
  rows afterwards: sellers=1, accounts=2, exactly what the seed defines.
Flakes: two D-217-class OTP-budget failures were met and cleared on the way (429 vs 202
  on a request leg, and one in t6-ownership-transfer). Different test each run, both
  green in isolation, neither related to console or locale. Recorded, not chased.
Ruling needed: the sellers-list endpoint's shape, which is D-97's standing question and
  the only thing between a returning seller and their own store; and a speaker's review
  of the two new Amharic strings.

### D-239 - T17: the payout lock stops accusing a new seller; two gap sentences deleted, two DELIBERATE KEEPS left standing

Severity:  a first-day seller was told their account may be compromised; fixed
Phase:     T17 (S6, the sentence triage applied)
Source:    apps/console (Payout.tsx, store-admin.spec.ts, ProductEditor.tsx, Stock.tsx);
           packages/locale
Effect / Response, each:
  FIRST SET  the NEW_DEVICE lock sentence is correct for a CHANGE and wrong for a FIRST
    SET. A seller who signed up minutes ago has no payout details at all, and the lock
    still fires -- their only device is by definition one we have not seen. Telling that
    person "a sign-in from a device we have not seen ... if that was not you" reports a
    security event that did not happen, on the day they joined, on the screen where they
    are trying to get paid. The panel now renders a first-set sentence when reason is
    NEW_DEVICE and BOTH active and pending are null: "You can add payout details once
    this device has been signed in for twenty-four hours. Nothing has gone wrong: this
    wait applies to any device we have not seen before, including the one you signed up
    on." Same lock, same reason, same lift, no accusation.
    THE LOCK ITSELF IS UNTOUCHED. Only the sentence changes, and only when there is
    nothing to change FROM. This is presentation chosen from server state, the same
    shape as the existing reason->sentence map -- the console still computes nothing.
  THE WARNING SURVIVES  a seller who HAS payout details and meets a new-device lock is
    exactly the person the original sentence was written for: someone whose account may
    be being taken over. A new planted arm proves that branch keeps the security wording
    verbatim, and that the first-set sentence does NOT appear there. Both halves are
    asserted, so a later simplification cannot collapse them into one.
  DELETED, TWO  console.catalogue.editor.attributes_owed named a screen that does not
    exist ("the category attribute list"), describing an intended design to a person who
    cannot use it; console.catalogue.stock.confidence_owed taught a seller what stock
    confidence is for the sole purpose of saying it is missing. Neither had a test and
    neither guarded anything. Gone, with their keys, from both locales.
  NOT DELETED, TWO -- AND THIS IS THE ENTRY'S POINT  T17's report triaged
    console.catalogue.products.cap_unreported and console.insights.analytics.export_owed
    as DELETE. Both were wrong, and the repository said so before I did:
    insights-inbox.spec.ts marks the export sentence "DELIBERATE KEEP: the worker and job
    table still do not exist (D-232)", and catalogue.spec.ts exists to assert that the
    console "names the cap it cannot yet report ... no invented N of 10". Two recorded
    decisions, each with a test standing over it. The triage was one line of judgement
    written while reading a locale file; the keeps were made while reading the wire.
    They were deleted, then RESTORED before merge. The report's SENTENCES list is left
    as written -- it is a point-in-time record and this entry is where it is corrected,
    not by editing the finding after the fact. Whether they should go remains the
    founder's call, now with the counter-evidence attached.
    The general lesson, which is the same one the chooser test encodes: a sentence that
    reads as awkward to someone skimming is often load-bearing to someone who was there.
    Check for the guard before removing the guarded thing.
Verification: pnpm ci:local -- all 25 gates, 531/531 API tests. pnpm verify:console-e2e
  -- 59 passed. The walk draws the first-set sentence in a browser on the day the seller
  signs up, and the control remains DISABLED beside it (the lock is a separate CANNOT on
  T17's list and is not touched here). store-admin.spec.ts asserts the real-server
  first-set branch (the seeded seller has no payout details) and the planted change
  branch, each denying the other's sentence.
Ruling needed: whether cap_unreported and export_owed should go after all, against the
  two deliberate keeps recorded above; and a speaker's review of the first-set sentence's
  Amharic, which is machine-written like the rest of this order's new strings.

### D-240 - T18 Phase 1: three fakes become null adapters; the boot blockers fall from six to four; and the push fallback that does not exist

Severity:  BLOCKER found during the pass (four notification templates have no delivery
           channel at all) - reported here, not introduced here
Phase:     T18 Phase 1
Source:    apps/api (app.module.ts, jobs/runtime.ts, push/social-platform/post-link
           adapters, fake-guard.ts, common/logging.ts); apps/api/test
The count, before anything else, because the order asked to be corrected from the tree:
  NINE fake/null classes exist, not eight. EIGHT call assertFakeIsPermitted. The API
  process constructs SIX of them; the ninth (NullInferenceAdapter) is deliberately
  outside the guard and always was. Two things the order's list and T17's own
  BETA-READINESS list both got wrong: PUSH_ADAPTER is not bound in AppModule at all
  (only jobs/runtime.ts, so the API never trips over it), and INFERENCE_ADAPTER binds
  the NULL, which does not throw. And THERE IS NO KYC ADAPTER - no class, no token, no
  file; it existed only as a line in the guard's docstring while a test asserted its
  absence (D-53). An adapter named in a comment and nowhere else is the cheapest
  possible fake.
  API-process guarded bindings:  6 before  ->  4 after.
  Integrations that still refuse production:  SMS and storage. Storage is TWO tokens
  (media, evidence) by deliberate design - grep the importers of the financial one and
  you hold the complete list of code that can touch payment-evidence bytes - and the
  ruling is explicit that one S3 implementation must not collapse them.
Effect / Response, each:
  RULING TRANSLATED  "no adapter, not a throwing one" cannot mean an ABSENT provider.
    There is no @Optional() anywhere in apps/api, so a missing provider is an
    UnknownDependenciesException at NestFactory.create - a boot crash, which is the
    opposite of the intended outcome. The ruling is discharged by the Null Object
    pattern NullInferenceAdapter already establishes: stay bound, satisfy the
    interface, answer truthfully. A fake pretends to be a vendor; a null adapter says
    there is no vendor.
  SOCIAL  NullSocialPlatformAdapter REJECTS both calls. Fabricating a profile was the
    one unacceptable option: the adapter's own INVARIANT is that the follower count
    comes from the adapter and never from the seller. Both call sites already land on
    the SPECIFIED degradation and neither changed - onboarding.service.ts catches and
    returns 503-retryable (S13.1's "degrades to manual verification"), and
    e3-trust-stock.ts records UNKNOWN, never UNAVAILABLE ("A PLATFORM OUTAGE IS NOT A
    DELETED POST").
  POST-LINK  NullPostLinkAdapter returns null - the contract's own degenerate case, not
    an approximation of it: resolve is documented as returning null "when the URL
    resolves to nothing recognisable", and with no resolver bound nothing is. Callers
    unchanged: 422 POST_LINK_UNRESOLVED to the seller, an empty array to an anonymous
    storefront lookup.
  GUARD UNTOUCHED  assertFakeIsPermitted's body is byte-identical. All eight callers
    still call it. What changed is the BINDING SITE. The fakes remain, reached by tests.
  PUSH, AND THE FINDING THE PASS FOUND IN MY OWN JUSTIFICATION  the first draft of
    NullPushAdapter's docstring said "SMS and the in-app list carry every notification".
    THAT IS FALSE, and the adversarial pass caught it before merge:
      * NOTHING produces channel = 'IN_APP'. The only two mentions in the whole tree are
        the enum (0001:240) and the CLAIM side of the job (e2-notification.ts:122).
        There is no INSERT. S9.3's fallback exists on the read side with no writer.
      * The four PUSH producers have NO SMS TWIN. ORDER_AWAITING_PAYMENT_MORNING,
        STOCK_CONFIDENCE_NUDGE, TRIAL_ENDING and notification.chat.escalated are
        PUSH-only; the SMS set (NEW_DEVICE_SIGNIN, PAYOUT_CHANGE_*,
        OWNERSHIP_TRANSFER_*) is disjoint.
    So those four have NO ACTIVE DELIVERY CHANNEL. That is a real defect and it PREDATES
    this order - the fake was hiding it by answering DELIVERED, which marked the row SENT
    while nothing left the process. Binding the null does not create the loss; it stops
    the lie about it. Registered here for a ruling: either a producer writes an IN_APP
    twin, or those templates gain SMS, or the beta accepts that four notifications are
    delivered only if the recipient happens to open their list.
  WHY RETRYABLE  the enum is DELIVERED | RETRYABLE | TOKEN_DEAD and none of the three
    means "there is no provider". DELIVERED is the precise lie the guard exists to stop.
    TOKEN_DEAD is a fact about the DEVICE and e2-notification acts on it by clearing
    core.device.push_token - saying it here would un-register the very devices that
    should receive the first push the day a provider is bound. RETRYABLE is the only
    true one, and it does not loop: markFailed writes state='FAILED', which is terminal.
  THE ACCIDENTAL MITIGATION, NAMED AS ONE  notifications.controller.ts does not filter on
    state, so a FAILED row is still listed if the person opens their notifications. That
    is a property of one query, not a delivery channel, and it is recorded so nobody
    mistakes it for the fallback.
  LOGGING  runtime.ts logs `{ msg: 'job ok', job, ms, ...result }`, but
    LOG_FIELD_ALLOWLIST contained none of those keys, so the emitted line was literally
    {"msg":"job ok"} with every count stripped - a delivery channel failing 100% of its
    rows reported success. That is the fake guard's own sentence ("the logs would look
    healthy") reappearing one layer down, in the process meant to make it visible. The
    seven operational scalars (job, ms, claimed, sent, suppressed, failed, dead_tokens)
    are now allowed: a compile-time job name, a duration and counts of rows. None is
    derived from user data and NEVER_LOG still excludes every sensitive value.
Verification: pnpm --filter @adulis/api test -- 544/544, including twelve new assertions.
  The nulls construct under NODE_ENV=production; the social null REJECTS rather than
  inventing a follower count; the post-link null resolves to null; the push null returns
  RETRYABLE and is asserted NOT to be DELIVERED and NOT to be TOKEN_DEAD; the four
  remaining API-boot blockers still refuse production, and their count is asserted so
  that nulling a fifth or re-binding a fake changes a test rather than only a paragraph.
  A behavioural arm in e2-e6.jobs.spec.ts runs the real job with a null push adapter and
  proves the row ends FAILED, sent = 0, dead_tokens = 0, and the device token SURVIVES.
  Measured end to end: `NODE_ENV=production node dist/main.js` now stops at
  FakeSmsAdapter, where it previously stopped at FakeSocialPlatformAdapter.
Pass: four adversarial lenses (guard integrity, consumer truth, data integrity,
  completeness). TWO MAJOR findings, both against my own work, both fixed before merge:
  (1) the false push justification above; (2) the rewritten fake-guard docstring was
  wrong AGAIN - it listed four of eight callers, said three still-guarded fakes were "no
  longer here" when only their binding site had changed, and claimed the Classifier "has
  never called this guard", conflating NullInferenceAdapter (which does not) with
  FakeInferenceAdapter (which does, at inference.adapter.ts:63). The header is now a
  mechanical list of all eight callers with the binding question separated from the
  guarding question, because the narrative form is what went wrong twice.
Flake: t12-d89-invite-claim failed once under gates (429 vs 202, then a different test in
  the same spec on the next run) - the D-217 OTP-budget class, 3/hour per phone against a
  platform-scoped row under parallel workers. Green 3/3 in isolation and 543/543 in a
  standalone full-suite run; it also flaked during T17, before any of this. Recorded, not
  chased, and unrelated: Phase 1 touches social, post-link and push, not SMS or sign-in.
Ruling needed: the four PUSH-only templates with no delivery channel (above) - an IN_APP
  producer, an SMS twin, or an accepted beta residual; and whether the worker should
  refuse to start when a channel it is scheduled to deliver has no provider at all.

### D-241 - T18 Phase 4: the new-device payout lock gains a subject; the cancel-then-set attack the first draft was open to; and one unreissued specification

Severity:  BLOCKER in the pass (a takeover path the first draft opened), fixed before merge
Phase:     T18 Phase 4
Source:    db/migrations/0047_payout_lock_first_set.sql; apps/api (financial.service.ts,
           c4-financial.e2e.spec.ts); apps/console (Payout.tsx, store-admin.spec.ts);
           packages/locale
Ruling discharged: T18 S4 -- "The lock exists to stop an attacker redirecting payments
  after a takeover. On a brand-new account there is nothing to redirect."
Effect / Response, each:
  THE PREDICATE IS "HAS NEVER HAD A PAYOUT ROW", NOT "HAS NO ACTIVE ROW". The first
    draft read the ruling literally and used state = 'ACTIVE'. The adversarial pass broke
    it in one move, and the move is free:
      CANCEL-THEN-SET. core.fn_cancel_payout_change (0022) requires NO step-up, checks NO
      lock and is deliberately easy -- "reverting must always be easier than changing".
      An attacker who has taken over an account, on a device we have never seen, cancels
      the seller's legitimate PENDING first set. That leaves no ACTIVE and no PENDING row,
      an ACTIVE-only carve-out then applies, and the attacker sets their own bank account
      UNLOCKED. Before this migration they were held for the full window.
      Aggravating: activation is lazy and reader-driven. core.fn_activate_due_payout is
      invoked from exactly ONE place in the product (the GET on /v1/seller/payout) and no
      job calls it, so a due PENDING stays PENDING -- and stays cancellable -- until
      somebody opens the payout screen. The window is not 24 hours; it is "until the
      seller next looks".
    A CANCELLED row is still a row, so "has this seller EVER had payout details" is the
    question an attacker-controlled move cannot walk back. Asserted by an arm that
    performs the whole attack and requires NEW_DEVICE at the end of it.
  GUARD ORDER CHANGED, DELIBERATELY  one-pending-per-seller now runs BEFORE the
    new-device lock. Without the move, a seller with a change already in flight would be
    refused with a message about a device; the true and more useful answer is that they
    have a change pending. Both are refusals and neither writes, so nothing is weakened.
    Asserted by its own arm.
  THE TWIN  payoutLockState (SC-24's proactive panel) carries the identical predicate in
    an `ever` CTE. A panel that disagrees with the write path is worse than no panel, and
    the first draft had them agreeing on the WRONG predicate, which would have hidden the
    attack from the screen as well as from the server.
  WHAT IS NOT RELAXED  a seller with ANY prior payout row changing from an unseen device
    is still locked for the full window; the activation delay still stacks downstream;
    RECOVERY_COOLING runs before this guard and knows nothing about payout rows, so a
    first set cannot step around account recovery (asserted); step-up is still required
    on every set, first or not.
  T17'S SENTENCE IS RETIRED, WHICH IS THE BETTER OUTCOME  D-239 added a first-set variant
    of the NEW_DEVICE message because the change-wording accused a day-old seller of a
    break-in. Phase 4 removed the STATE instead of wording it more kindly, so the branch
    became unreachable and the string is deleted rather than improved. D-239's "THE LOCK
    ITSELF IS UNTOUCHED. Only the sentence changes" is superseded by this entry.
  R20 KEPT ITS ASSERTION  the real-GET e2e now proves the opposite case (no lock at all),
    so "locked implies the control is DISABLED" moved to the planted CHANGE arm rather
    than being lost with the test that used to carry it. The pass caught that it would
    otherwise have had no assertion anywhere in the suite.
  A TEST THAT COULD NO LONGER FAIL  the unsuppressible-notification assertion counted
    PAYOUT_CHANGE_REQUESTED rows globally with toBeGreaterThan(0). The new first-set arm
    creates one, so the later assertion was satisfied in advance. It is now a delta,
    scoped to the row its own arm creates.
Verification: pnpm ci:local -- 25 gates. c4-financial 17/17, including: the panel silent
  BEFORE a first set and reporting NEW_DEVICE one request AFTER it (the lock arms itself
  the moment there is something to protect -- the carve-out is a property of the seller's
  history, not of the device); a CHANGE from an unseen device still 409/NEW_DEVICE with
  no row written; the full cancel-then-set attack ending in NEW_DEVICE; a PENDING change
  refused as PAYOUT_CHANGE_PENDING; and recovery cooling still firing with no payout row.
  Browser-drawn: zz-beta-walk step 4 turns from "on day one the payout control is
  DISABLED and the screen says ..." into "payout details can be set on the day of
  sign-up". T17's BETA-READINESS CANNOT #5 is answered.
Pass: four adversarial lenses (takeover, twin consistency, migration fidelity, blast
  radius). ONE BLOCKER-class finding -- the cancel-then-set path above -- plus a lost R20
  assertion, a pre-satisfied notification assertion, and stale comments, all fixed before
  merge. The findings were against my own first draft in every case.
Ruling needed / DOCUMENT DEBT, recorded rather than assumed:
  1. ADU-AUTH-01 v2.6 S20 states the new-device payout lock UNCONDITIONALLY, and v2.5's
     invariant quantifies the guarantee as "an attacker needs 48 hours under a push
     notification the real seller has already received". For a seller who has NEVER had
     payout details it is now 24 (the activation delay alone). The narrowing is a founder
     ruling (T18 S4) carried as an interim ruling; the specification is unreissued and
     the amendment is owed. Neither document is edited here -- transcribe, do not design.
  2. core.fn_cancel_payout_change accepting a row whose activates_at has already passed,
     given that activation happens only when someone reads. Not touched by this phase.
  3. Whether activation should have a job rather than depending on a reader.
### D-242 - T18 Phase 2: the image reorder had never once succeeded, and the fix for the last finding about it was never exercised either

Severity:  BLOCKER - a shipped endpoint that could not work in any environment
Phase:     T18 Phase 2 (the half that needs no storage vendor)
Source:    db/migrations/0048_product_image_position_deferrable.sql;
           apps/api/src/modules/catalogue/catalogue.service.ts; c2-catalogue.e2e.spec.ts
Finding:   PUT /v1/seller/products/{id}/images/order could not succeed against the real
  database, ever, since 0007 created the table. The service parked positions at 100,
  101, ... to clear the UNIQUE range before placing them 1..n, but 0007:242 declares
  `position int NOT NULL CHECK (position BETWEEN 1 AND 5)`, so the FIRST parking UPDATE
  raises 23514. Proven against the live schema rather than argued -- a row inserted, the
  parking UPDATE run, and the constraint quoted back:
      BLOCKED by 23514: new row for relation "product_image"
      violates check constraint "product_image_position_check"
  Both constraints are right; the technique was wrong. The parking trick exists only to
  dodge a non-deferrable UNIQUE and is defeated by the CHECK that bounds the range.
THIS IS THE SECOND TIME, AND THAT IS THE FINDING WORTH KEEPING. T14-C's C-5 pass already
  found the CLIENT half (the console sent [{id, position}] where the server takes
  `order: string[]`) and wrote, in its own words: "A green tsc, lint and e2e certified a
  reorder that had never once succeeded against the real API." The fix for that finding
  was ITSELF never exercised against the real API, because nothing called the endpoint:
  grep over apps/api/test and apps/console/e2e returns no caller of images/order. The
  same sentence, one layer down, in the same feature, twice. A fix without a test that
  drives it is a claim.
Effect / Response, each:
  0048  UNIQUE (product_id, position) becomes DEFERRABLE. The CHECK stays
    non-deferrable: a position outside 1..5 is never valid, not even transiently, and it
    is the constraint that caught this.
  INITIALLY IMMEDIATE, NOT INITIALLY DEFERRED -- a deliberate narrowing of the ruling's
    letter to serve its purpose, recorded rather than quietly kept. T18 S2 asked for
    "DEFERRABLE INITIALLY DEFERRED". That was written first and it broke something real:
    committing an image to a position already taken used to raise 23505 AT THE INSERT,
    which the translator turns into a 409 carrying reason = POSITION_TAKEN; under
    INITIALLY DEFERRED the violation moves to COMMIT, outside the statement that caused
    it, and the seller stops being told which position was taken. An existing test caught
    it; a seller would have met it as an unexplained failure. So: DEFERRABLE (the
    capability the reorder needs), INITIALLY IMMEDIATE (the behaviour every other writer
    already had), and the reorder opts in for its own transaction with
    `SET CONSTRAINTS core.product_image_position DEFERRED`. Narrowest possible scope --
    one code path, one transaction.
  ONE PASS  reorderImages assigns final positions 1..n directly. No parking, so every
    value written is inside the range at every step.
  VALIDATE BEFORE WRITING, and not for tidiness: inside the deferred transaction a
    violation surfaces at COMMIT with no statement context, so anything checkable is
    checked first. Duplicate ids -> DUPLICATE_IMAGE. An id that is not this product's ->
    UNKNOWN_IMAGE. A PARTIAL order -> PARTIAL_ORDER, because reordering three of five
    images leaves the other two holding positions the new order also claims, and "the
    whole ordering in one transaction, or it is a defect" is this endpoint's own rule.
    All three are VALIDATION_FAILED / 400, the codebase's existing convention; a new
    status for this one path would be an invention.
  THE CAP IS UNTOUCHED  five positions and one row per position is still what makes five
    images a structural fact rather than a counting rule. A deferred constraint still
    refuses a sixth at COMMIT.
Verification: pnpm ci:local -- 25 gates. c2-catalogue 15/15, including the first test in
  this repository's history that actually calls images/order against the real API:
    * a full REVERSAL of three images -- the case the parking trick existed for, where
      every row's new position is currently held by another row, so a naive one-pass
      update collides on its first statement unless uniqueness is deferred;
    * an adjacent SWAP -- the minimal collision, and the one a "just add one to each"
      implementation also gets wrong;
    * the three refusals, each asserted to move NOTHING.
  The constraint's state is checked in the database, not inferred:
    product_image_position   condeferrable=t condeferred=f   (DEFERRABLE IMMEDIATE)
    product_image_position_check condeferrable=f             (immediate, as ruled)
Owed, not built: a CONSOLE e2e that clicks reorder. Media.tsx already calls the endpoint
  correctly (T14-C fixed the body shape), but the seed carries no core.product_image
  rows and there is no way to view an image at all -- no signGet, no public URL -- so
  there is nothing for a browser to drag. It belongs with the storage adapter, and the
  lesson above says plainly why it should not be skipped again once that lands.
Ruling needed: none. The deviation from S2's letter is recorded above rather than
  invited, because the ruling's purpose is served and its letter cost a seller-facing
  error message.
### D-243 - T18 Phase 3: GET /v1/seller/list closes D-97; the chooser redirects; and a case-sensitivity hole in the seller-context guard

Severity:  D-97 closed; one pre-existing auth-boundary defect found and fixed in passing
Phase:     T18 Phase 3
Source:    apps/api (auth.guard.ts, onboarding controller + service, c1-onboarding);
           apps/console (Chooser.tsx, Shell.tsx, chooser.spec.ts, zz-beta-walk.spec.ts);
           packages/locale; contracts/openapi.json
Supersedes: D-97 ("The contract has no endpoint listing the caller's own sellers"), whose
  Action line ruled that "the endpoint's shape (owner stores only? team memberships? role
  per store?) is contract design, not console transcription". T18 S3 answered all three:
  owned AND team-membered, role per row. D-97 is not rewritten -- the register is
  append-only and records are not restated when the world moves -- so this entry is where
  it is closed.
Effect / Response, each:
  THE THIRD EXEMPTION  GET /v1/seller/list is exempt from requiresSellerContext, and the
    reason sits beside the other two rather than in a comment of its own: all three are
    paths under /v1/seller that no seller header can describe. Creation has nothing to
    name yet; identity verification is held by an operator who holds no seller; and this
    one asks WHICH sellers the caller holds, so requiring the answer as input is
    circular. Inventing a /v1/accounts namespace for one endpoint would have been the
    larger change.
  SCOPED TO GET AND HEAD, after the pass. The two existing exemptions are method-gated
    for free by sitting BELOW the POST check; this one sits above it and would otherwise
    have exempted every verb, so a later @Post('seller/list') would have inherited it
    silently. HEAD is included deliberately: Express routes HEAD to the GET handler, and
    a HEAD demanding a header the endpoint cannot accept would be a 400 nobody could fix.
  A CASE-SENSITIVITY HOLE, PRE-EXISTING, FOUND AND FIXED. Express routes
    case-INSENSITIVELY (nothing sets 'case sensitive routing'), so GET /v1/SELLER/payout
    reaches the payout handler -- but every predicate in requiresSellerContext was
    case-SENSITIVE, so that request skipped BOTH effects of section 4.2: no
    SELLER_CONTEXT_REQUIRED, and adulis.actor_role silently BUYER instead of SELLER. It
    fails closed one layer down today (assertPermission throws on a null sellerId rather
    than querying), so nothing leaked -- but the guard's own docstring promises "absent
    on a seller-scoped path -> 400" and that promise was false for any capitalisation.
    The path is now lowercased once, at the top. Raised against THIS phase rather than
    left as inherited debt for a specific reason: until now, requiresSellerContext
    returning false on a /v1/seller path was ALWAYS a bug. This change makes it a
    legitimate documented outcome for the first time, which is exactly the condition
    under which a case-variant request stops looking anomalous. Asserted both ways.
  THE QUERY  a UNION ALL of the two arms fn_has_permission itself uses. Three things the
    pass corrected before merge, each a real defect:
      DELETED  core.seller_status carries DELETED and both arms now exclude it. With the
        console's exactly-one redirect, listing a deleted store would forward a seller
        into it on every visit and leave them unable to reach the screen that offers to
        create a new one.
      DUPLICATES  team_member_is_never_owner constrains the ROLE VALUE (role <> 'OWNER'),
        NOT the account -- nothing stops an owner also holding an ADMIN row on their own
        store, and under UNION ALL it would be listed twice. Two rows also defeat the
        exactly-one redirect, stranding that seller on a chooser showing one store twice.
        The member arm now excludes the owner.
      TOTAL ORDER  ORDER BY created_at gained an id tie-breaker; two stores created in
        one transaction share a timestamp and the list would reshuffle between requests.
  NO fn_has_permission, deliberately. Every other seller-scoped read begins with it, but
    it asks "may this account act on THIS seller" and the answer here IS the set of
    sellers. There is no id to check against and no oracle: rows are selected BY account
    id. THE WHERE CLAUSE IS THE AUTHORIZATION -- there is no RLS on core.seller or
    core.seller_team_member, so any future edit to it is a security edit.
  THE CHOOSER  S2.1's rule is honoured rather than described: REDIRECT WHEN EXACTLY ONE,
    replacing the history entry so Back leaves the app instead of bouncing. The pasted-id
    box and D-97's on-screen sentence are gone because the gap is gone, which is the only
    acceptable way for them to go. The load no longer navigates or sets state after
    unmount.
Verification: pnpm ci:local -- 25 gates. c1-onboarding 37/37: the exemption proved by
  CONTRAST (the same session gets 400 SELLER_CONTEXT_REQUIRED one endpoint along), owner
  sees OWNER, a team member sees THEIR role, a stranger gets an empty 200 rather than a
  403 or 404, suspension both logs out and filters, revocation filters, a case-variant
  path still demands the header, an owner with a team row on their own store is listed
  ONCE, and a DELETED store is not listed at all. Browser-drawn: the walk's step 14 turns
  from "a returning seller is asked to paste a store id" into "a returning seller is
  taken straight back into their store", and step 2 from an EMBARRASSES naming a register
  number into "You do not have a store yet." T17's BETA-READINESS CANNOT #6 and #7 are
  both answered.
Pass: four adversarial lenses (exemption safety, the query, the console, contract and
  blast radius). The case-sensitivity hole, the DELETED omission, the duplicate-owner
  path, the missing tie-breaker, the unmount race and a tautological e2e assertion (four
  toHaveCount(0) checks that pass on a blank page -- D-152's exact class, now preceded by
  a positive assertion) were all found and fixed before merge.
Ruling needed:
  1. REACHABILITY, and it is the one thing this phase makes WORSE. A single-store seller
     is now redirected away from "/" and can no longer reach the two links that lived
     there: the courier entry point and "Create a store". Both remain reachable by typing
     a URL -- which is precisely the failure T17 recorded as the point where a real seller
     stops and messages the founder. SellerSwitcher is the ruled home for store switching
     and its blocker (D-97) is now gone, so building it is the obvious next step; whether
     the courier link belongs there, in the account menu, or somewhere else is a design
     decision and is not made here.
  2. The exemption rests on T18 S3's founder ruling, not on a reissued ADU-API-01 or
     ADU-AUTH-01. D-97's own Ruling line asked for governed authority. Recorded as
     document debt, like T18 Phase 4's.
### D-244 - T18 Phase 5: the trust flags become a launch gate; and the flag that enforces nothing says so

Severity:  a deliberate beta setting given a tripwire, so it cannot survive by inertia
Phase:     T18 Phase 5
Source:    ops/scripts/verify-trust-before-open-signup.mjs; ops/scripts/gates.mjs;
           ops/scripts/seed.mjs; package.json
Ruling discharged: T18 S5 -- "A hand-picked beta of twenty sellers is verified by the
  founder, not the system. That is correct for the cohort. What is not correct is `false`
  surviving by inertia. audience_required or identity_required must be TRUE before open
  signup."
Effect / Response, each:

### D-245 - T19 Phase 1: the switcher #80 owed, the courier entry point moved, and a deviation from S9.2 recorded rather than argued in one file

Severity:  a regression PR #80 shipped -- two routes reachable only by typing a URL
Phase:     T19 Phase 1
Source:    apps/console (SellerSwitcher.tsx new, Shell.tsx, SignIn.tsx, Chooser.tsx,
           console.css, chooser.spec.ts, zz-beta-walk.spec.ts); packages/locale
The regression, stated plainly: #80's redirect is RIGHT -- a returning seller belongs in
  their store, not on a chooser -- and it shipped without its replacement. The chooser
  carried two links, and forwarding a single-store seller past it left both reachable
  only by typing a URL: "Create a store" and the courier entry point. That is exactly the
  failure T17 recorded as the point where a real seller stops and messages the founder,
  reintroduced by the fix for it. T18 S3 said to build the switcher in the same PR as the
  redirect; that did not happen, and this entry is the debt.
Effect / Response, each:
  THE SWITCHER  built at last -- its blocker was D-97 and D-97 closed at T18 Phase 3.
    Store name, other stores as links, and "Create a store" ALWAYS.
  THE S9.2 DEVIATION, RECORDED HERE BECAUSE D-243 RESERVED IT FOR A RULING and arguing
    it only inside the file that deviates is how a rule gets quietly talked around.
    ADU-REPO-01 S9.2 says the switcher renders "ONLY when the account holds more than one
    seller". This renders something at one store. The reading: S9.2 protects against a
    menu that lies about having a choice, and at one store this is NOT a switcher -- it
    is the store's name plus the one control that must not be lost. Drawing nothing would
    satisfy the letter and leave the regression in place. Recorded as an interim reading
    against an unreissued document; the alternative is to put "Create a store" somewhere
    else entirely, which is a design decision and not made here.
  THE COURIER ENTRY POINT moved to SIGN-IN, per T19 S2's ruling: a courier is not seller
    staff, holds their own account, sees only assigned orders, and has no store to be
    redirected into. Routing them through a store chooser was wrong before the redirect
    made it visible.
  AND THE CLICK HAD TO SHOW SOMETHING. /courier sits behind RequireSession, so following
    that link while signed out bounces straight back to sign-in -- correctly, and with
    `from` armed, so the courier DOES land on their deliveries after verifying. But the
    round trip is invisible: the address bar ends where it started. On the one screen a
    courier meets first that reads as a dead link, so the screen now says what will
    happen.
  IT ALSO STAYS ON THE CHOOSER, in EMPTY *and* READY. The first draft gated it on EMPTY
    alone and the pass found the case that breaks: a courier who ALSO holds stores. With
    two stores they land on the chooser and would have found nothing.
Pass: three adversarial lenses. TWO BLOCKER-class findings, both against my own draft:
  FAIL-QUIET CONFLATED FAILURE WITH EMPTINESS. The catch set rows = [], which renders
    byte-identically to an account with exactly one store: the generic "Your store", a
    menu with no stores in it, and no sign anything had failed -- for the whole session,
    because the fetch runs once per Shell mount and Shell does not remount on navigation.
    A seller with three stores who hit one dropped request would have concluded they had
    lost access to two of them. The failure is now its own state, with a retry, and an
    arm asserts the difference. (A 401 never reaches that catch: api() fires the global
    unauthorized handler first and RequireSession redirects -- checked, not assumed.)
  THE COURIER LINK GATED ON EMPTY (above).
  Four more fixed: no CSS existed for ANY switcher class, so the menu rendered as an
    unstyled in-flow block that pushed the whole page down, with default disc bullets;
    the topbar's `margin-right: auto` was orphaned by the new nesting -- an auto margin on
    a non-replaced INLINE box computes to zero, so the bell and Sign out silently
    un-pushed from the right edge of every seller route; the menu had no dismissal path
    (Escape and click-outside added, and it now closes on navigation, which otherwise
    left a panel describing where you no longer are); and Shell.tsx's own header still
    told the next engineer the switcher could not be built.
Verification: pnpm ci:local -- 26 gates, 558/558, 65 e2e. New arms: the multi-store
  switcher (the behaviour S9.2 actually rules, which had NO coverage -- names this store,
  offers a switch, lists the other, Escape closes, switching navigates); the failed list
  proving it is never mistaken for one store and that the rest of the console still
  renders; and the single-store seller reaching "Create a store" from "/" without typing.
  Browser-drawn, from the state that broke, in zz-beta-walk step 14:
    "a returning seller is taken straight back into their store"
    "a redirected seller still reaches Create a store, from the switcher"
    "signing out reaches the courier entry point, which says it will resume there"
  The walk owns its account and runs last, which is why it is the one place the SIGNED-IN
  path can be driven: the shared suite session cannot sign out without revoking the row
  every later spec authenticates with.
Ruling needed: a courier who ALSO holds exactly ONE store is still redirected into it and
  must sign out to reach /courier. Rare, and not fixable on the chooser -- that account
  never sees the chooser. If it matters, the entry point belongs in the topbar beside the
  switcher, which is the design decision this phase did not make.
  THE GATE  a market may not be open to public SELLER registration while measuring
    nothing about the sellers it admits. It fails when, for one market:
    seller_registration_enabled AND registration_enabled are true, AND
    eligibility_config.audience_required is false, AND identity_config.identity_required
    is false. Buyer registration is deliberately not consulted (a buyer is not a seller
    and neither flag measures one), and neither is activation_state (a market can be
    ACTIVE for OTP delivery while seller signup stays shut, and conflating them would
    fail markets doing the right thing).
  A GATE, NOT A SEVENTEENTH CHECK, and the repository had already ruled it. db-check.mjs
    exits 2 on any count but sixteen; "sixteen checks" is written into TWO governed ASCII
    specifications (ADU-DB-01 v1.16 Appendix C, ADU-REPO-01 v1.3); and gates.mjs's own
    comment reads "NOT a seventeenth db/checks file ... a governed set". Appendix C is
    closed. The gate list is not, and carries no frozen count. This is gate 26.
  FAIL-CLOSED ON AN ABSENT CONFIG ROW, matching 0018's own reading: a missing
    identity_config means identity IS required (coalesce(..., true)), which is the safe
    side, so an absent row does not fire this gate.
  GREEN TODAY, BY CHANGING THE SEED RATHER THAN THE GATE. seller_registration_enabled is
    now seeded FALSE, because the beta genuinely is invite-only. D-93 is why this
    mattered: console build-output gates that went red on every backend-only PR produced
    the finding "a red that teaches people the gate lies", and a gate people learn to
    skip is worse than no gate.
  AND THE CAVEAT IS WRITTEN DOWN IN BOTH PLACES. NOTHING IN THE CODEBASE READS
    seller_registration_enabled -- this gate is its FIRST reader. Setting it false makes
    the flag HONEST ABOUT INTENT and ENFORCES NOTHING. The beta is invite-only because
    the founder controls who gets a link, not because any code refuses anyone. That is
    fine for a beta and it is recorded here, in the seed and in the gate script, because
    the day someone assumes the flag is enforcing is the day it isn't.
Verification: pnpm ci:local -- ALL 26 GATES (the new one runs at position 17). The gate
  was driven through all three states against the live database rather than reasoned
  about:
    closed signup, nothing measured   -> PASS   "SEED  seller signup closed  measures: NOTHING"
    OPEN signup, nothing measured     -> FAIL   "1 market(s) open to public SELLER
                                                 registration with neither audience nor
                                                 identity required: SEED"
    OPEN signup, identity required    -> PASS   "SEED  seller signup OPEN  measures: identity"
  Reproduced by: update core.market set seller_registration_enabled = true;
                 pnpm verify:trust-before-open-signup   -> exit 1
Ruling needed: whether seller_registration_enabled should ever ENFORCE rather than
  declare -- i.e. whether POST /v1/seller should refuse when the market's seller signup is
  closed. Not built here: it would turn a declarative flag into an access control on the
  one path a hand-picked beta seller must still walk, and that is a product decision.

### D-246 - T20 S2: the merge that spliced one entry into another; and the CI ruling whose premise the Actions history refutes

Severity:  the register carried a corrupted entry on main; and a ruling corrected by evidence
Phase:     T20 S2
Source:    docs/build-status/DEFECT-REGISTER.md; .github/workflows/ci.yml; README.md
Effect / Response, each:
  THE SPLICE  #82 reordered the register tail and #83 appended D-245; both were merged on
    origin by hand while this session prepared the same merges locally. The hand
    resolution pasted a 67-line chunk of D-241's body -- the cancel-then-set attack --
    into the MIDDLE of D-244's entry. No heading was duplicated, so a heading count reads
    clean and the file LOOKS ordered; D-244 simply turns into D-241's text partway
    through. Found by the S1.2 multiset comparison, which exists for exactly this: the
    clean resolution and origin's differed by +67 lines with zero lines lost, and the
    probe line's two occurrences sat under two different headings. Repaired by removing
    the contiguous spliced run, PROVEN by the repaired file equalling the clean
    resolution as a multiset -- zero lost, zero extra.
  THE RULING'S PREMISE, CORRECTED BY THE ACTIONS HISTORY  T20 S2.1 ruled "CI runs on
    push to main, not only on pull_request... only the trigger changes." The trigger has
    ALWAYS covered main (push: branches: '**'), and the run history proves it fired:
    every merge to main has a recorded run, and the merges of #80 and #81 each produced
    a RED run on main at 07:10 and 07:12 -- two hours before the next order started and
    tripped over the breakage. So the ruling's mechanism already existed, and what it
    buys is exactly what happened: a red main RECORDED within a minute and looked at by
    nobody. The gate saw the merged tree. Nobody saw the gate.
  WHAT IS ACTUALLY DONE  the premise correction is written at the trigger itself in
    ci.yml, so the next person does not re-derive it; README.md gains the main-branch
    status badge at the very top with the instruction that a red badge precedes every
    other task; and the stronger fix -- branches current before merge -- remains
    branch protection, recorded unenforceable on this plan (ADU-CON-02 S21). The
    fifth state-divergence finding stands as named (the merged tree is a state neither
    branch tested), but its remedy is visibility, and the trigger was never the gap.
Verification: the multiset proof above; the Actions API listing (runs on main for every
  merge sha, conclusions success/failure as stated); pnpm ci:local on the MERGED main.
Ruling needed: none. The parked item stays parked: branch protection when the plan
  allows it.

### D-247 - T20 S3: the courier entry point becomes a line in the switcher menu, discharging D-245's parked ruling

Severity:  D-245's parked case closed -- a courier who also owns exactly one store
Phase:     T20 S3
Source:    apps/console (SellerSwitcher.tsx, console.css, chooser.spec.ts); packages/locale
Ruling discharged: T20 S3 -- "the courier entry point is reachable from inside a store,
  as a LINK, not a mode. One line in the switcher menu -- Courier deliveries -- routing
  where the sign-in screen routes."
Effect / Response:
  A LINK, NOT A MODE, and the distinction is the ruling's own reasoning: ADU-MOB-01
  makes buyer/seller a real mode with its own session semantics; this is one person with
  two unrelated relationships to Adulis, and a link is the honest shape. Nothing
  session-like changes on the click -- the same cookie rides, and SC-C1 renders inside
  its own route tree with none of the seller shell (the C-8 rule, untouched).
  The line renders for EVERY seller, courier or not. The console cannot know which the
  account is (the roles[] rendering hint is the owed refinement, D-228), and a
  non-courier who follows it meets SC-C1's empty state, which explains itself.
  D-245's parked sentence -- "if it matters, the entry point belongs in the topbar
  beside the switcher" -- is answered by the founder's ruling with exactly that.
Verification: pnpm ci:local -- 26 gates. The e2e arm starts where the parked case
  starts: at "/", REDIRECTED into the single store, then reaches /courier through the
  switcher menu and asserts SC-C1's own root renders. The adversarial pass caught the
  first draft asserting a <main> that does not exist at /courier (SC-C1's root is a
  data-screen div, deliberately outside the seller shell) and starting the arm one step
  past the state that broke.
Ruling needed: none.

### D-248 - The last fatal item that was an engineering task: a product can carry a photograph

Severity:  RESOLVED (was BLOCKER - BETA-READINESS fatal item 3)
Phase:     T20 - S4
Source:    T17's beta walk, step 5: "The product screen has no file input of any kind -- not a hidden one, not a disabled one", and the only storage implementation in the tree was a fake signing https://fake-r2.local/ and reading back from an in-memory map that only tests wrote to
Found by:  T17's walk; closed here against MinIO
Effect:    Without an image there is no product. Nine of the ten publication-readiness items are reachable from nowhere but this console, so a seller who cannot add a photograph cannot sell.
Response:  BUILT, and proven by a browser rather than by a test double
Action:    apps/api/src/common/adapters/s3-object-storage.ts is ONE class implementing both MediaStorageAdapter and FinancialStorageAdapter, bound twice under two sets of values. Two buckets, because evidence/raw/ is plaintext: adulis-media is public-read with CORS for the console origin, adulis-evidence has no public access and a lifecycle rule expiring evidence/raw/ as a BACKSTOP -- the commit path deletes the raw object on success, and the lifecycle rule is what catches the commit that never came.
Verification: the beta walk's own step 5, against real object storage: a PNG is picked in a browser, resized in the page to three WebP derivatives, PUT to presigned URLs, committed, and the rendered <img> reports naturalWidth > 0. "WALK [OK] step 5: a photograph uploads from the browser and renders on the product." The objects are in the bucket. SC-10 media covers the rest of S4.5.
Ruling needed: none.

### D-249 - MinIO is admissible proof for an R2 adapter only because the adapter cannot tell them apart

Severity:  MINOR (a claim about scope of evidence, recorded so it is not overclaimed)
Phase:     T20 - S4
Source:    D-248's proof ran against MinIO in docker compose; Cloudflare R2 is the decided production store and its credentials exist in neither this repository nor the order
Found by:  Stating the limit of what was proven
Effect:    "It works" is a claim about MinIO. What makes it a claim about R2 is that S3ObjectStorage resolves its endpoint from R2_ACCOUNT_ID -- a bare account id becomes https://<id>.r2.cloudflarestorage.com, a URL is used as-is with forcePathStyle -- and reads five further values. NOTHING ELSE DIFFERS. Switching stores changes six environment variables and no code, which is the only reason a MinIO run says anything about R2.
Response:  RECORDED, and the equivalence is the thing to re-check if either side changes
Action:    If a future change makes the adapter branch on WHICH store it is talking to, this entry stops being true and the proof stops transferring. Nothing in the class branches today.
Ruling needed: none.

### D-250 - The media key carried a position, so a reorder was a storage rewrite or a lie

Severity:  MAJOR (avoided before it shipped)
Phase:     T20 - S4.4
Source:    the signed key was products/<product>/img/<position>/<size>.webp
Found by:  T20 S4.4's ruling, applied
Effect:    The object's NAME was a copy of core.product_image.position, which reordering changes. Every reorder then had two options and both are wrong: copy the objects to new keys (megabytes of network to express a change of integer, on a connection where the upload itself is the expensive part), or leave the keys alone and ship an object whose name disagrees with its row. The second is what would have happened, because it is the one that looks like it works.
Response:  FIXED before any reorder existed to break
Action:    products/<product>/img/<uuid>/<size>.webp. The commit guard still matches on the products/<id>/img/ prefix, so a commit can still only name keys this API minted. Position lives in the row and nowhere else. c2-catalogue asserts the key is opaque, position-free, and that the three derivatives share one folder.
Ruling needed: none.

### D-251 - A five-image cap has two places to check it and only one of them is honest

Severity:  MAJOR (avoided)
Phase:     T20 - S4
Source:    REQUEST_UPLOAD signed three PUTs without counting existing images; the cap was enforced at COMMIT
Found by:  T20 S4's own warning that a presigned upload has two places to check a cap
Effect:    A seller adding a sixth photograph would have resized it, uploaded three derivatives over a mobile connection, and THEN been told the limit is five. The bytes are the expensive part and they were spent before the refusal. Worse, the three orphaned objects are in the bucket with no row referencing them and no lifecycle rule covering that prefix.
Response:  FIXED - the count is taken before the URLs are signed
Action:    REQUEST_UPLOAD counts core.product_image for the product and refuses with IMAGE_CAP_REACHED before minting anything. The COMMIT-time check STAYS: it is the one that holds under two concurrent uploads, where both requests counted four and both were signed.
Verification: an e2e arm asserts the sixth image is refused BEFORE any upload begins, not after.
Ruling needed: none.

### D-252 - CSP and bucket CORS are two different failures with one symptom

Severity:  MINOR (diagnosability)
Phase:     T20 - S4
Source:    a direct-to-storage PUT can be stopped by this page's connect-src or by the bucket's own CORS, and in both cases fetch() rejects with an opaque TypeError
Found by:  T18's ruling that these are "two different fixes, one symptom"
Effect:    The seller sees "upload did not start" either way, and so does the engineer reading the failure. The two fixes are in different systems -- one is a header this repository ships, the other is a bucket setting that is not in this repository at all -- so guessing wrong costs a deploy.
Response:  MADE DISTINGUISHABLE
Action:    The page listens for securitypolicyviolation and records the last one; when a PUT rejects, the thrown message names which wall was hit -- "blocked by this page's security policy (connect-src blocked <uri>)" or "refused by storage before upload (bucket CORS or network)". The e2e harness derives BOTH origins so a misconfiguration of either is reproducible locally rather than only in production.
Ruling needed: none.

### D-253 - The push adapter said RETRYABLE when it meant there is no provider, and four templates reached nobody

Severity:  MAJOR
Phase:     T20 - S5
Source:    NullPushAdapter.send() returned 'RETRYABLE'; ORDER_AWAITING_PAYMENT_MORNING, STOCK_CONFIDENCE_NUDGE, TRIAL_ENDING and notification.chat.escalated are PUSH-only
Found by:  T20 S5, and D-240 had already recorded the gap
Effect:    RETRYABLE is a claim about a TRANSIENT failure. With no provider bound it is permanent, so every PUSH notification burned its full backoff and landed in FAILED -- silence with a retry count next to it. notification.chat.escalated is the one that costs money: a buyer asks what the assistant cannot answer, it escalates, and the seller never learns. A lost sale with no trace.
Response:  FIXED - a fourth outcome, and the row MOVES
Action:    PushOutcome gains NO_PROVIDER, which is a fact about the PLATFORM rather than about the device (TOKEN_DEAD) or the network (RETRYABLE). The job then UPDATEs the notification's channel to IN_APP rather than inserting a twin: notifications.controller does not filter by channel, so a copy would appear twice in the seller's list. A bound provider returning RETRYABLE still fails, and a test asserts that separately so the fallback cannot swallow a real transport failure.
Ruling needed: none.

### D-254 - fn_activate_due_payout had no job, so "twenty-four hours" meant "until the seller next looks"

Severity:  MAJOR
Phase:     T20 - S6.1
Source:    ADU-AUTH-01 v2.7 S20.1; core.fn_activate_due_payout was invoked from exactly one place, the GET on /v1/seller/payout
Found by:  v2.7 change C, built here
Effect:    A due PENDING payout change stayed PENDING -- and stayed CANCELLABLE -- until somebody opened the payout screen. The exposure window was never twenty-four hours; it was unbounded.
Response:  BUILT - payout.activate_due, every five minutes
Action:    Per-seller containment, which is the requirement and not a nicety: the ownership-transfer activation had none, so one raise would have stopped the sweep platform-wide. Each seller is claimed and run alone and a raise is logged and stepped over. Its own transaction, one statement, with nothing after it that can fail.
Ruling needed: none.

### D-255 - fn_activate_due_payout on the READ path is D-74's twin, and it is still there

Severity:  MAJOR (registered, NOT fixed here)
Phase:     T20 - S6.1
Source:    apps/api/src/modules/financial/financial.service.ts getPayout runs core.fn_activate_due_payout inside the handler's transaction; migration 0022, since Tier 3
Found by:  T20 S6.1 asked the question directly rather than assuming the answer
Effect:    YES, IT IS THE TWIN. A failure later in that read rolls back an activation it just performed -- the exact shape D-74 recorded, where anything written at the top of a handler transaction is undone when the handler raises. It is less damaging than D-74's case only because the next read re-performs it; it is still a write whose durability depends on the success of an unrelated read.
Response:  REGISTERED, not fixed
Action:    The fix is a decision about the read path -- move the activation to its own connection, or drop the lazy call now that a job exists and accept that the screen is correct only to the last job tick. Both are behaviour changes to a screen this order did not scope. The NEW job is immune by construction and does not depend on this being fixed.
Ruling needed: YES -- keep the lazy activation on its own connection, or remove it and let the job own activation entirely?

### D-256 - A job from another document went into the S24 transcription and broke the assertion that made it a transcription

Severity:  MINOR (caught by its own test, within the hour)
Phase:     T20 - S6.1
Source:    payoutActivateDue was first added to E5_JOBS, which feeds S24_JOBS
Found by:  the test "registers exactly the twenty jobs S24 names, and no others", going red
Effect:    S24_JOBS is a TRANSCRIPTION of ADU-DB-01 S24 and its test asserts the set both ways. A job from ADU-AUTH-01 v2.7 inside it turns twenty into twenty-one, and the obvious repair -- editing the 20 to a 21 -- destroys the only thing the assertion was for. The failure reads as a broken test rather than as a job filed under the wrong document, which is what makes it worth an entry.
Response:  FIXED by separating the lists, not by editing the number
Action:    RULED_JOBS holds jobs required by documents other than S24, each citing its own; SCHEDULED_JOBS is what the worker registers. Tests assert an S24 name never appears in RULED_JOBS and a RULED job never cites S24. The heartbeat was always outside the list for the same reason and is the precedent.
Ruling needed: none.

### D-257 - The heartbeat published the size of a transcription, not the number of jobs it runs

Severity:  MINOR
Phase:     T20 - S6.1
Source:    makeHeartbeatJob(workerId, S24_JOBS.length)
Found by:  D-256's fix, which made the two numbers different for the first time
Effect:    jobs_registered exists to answer "is this worker running the full set?". It reported twenty while twenty-one were scheduled, so it could not have detected the one failure it is watched for. The numbers had been equal since the heartbeat was written, which is why nobody noticed the wrong one was being published.
Response:  FIXED
Action:    It publishes SCHEDULED_JOBS.length. cronItemsForTest had the same shape and now covers the scheduled set, with its doc comment corrected -- it does NOT cover the heartbeat's own cron, which is built inside startWorker from the worker's identity, and saying so is more useful than pretending otherwise.
Ruling needed: none.

### D-258 - The surface-marker gate found three disagreements, all in the direction the ruling did not anticipate

Severity:  MINOR (documentation vs. grant; no grant changed)
Phase:     T20 - S6.2
Source:    ADU-AUTH-01 v2.7 S26.4 -- "a marker in a catalogue is a CLAIM about a grant, and nothing compared the two ... The grant governs; the marker is corrected to it"
Found by:  pnpm verify:surface-markers, built here
Effect:    v2.7 named one case (analytics overview) and expected the failure to be markers promising reach the grant refuses. That direction is CLEAN: no M in ADU-API-01 S12 over-promises. The other direction was not. THREE permissions are granted on MOBILE with no marked endpoint -- seller.reviews:read, seller.analytics.basic:read, seller.notifications.preferences:write. Nobody is broken by this today, which is exactly why it survives: the day someone builds the mobile screen, the review that should have questioned the grant has already happened and concluded nothing.
Response:  MARKERS CORRECTED per S26.4; no grant touched
Action:    Three rows in ADU-API-01 v1.11 S12 gain M, and the correction is recorded in S12 itself. THIS IS A DOCUMENT EDIT MADE BY THE BUILD, which is not ordinary -- it is made because S26.4 rules the direction explicitly and leaves nothing to design.
Verification: the gate is proven to FIRE in both directions by planting each violation and observing red, then restoring. The path-to-permission mapping is read out of the source rather than transcribed, and a marked row whose permission cannot be resolved is a FAILURE, not a skip -- a reader that silently drops what it cannot parse is a gate that goes green by not looking.
Ruling needed: none.

### D-259 - Fifty-seven console styles referenced variables that were never defined anywhere

Severity:  MAJOR (invisible until dark mode existed)
Phase:     T20 - S6.3
Source:    apps/console/src/console.css used var(--color-border, #d4cec4), var(--space-3, 0.75rem) and five more names in that convention; @adulis/tokens defines --adu-* and nothing else
Found by:  auditing hardcoded colours before adding dark mode
Effect:    Every one had a fallback, so every one silently rendered the literal. The storefront-preview region was not using the design system at all -- it looked correct, passed every gate, and would have stayed light-coloured in dark mode while the rest of the page inverted. A fallback is what makes this class invisible: without it the layout collapses and somebody fixes it the same day.
Response:  FIXED - all 57 bound to real tokens; zero non---adu- variables remain
Action:    One of the seven had no token to bind to. --space-3 (0.75rem, 12px) was used TWENTY-TWO times against a 4px scale that ran 4, 8, 16 -- so space.smd is added to both token files. Twenty-two authored uses of a value is evidence the scale was missing a step, not that the author was careless.
Ruling needed: none.

### D-260 - The two token files are still two files, and dark mode doubled the surface

Severity:  MINOR (PARKED)
Phase:     T20 - S6.3
Source:    packages/tokens README: "One source would be better than two; until a build step derives one from the other, a drift between these files is a defect to fix in BOTH"
Found by:  Adding a second mode to both by hand
Effect:    index.ts and tokens.css carried one value set each and now carry two, so the number of places a drift can hide has doubled. Nothing compares them. This repository has a name for that shape and a gate for it in two other places (verify:permission-doc, verify:appendix): a value given in two forms is not verified until a comparator runs.
Response:  PARKED, deliberately
Action:    The comparator is a small script -- parse the custom properties, compare to the exports, both directions, both modes -- and it was not built because T20 S6.3 asked for dark mode and the window's remaining work was S7. It is the obvious next gate and it is cheap. Recorded rather than done.
Ruling needed: none.

### D-261 - A financial test arm fails under parallel load and passes alone; the mechanism is not established

Severity:  MINOR (flake, PARKED with what was ruled out)
Phase:     T20 - S4
Source:    c4-financial.e2e.spec.ts "with step-up, an aged device and no locks", the notices count assertion at the end of the arm
Found by:  one full API suite run; green in isolation and green on the next full run
Effect:    Counted PAYOUT_CHANGE_REQUESTED rows scheduled_for >= a JS-captured startedAt returned 0. The arm's earlier assertions in the same request all passed, so the payout WAS written and only the notification count came back empty.
Response:  PARKED - NOT diagnosed, and saying so is the point
Action:    Ruled out: clock skew between Node and Postgres, which was the obvious cause and is the WRONG DIRECTION -- measured at +0.1s with Postgres AHEAD, which makes the filter more inclusive rather than less. Ruled out: cross-suite teardown, since c4 and c6 use distinct market and account ids and every other teardown is account-scoped. Not ruled out: anything else. Two green runs is not a diagnosis and this entry does not claim one.
Ruling needed: none.

### D-262 - BLOCKER: S7 cannot be drawn. The Figma account has neither edit access to the file nor a seat that could do the work

Severity:  BLOCKER (external; nothing in this repository can clear it)
Phase:     T20 - S7
Source:    T20 S7 names file key FneEVVjS5zjOA03NrVu4Rs and asks for a polished seller console in both modes -- five screens at two breakpoints, twenty frames, a variable collection with Light/Dark modes, and Auto Layout throughout
Found by:  Checking access before drawing anything, per S1.4's instruction to check the Figma MCP first
Effect:    TWO INDEPENDENT BLOCKERS, and clearing either one alone is not enough.

  1. NO EDIT ACCESS TO THE FILE. get_metadata on FneEVVjS5zjOA03NrVu4Rs returns
     "Looks like you don't have edit access to this file. The file owner can
     share it with you and make you an editor." Every write tool needs edit
     rights, and so does renaming the file from "Untitled" (S7.1).

  2. THE SEAT CANNOT AFFORD THE WORK EVEN WITH ACCESS. whoami reports one plan:
     "Abenezer Mekonnen's team", tier STARTER, seat VIEW. Figma's published
     limits put a View seat on Starter at UP TO 20 TOOL CALLS PER MONTH -- for
     the whole month, not per session. S7 is twenty frames plus a two-mode
     variable collection plus components; it is hundreds of calls. Twenty is
     not a slow version of that work, it is not that work.

  Also recorded as a fact rather than a conclusion: the authenticated Figma
  identity is abenezerlibamu421@gmail.com, which is not the account this
  repository's commits are authored by. Whether that is the intended account is
  not something the build can determine.

Response:  STOPPED, per S1.3 -- "A BLOCKER stops you"
Action:    To clear it, BOTH are needed: (a) the file's owner shares
  FneEVVjS5zjOA03NrVu4Rs with the authenticated Figma account as an EDITOR, and
  (b) that account holds a Full or Dev seat on a Professional plan or better
  (200 calls/day). Figma's own guidance is explicit that a Starter plan must be
  upgraded and that the new seat must be Full or Dev.
  NOTHING WAS DRAWN AND NOTHING WAS FAKED. No partial file was created in a
  drafts folder to show progress -- a design in the wrong file is not the design
  the order asked for, and would have spent a fifth of the monthly call budget
  proving it.
Verification: whoami and get_metadata, both quoted above. Two calls, deliberately
  -- there was no point spending more of a twenty-call monthly budget confirming
  a refusal that had already been stated plainly.
Ruling needed: none. It is an access grant and a seat upgrade, not a decision.

### D-263 - Correction to D-251: the commit-side image cap is a schema fact, not a second count

Severity:  MINOR (precision in the register; no code change)
Phase:     T20 - S4, adversarial pass
Source:    D-251 states "The COMMIT-time check STAYS: it is the one that holds under two concurrent uploads, where both requests counted four and both were signed"
Found by:  The media phase's adversarial pass, checking that claim instead of trusting it
Effect:    The claim is TRUE in substance and MISLEADING in mechanism, which is the worse kind of register entry. There is no second count at COMMIT and there never was. `>= 5` appears exactly once in catalogue.service.ts, in REQUEST_UPLOAD. A reader following D-251 would look for a commit-time count, fail to find one, and reasonably conclude the cap had been left half-built.
Response:  CORRECTED HERE - the register is append-only, so D-251 stands as written and this entry is what a reader of it must also read
Action:    What actually holds at commit is the SCHEMA, and it is stronger than a count:

             position int NOT NULL CHECK (position BETWEEN 1 AND 5),
             CONSTRAINT product_image_position UNIQUE (product_id, position)

           migration 0007's own comment says it exactly -- "UNIQUE (product_id, position)
           caps images at five as a STRUCTURAL FACT ... five positions, five rows, no
           counting logic anywhere." Two concurrent uploads that both counted four and
           were both signed cannot produce six rows: there are only five positions and
           each is unique per product. The second committer gets POSITION_TAKEN.
           This is the doctrine working as written -- a rule the database can hold, the
           database holds -- and the pre-mint count added in D-251 is NOT the cap. It is
           a courtesy that refuses before the seller pays for three uploads. The cap
           itself was never in application code and must not be moved there.
           Migration 0048 made the UNIQUE constraint DEFERRABLE INITIALLY DEFERRED so a
           reorder can swap positions in one statement; deferred uniqueness is checked at
           COMMIT, so the concurrency guarantee above is unaffected -- one of the two
           transactions still fails, just at commit rather than at insert. The CHECK is
           not deferrable and is immediate either way.
Ruling needed: none.

### D-264 - D-260 discharged: the token comparator exists

Severity:  RESOLVED (D-260 was PARKED in the same order)
Phase:     T20 - S6.3
Source:    D-260 parked the comparator because the window's remaining work was S7
Found by:  S7 turning out to be blocked (D-262), which returned the time
Effect:    n/a -- this closes a parked risk rather than reporting a new one.
Response:  BUILT - gate `tokens`
Action:    `pnpm verify:tokens` checks four things, and the last two are what dark mode added: every export has its custom property and every custom property its export (both directions, per group); the VALUES agree; MODE PARITY -- colorDark has exactly the keys color has, which is the shape T20 S7.3's Light/Dark collection needs; and the TWO dark blocks in tokens.css are identical to each other, which is the copy most likely to drift because CSS cannot express one body under two selectors here.
Verification: it found two defects IN ITSELF before it found none in the tokens, and both are recorded in its header rather than quietly fixed. It was line-based, so it mis-read every single-line nested object and then reported the source as missing keys -- a comparator accusing the source of its own parsing bug, which trains a reader to disbelieve it. And it compared the CSS role indirection (`var(--adu-neutral-0)`) against the TS literal, reporting thirty-eight disagreements where there were none. Both are now resolved on both sides before comparison.
Ruling needed: none.

### D-265 - The gate list meant two different things on two machines, and only a CI run could tell

Severity:  MAJOR (a green local gate list that does not mean what it says)
Phase:     T20 - S4/S9, found when PR #85's CI went red
Source:    `pnpm ci:local` green on 27 gates; the identical list red in CI on t14-a3-stamped-audience.spec.ts, five tests, all "expected 202, got 400" against the OTP endpoint
Found by:  Looking at the gate rather than trusting the local run -- which is the exact discipline T20 S2 added the README badge for
Effect:    AMBIENT STATE. That suite reads `core.market WHERE code = 'SEED'`, which only `ops/scripts/seed.mjs` creates, and NOTHING between `db:migrate` and the `test` gate created it. A developer's database has been seeded at some point; a CI database has not. The suite therefore passed for everyone who ran it locally and could never pass in CI.
  IT WAS INVISIBLE BECAUSE THE TEST GATE IS SCOPED to packages changed against origin/main. The api suite had not actually run in CI for several merges -- the recent red mains failed at `mt-keys`, before `test` -- so the first branch to touch apps/api again inherited a failure that had been waiting since the suite was written. It was not caused by this order's changes.
  AND IT FAILED SILENTLY, WHICH IS WHY IT POINTED AT THE WRONG PLACE. The setup is `INSERT INTO core.device ... SELECT ... WHERE code = 'SEED'`, and an INSERT ... SELECT over an empty SELECT inserts nothing and raises nothing. The device did not exist, so every OTP request 400'd, and five failures named the auth endpoint -- which was blameless.
Response:  BOTH HALVES FIXED
Action:    (1) The `migrate` gate runs `db:seed` as a second STEP -- a step and not a new gate, because ADU-RUL-03 S5.2 cites gates by position. The seed is idempotent, so it costs a local developer nothing and gives CI the state the suites were written against. A gate list that means something different on two machines is not a gate list.
           (2) The suite checks `rowCount === 1` and throws naming the seed. One clear error instead of five that accuse the wrong subsystem.
Verification: PROVEN BY CONTROLLED EXPERIMENT, twice -- the first attempt was invalid and is worth recording. Hiding the market with the suite run in a subprocess that had no `.env` produced five failures for an unrelated reason (a missing database password), which looked like confirmation and was not. Re-run with the environment loaded: market present -> 5 passed; market hidden -> 5 failed, carrying the new message, with no bare 400 anywhere; market restored -> 5 passed.
Ruling needed: none.

### D-266 - Correction to D-261: the right conclusion from a measurement that could not support it

Severity:  MINOR (evidence quality in the register)
Phase:     T20 - S9
Source:    D-261 states clock skew was "Ruled out ... measured at +0.1s with Postgres AHEAD"
Found by:  Re-reading my own method while the flake recurred
Effect:    THE MEASUREMENT WAS WORTHLESS AND THE CONCLUSION HAPPENED TO BE RIGHT, which is the combination worth recording. Each sample spawned `docker exec ... psql`, so the ~100ms it reported was process startup latency with the clock offset buried somewhere inside it. It could not have detected a skew smaller than its own noise floor, and it would have reported "+0.1s, Postgres ahead" for a Postgres running a tenth of a second BEHIND. Anyone re-deriving the flake from that entry would have been reasoning from a number that measured the wrong thing.
Response:  RE-MEASURED PROPERLY, and skew is genuinely ruled out
Action:    A warm `pg` connection, five samples, bracketing each `clock_timestamp()` between a Node timestamp taken before the query and one taken after: round trip 1ms, and the database clock falls INSIDE the bracket every time. The clocks agree to within a millisecond. `core.notification.scheduled_for` defaults to `now()`, so the arm's `scheduled_for >= startedAt` filter is sound and is not the cause.
           MECHANISM NARROWED, NOT ESTABLISHED. `core.fn_notify_payout_change` is an AFTER INSERT OR UPDATE OF state trigger that returns without writing anything unless the row is NEW or its state actually changed. The arm's other assertions -- the change log and the ciphertext -- pass whether the write was an insert or an update, so ONLY the notification count can see the difference. Any path that turns that POST into an update, or into an idempotent replay, produces exactly the observed failure: 201, a good log row, good ciphertext, and no notification. Which path, and what makes it intermittent, is still not established.
           NOT FIXED, AND NOT PAPERED OVER. Changing the assertion to make it pass would remove the only thing in the suite that can tell an insert from an update.
Ruling needed: none.

### D-267 - The media proof needed a store in CI, and CI had none. Same class as D-265, found the same way

Severity:  MAJOR (the fatal item's proof would not have run where it matters)
Phase:     T20 - S4, found by CI after D-265's fix let the run reach gate 25
Source:    `verify-console-e2e.mjs` requires the six R2_* values; the CI job had no object storage and no .env
Found by:  Watching the gate. D-265's fix moved the failure from gate 11 to gate 25, which is what progress looks like.
Effect:    THE SECOND INSTANCE OF THE SAME CLASS IN ONE ORDER, and that is the reason it gets its own entry rather than a line in D-265. My machine had the six values in .env, CI had none, and `pnpm ci:local` was green while the identical list went red -- exactly D-265's shape, with configuration in place of seeded rows. Two of these in one order says the class is not a coincidence: ANY gate that reads ambient state passes locally and is untested until CI happens to reach it.
           The gate refused rather than degraded, which is the only reason this was visible at all. It could have skipped the media arms when storage was unset; then CI would have gone green while the proof of BETA-READINESS's last fatal item silently did not run. ADU-CON-02 S16 is explicit that there is no skip label, and this is why.
Response:  CI GIVEN A REAL OBJECT STORE
Action:    A step starts `minio/minio` and creates the two buckets exactly as docker-compose.yml does -- media public-read, evidence with no public access and a lifecycle rule on evidence/raw/ -- and the six values are passed to the gate step. A STEP AND NOT A `services:` CONTAINER because the official image needs `server /data` as its command and GitHub's `services:` cannot set one.
           The credentials are the local container's own, in the clear, deliberately: they are the local-dev-password class, they grant nothing anywhere, and no real credential is in this repository or any report.
           This also means the adapter's central claim is now exercised on a second machine: the same class talks to MinIO under six environment values in CI and would talk to Cloudflare R2 under six different ones, with no code path between them (D-249).
Ruling needed: none.

### D-268 - The payout GET no longer activates, and the installed document still says it should

Severity:  BLOCKER (document debt, not code -- the code is correct and the document is not)
Phase:     T21 - S1
Source:    ADU-AUTH-01 v2.7 S20.1, verbatim: "The lazy path stays -- it costs nothing and makes the screen correct at the moment it is read. The job is what makes the interval mean twenty-four hours."
Found by:  Routing the order's ruling through adulis-spec-router BEFORE implementing it, rather than after
Effect:    T21 S1 RULES THE OPPOSITE. D-255 asked which of two fixes to take -- lazy activation on its own connection, or remove it and let the job own activation -- and the founder ruled REMOVE. That discharges D-255 and contradicts an installed, binding sentence in a document this order does not reissue. The router returned OPEN_DECISION on exactly this ground and was right to: nothing in ADU-API-01 S15, ADU-DB-01 S13.4 or S24 requires the read path to activate, but ADU-AUTH-01 S20.1 affirmatively KEEPS it.
Response:  IMPLEMENTED AS AN INTERIM FOUNDER RULING, with the debt recorded here
Action:    The spec router's own rule: "A founder instruction may authorize an interim ruling, but record the exact source/ruling and the unreissued document debt." The source is WORK ORDER T21 S1; the debt is ADU-AUTH-01 v2.7 S20.1's sentence, now false as written. The code says so at the point of removal rather than leaving a future reader to find the document and believe it.
           THE COST IS REAL AND BOUNDED: a due PENDING can display as PENDING for up to one job period (five minutes) after activates_at. The order accepted that explicitly against a twenty-four hour delay.
           D-241's remaining open ruling is NARROWED but not closed: fn_cancel_payout_change still accepts a row whose activates_at has passed, and that five-minute window is now the only such window rather than one of two.
Ruling needed: YES -- reissue ADU-AUTH-01 S20.1 so the document and the code agree. Until then the document is wrong and this entry is the only thing that says so.

### D-269 - Ownership transfer still activates on a read, and the reason it had to no longer holds

Severity:  MINOR (registered, NOT fixed -- outside T21's scope)
Phase:     T21 - S1
Source:    apps/api/src/common/db/handler-transaction.ts, whose comment justified activating on the request path partly with "the S24 job set is closed at twenty names, so a sweeper is not available either"
Found by:  Correcting that comment's citation of payout as the precedent FOR laziness
Effect:    Payout was that precedent, and T21 S1 withdrew it -- so the comment now leans on an example that argues the opposite way. The second half has also stopped being true on its own terms: RULED_JOBS (registry.ts) is exactly the mechanism that made a twenty-first job available, and payout.activate_due used it. "A sweeper is not available" was true when written and is not now.
Response:  COMMENT CORRECTED, BEHAVIOUR UNTOUCHED
Action:    fn_activate_due_ownership_transfer is NOT payout's twin and must not be assumed to be. AMENDMENT A1.1 requires a live session held by the outgoing owner to lose those capabilities ON ITS NEXT REQUEST, with no re-authentication -- a requirement a five-minute sweep does not discharge by itself. Copying the payout decision here would trade a correctness guarantee for consistency, which is why this is registered rather than done.
Ruling needed: YES -- does A1.1's "on its next request" permit a job-plus-read hybrid, or does it require the read path to keep activating?

### D-270 - payout.activate_due has never activated anything: the grant it needed was not the grant it got

Severity:  BLOCKER (fixed here)
Phase:     T21 - S1
Source:    db/migrations/0022 granted adulis_jobs EXECUTE on core.fn_activate_due_payout; the job's FIRST statement is a direct SELECT on core.payout_details, on which adulis_jobs held nothing
Found by:  The first test in this repository's history to call payoutActivateDue.run(). It failed on its first statement.
Effect:    Every tick raised "permission denied for table payout_details" and died WHOLE -- the discovery query sits outside the per-seller try/catch, so the containment that protects one seller from another does not protect the sweep from this. Verified against the running database: has_table_privilege('adulis_jobs','core.payout_details','SELECT') was false while has_function_privilege on the function was true. The grant it was given was real; it was the wrong one, and only by itself.
           IT WAS MASKED BY THE DEFECT THIS ORDER REMOVED. The lazy call on the GET was the only thing actually activating payouts, so the broken job cost nothing while D-255 was live. Shipping S1 without migration 0049 would have meant payout changes never activate AT ALL -- a seller's new details PENDING forever while the money kept going to the old account. Two defects that were each survivable alone and fatal together.
           WHY NOBODY SAW IT: the job shipped in T20 S6.1 with three tests, and all three assert only that its NAME is registered and scheduled. "Registered" and "works" are different claims that looked identical in the suite. A job with no behavioural test is a job nobody has run.
Response:  FIXED - migration 0049 grants SELECT, and only SELECT
Action:    The job reads to find work and hands that work to the SECURITY DEFINER function, which writes under its own rights; adulis_jobs gets no INSERT, UPDATE or DELETE because it needs none. Mirrors 0032's grant on core.session and 0043's on core.platform_otp_budget.
           The behavioural test is the durable half of the fix: revoking the grant turns exactly one arm red, and nothing else.
Ruling needed: none.

### D-273 - The api suite has a cross-suite flake that reproduces on unmodified main

Severity:  MAJOR (pre-existing, NOT introduced here, NOT diagnosed)
Phase:     T21 - S1, observed while verifying
Source:    Globally-scoped assertions in suites that jest runs in parallel workers
Found by:  Running the full suite repeatedly on the branch AND on a clean main, because the first failure looked like mine and the controlled comparison refuted that
Effect:    THE FULL SUITE FAILS ROUGHLY ONE RUN IN THREE, ON MAIN, WITH A DIFFERENT TEST EACH TIME. Observed: main run 2 of 3 failed on c4-financial's notification-delta arm AND t6-ownership-transfer's OWNERSHIP_TRANSFER_REQUESTED count; a branch run failed on t12-d89-invite-claim; the first full gate run failed on that same D-89 arm. That spec passes 3 of 3 alone. This is D-261's registered shape -- "fails under parallel load and passes alone" -- and it is WIDER than D-261 recorded: at least four distinct tests across at least three files.
           The common shape is an assertion counting rows the suite does not own: "SELECT count(*) FROM financial.payout_credential" with no seller predicate; a count over every OWNERSHIP_TRANSFER_REQUESTED notification in the table. Another suite's fixture or teardown landing inside the before/after window changes the number, and the failure then accuses the subsystem under test.
Response:  REGISTERED WITH EVIDENCE, NOT FIXED
Action:    Not fixed here because it is neither this order's scope nor this order's defect, and because scoping those assertions means editing suites S1 has no business touching. What T21 DID do is avoid making it worse: the payout job's behavioural test was moved off the fleet-wide sweep onto a seller nothing else reads, after the sweep version reproduced a failure on demand (D-83's rule -- exactly one suite may own a global sweep).
           The evidence is the useful part. "One run in three, a different test each time, on main" turns an intermittent red into a known quantity rather than a reason to disbelieve the suite -- which is the actual danger, and is how the seeded-market defect survived for several merges.
Ruling needed: none. It is an engineering task with a known shape: scope every count to the fixture that owns it.

### D-271 - The focus ring had no dark value, and the mode it fails in is the one it matters most in

Severity:  MAJOR (fixed on the packages/tokens branch, PR #86)
Phase:     T21 - S2
Source:    packages/tokens/src/index.ts, focus.ringColor: color.accent
Found by:  Mirroring the ring into a Figma variable, which forced the question "what is its dark value?" and found there was none
Effect:    `color.accent` is evaluated by TypeScript at the point of definition, so `focus.ringColor` FROZE at the light accent (#1e40af). tokens.css wrote `var(--adu-color-accent)` and kept the reference LIVE, so the dark blocks moved it. The two files therefore disagreed in dark mode, and the disagreement was the entire point of the token: a 2px #1e40af ring on a #14120f page is a focus indicator the colour of the ground it sits on.
           THE WEB SURFACES WERE NEVER WRONG -- they read the CSS. Anything reading the TS was, and React Native has no other source. Same shape as D-259, where the console referenced variables that existed nowhere and every fallback rendered a literal that looked fine until a mode existed.
Response:  FIXED - focusDark and focusModes, the colorModes shape
Action:    ringWidth and ringOffset are NAMED from `focus` rather than restated: the ring's geometry does not change with the theme, only its colour does, and saying that once is the point. tokens.css needed no change; it was already correct.
Ruling needed: none.

### D-272 - verify:tokens could not have found D-271: its GROUPS table is the gate

Severity:  MAJOR (fixed on the packages/tokens branch, PR #86)
Phase:     T21 - S2
Source:    ops/scripts/verify-tokens.mjs -- the orphan loop only visits custom properties matching some GROUPS row's prefix
Found by:  Asking why a gate that claims both directions had not already caught D-271
Effect:    "Every TS export has its custom property, and every custom property has its export -- BOTH DIRECTIONS" is true only of a property some row's prefix MATCHES. `--adu-focus-ring-width`, `--adu-focus-ring-offset`, `--adu-focus-ring-color`, `--adu-touch-min`, `--adu-font-family` and `--adu-font-mono` matched no row at all, so they were compared by no direction of no check -- eight custom properties outside a gate reporting itself green. The hand-maintained list had grown a hole, which is the same class the comparator was built to catch one level up.
Response:  FIXED - four rows added, and three comparator defects fixed to make them mean anything
Action:    (1) `resolve` follows a DOT reference (color.accent, focus.ringWidth), the TS-side twin of what resolveCss already did for var(); a comparator that resolves one side's indirection and not the other reports disagreements where there are none. (2) `resolveCss` follows ANY --adu-* reference, not only the ramp -- the ring points at a ROLE, so a ramp-only regex gave up at the outer var(). (3) `pairs` respects QUOTES: it split on commas at depth zero, so the font stack parsed as `system-ui` and the check reported a value disagreeing with its own first word. That last one is precisely what the function's existing comment warns about one level up, and it was invisible only because no row had ever reached a value containing a comma.
           PROVEN TO FIRE: four violations planted one at a time -- the dark ring frozen at the light accent, a 44px target drifting to 40px in CSS only, one character changed in the mono stack, and a ring offset drifting in CSS only -- each observed red, then restored. The offset plant fails TWO rows, which is correct: the geometry is shared across modes.
Ruling needed: none.

### D-268 - CLOSED by ADU-AUTH-01 v2.8

Severity:  BLOCKER (document debt) -- DISCHARGED
Phase:     T21 - S1, closed T22 - Phase 1
Source:    ADU-AUTH-01 v2.7 S20.1, "The lazy path stays -- it costs nothing and makes the screen correct at the moment it is read"
Found by:  Routing T21's ruling through adulis-spec-router before implementing it
Effect:    T21 shipped the removal of the lazy payout activation against an installed binding sentence that said the opposite, as an interim founder ruling, and registered the disagreement here because the code and the document may not silently differ.
Response:  CLOSED. ADU-AUTH-01 v2.8 S20.1 WITHDRAWS the sentence in terms: "v2.7's 'The lazy path stays' is WITHDRAWN. The GET stops activating. The job owns activation entirely."
Action:    The two code comments that carried the debt now say it is discharged rather than owed -- financial.service.ts getPayout and the payout.activate_due header. THE DEBT WAS OPEN FOR ONE ORDER, which is the point: it was recorded, it was visible, and it was paid. An interim ruling that is never written down is a code base that quietly disagrees with its own specification.
Ruling needed: none. Discharged.

### D-274 - The ASCII gate governed two superseded revisions, and the manifest disagreed with itself

Severity:  MAJOR (fixed here)
Phase:     T22 - Phase 1
Source:    ops/scripts/verify-docs-ascii.mjs GOVERNED named ADU-AUTH-01 v2_6 and ADU-API-01 v1_10; docs/amendments/README.md's split block named v2.6
Found by:  Installing v2.8 and reading the list the installation had to touch
Effect:    THREE STALE COPIES, ALL FROM ONE ORDER'S INSTALL. T20 installed ADU-AUTH-01 v2.7 and ADU-API-01 v1.11 and advanced neither the ASCII gate's governed list nor the manifest's own split block.
           The gate did not go red, and could not have: both superseded files were still on disk and still ASCII, so readFile succeeded and every line printed PASS. IT WAS ENFORCING ASCII ON DOCUMENTS NOBODY READS AND NOT ON THE DOCUMENTS THAT GOVERN. A gate checking the wrong file is worse than no gate, because it reports a result.
           The manifest was worse in kind. Its table row said v2.7 governs authentication; its own split block, eleven lines below, said "-> v2.6" -- the file whose entire job is to say which revision governs, disagreeing with itself, in the one entry where "the newer version governs" is explicitly FALSE as a general statement and a reader therefore CANNOT fall back on the general rule.
           And DOCUMENT_AUTHORITY.md, which every skill instructs an agent to read first, still answered "ADU-API-01 v1.10 governs" and "ADU-AUTH-01 v2.5 governs" -- two and three revisions behind.
Response:  FIXED, and made mechanical
Action:    The list now names v2.8 and v1.11. v2.7 and v1.10 are moved to docs/superseded/; v2.6 and v2.5 STAY in docs/ and stay governed for a different reason, which the comment now states: a document is governed if it GOVERNS or if A GATE PARSES IT. verify-transcription parses v2.6, verify-permission-doc parses v2.5.
           THE DURABLE HALF IS THE COMPARATOR, because the list is a hand-maintained transcription and this project's answer to those is never "remember harder". Two rules: every governed path exists and is not under superseded/; and for every document family installed under docs/, if the family is governed at all it is governed at its NEWEST installed revision. The second rule is the one that fires the day a revision is installed and the list is not touched.
Verification: proven to FIRE by planting the exact T20 mistake -- the governed entry set back to v2.6 while v2.8 is installed -- and observing red naming both families. Restored green. 12 governed documents.
Ruling needed: none.

### D-275 - The D-47 probe, restored and made self-extending

Severity:  MINOR (a probe rebuilt, no defect found by it)
Phase:     T22 - Phase 1
Source:    ADU-AUTH-01 v2.8 S20.1a -- "Prove a job runs by running it as its own role, never by reading the migration", and its note that the D-47 probe "was not repeated for jobs added later"
Found by:  The order asking for it directly
Effect:    D-47 found twenty jobs holding EXECUTE and no USAGE on core, by running them as adulis_jobs before a line of the worker existed. It was a ONE-OFF. Four tiers later payout.activate_due shipped holding EXECUTE on a SECURITY DEFINER function and no SELECT on the table it reads to find its work (D-270), and nothing looked, because the probe that would have caught it was a thing somebody once did rather than a thing that runs.
Response:  BUILT as a permanent test, and it found NOTHING -- which is the result, stated plainly
Action:    All twenty-one SCHEDULED_JOBS run as adulis_jobs with no grant error. The probe iterates SCHEDULED_JOBS rather than a list of names, so a job added tomorrow is probed tomorrow with nobody remembering to add it -- the whole difference between this and the probe that went stale.
           It asserts on the PERMISSION CLASS ONLY. A job may raise for an ordinary reason; ledger.assert_zero is REQUIRED to throw on an unbalanced ledger. What no job may do is raise 42501 or "permission denied", which is never a fact about the data and always a fact about the grant.
           It lives in e2-e6.jobs.spec.ts because several of these jobs are fleet-wide sweeps and D-83 rules that exactly one suite may own a global sweep. That suite already owns them.
Verification: proven to FIRE by revoking migration 0049's grant and observing the probe report, by name, "payout.activate_due: permission denied for table payout_details" -- D-270 reproduced on demand by the probe that would have prevented it. Restored.
Ruling needed: none.

### D-276 - boot-smoke was red on main because it replayed a production origin at a localhost bundle. The console boots.

Severity:  MAJOR (fixed here). NOT a BLOCKER -- the artifact was never broken.
Phase:     T22 - Phase 2
Source:    ops/scripts/verify-boot-smoke.mjs, the unconditional `for (const e of rep.csp) fail(...)`
Found by:  The order requiring a verdict: does the artifact fail to boot, or is the gate wrong?
Effect:    THE ARTIFACT BOOTS, and the gate said so on the line above the failure. Measured:
             PASS  #root mounted with 1 child element(s)
             FAIL  CSP violation under the production policy: connect-src <- http://localhost:3000/v1/bootstrap
             FAIL  CSP violation under the production policy: connect-src <- http://localhost:3000/v1/auth/sessions
             PASS  the smoke break flag is compiled out of all 1 shipped bundle(s)
           React mounted, nothing threw, nothing rejected. The two failures are the gate replaying the PRODUCTION policy -- connect-src 'self' https://api.adulis.example -- against a bundle built with VITE_API_BASE_URL=http://localhost:3000, so SessionProvider's mount call to /bootstrap and its follow-on /auth/sessions are refused.
           IT WAS GREEN BY ACCIDENT, AND THE HEADER SAID SO. D-138 already recorded that CI builds without VITE_API_BASE_URL, so apiBase() throws before fetch is reached and no request is ever attempted -- and added, in terms, "a gate that quietly benefits from a misconfiguration it does not name is the class this repository keeps finding." The misconfiguration stopped and the gate went red. It was never testing connect-src; it was being spared it.
           THE BUNDLE IS CONFIGURED BY WHOEVER BUILT LAST. `verify:console-e2e` rebuilds the console with VITE_API_BASE_URL set and leaves that dist in the tree; it runs at gate 25, AFTER boot-smoke at 22, so it contaminates the NEXT run. apps/console/CLAUDE.md also instructs an operator to export the same variable into their shell, in which case even the `build` gate bakes it in. Either route makes boot-smoke red on every branch including unmodified main -- which is where this was found.
           AND THIS IS D-164 RECURRING IN THE SIBLING FILE. D-164 is the same symptom, the same directive, the same origin, fixed in apps/console/e2e/serve.mjs with "THE CSP IS DERIVED, NOT REPLAYED". verify-boot-smoke.mjs never received that treatment, which is exactly why `verify:console-e2e` passes against the identical dist while boot-smoke fails.
Response:  FIXED - load-time violations still FAIL; the one runtime directive is REPORTED
Action:    script-src, style-src, font-src, img-src, worker-src and every other load-time directive remain hard failures: a refused script or style is a page that did not load what it shipped with, and that is this gate's whole question. connect-src is printed as a NOTE naming why it is not a boot failure.
           THIS NARROWS STATED COVERAGE, NOT REAL COVERAGE, and saying which is the point: D-138 established the gate never tested connect-src. What is fixed is a gate that changed colour with an environment variable and reported it in the words "CSP violation under the production policy", which reads as a product fault.
           D-138's open ruling -- does boot-smoke assert connect-src at all, or does that belong to the console harness owed at C-3 -- is NOT closed by this. This is the honest interim answer: it does not.
Verification: green on a clean build (no NOTE lines at all, because no request is made -- the CI path) AND green on a configured build (two NOTEs). Deterministic on both, for the SAME reason rather than for two different accidents.
           Proven to still FAIL on a real one: built with VITE_SMOKE_BREAK=1 and observed three arms red -- "#root has 0 children: the console did not mount", the uncaught module-scope error, and the break flag surviving into the bundle. The gate's teeth are intact.
Ruling needed: D-138's remains open and is now the only question here.

### D-277 - The gate could not tell "the console did not load" from "the browser did not run"

Severity:  MINOR (fixed here)
Phase:     T22 - Phase 2
Source:    ops/scripts/verify-boot-smoke.mjs, the `no smoke report in the DOM: the page never reached the probe` branch
Found by:  Running the gate from a sandboxed shell during T21 and reading its message as a product failure
Effect:    Under a restricted or sandboxed shell msedge returns exit 0 in about sixty milliseconds having made ZERO HTTP requests and written ZERO bytes. The gate then finds no marker in an empty DOM dump and says "the page never reached the probe" -- which reads as "the console is broken" and is a statement about the shell.
           IT COST A WHOLE ORDER'S DIAGNOSIS. T21 reported boot-smoke as failing with this message, on the branch and on main, and concluded "environmental on this machine" without being able to say what was environmental about it. Both halves were true and neither was useful.
Response:  FIXED - an empty dump is now named as an empty dump
Action:    A zero-byte DOM says nothing was fetched, so it can say nothing about the console. The gate now says that, and says to try an ordinary shell before reading it as a product failure. One branch, four lines, and it turns an ambiguous red into a directed one.
           The general form is worth carrying: A GATE'S FAILURE MESSAGE IS PART OF THE GATE. Two causes that produce one message make a gate that reports a result nobody can act on, which is the same class as a gate that checks the wrong file (D-274).
Ruling needed: none.

### D-273 - RESOLVED as far as evidence allows: the shared resource is named, bounded, and eight assertions stopped reading other suites' rows

Severity:  MAJOR -> reduced to one named, instrumented survivor
Phase:     T22 - Phase 3
Source:    One PostgreSQL database, no per-worker isolation, and assertions that count rows the suite does not own
Found by:  Running the D-217 protocol, which T21 registered as owed and did not run

THE SHARED RESOURCE, NAMED AND BOUNDED, because "environmental" is a diagnosis and not an answer:
           It is ONE database -- `adulis` on the local `adulis-postgres` container -- reached through one DATABASE_URL by every jest worker, with no per-worker database, schema or transactional isolation. Bounds, measured: 40 spec files; `os.cpus().length` = 20, so jest's default maxWorkers is 19; `max_connections` = 100; per-suite ceiling is APP_POOL_MAX 10 + FINANCIAL_POOL_MAX 4 + the suite's admin pool, so 19 workers can demand up to 304 connections against 100. That is D-217's "connections" clause, quantified.
           The three candidate sub-resources the order offered map onto it as INSTANCES, and one of them is dead: "global sweeps" is the payout_credential and social_post cases; "teardown windows" is the c8/t6 and c2/e2-e6 cases; "the seeded market" is the OTP-budget case; and "rate-limit buckets" is a DEAD candidate -- the IP limiter was DELETED, not tuned (auth.controller.ts, ADU-AUTH-01 S15), so any explanation citing `otp-request-ip` cites a control that no longer exists.

THE ONE FULLY ESTABLISHED MECHANISM, with the colliding line:
           c8-analytics-public inserts a row with template_key `OWNERSHIP_TRANSFER_REQUESTED` for its own owner and keeps it until its afterAll. t6-ownership-transfer selected EVERY row of that template, platform-wide, and compared the set to two of its own account ids. For the whole window in which c8 holds that row, in a different worker, t6 sees three ids and compares them to two. Deterministic given overlap, and it is the failure D-273 recorded.
           The suite already knew its own ids: its beforeEach cleanup scopes correctly by `recipient_account_id = ANY($1)`. The read declined to.

Response:  FIXED - eight assertions and teardowns scoped, per D-83's existing rule
Action:    D-83 already governs this and says it in one line: "Exactly one suite may own a global sweep, and no test asserts a global count ... a test that asserts a number the whole database contributes to is a test about other people's rows. Assert your own row is gone; assert theirs is not." D-273 is that rule violated in eight new places. Fixed:
             READS   t6-ownership-transfer x3 (REQUESTED, ACTIVATED, CANCELLED) -> scoped to its own two accounts
                     e2-e6 payout_credential, two fleet-wide counts around a job run -> scoped to its own seller
                     c4-financial's notification delta -> scoped by recipient as well as by time
                     migration-04-05's `count(*) = 0` over verification.access_log -> scoped to its own actor
                       (t5-identity-operator-only WRITES that table and cleans up from it, in another worker)
             SWEEPS  c2's table-wide social_post orphan sweep -> a CTE that deletes only its own links and their posts
                       (it matched exactly the three unlinked rows e2-e6 inserts and reads back)
                     c1's table-wide core.person orphan sweep -> scoped to its own market's people
                     c6's media_lifecycle purge by reason alone -> scoped to its own seller
           NOT CHANGED, deliberately: the table-wide counts over IMMUTABLE reference data (core.permission 42, core.role_permission 139, core.locale_pack 2, the permission matrix). Nothing writes those, the counts are the point, and "fixing" them would remove a real assertion.
           NOT CHANGED, deliberately: jobs.worker_heartbeat's `count(*) = 1`. It reads like a table-wide count and is not one -- the table is ONE ROW BY CONSTRUCTION (`id boolean PRIMARY KEY CHECK (id)`), so no other suite can add to it. It was in the candidate population and measurement removed it.

Verification: THE D-217 PROTOCOL, RUN.
             isolation      t6 8/8, t12-d89 6/6, c4 20/20, e2-e6 24/24 -- every implicated spec green alone
             maxWorkers=2   565/565, 43/43 suites
             re-run         THIRTEEN consecutive full-suite runs: TWELVE green at 565/565.
           BEFORE: roughly one run in three failed, with a DIFFERENT test each time. AFTER: one run in thirteen, always the SAME test.
Ruling needed: none for the fixed population. See D-279 for what survives.

### D-278 - The probe written to close D-270 made D-273 four times worse, and measurement caught it

Severity:  MAJOR (introduced and fixed inside T22)
Phase:     T22 - Phase 1, found in Phase 3
Source:    The twenty-one-job role probe, first written to call `job.run()` for real
Found by:  Running the D-217 protocol on the branch and not recognising the numbers
Effect:    Running twenty-one jobs for real is twenty-one FLEET-WIDE sweeps. notification.send drains every pending row, stock.confidence_nudge nudges every stale variant, the purges purge -- so the probe consumed the fixtures of the tests below it in its own file and of every suite in every other worker.
           MEASURED, and the comparison is the whole entry: with the naive probe the full suite failed 4 runs of 4, two to five tests each. With the probe reverted to main's file, 2 of 3 runs were 564/564. The test written to close one defect had quadrupled another.
           It is D-83's rule broken by the very change that cites D-83 in its own comment for choosing which file to live in.
Response:  FIXED - every job now runs inside a transaction that is always rolled back
Action:    Postgres checks privileges PER STATEMENT, before it does the work, so a missing grant raises inside a transaction exactly as it would outside one. The rollback discards only the EFFECT, which was never what the probe was for. Verified it still catches the real thing: revoking migration 0049's grant makes it report, by name, "payout.activate_due: permission denied for table payout_details".
           TWO JOBS CANNOT BE WRAPPED -- notification.send and notification.push_seller open their own transaction, and kysely refuses to nest. That is a coverage hole, and it is NAMED AND ASSERTED rather than swallowed: the probe pins the set, so a third job doing the same thing fails the test instead of quietly costing coverage. Both are covered by real runs elsewhere in the same file.
           The general lesson is the one D-83 already carries and this proves again from the inside: a test that exercises production behaviour fleet-wide is a test about other people's rows, even when it is a test you wrote to be careful.
Ruling needed: none.

### D-279 - What survives D-273: one arm, one in thirteen, now instrumented

Severity:  MINOR (a known, bounded, self-reporting flake)
Phase:     T22 - Phase 3
Source:    c4-financial.e2e.spec.ts, "with step-up, an aged device and no locks", the PAYOUT_CHANGE_REQUESTED assertion
Found by:  Thirteen consecutive full-suite runs after the D-273 scoping landed
Effect:    ONE run in thirteen, and always this arm. It is D-261's original red, which D-266 re-measured and narrowed and could not close, surviving a third order.
           SCOPING CANNOT HAVE FIXED IT AND WAS NOT EXPECTED TO. The read was unscoped and is now scoped, but an unscoped read of this shape can only produce a FALSE GREEN -- another suite ADDING a row makes `toBeGreaterThan(0)` pass. The observed failure is zero rows, and no unscoped DELETE of core.notification exists anywhere in the suite (all sixteen are recipient- or market-scoped).
           D-266's two candidate paths are both CLOSED by reading the code: the POST is a plain INSERT, so the trigger always takes the REQUESTED branch, and the idempotency key is a fresh randomUUID per POST.
           WHAT REMAINS A CANDIDATE is the trigger's shape. `core.fn_notify_payout_change` is an `INSERT ... SELECT ... JOIN core.market` -- and an INSERT over an empty SELECT inserts nothing and raises nothing. That is the exact class T20 found in the device seed, where `INSERT ... SELECT ... WHERE code='SEED'` silently wrote no row and five tests then accused a blameless endpoint.
Response:  INSTRUMENTED, not guessed at
Action:    The arm now makes its own next failure diagnostic. On zero rows it dumps every notification that DOES exist for that owner with its scheduled_for, plus Postgres `now()` and `clock_timestamp()` and the Node clock, and throws with all of it. The two hypotheses have different fingerprints and this separates them:
             rows exist, all scheduled_for < startedAt  -> the row WAS written and the time predicate excluded it
             no rows at all for the owner               -> the INSERT..SELECT wrote nothing, D-266's remaining path
           A flake that has survived three orders is not closed by a fourth guess. It is closed by the next occurrence explaining itself, and that is now arranged.
Ruling needed: none. The next red carries its own diagnosis.

### D-280 - The default worker count is slower AND redder than --maxWorkers=2

Severity:  MINOR (a measurement, offered rather than acted on)
Phase:     T22 - Phase 3
Source:    jest's default maxWorkers of cores-1 = 19 against one Postgres with max_connections = 100
Found by:  Running the D-217 protocol and timing it, which no report in this repository had done
Effect:    EVERY RELEASE REPORT SINCE T14C HAS CITED "--maxWorkers=2" AS THE SLOW-BUT-SAFE FALLBACK, and the assumed cost of adopting it was a 6-20x increase in wall clock. THAT ASSUMPTION IS WRONG, and nobody had measured it: no run log in docs/build-status records a duration.
           Measured on this machine, same database, same commit:
             --maxWorkers=2   565/565, 43/43 suites, 17s
             default (19)     565/565, 34-39s across five runs
           The cap is roughly TWICE AS FAST, not six to twenty times slower. Nineteen workers demanding up to 304 connections against a ceiling of 100 is contention, not parallelism.
Response:  REPORTED, NOT ADOPTED
Action:    Not pinned in gates.mjs, and the reason is not cost. A cap makes the remaining instances of this class INVISIBLE rather than absent -- it would have hidden every one of the eight assertions D-273 just fixed, and it would hide the ninth. The scoping is the fix; the cap is a way of not needing one.
           It is recorded because the cost sentence was repeated across four reports without a measurement behind it, and because a founder deciding this should decide it against numbers. If the gate's wall clock ever becomes the constraint, the cheap answer now has evidence.
Ruling needed: whether to pin the API test gate's worker count. The measurement is here; the decision is not mine.

### D-281 - Two jest workers raced to unlink one file, and a whole spec reported "failed to run"

Severity:  MINOR (fixed here)
Phase:     T22 - Phase 4, observed while re-running the suite
Source:    apps/api/src/modules/auth/sms.adapter.ts -- FakeSmsAdapter's constructor did rmSync(devSmsLogPath()) before writing an empty file
Found by:  One run in six going red with EPERM instead of an assertion
Effect:    `EPERM: operation not permitted, unlink '.dev-sms.log'`, and c1-onboarding reported "Test suite failed to run" -- a whole spec file blamed for a file it never mentions. Every jest worker constructs a FakeSmsAdapter against the SAME path, and on Windows a file another process holds open cannot be unlinked.
           IT IS D-273'S SHAPE WITH A FILE AS THE SHARED RESOURCE INSTEAD OF A TABLE, which is worth saying because D-273's whole population was database rows and the class is wider than that. Nineteen workers share a filesystem as surely as they share a database.
Response:  FIXED - truncate, do not unlink
Action:    Writing an empty file achieves what the unlink was for -- the log starts empty for this run -- without requiring exclusive access to a path nineteen processes share. The mode comment above it is unchanged and still true.
Ruling needed: none.

### D-282 - D-261 IS DIAGNOSED: the assertion compared a server timestamp to a client one

Severity:  MAJOR (fixed here) -- open across D-261, D-266, D-273 and D-279
Phase:     T22 - Phase 4, by the instrumentation added in T22 Phase 3
Source:    c4-financial.e2e.spec.ts, `scheduled_for >= startedAt` where startedAt was a JS `new Date()`
Found by:  The forensics D-279 attached to the arm, on its first reproduction
Effect:    THE FORENSICS PRINTED THE ANSWER:
             startedAt                  2026-09-04T02:34:00.216Z
             newest row for this owner  2026-09-04T02:34:00.202Z
           THE ROW WAS WRITTEN. It was fourteen milliseconds "before" an instant the test had captured a moment earlier, so the predicate excluded it and the arm reported that the notification did not exist.
           THAT REFUTES D-266'S REMAINING CANDIDATE. The INSERT..SELECT..JOIN was not writing zero rows; rows plainly exist, six of them for this owner. Three orders looked for a missing write and the write was never missing.
           THE MECHANISM: `core.notification.scheduled_for` defaults to `now()`, which in Postgres is TRANSACTION START -- not statement time -- and it is POSTGRES'S clock, not Node's. Comparing a server-assigned instant to a client-assigned one is a race whose margin is the difference between two machines' clocks plus the width of a transaction. Under nineteen parallel workers that margin is not always positive.
           D-261 called it clock skew and could not measure it. D-266 re-measured the clocks properly, found them within a millisecond, and correctly declined to conclude from that. BOTH WERE LOOKING AT THE RIGHT THING. What neither had was the failing row's own timestamp printed beside the value it was being compared against -- which is the whole argument for instrumenting a flake instead of guessing at it a fourth time.
Response:  FIXED - the assertion uses no clock at all
Action:    Count before, count after, assert the count rose. That is what the arm's own comment ("A DELTA, not a running total") always meant; the previous attempt implemented the delta with a wall clock, which is the defect. Combined with D-273's recipient scope it is immune to skew AND to other suites' rows.
           THE GENERAL RULE, worth carrying: A TEST MAY NOT COMPARE A SERVER-ASSIGNED TIMESTAMP TO A CLIENT-ASSIGNED ONE. Where a test needs "since I started", the honest instrument is a count taken before and after, or a timestamp the server itself issued.
Verification: nine consecutive full-suite runs green after the fix (566/566), against one-in-ten before it, on the arm that had flaked in three consecutive orders.
Ruling needed: none. D-261, D-266 and D-279 are all discharged by this entry.

### D-283 - fn_effective_limit resolved the intersection and threw both operands away, and no endpoint called it

Severity:  MAJOR (fixed here) -- the contract half of ADU-CON-03 S8
Phase:     T22 - Phase 4.2
Source:    billing.fn_effective_limit's PRODUCT_COUNT branch returned {"allowed":true,"cap":N} and nothing else
Found by:  Drawing SC-07 in T21 and discovering the contract could not fill it
Effect:    ADU-CON-03 S8 requires the counter to say WHICH limit binds: "A NEW seller on a paid tier is capped at 10 by ladder_config.new_level_product_cap, whatever the tier allows -- and '10 of unlimited' is a bug report waiting to be filed." The function computed exactly that intersection with `least(tier_cap, level_cap)` AND DISCARDED BOTH OPERANDS ONE LINE AFTER READING THEM.
           A seller told "10 of 10" without being told which limit that is cannot know whether PAYING or TRADING lifts it. Those are different actions and the number is identical.
           WORSE, NO HTTP ENDPOINT CALLED IT FOR PRODUCT_COUNT AT ALL -- the only callers were SQL function bodies -- so even the collapsed number never reached the wire. SC-07 said so on screen for three orders, which is S17 working as intended: a region that depends on a contract names the endpoint and the field, and naming it is what got it built.
Response:  FIXED - migration 0050 and a `publication` object on GET /v1/seller/products
Action:    The function now returns tier_cap, level_cap, binding and level beside the unchanged cap. ADDITIVE ONLY: `allowed` and `cap` are byte-identical, so fn_publish_product and every other reader is untouched, and CREATE OR REPLACE preserves owner and grants (verified: adulis_app still holds EXECUTE, owner still adulis_migrate).
           `level_cap` is read from the ladder subselect DIRECTLY rather than derived from `cap`, because `least()` IGNORES NULLS -- least(NULL,10) is 10 -- so reconstructing the operands from the result would inherit exactly that hole.
           `binding` is TIER | LEVEL | BOTH | NONE. BOTH when the two are equal and non-null, because naming one there would be a coin flip.
           AND `resolved` IS CARRIED SEPARATELY. The function's fail-closed branches (NO_TIER_DEFINITION, NO_LADDER_CONFIG) return allowed:false, and collapsing that into "no cap is in force" would tell a seller who cannot publish at all that nothing limits them -- the opposite of the truth. The screen has its own sentence for it.
Verification: all four bindings proven in a rolled-back transaction -- NEW with tier 25 vs level 10 gives cap 10 binding LEVEL; ESTABLISHED gives cap 25 binding TIER; tier 10 with level 10 gives BOTH; no cap gives NONE. c2-catalogue asserts the wire: cap 2, binding LEVEL, level NEW, level_cap 2. console-e2e asserts the browser renders a binding and never the word "unlimited".
Ruling needed: none. But see the note below -- the seeded environment cannot reach the ordinary path.

### D-284 - The seed seller has no subscription, so the seeded console can only reach the fail-closed limit

Severity:  MINOR (registered, NOT fixed -- fixing it broke two screens)
Phase:     T22 - Phase 4.2
Source:    ops/scripts/seed.mjs creates no billing.subscription row; migration 0016 seeds ONE tier_definition, the BETA row
Found by:  SC-07's new cap counter rendering "your limit could not be resolved" in the seeded environment
Effect:    fn_effective_limit resolves the tier from the seller's subscription and falls back to LISTED when there is none. 0016 deliberately seeds only the BETA row -- the priced tiers are a commercial decision that has not arrived -- so a seller with no subscription resolves to LISTED, finds no definition, and FAILS CLOSED.
           The behaviour is correct. THE FIXTURE IS NOT: every real beta seller has a BETA subscription, so the seeded environment reaches only the fallback and never the ordinary path. SC-07 therefore demonstrates "your product limit could not be resolved" rather than the sentence S8 actually specifies.
Response:  RULED AND FIXED IN T23 PHASE 2 -- the T22 text below is kept because it is the argument the ruling answers
Ruling:    T23 S2: SEED TWO SELLERS, one with a BETA subscription and one without. Neither screen loses its demonstration, because the two screens are no longer arguing about one row.
           IT IS TWO ACCOUNTS, NOT ONE, and that is not tidiness. chooser.spec.ts asserts that a single-store seller is taken STRAIGHT INTO their store rather than asked to choose -- D-97's closure -- and its comment states the fixture property it rests on: "The seeded account owns exactly one store, which is the shape almost every real seller has." Hanging the second seller off the same account made that true of nothing and turned four chooser tests red on the first run. So the second SELLER got a second OWNER (+251900000003), both accounts own exactly one store, and D-97's test keeps its subject.
             seed-store        no subscription  -> SC-26 "honest about having none", SC-12's entitlement arm
             seed-store-beta   BETA             -> SC-07 resolves cap 10, binding LEVEL, level NEW
           THE COUNT GATE CAUGHT IT FIRST, which is the gate working: `db:reset` refused with "sellers: expected 1, got 2" before any test ran. Its EXPECTED map is a transcription of what the seed defines, so accounts and sellers moved together, with the reason written beside them.
           AND SIGN-IN NEEDED A REAL FIX, not a fixture one. A second owner means a second sign-in, and `browser.newContext()` merges the config's `use.storageState` unless the option is given a VALUE -- `undefined` reads as "not specified", so the new context arrived carrying the FIRST account's session cookie and ADU-API-01 S5.1's Origin check refused the sign-in POST 403, correctly, as a cookie-carried write with no Origin. `storageState: { cookies: [], origins: [] }` is the honest empty.
Verification: `pnpm verify:console-e2e` -- 86 passed, including SC-07's subscribed arm asserting `data-cap-binding="LEVEL"`, the text "0 of 10", the sentence "New sellers can list 10 products", the word "Established", and zero occurrences of "unlimited". SC-26 and the four chooser tests stayed green. On the wire: seed-store -> {"allowed":false,"reason":"NO_TIER_DEFINITION"}, seed-store-beta -> {"allowed":true,"cap":10,"binding":"LEVEL","level":"NEW","tier_cap":null,"level_cap":10}.
Action:    Adding the BETA subscription to the seed WORKS -- the limit resolves to cap 10, binding LEVEL, level NEW, which is ADU-CON-03 S8's model sentence verbatim ("10 of 10 -- new sellers can list 10 products. This lifts when your store reaches Established.").
           IT ALSO BREAKS TWO SCREENS THAT ARE SEEDED TO DEMONSTRATE THE OPPOSITE. SC-26's e2e is titled "Subscription -- honest about having none", and SC-12's entitlement arm depends on the same absence. Both went red. The seed serves thirty screens, and one screen's realistic fixture is another screen's broken demonstration.
           So the number is proven where it can be proven without that cost: c2-catalogue asserts cap 2 / binding LEVEL / level NEW on the wire, and the e2e asserts the region renders, names a binding, and never prints "unlimited".
Ruling needed: ANSWERED -- see Ruling above. It was a fixture question with a product answer, and the answer was that the fixture was too small to hold both truths.

### D-285 - Two focus-ring rules, and the one that lost was the token's

Severity:  MAJOR (fixed here)
Phase:     T22 - Phase 5
Source:    apps/console/src/console.css declared `:focus-visible { outline: 3px solid var(--adu-color-accent) }`; packages/tokens/tokens.css declared `:where(...):focus-visible { outline: var(--adu-focus-ring-width) solid var(--adu-focus-ring-color) }`
Found by:  Planting a violation to prove the new rule-5 guard fires -- and watching it NOT fire
Effect:    BOTH RULES WERE LIVE AND THEY DISAGREED. The token said 2px and named a dedicated `--adu-focus-ring-color`; the console said 3px and read `--adu-color-accent` directly. Because the token's rule is written `:where(...)` -- deliberately at specificity ZERO so a surface can override the treatment -- THE CONSOLE'S ALWAYS WON.
           So the console rendered a 3px ring and NEVER ONCE READ THE FOCUS TOKEN. `focus.ringWidth` and `focus.ringColor` described something nothing rendered.
           IT MADE T21's WORK INERT. D-271 gave the ring a DARK value because a 2px #1e40af ring on a #14120f page is a focus indicator the colour of the ground it sits on. That fix was correct, it was gated, and it bought the console nothing, because the console was not reading the token it fixed.
           This is D-259's class from the other direction. There the console referenced variables that existed nowhere and every fallback silently rendered a literal. Here the console defined its own value for a variable that did exist -- same outcome, opposite cause: a token whose value is not what ships.
           IT WAS INVISIBLE BECAUSE NOTHING READ THE RING BACK. `verify:tokens` compares index.ts to tokens.css and passes; both are internally consistent. What no gate did was ask the BROWSER what outline it actually painted.
Response:  FIXED - the console's rule now reads the tokens
Action:    Width, colour and offset all come from `--adu-focus-ring-*`. The width is kept at the token's 2px rather than this file's 3px, and that direction is the point: A TOKEN THAT LOSES AN ARGUMENT WITH A STYLESHEET IS NOT A TOKEN.
Verification: proven by the guard that found it. With the console reading the token, setting `--adu-focus-ring-width: 0px` turns rule 5 red in BOTH light and dark; before the fix the same plant changed nothing. Restored, and 83/83 green.
T23 S2:    THE FIX WAS NOT THE WHOLE ANSWER, and T23 says why: the ring was one of SIXTY-NINE variables, ANY of which could be defined, verified and unread. Rule 5's guard asserts a ring is VISIBLE; it never asked whether the ring was the TOKEN's. So `apps/console/e2e/tokens-are-read.spec.ts` reads tokens.css per mode and compares it to `getComputedStyle`, on three shapes chosen because they are the three ways a token gets consumed:
             the FOCUS RING     read as a whole DECLARATION, measured on a real Tab-focused element
             the ACCENT         read as a COLOUR -- the one D-285 bypassed
             the DANGER TRIPLE  read as a SET, where the failure is one of three hardcoded and the other two not
           NOT ALL SIXTY-NINE, deliberately: a gate asserting every one would be a transcription of tokens.css with a browser attached, stale the day a token is renamed. These three go stale only if the console stops reading tokens at all, which is the thing being guarded.
           Tagged `@safety`, so the dark project re-runs it. PROVEN TO FIRE TWICE, and the second plant is the one that argues for both modes:
             `outline: 3px solid #1e40af` (D-285 verbatim)          -> RED in light AND dark, on the width
             `outline: var(--adu-focus-ring-width) solid #1e40af`   -> GREEN in light, RED in dark
           The second is the whole case for the dark project in one line: a hardcoded LIGHT accent is indistinguishable from a correct one in light mode and wrong in dark. Expected rgb(138, 176, 255), painted rgb(30, 64, 175). Restored, 86/86 green.
Ruling needed: none.

### D-286 - Three of the six safety rules were enforced by absence, and none of the six ran in dark mode

Severity:  MAJOR (fixed here -- the guard, not a defect in the product)
Phase:     T22 - Phase 5
Source:    apps/console/e2e -- one Playwright project, no colorScheme, no emulateMedia anywhere
Found by:  Surveying what a component port could break without any gate firing
Effect:    T22 S5.1 requires the six product-safety rules to hold in both modes AFTER the port, and warns that "a component library is exactly where a 'primary' variant quietly becomes the confirm button".
           TWO PROBLEMS, and the second is the one that made the first dangerous.
           (1) THREE RULES WERE HELD BY NOTHING BUT ABSENCE. Rule 1 by there being no `.decision` variant; rule 4 by there being no colour rule on a badge at all; rule 6 by `Deadline` returning null. A design system arrives WITH variants and tones by default, so a port could satisfy every existing test and break all three. Rules 4 and 5 had no e2e assertion of any kind.
           (2) NOT ONE TEST RAN IN DARK MODE. Every one of the six was asserted in exactly the mode a developer looks at -- and a mode is precisely where an absence stops being absent. D-285 is the worked example: the focus ring's token had no dark value until T21, and nothing here could have caught it.
Response:  FIXED - a second Playwright project, and the two missing rules asserted
Action:    A `dark` project re-runs ONLY the `@safety`-tagged tests with `colorScheme: 'dark'`. Running the whole suite twice would double the most-run console gate for coverage nobody asked for; running the six rules twice is the requirement. It needs no application change -- the console has no theme switch of its own and tokens.css keys dark off `prefers-color-scheme`.
           New assertions for the two rules that had none: every state badge carries a WORD (not a class, not a colour -- text is what survives greyscale and the mode you do not develop in), every readiness row says its state in words, and the focus ring appears on Tab AND NOT on a mouse click. Both halves of rule 5, because a ring that never shows fails a keyboard user and a ring that shows on every click is the one somebody eventually deletes.
           They are keyed on `data-badge`, `data-clock`, `data-verbatim`, `data-gate` and `data-gated` -- the attributes a port must preserve -- rather than on class names a port will legitimately change.
           WRITTEN BEFORE THE PORT, NOT AFTER. A guard added after the thing it guards has already proved nothing about the change.
Verification: 83 tests, 11 of them in dark. Both guards proven to FIRE: a `#detail-confirm` "primary" variant -- the exact thing the order warns about -- turns rule 1 red in BOTH modes; a zero-width focus ring turns rule 5 red in BOTH modes. Restored, 83/83.
Ruling needed: none.

### D-287 - T22 Phase 5 is PART DONE, and this says which part

Severity:  INFORMATIONAL (scope, stated rather than implied)
Phase:     T22 - Phase 5
Source:    WORK ORDER T22 S5's four-step order: variables, eleven components, twelve ScreenState treatments, five screen layouts
Effect:    WHAT LANDED: step 1 in full, and the precondition S5.1 sets for everything after it.
             Step 1, VARIABLES -- already done and verified rather than migrated. T21 ruled that Figma imports packages/tokens and never invents a parallel set, so there is nothing to bring back; the one value the design needed that the tokens lacked (focusDark) landed in T21 S2 and is merged. `verify:tokens` green, both modes, both directions. AND THE CONSOLE NOW ACTUALLY READS ONE OF THEM (D-285), which it did not before.
             S5.1, THE SIX RULES IN BOTH MODES -- done, and proven to fire (D-286).
           WHAT DID NOT: steps 2, 3 and 4. Eleven components, twelve ScreenState treatments, five screen layouts.
           THE SHAPE OF THAT WORK, measured so the next order is not surprised: only THREE of the eleven exist as React components today (PaymentDecisions, StateBadge, ScreenState). The other eight are bare CSS applied inline across 37 feature files -- Button and Input are ELEMENT selectors with 94 raw <button> and 38 raw <input> call sites, and the three Nav components are three regions inside one file sharing one const. So it is three swaps and eight extractions-from-scratch, not eleven of the same job.
           AND THE ORDER MATTERS: Button and Input must be done LAST, not first. They are element selectors today, so until every call site is migrated the bare `button`/`input` rules must stay alive -- otherwise every unmigrated control loses its 44x44 touch target in the same commit that introduces the component meant to guarantee it.
Response:  REPORTED, NOT ATTEMPTED HALFWAY
Action:    An eleven-component port started and abandoned mid-way leaves the console in two design systems at once, which is the state T22 S5's own ruling exists to prevent: "five screen layouts applied first improves five and leaves twenty-five visibly inconsistent -- and the inconsistency is what a seller notices". The same is true of six components out of eleven.
           What this phase leaves behind is the thing that makes the port safe to do next: a guard that fails, in both modes, the moment the port breaks a safety rule.
Ruling needed: none. It is scheduling.

### D-288 - Three gap sentences promised a name the schema is built never to store

Severity:  MINOR (fixed here) -- honesty of seller-facing copy, and one advertisement removed
Phase:     T23 - Phase 3
Source:    packages/locale/src/en.ts -- the ten remaining `_owed` sentences, triaged one by one against what the server returns TODAY
Found by:  Reading `core.person` while checking whether the courier list's "Names ... not reported by the server yet" had closed
Effect:    IT HAS NOT CLOSED AND IT NEVER WILL. `core.person` carries id, id_hash, id_hash_key_version, created_at. `core.account` carries a phone and a market. THERE IS NO NAME COLUMN ANYWHERE FOR A PERSON -- not for a buyer, not for a courier, not for the human behind a seller. A store has a `store_name`; a person has nothing.
           So three sentences said "not reported by the server YET" about a field no server will ever report, and each one set a seller waiting for a release that is not coming:
             console.store.couriers.columns_owed   "Names, current assignments and last activity are not reported by the server yet"
             console.inbox.columns_owed            "Buyer names, message previews, unread markers ... are not reported by the server yet"
             console.courier.details_owed          "The buyer name, the pickup point and the collection note are not reported to couriers yet"
           AND THE CONSOLE ALREADY KNEW BETTER, TWO SCREENS AWAY. `console.trade.orders.no_buyer_name` states it correctly and as policy: "Adulis does not store a name for a buyer account, so there is none to display, and showing a phone number instead is not permitted where a conversation exists." BETA-READINESS's triage even flagged the trade pair as "not a gap sentence at all -- it states a deliberate privacy decision" and did not notice that three OTHER sentences were making the opposite claim about the same absence.
           That is the whole defect: one product decision, told two ways, and the wrong way outnumbered the right one three to two.
Response:  FIXED - the name clause states the policy; the genuinely-pending clauses keep their "yet"
Action:    Each of the three now opens with the permanent fact and then lists what is actually owed, so the sentence stops mixing a decision with a backlog. The courier one still ENDS IN ITS INSTRUCTION ("call the number above to arrange the handoff") -- BETA-READINESS calls it "the only gap sentence that ends in an instruction", and that is the load-bearing half.
           ONE DELETE, and it is the one the order names: `console.insights.analytics.export_owed` advertised a paid feature (Business) on a screen where it cannot be bought, and the plan comparison does not sell it either. Either sell it or say nothing. D-226's rule -- an export exists in no wire, and a control faked at a 404 is worse than an absence -- is untouched and is written where the sentence used to be. THE ABSENCE STAYS; THE ADVERTISEMENT GOES.
           THE OTHER SIX ARE KEEP, and each was re-checked against the tree rather than carried forward on T20's verdict:
             products.row_summary_owed   KEEP  GET /v1/seller/products returns id, name, base_price, image_key, visibility, display_order -- no stock, no variants. Still true.
             variants.labels_owed        KEEP  core.attribute_definition has ZERO rows and no endpoint lists it; the editor returns bare attribute_definition_id UUIDs. Still true.
             store.profile.logo_owed     KEEP  core.seller has no logo column. Still true.
             store.identity.recheck_owed KEEP  no re-check endpoint exists. Still true.
             claims.detail.history_owed  KEEP  the detail returns attachments, not an event trail. Still true.
             insights.trust.wire_owed    KEEP  and DELIBERATELY UNTOUCHED: trust is a founder-owned engine, and this order forbids touching, stubbing, extending, designing or registering against it. The sentence is the honest face of that boundary.
Verification: `verify:mt-keys` PASS (769 machine-translated, 2 HUMAN-REQUIRED -- the deleted key regenerated out of the list, the three reworded keys still present in both files). `tsc` clean on the console and on packages/locale, which is the gate that would have caught a key deleted from en.ts and left in am.ts or vice versa. `verify:console-e2e` green.
Ruling needed: none. Nine of the ten sentences were already triaged in BETA-READINESS; this applies those verdicts and corrects the three that were triaged against the wrong fact.

### D-289 - ops/render.yaml exists now, unapplied, with a gate over every claim it makes about this repository

Severity:  MAJOR (fixed here) -- D-80 has been open since T6 and blocked on a fact, not a decision
Phase:     T23 - Phase 4
Source:    ADU-CON-02 v3.1 S18 -- "`render.yaml` keeps infrastructure in the repo" (:446) and "Topology (`ops/render.yaml`)" (:450)
Found by:  D-80, in T6, while writing the deploy runbook and looking for the file it should point at
Effect:    The hosting topology existed as one sentence in a document and a paragraph in `ops/runbooks/deploy.md`. Infrastructure created by hand in a dashboard is infrastructure nobody can review, diff or restore.
           D-80's REASON FOR LEAVING IT ABSENT WAS GOOD, and it is why this stayed open for seventeen orders: "Writing it needs a Render account to verify against; inventing a `render.yaml` that has never been applied would be a file that looks authoritative and has never been true." T23 Phase 1 went looking for that account, found no credentials of any kind -- no environment variables, no `render` CLI, no `~/.render` -- and PARKED rather than simulating one. So the objection still stands in full.
Response:  FIXED, and the objection answered rather than ignored
Action:    The file lands, and its FIRST LINE says "THIS FILE HAS NEVER BEEN APPLIED." That sentence is deleted by the person who applies it and by nobody else, and `verify:render-yaml` notices when it goes.
           WHAT MAKES IT MORE THAN A DRAFT is the gate beside it. It cannot check that Render accepts the schema -- only applying it can -- and it prints that limitation rather than implying otherwise. What it CAN check is every claim the blueprint makes about THIS REPOSITORY, which is exactly the set of claims that rot between the day a file is written and the day somebody runs it:
             1. every pnpm script and node entry point it names exists
             2. healthCheckPath is a route the API serves AND is @Public (D-79: without @Public it answers 401 to Render, every instance is marked unhealthy, and no deploy ever goes live)
             3. the pre-deploy runs BOTH db:migrate and worker:install, from ONE service (D-52; two services migrating race each other)
             4. every variable .env.example declares is declared for the API, and every VITE_* for the console
             5. no secret carries a literal value, and NODE_ENV is in the closed set
             6. every fromService names a service the file defines
           THREE DECISIONS IN THE FILE ARE NOT TRANSCRIPTION and are argued where they are made. The three DATABASE_URLs are `sync: false` rather than `fromDatabase` because Render synthesises ONE connection string and this platform needs THREE ROLES -- collapsing them to the owner connection would make every privilege check in the schema untestable and would pass every test. The staging API is pinned to ONE INSTANCE because the OTP goes to a file on the instance that answered. And the static console declares NO NODE_ENV, because Vite picks React's development build from it.
Verification: `pnpm verify:render-yaml` PASS. Every one of the six checks proven to FIRE by planting its violation: a renamed `worker:install`, a wrong health path, a preDeployCommand on the worker, a dropped CONSOLE_ORIGIN, a pasted DATABASE_URL, NODE_ENV on the console, and a misspelled fromService. All seven went red; restored, green.
Ruling needed: none. What remains is applying it, which needs the account Phase 1 parked for.

### D-290 - NEVER_LOG removes FIELDS, and a secret interpolated into `msg` is not a field

Severity:  MAJOR (registered; the limit is now written down and asserted)
Phase:     T23 - Phase 4
Source:    apps/api/src/common/logging.ts -- `redact: { paths: [...NEVER_LOG], remove: true }` plus `formatters: { log: applyAllowList }`
Found by:  Writing the test that was supposed to prove a staging OTP never reaches the logger -- and watching it PASS with the violation planted
Effect:    TWO FINDINGS, and the second is only visible because the first was chased properly.
           (1) THE FIRST INSTRUMENT WAS BLIND. The obvious test captures `process.stdout.write` and searches it for the code. pino writes through SonicBoom straight to file descriptor 1 and never touches `process.stdout.write`, so the capture saw nothing, the assertion passed, and the green meant NOTHING. A measurement that cannot observe the thing it rules out proves nothing about it.
           (2) AND REDACTION WOULD NOT HAVE COVERED IT EITHER. `NEVER_LOG` names `otpCode` and `phone`, and `applyAllowList` drops unknown keys outright -- so the STRUCTURED field is genuinely removed. But `msg` is allow-listed and NOTHING READS ITS CONTENTS. `log.warn({ msg: `code ${code}` })` passes every control this repository has, and sms.adapter.ts's own comment ("the logger CANNOT carry an OTP -- the code and the phone are on NEVER_LOG") is true of the field and false of the sentence.
Response:  REGISTERED, with the limit asserted in both directions
Action:    The guarantee is now written where it can be checked rather than believed. One test logs `{ phone, otpCode }` as fields and asserts they are gone; the same test logs the code inside `msg` and asserts IT SURVIVES -- not a bug asserted as correct, a LIMIT written down, so that nobody reaches for "the logger redacts it" as a reason to log a secret.
           The adapter's own guarantee is asserted ON THE SOURCE: FakeSmsAdapter's send path contains no logger call at all. That is a weaker instrument than a behavioural one and it says so -- but it is an instrument that FIRES, which the two stronger-looking ones were not.
           STAGING'S OTP DESTINATION FOLLOWS FROM THIS. The founder's boundary for T23 is that "anyone who can read its logs can sign in as anyone", which describes what staging is WORTH, not a licence to move an OTP onto a log line -- ADU-RUL-03 S1.1 is a governing document and this window is unattended. So staging writes the code where development already writes it: a 0600 file, off stdout, outside every container log aggregator. That is what makes the staging API's instance count load-bearing, and `ops/render.yaml` pins it to one and says why.
Verification: 10 tests in t8-node-env-boundary.spec.ts, all green. Both new guards proven to fire: a `log.warn` added to the send path turns the source assertion red; a negated fake-guard (`!== 'development' && !== 'test'`) turns the staging/production pair red. Restored, 570/570 API tests green.
Ruling needed: YES, but small and not urgent -- should `applyAllowList` scan `msg` for the shapes it already refuses as fields (a six-digit code, an E.164 number)? It would catch this class rather than documenting it. It also risks a redaction that fires on an order reference, which is why it is not decided here.

### D-291 - The console's CSP named two origins that had never been true, and were typed a second time

Severity:  MAJOR (fixed here)
Phase:     T23 - Phase 4
Source:    apps/console/public/_headers -- `connect-src 'self' https://api.adulis.example https://media.adulis.example`, with a note saying they "are replaced with the real ones when DNS is provisioned"
Found by:  T23 Phase 4's "CSP and CORS derived, not hardcoded"
Effect:    A SECOND PLACE TO CONFIGURE AN ORIGIN THE BUILD ALREADY KNOWS. CORS was already derived -- `CONSOLE_ORIGIN`, one variable, read by the middleware -- and the CSP was not.
           THE DRIFT IS SILENT IN THE DIRECTION THAT HURTS. A policy naming an API the bundle does not call refuses every fetch IN THE BROWSER, before it leaves the machine, with no server-side symptom to find. This repository has hit it twice: D-164 (the e2e server replayed the production directive at a localhost bundle, every fetch refused, and the suite went green against something else serving the port) and D-276 (the same drift reaching boot-smoke, which was red on unmodified main while the console mounted perfectly one line above).
           Both were fixed by deriving the policy AT SERVE TIME, in two different harnesses. Neither fixed the artifact, so production would have shipped a policy naming two hostnames that have never existed.
Response:  FIXED - the origins are substituted at BUILD time from the variables the bundle is built with
Action:    `ops/scripts/build-headers.mjs` fills `${API_ORIGIN}` and `${MEDIA_ORIGIN}` in `public/_headers` from `VITE_API_BASE_URL` and `R2_MEDIA_PUBLIC_ORIGIN`, and writes `dist/_headers`. EVERY DIRECTIVE IS STILL WRITTEN, NOT ASSEMBLED, which is what ADU-CON-02 S3.9 requires -- and the script asserts that, comparing the directive list it wrote to the one it read, so it stays a substitution rather than becoming an assembler.
           AN UNSET VARIABLE OMITS ITS ORIGIN RATHER THAN FAILING, and the first version had this wrong. It exited non-zero on the NODE_ENV principle that the permissive branch is the one nobody chose; `pnpm ci:local` failed within a minute, because `pnpm build` is a does-it-compile build with neither variable set. The principle survives in a better form: THE INVARIANT IS THAT THE POLICY NAMES EXACTLY THE ORIGINS THE BUILD WAS GIVEN, and a bundle built without VITE_API_BASE_URL has no API to call at all (`apiBase()` throws before fetch is reached -- the very fact boot-smoke's D-138 note rests on). `connect-src 'self'` is an exact description of that bundle, not a guess about it. A variable that is SET but is not a URL is still refused: that is a typo, not an absence.
           A REAL DEPLOY FORGETTING THEM IS CAUGHT AT THE RIGHT LAYER -- `verify:render-yaml` asserts the console service declares every VITE_* variable .env.example names. A deployment mistake belongs to a gate over the blueprint, not to a gate over a compile.
Verification: three behaviours proven -- built with both variables, the policy names both origins; built with neither, it names neither and says so; built with a non-URL, it refuses. An unresolved placeholder is refused too (a browser silently DROPS a source expression it cannot parse and enforces the rest, so a literal placeholder would ship a policy quietly stricter than the one written). `verify:console-e2e` 86 green, `boot-smoke` green.
Ruling needed: D-138's open question -- whether `connect-src` belongs to boot-smoke's assertions at all -- is now answerable, because the artifact's policy and the artifact agree by construction. Left open deliberately: this phase changed the artifact, not that gate's stated coverage.

### D-292 - What staging can and cannot do on the day this lands

Severity:  INFORMATIONAL (scope, stated rather than implied)
Phase:     T23 - Phase 4
Source:    WORK ORDER T23 S4 -- deploy to staging
Effect:    WHAT LANDED, all of it verifiable on this machine:
             `ops/render.yaml`                 the topology, unapplied, gated (D-289)
             `worker:install` in the deploy    D-52, asserted by the gate
             /healthz 200 degraded not 503     ALREADY CORRECT since T4 (D-51). Verified, not changed: a stale WORKER reddens the body; only an unreachable DATABASE 503s, which is honest, because that instance genuinely cannot serve.
             NODE_ENV=staging in the closed set  with the guard audit written out and two of its entries asserted (D-290)
             the environment banner            served from /v1/bootstrap, rendered above the router so it also covers SIGN-IN -- which is where a real phone number is typed into the wrong server
             TRUSTED_PROXY_HOPS                a validated COUNT, never a boolean
             CSP derived, not typed            D-291
             R2 buckets                        adulis-staging-media / adulis-staging-evidence, separate from production
           WHAT DID NOT LAND, AND IT IS THE DEPLOY ITSELF. Phase 1 found no hosting credentials and parked; nothing here has been applied to a server. Every claim above is about this repository and its gates, and none is about a running staging instance. THE WORD "STAGING" IN THIS ENTRY NAMES A CONFIGURATION, NOT A URL.
           TWO THINGS STAGING WILL NOT BE ABLE TO DO on the day it is first applied, both stated so the first operator is not surprised:
             SIGN-IN NEEDS A SHELL. There is no SMS vendor (O-5b), so the OTP goes to a 0600 file on the API instance. `ops/runbooks/staging.md` says how to read it; the instance count is pinned to 1 so there is only one file to read.
             THE FOUNDER OPERATOR GRANT IS NOT AUTOMATIC. It is Phase 5's, and it is the one that will be forgotten.
Response:  REPORTED
Action:    None owed here. The blueprint is applied by a person with an account, and the first line of the file tells them what to delete when they do.
Ruling needed: none.

### D-293 - boot-smoke cannot run on this machine, and the reason is msedge.exe, not the console

Severity:  MINOR (environmental; the gate is untouched and the property it guards is covered elsewhere today)
Phase:     T23 - Phase 4
Source:    ops/scripts/verify-boot-smoke.mjs spawns `msedge.exe --headless=new --dump-dom` and reads stdout from a file
Found by:  `pnpm ci:local` at the end of T23 Phase 4
Effect:    The gate reports "the browser exited without loading anything: the DOM dump is empty", which its own message correctly warns "says NOTHING about the console".
           THE BROWSER IS THE VARIABLE, AND THE PROOF IS TWO LINES LONG. The same command against `data:text/html,<h1>hi</h1>` -- no server, no policy, no bundle -- also produces ZERO BYTES. So does `msedge.exe --version`. The launcher writes nothing to a redirected stdout from this shell at all, which is msedge.exe detaching from the console on Windows; 55 Edge processes were already running, and a fresh `--user-data-dir` did not change it. `--headless`, `--headless=old` and `--headless=new` all behave identically.
           IT IS NOT THE SANDBOX. Re-run with the sandbox disabled: same zero bytes.
           IT IS NOT T23's CHANGES. A `data:` URL exercises none of them.
Response:  DIAGNOSED, NOT WORKED AROUND
Action:    NOTHING IN THE GATE IS CHANGED. Loosening an assertion to get a green on one laptop is how a gate becomes decorative, and this one is already the only gate that RUNS the console rather than reading it.
           CI IS UNAFFECTED, which is why this is MINOR: `.github/workflows/ci.yml` runs on `ubuntu-latest`, where the candidate list resolves to chromium or google-chrome, and neither has the Windows launcher's detach behaviour.
           AND THE PROPERTY IS COVERED TODAY ANYWAY. `verify:console-e2e` serves the SAME built `apps/console/dist` and drives the SAME Edge -- over CDP, through Playwright, which is why it works -- and 88 tests passed against it in this phase. A console that did not mount could not have produced them. That is not a reason to leave boot-smoke broken; it is the reason nothing was rushed to fix it.
           THE FIX, when someone takes it: drive the browser over CDP instead of `--dump-dom`. Playwright is already a dependency of `apps/console` and already launches this exact binary successfully. It is a rewrite of the gate's spawn block, not a change to what it asserts.
Verification: `msedge.exe --headless=new --dump-dom "data:text/html,<h1>hi</h1>" > out` -> 0 bytes, exit 0. `msedge.exe --version > out` -> 0 bytes. Both with and without the sandbox.
Ruling needed: none. It is work with a known shape, and it is not T23's.
