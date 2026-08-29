-- 0032 -- G1.11: core.device gains a market, and retention stops guessing
-- in the dangerous direction.
--
-- ADU-DB-01 v1.12 S6.4 (G1.11)  -  S11.5 (the purge)
-- WORK ORDER T6 S2. Register D-54 closes with this.
--
-- WHAT D-54 SAID. media_retention is per-market configuration and a device
-- belonged to no market, so "the retention period" was undefined for the one
-- job that needs it. T4 resolved it as the LONGEST interval in force
-- anywhere -- "the only choice that cannot delete a device some market still
-- considers live" -- and registered it for a ruling.
--
-- G1.11 RULES THE OTHER WAY, AND GIVES THE BETTER REASON. Two halves:
--
--   1. A device is ASSIGNED a market at its first /v1/bootstrap, which
--      already resolves one. That removes the marketless case rather than
--      answering it. (The assignment itself is an endpoint change and lands
--      with the other surfaces; this migration is the column.)
--
--   2. Where a device genuinely has no market, retention falls back to the
--      SHORTEST interval in force, never the longest. "A retention default
--      must fail toward deletion. Falling back to the longest keeps
--      anonymous data longest exactly where the system knows least about
--      whose it is -- the wrong direction under a data-protection regime,
--      and the wrong direction to have to explain."
--
-- T4's reasoning was not wrong about what it optimised for; it optimised for
-- the wrong thing. Keeping a cart is a convenience. Keeping anonymous data
-- longest where you know least about whose it is, is a DPIA answer nobody
-- wants to give.
--
-- EXISTING ROWS STAY NULL, DELIBERATELY. The work order says so and it is
-- right: there are 106 unbound devices locally and nothing records which
-- market any of them came from. A backfill would have to pick one, and
-- picking wrong assigns a person's device to a country. NULL is the honest
-- value and now has a defined meaning -- shortest retention, so the fallback
-- is safe rather than merely undefined.

ALTER TABLE core.device
  ADD COLUMN market_id uuid NULL REFERENCES core.market(id);

COMMENT ON COLUMN core.device.market_id IS
  'G1.11. Assigned at the first /v1/bootstrap, which already resolves a market. NULL means "not yet seen at bootstrap", and retention then falls back to the SHORTEST media_retention in force -- a retention default must fail toward deletion (S6.4). Existing rows stay NULL: nothing records which market they came from, and a backfill would assign a person''s device to a country.';

-- The purge reads it per device, so index the way the purge asks.
CREATE INDEX idx_device_unbound_market
  ON core.device (market_id, last_seen_at)
  WHERE account_id IS NULL;

-- The two grants the wedge fix needs -----------------------------------------
--
-- device.purge_unbound now asks whether a session or a remembered-device row
-- still points at the device before deleting it. adulis_jobs could not read
-- either table, so the job raised 42501 the first time a real row moved --
-- the same class of defect as D-47 and the two invoker triggers of T4, and
-- found the same way: by running the job as the role rather than as admin.
--
-- SELECT only, and named. The job never writes either table: it reads them
-- to decide not to delete something.
GRANT SELECT ON core.session        TO adulis_jobs;
GRANT SELECT ON core.account_device TO adulis_jobs;
