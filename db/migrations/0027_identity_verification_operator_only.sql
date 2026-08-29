-- 0027 -- G1.1: identity verification is operator-only.
--
-- ADU-DB-01 v1.12 S7.3  -  ADU-API-01 v1.7 S12.9  -  ADU-AUTH-01 v2.5 S15.2
-- WORK ORDER T5 S2.
--
-- THE HOLE THIS CLOSES. verification.write_attestation took the attestation
-- fields and nothing else, so POST /v1/seller/identity-verification wrote a
-- row from values THE CLIENT SUPPLIED: the verifier, the reference, the
-- legal name, the ID hash and the date. A seller holding
-- seller.identity:manage and a step-up code could assert their own identity
-- verification -- the IDENTITY eligibility path, and at Pro the verified
-- badge. Open from C6.
--
-- The step-up was working perfectly the whole time. It proved the person
-- holding the phone was the account holder, which was never the question.
-- The question was whether anyone had checked the document, and nobody had.
-- A control that works correctly can still be the wrong control.
--
-- THE TRAP, and it is SR-1's defect with a fresh chance to happen. The
-- signature CHANGES, so this is a NEW function object. CREATE OR REPLACE
-- preserves ownership and privileges only when the signature is identical;
-- add a parameter and PostgreSQL gives you a different function with its
-- DEFAULTS -- owned by whoever ran the migration, EXECUTE granted to
-- PUBLIC -- and leaves the old one in place, still callable, still writing
-- attestations from client-supplied fields.
--
-- So this migration does four things and none is optional:
--   1. CREATE the new function
--   2. ALTER FUNCTION ... OWNER TO adulis_verification
--   3. REVOKE ALL ... FROM PUBLIC, then GRANT to the one role that calls it
--   4. DROP the old eight-argument signature
-- Leaving step 4 out is leaving the hole open behind a new door.

-- 1. The enum value, because neither existing one would be true ------------
--
-- KYC_VENDOR names a vendor that does not exist. VIDEO_CALL names a call
-- that does not happen. An audit record that says something other than what
-- occurred is worse than one that says less -- and this row is the evidence
-- a claim about a seller's identity would rest on.
--
-- ADD VALUE is transaction-safe on PostgreSQL 12+ so long as the new value
-- is not USED in the same transaction. Nothing below uses it: the function
-- takes the type as a parameter and names no literal.
ALTER TYPE verification.verifier_kind ADD VALUE IF NOT EXISTS 'OPERATOR_ATTESTED';

-- 2. The write path, with the actor it should always have taken -----------

CREATE FUNCTION verification.write_attestation(
  p_actor           uuid,
  p_person_id       uuid,
  p_verifier_kind   verification.verifier_kind,
  p_vendor_ref      text,
  p_id_type         text,
  p_legal_name      text,
  p_id_hash         bytea,
  p_id_hash_key_ver int,
  p_verified_on     date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = verification, core AS $fn$
DECLARE v_id uuid;
        v_role text;
BEGIN
  -- R5, and the same derivation read_attestation already performs: the role
  -- comes from the caller's ACTUAL grants and is never supplied. With no
  -- grant lookup the function authorised nothing -- it wrote a row it was
  -- going to write anyway. Now no grant, no row.
  SELECT g.role::text INTO v_role
    FROM core.operator_grant g
   WHERE g.account_id = p_actor
     AND g.role IN ('IDENTITY_REVIEWER', 'ADMIN')
     AND g.revoked_at IS NULL
   ORDER BY g.granted_at
   LIMIT 1;

  IF v_role IS NULL THEN
    -- U0001 -> 403 PERMISSION_DENIED, identical whatever gate produced it
    -- (ADU-DB-01 S6.9b, ADU-AUTH-01 S14). NOT U0002: the caller is not
    -- being told the subject does not exist, they are being told they may
    -- not do this.
    RAISE EXCEPTION 'no grant permits writing an identity attestation'
      USING ERRCODE = 'U0001';
  END IF;

  INSERT INTO verification.identity_attestation
    (person_id, verifier_kind, vendor_reference, id_type, legal_name,
     id_hash, id_hash_key_version, verified_on)
  VALUES
    (p_person_id, p_verifier_kind, p_vendor_ref, p_id_type, p_legal_name,
     p_id_hash, p_id_hash_key_ver, p_verified_on)
  ON CONFLICT (person_id) DO UPDATE SET
     verifier_kind       = EXCLUDED.verifier_kind,
     vendor_reference    = EXCLUDED.vendor_reference,
     id_type             = EXCLUDED.id_type,
     legal_name          = EXCLUDED.legal_name,
     id_hash             = EXCLUDED.id_hash,
     id_hash_key_version = EXCLUDED.id_hash_key_version,
     verified_on         = EXCLUDED.verified_on
  RETURNING id INTO v_id;

  RETURN v_id;
END $fn$;

-- 3. Owner, then PUBLIC, then the one role -- S4.4a's three lines ---------
--
-- Ownership is not a formality. A function created by the superuser that
-- runs the migrations is OWNED by that superuser, so SECURITY DEFINER would
-- lend SUPERUSER privileges and bypass RLS entirely -- which is exactly
-- D-50, found in T4 on a function that had worked perfectly for four work
-- orders. The REVOKE is not hardening either: p_actor is trustworthy only
-- because exactly one role may call this and that role always passes its
-- own session's account. It is the precondition that makes the signature
-- sound (SR-1).
ALTER FUNCTION verification.write_attestation(
  uuid, uuid, verification.verifier_kind, text, text, text, bytea, int, date)
  OWNER TO adulis_verification;

REVOKE ALL ON FUNCTION verification.write_attestation(
  uuid, uuid, verification.verifier_kind, text, text, text, bytea, int, date)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION verification.write_attestation(
  uuid, uuid, verification.verifier_kind, text, text, text, bytea, int, date)
  TO adulis_app;

-- 4. The old door, closed -------------------------------------------------
--
-- Named by its full signature so this cannot resolve to the new one.
DROP FUNCTION verification.write_attestation(
  uuid, verification.verifier_kind, text, text, text, bytea, int, date);
