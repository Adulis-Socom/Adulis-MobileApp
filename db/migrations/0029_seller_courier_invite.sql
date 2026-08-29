-- 0029 -- G1.8: core.seller_courier_invite, the table that closes the
-- registration oracle.
--
-- ADU-DB-01 v1.12 S6.3a  -  ADU-API-01 v1.7 S12.9/S12.11  -  ADU-AUTH-01 v2.5 S19
-- WORK ORDER T6 S2 and S1.3.
--
-- WHAT THE ORACLE IS. A seller invites a courier by phone. Today
-- couriers.controller.ts:78-82 looks the number up and raises NOT_FOUND when
-- it finds nothing, so any seller account can test arbitrary phone numbers
-- for Adulis membership, one invite at a time. S19's rule generalised in
-- v2.5: no response distinguishes an identity that exists from one that does
-- not.
--
-- THIS MIGRATION IS THE TABLE ONLY. The endpoint that stops branching is
-- Phase B. Splitting them is deliberate: a schema migration and an endpoint
-- change in one diff is a diff nobody reads properly.
--
-- ------------------------------------------------------------------------
-- TRANSCRIBED VERBATIM FROM S6.3a, INCLUDING TWO THINGS I WOULD HAVE WRITTEN
-- DIFFERENTLY. Both are registered rather than corrected here, because
-- "transcribe, do not design" and because a judgement call in SQL is the
-- failure this project has paid for most.
--
--   1. `UNIQUE (seller_id, phone)` is TOTAL, where the neighbouring
--      core.seller_courier uses a PARTIAL index -- seller_courier_live ON
--      (seller_id, account_id) WHERE revoked_at IS NULL (0005:178-179). The
--      consequence is real: once an invite here is revoked or claimed, its
--      row remains, and that seller can NEVER invite that phone again. The
--      neighbouring table deliberately frees the pair on revocation. This
--      looks like an oversight in the printed DDL rather than a decision,
--      and it is not mine to make.
--
--   2. `invited_by_account_id` and `claimed_by_account_id` carry NO
--      REFERENCES, while `seller_id` beside them does and every comparable
--      column in core references core.account(id). Built as printed: two
--      unconstrained uuids.
-- ------------------------------------------------------------------------

CREATE TABLE core.seller_courier_invite (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    uuid NOT NULL REFERENCES core.seller(id) ON DELETE CASCADE,
  phone        core.e164 NOT NULL,
  invited_by_account_id uuid NOT NULL,
  invited_at   timestamptz NOT NULL DEFAULT now(),
  claimed_at   timestamptz NULL,
  claimed_by_account_id uuid NULL,
  revoked_at   timestamptz NULL,
  UNIQUE (seller_id, phone)
);

COMMENT ON TABLE core.seller_courier_invite IS
  'G1.8. An invite succeeds whether or not the phone has an account, so nothing is learned by inviting (S6.3a). NOT append-only: claimed_at and revoked_at are stamps on the row.';
COMMENT ON COLUMN core.seller_courier_invite.phone IS
  'The invited number, in the clear. Unlike core.phone_reuse_block and the rate-limit buckets -- which hash BECAUSE they must work before an account exists -- this row is scoped to one seller who typed the number themselves, and it has to be matched against core.account.phone_e164 at that person''s next sign-in.';

-- The seller reads and writes its own invites; claiming is a write too. No
-- DELETE: revocation is a stamp, matching seller_courier beside it.
GRANT SELECT, INSERT, UPDATE ON core.seller_courier_invite TO adulis_app;

-- The lookup that runs at sign-in: "does this phone have anything waiting?"
-- Not covered by the UNIQUE, which leads with seller_id.
CREATE INDEX seller_courier_invite_phone
  ON core.seller_courier_invite (phone)
  WHERE claimed_at IS NULL AND revoked_at IS NULL;
