-- 0037 -- D-67: the invite UNIQUE becomes partial, and the two account
--         columns become foreign keys.
--
-- ADU-RUL-02 via WORK ORDER T7 S3.3 (document text owed -- register D-84).
-- Register D-67: S6.3a's UNIQUE is total where its neighbour's is partial,
-- so a revoked invite blocked that phone forever. 0029 transcribed the
-- printed DDL verbatim and registered the doubt; this is the ruling landing.
--
-- ------------------------------------------------------------------------
-- 1. ORPHAN CLEANUP FIRST, or the FKs cannot validate. c6's teardown runs
--    under session_replication_role = replica, which disables the RI
--    triggers -- including the seller FK's ON DELETE CASCADE -- so a c6 run
--    leaves an invite row whose seller and accounts no longer exist. The
--    live dev database holds exactly one such row. Note the new FKs do NOT
--    prevent recurrence (replica mode disables them too); c6's teardown now
--    deletes its own invite rows, in the same PR.
-- ------------------------------------------------------------------------
DELETE FROM core.seller_courier_invite i
 WHERE NOT EXISTS (SELECT 1 FROM core.seller  s WHERE s.id = i.seller_id)
    OR NOT EXISTS (SELECT 1 FROM core.account a WHERE a.id = i.invited_by_account_id)
    OR (i.claimed_by_account_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM core.account a WHERE a.id = i.claimed_by_account_id));

-- ------------------------------------------------------------------------
-- 2. THE PARTIAL UNIQUE. Only a LIVE, PENDING invite occupies the
--    (seller, phone) slot; claimed and revoked rows are history and stop
--    blocking. This is the same shape as seller_courier_live beside it
--    (0005:178), which is the comparison D-67 was raised on.
--
--    A UNIQUE table constraint cannot carry a WHERE clause, so this is a
--    UNIQUE INDEX -- which means the invite endpoint's ON CONFLICT target
--    must name the predicate (partial indexes are matched by inference,
--    never by name). That controller change rides in this PR; without it
--    every invite would 42P10.
--
--    seller_courier_invite_phone (0029:62, non-unique, keyed on phone
--    alone, same predicate) is the SIGN-IN lookup and stays -- it is not
--    this index.
-- ------------------------------------------------------------------------
ALTER TABLE core.seller_courier_invite
  DROP CONSTRAINT seller_courier_invite_seller_id_phone_key;

CREATE UNIQUE INDEX seller_courier_invite_live
  ON core.seller_courier_invite (seller_id, phone)
  WHERE revoked_at IS NULL AND claimed_at IS NULL;

-- ------------------------------------------------------------------------
-- 3. THE TWO FOREIGN KEYS. Bare NO ACTION, matching seller_courier's
--    account_id (0005:172): accounts are SCRUBBED in production, never
--    deleted, so the reference always resolves outside replica-mode
--    test teardowns.
-- ------------------------------------------------------------------------
ALTER TABLE core.seller_courier_invite
  ADD CONSTRAINT seller_courier_invite_invited_by_fk
    FOREIGN KEY (invited_by_account_id) REFERENCES core.account(id),
  ADD CONSTRAINT seller_courier_invite_claimed_by_fk
    FOREIGN KEY (claimed_by_account_id) REFERENCES core.account(id);

COMMENT ON TABLE core.seller_courier_invite IS
  'S6.3a as amended by D-67''s ruling (T7 S3.3): NOT append-only -- '
  'claimed_at and revoked_at are stamps on the row. Uniqueness is PARTIAL '
  '(seller_courier_invite_live): a claimed or revoked invite is history and '
  'never blocks re-inviting the phone. Lock note: DROP CONSTRAINT and ADD '
  'FOREIGN KEY take ACCESS EXCLUSIVE; the table is tiny and the FK '
  'validation scans it once.';
