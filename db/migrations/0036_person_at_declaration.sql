-- 0036 -- D-57: the person row is created at seller-type declaration.
--
-- ADU-RUL-02 via WORK ORDER T7 S3.2 (document text owed -- register D-84).
-- Register D-57: after G1.1, nothing created the core.person row an
-- INDIVIDUAL seller's attestation needs.
--
-- THE ROW IS AN ANCHOR, NOT AN IDENTITY CLAIM. Declaring yourself an
-- individual seller already asserts you are a natural person. An operator
-- attests ABOUT a person and does not bring one into being -- so the person
-- must exist first, and the only act that knows an individual seller is a
-- person is the declaration that they are one. The endpoint change rides in
-- the same PR (onboarding.service.ts); this migration is the BACKFILL for
-- the sellers that declaration already created, plus the assertion.
--
-- ------------------------------------------------------------------------
-- GRANULARITY: ONE PERSON PER OWNER ACCOUNT, not one per seller row.
--
-- Not a judgement call -- two documented invariants meet here:
--   * ADU-DB-01 S4.4: the keyed ID hash is "stored once per person and
--     referenced by EACH seller account" -- one person, many sellers.
--   * S6.1: one phone, one account -- so two INDIVIDUAL declarations by the
--     same account are necessarily the same natural person.
-- One person per seller row would make one human verify identity once per
-- store, and would split their attestation history across person rows.
--
-- core.account.person_id is NOT touched: v1.12:719 reserves it for
-- attestation time ("Set when an identity attestation exists"), and this
-- ruling is about the seller's anchor, not the account's.
--
-- COMPANY sellers untouched (T7 S3.2): their person is the representative,
-- arriving via seller_company_detail.representative_person_id.
--
-- DELETED / tombstoned INDIVIDUAL sellers are backfilled too: the work
-- order's assertion is blanket ("no individual seller has a NULL
-- person_id"), and fn_delete_seller deliberately keeps person_id (0023:204),
-- so a person row for a deleted store is consistent with the scrub design.
-- ------------------------------------------------------------------------

-- 1. Where an owner already has a personed INDIVIDUAL seller (the pre-T5
--    lazy-creation flow made some), the personless siblings REUSE it --
--    creating a second person for the same human is the exact split S4.4
--    forbids.
UPDATE core.seller s
   SET person_id = src.person_id
  FROM (SELECT DISTINCT ON (owner_account_id) owner_account_id, person_id
          FROM core.seller
         WHERE entity_type = 'INDIVIDUAL' AND person_id IS NOT NULL
         ORDER BY owner_account_id, created_at) src
 WHERE s.owner_account_id = src.owner_account_id
   AND s.entity_type = 'INDIVIDUAL'
   AND s.person_id IS NULL;

-- 2. One new person per remaining owner. A temp table rather than a
--    data-modifying CTE chain: the person INSERT must be complete before
--    the seller UPDATE's FK check fires, and CTE sub-statements give no
--    ordering guarantee. core.person.id has NO DEFAULT, so the uuid is
--    minted explicitly.
CREATE TEMP TABLE t7_d57_pairs ON COMMIT DROP AS
  SELECT o.owner_account_id, gen_random_uuid() AS pid
    FROM (SELECT DISTINCT owner_account_id
            FROM core.seller
           WHERE entity_type = 'INDIVIDUAL' AND person_id IS NULL) o;

INSERT INTO core.person (id)
SELECT pid FROM t7_d57_pairs;

UPDATE core.seller s
   SET person_id = p.pid
  FROM t7_d57_pairs p
 WHERE s.owner_account_id = p.owner_account_id
   AND s.entity_type = 'INDIVIDUAL'
   AND s.person_id IS NULL;

-- 3. THE ASSERTION, one-time (T7 S3.2: "Assert afterwards"). Deliberately
--    NOT a forward CHECK or trigger: 24 test files insert INDIVIDUAL
--    sellers directly as fixtures, the endpoint is the forward enforcement
--    point for real traffic, and a constraint here would demand a person
--    row in every fixture -- a harness rewrite no ruling asks for. On a
--    fresh database this DO block sees zero rows and passes vacuously,
--    which is correct: the endpoint is already in force there.
DO $assert$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n
    FROM core.seller
   WHERE entity_type = 'INDIVIDUAL' AND person_id IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'D-57 backfill incomplete: % INDIVIDUAL sellers still carry NULL person_id', v_n
      USING ERRCODE = 'restrict_violation';
  END IF;
END $assert$;

-- No grant work: adulis_app already holds INSERT on core.person (0003, for
-- the endpoint), and this backfill runs as the migration role.
--
-- THE DEPLOY WINDOW (adversarial pass): in a rolling deploy, a declaration
-- served by a still-running pre-T7 pod AFTER this migration commits writes
-- an INDIVIDUAL seller with NULL person_id -- past the one-time assert,
-- invisible forever. The two UPDATE statements above are deliberately
-- RE-RUNNABLE VERBATIM (idempotent by their IS NULL predicates); the deploy
-- runbook's post-deploy check is where a re-run belongs if the window is
-- ever real. Recorded in the T7 report.
