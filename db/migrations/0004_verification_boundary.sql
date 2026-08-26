-- ===========================================================================
-- MIGRATION 04 - THE VERIFICATION BOUNDARY
--
-- Source: ADU-DB-01 v1.9 section 28 item 4 - "verification schema and its
-- functions". Transcribed from section 7.3.
--
-- Two tables, three functions. This is one of the two isolated boundaries of
-- doctrine 7: "their only read path is a SECURITY DEFINER function that writes
-- the access log in the same transaction. You cannot read the evidence without
-- logging the read, because there is no other way to read it."
--
-- v1.9 closes TWO defects here:
--   D4 - verification.write_attestation was named in ADU-API-01 section 13 and
--        asserted as defined in this document's own v1.5 change table. It was
--        never written. It is written below.
--   D7 - Appendix C check 10 forbade any GRANT ... ON SCHEMA verification ...
--        adulis_app, INCLUDING the USAGE without which the SECURITY DEFINER
--        function is uncallable. Taken literally, identity verification could
--        not work at all. The corrected invariant is USAGE on the schema,
--        EXECUTE on the functions, and NO privilege on any table.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. verification.identity_attestation (section 7.3)
-- ---------------------------------------------------------------------------
CREATE TABLE verification.identity_attestation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id           uuid NOT NULL UNIQUE,
  verified_on         date NULL,
  verifier_kind       verification.verifier_kind NOT NULL,
  vendor_reference    text NULL,
  id_type             text NULL,
  legal_name          text NULL,
  id_hash             bytea NULL,
  id_hash_key_version int NULL,
  verified            boolean NULL,
  company_relationship text NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- INVARIANT (section 7.3) - NO identity image or video is ever uploaded to
-- Adulis systems. "There is no column for one. Not a nullable column, not an
-- image_url left empty - no column exists, so no agent can populate one and no
-- migration can quietly add one without appearing in review."
--
-- INVARIANT (section 7.3) - ID verification always attests to a NATURAL PERSON,
-- regardless of seller entity type. The table is keyed on person_id and has no
-- seller_id. A company attestation is an attestation about its representative.
--
-- person_id is a BARE uuid with no foreign key, deliberately: core.person lives
-- across the boundary, and a foreign key from an isolated schema into core
-- would give adulis_app a readable path to the fact that a row exists. Section
-- 13.6 takes the same decision for financial.payout_credential's
-- payout_details_id, and says so in as many words.
--
-- NOTE ON `verified`: section 7.3 lists the column and
-- verification.write_attestation - the only writer - never sets it. It is
-- therefore nullable rather than defaulted, because a default would be this
-- migration deciding what an unset attestation means. Reported.
COMMENT ON TABLE verification.identity_attestation IS
  'Isolated boundary. Readable only through verification.read_attestation, '
  'which logs. No image column exists and none may be added.';

-- ---------------------------------------------------------------------------
-- 2. verification.access_log (section 7.3) - APPEND-ONLY
-- ---------------------------------------------------------------------------
CREATE TABLE verification.access_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id  uuid NOT NULL,
  actor_role        text NOT NULL,
  attestation_id    uuid NULL,
  reason            text NULL,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN verification.access_log.actor_role IS
  'INVARIANT (R5, ADU-AUTH-01 section 20.2) - actor_role is DERIVED '
  'server-side from the caller actual grants and is NEVER a function '
  'parameter. Through v1.6 the function took p_actor_role text and wrote it '
  'straight into the log, which made the most contested field in the audit row '
  'the one the reader supplied about themselves. Deriving it closes a second '
  'hole in the same edit: with no grant lookup the function AUTHORISED '
  'NOTHING - it logged a read it was going to perform anyway. Now no grant, no '
  'row, and the query that logs is the query that authorises.';

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON verification.access_log
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE INDEX idx_verification_access_log_attestation
  ON verification.access_log (attestation_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- 3. The only read path (section 7.3, transcribed verbatim)
-- ---------------------------------------------------------------------------
CREATE FUNCTION verification.read_attestation(
  p_person_id uuid, p_actor uuid, p_reason text
) RETURNS verification.identity_attestation
LANGUAGE plpgsql SECURITY DEFINER SET search_path = verification, core AS $$
DECLARE r verification.identity_attestation;
        v_role text;
BEGIN
  -- R5: the role is DERIVED from the caller's actual grants, never supplied.
  SELECT g.role::text INTO v_role
    FROM core.operator_grant g
   WHERE g.account_id = p_actor
     AND g.role IN ('IDENTITY_REVIEWER', 'ADMIN')
     AND g.revoked_at IS NULL
   ORDER BY g.granted_at LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'no grant permits reading an identity attestation'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO r FROM verification.identity_attestation WHERE person_id = p_person_id;
  INSERT INTO verification.access_log
    (actor_account_id, actor_role, attestation_id, reason)
  VALUES (p_actor, v_role, r.id, p_reason);
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- 4. The write path - D4 (section 7.3, transcribed verbatim)
--
-- "ADU-API-01 section 13 maps POST /v1/seller/identity-verification to
-- verification.write_attestation, and this document's v1.5 change table
-- claimed 'both defined.' Only the read was."
-- ---------------------------------------------------------------------------
CREATE FUNCTION verification.write_attestation(
  p_person_id       uuid,
  p_verifier_kind   verification.verifier_kind,
  p_vendor_ref      text,
  p_id_type         text,
  p_legal_name      text,
  p_id_hash         bytea,
  p_id_hash_key_ver int,
  p_verified_on     date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = verification AS $$
DECLARE v_id uuid;
BEGIN
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
END $$;

COMMENT ON FUNCTION verification.write_attestation IS
  'INVARIANT (section 7.3) - the write function takes no image, no document '
  'reference and no file handle, because there is no column for one. The '
  'vendor holds the document; Adulis holds an attestation that a vendor saw '
  'it. p_id_hash is a keyed HMAC computed BEFORE the call, so the raw '
  'identifier never crosses this boundary either. It UPSERTS on person_id '
  'rather than inserting: a person re-verifying is one attestation superseding '
  'itself, not two rows. The write is NOT logged in verification.access_log - '
  'that log records READS, and a write is already evidenced by the row it '
  'produces.';

-- ---------------------------------------------------------------------------
-- 5. Duplicate detection that returns no identity data (section 7.3)
--
-- "A duplicate-detection path that returns no identity data is provided
-- separately - verification.id_hash_matches(p_hash bytea) RETURNS int - so
-- section 13.2's 'same person across accounts' check does not require reading
-- a name."
--
-- The signature and the contract are given; the body is not, and it is the one
-- statement the contract admits. It logs nothing because it discloses nothing:
-- a count is not an attestation, and logging every eligibility evaluation into
-- the access log would make it unreadable by the paid reviewer section 23
-- requires to read it in full.
-- ---------------------------------------------------------------------------
CREATE FUNCTION verification.id_hash_matches(p_hash bytea) RETURNS int
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = verification AS $$
  SELECT count(*)::int FROM verification.identity_attestation WHERE id_hash = p_hash;
$$;

-- ---------------------------------------------------------------------------
-- 6. Ownership - THE PART THAT MAKES SECURITY DEFINER MEAN ANYTHING
--
-- A SECURITY DEFINER function runs as its OWNER. These migrations are applied
-- by a bootstrap superuser, so without the statements below every function
-- here would run as a superuser - which bypasses all privilege checks and
-- makes the boundary decorative while every test still passes.
--
-- Section 3 assigns the schema to adulis_verification. The tables and
-- functions are assigned to it explicitly so that the escorted-visitor design
-- holds: adulis_app may enter the schema and call the escorts, and the escorts
-- act with exactly the owning role's authority and no more.
-- ---------------------------------------------------------------------------
ALTER TABLE verification.identity_attestation OWNER TO adulis_verification;
ALTER TABLE verification.access_log           OWNER TO adulis_verification;
ALTER FUNCTION verification.read_attestation(uuid, uuid, text)  OWNER TO adulis_verification;
ALTER FUNCTION verification.write_attestation(uuid, verification.verifier_kind, text, text, text, bytea, int, date)
  OWNER TO adulis_verification;
ALTER FUNCTION verification.id_hash_matches(bytea) OWNER TO adulis_verification;

-- ---------------------------------------------------------------------------
-- 7. Grants - Appendix C check 10, as corrected by D7
--
-- "The invariant that actually matters: adulis_app holds USAGE on both schemas
-- and EXECUTE on the four named functions, AND NO PRIVILEGE ON ANY TABLE
-- within them. The escorted-visitor design requires the schema to be
-- enterable; what it forbids is reading the furniture."
--
-- Verified empirically rather than assumed: without USAGE, PostgreSQL refuses
-- the CALL itself with insufficient_privilege, so section 7.3's DDL exactly as
-- written through v1.8 meant identity verification could not work at all.
-- Granting USAGE makes the call succeed and leaves a direct SELECT still
-- denied - which is the invariant, and it is a property of table privileges,
-- not of the schema grant.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA verification TO adulis_app;

GRANT EXECUTE ON FUNCTION verification.read_attestation(uuid, uuid, text)  TO adulis_app;
GRANT EXECUTE ON FUNCTION verification.write_attestation(uuid, verification.verifier_kind, text, text, text, bytea, int, date)
  TO adulis_app;
GRANT EXECUTE ON FUNCTION verification.id_hash_matches(bytea) TO adulis_app;

-- Belt and braces against a future default-privilege change: no table in this
-- schema is reachable by the application role, and PUBLIC never was.
REVOKE ALL ON verification.identity_attestation FROM adulis_app, PUBLIC;
REVOKE ALL ON verification.access_log           FROM adulis_app, PUBLIC;

-- Down Migration

DO $$
BEGIN
  RAISE EXCEPTION
    'Migration 04 is not reversible. Dropping an identity boundary would drop '
    'its access log, which section 16.9 retains beyond account deletion. '
    'Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $$;
