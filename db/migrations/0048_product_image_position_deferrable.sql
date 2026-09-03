-- ---------------------------------------------------------------------------
-- 0048 - WORK ORDER T18 Phase 2: make the image-position uniqueness DEFERRABLE
--        so a reorder can assign final positions directly.
--
-- THE DEFECT THIS FIXES HAD NEVER ONCE WORKED. core.fn -- no, plainly: the
-- reorder endpoint (PUT /v1/seller/products/{id}/images/order) could not
-- succeed against the real database, ever, since 0007 created the table.
--
--   catalogue.service.ts parked positions at 100, 101, ... to clear the
--   UNIQUE range before placing them 1..n. But 0007:242 declares
--       position int NOT NULL CHECK (position BETWEEN 1 AND 5)
--   so the FIRST parking UPDATE raises 23514 check_violation. Proven against
--   the live schema rather than argued:
--       BLOCKED by 23514: new row for relation "product_image" violates
--       check constraint "product_image_position_check"
--
-- BOTH CONSTRAINTS ARE RIGHT; THE TECHNIQUE WAS WRONG. The parking trick
-- exists only to dodge a non-deferrable UNIQUE, and it is defeated by the
-- CHECK that constrains the range. The RULING (T18 S2) removes the need for
-- the trick rather than loosening either rule:
--
--   "Make UNIQUE (product_id, position) DEFERRABLE INITIALLY DEFERRED, and
--    assign final positions directly. No parking is then needed. Every
--    intermediate value is 1..5, so the range check passes at every step;
--    duplicates are permitted until commit, which is exactly when uniqueness
--    must hold and not before."
--
-- THE CHECK STAYS NON-DEFERRABLE AND IMMEDIATE, deliberately. A position
-- outside 1..5 is never valid, not even transiently -- that is the constraint
-- doing its job, and it is what caught this. Only the UNIQUE is deferred, and
-- only to the end of the transaction it was always meant to hold at.
--
-- WHAT DOES NOT CHANGE. The cap is still STRUCTURAL: five positions and one
-- row per position is what makes five images a fact rather than a counting
-- rule, and a deferred constraint still refuses a sixth at COMMIT. The
-- constraint is dropped and recreated rather than altered because PostgreSQL
-- has no ALTER CONSTRAINT ... DEFERRABLE for a unique constraint; the column
-- set and the name are identical on both sides, so Appendix B's table shape is
-- unchanged.
--
-- INITIALLY IMMEDIATE, NOT INITIALLY DEFERRED, and this is a deliberate
-- narrowing of the ruling's letter to serve its purpose. The ruling asked for
-- "DEFERRABLE INITIALLY DEFERRED"; that was written and it broke something
-- real, so it is recorded here rather than quietly kept:
--
--   Committing an image to a position that is already taken used to raise
--   23505 AT THE INSERT, which the error translator turns into a 409 carrying
--   reason = POSITION_TAKEN. Under INITIALLY DEFERRED the violation moves to
--   COMMIT, outside the statement that caused it, and the seller stops being
--   told which position was taken. One test caught it; a seller would have
--   met it as an unexplained failure.
--
-- So the constraint is DEFERRABLE (the capability the reorder needs) but
-- INITIALLY IMMEDIATE (the behaviour everything else already had). The reorder
-- opts in for its own transaction with SET CONSTRAINTS ... DEFERRED, which is
-- the narrowest possible scope: exactly one code path, exactly one
-- transaction. Every other writer keeps its immediate, attributable error.
--
-- A DEFERRED UNIQUE IS NOT A FREE LUNCH even so, and the cost is named here so
-- nobody rediscovers it: inside the reorder's transaction a violation surfaces
-- at COMMIT with no statement context. That is why the service validates the
-- ids it was given BEFORE it writes -- a caller who sends a duplicate or a
-- foreign id gets a 422 naming the id, not an opaque commit-time 23505.
-- ---------------------------------------------------------------------------

ALTER TABLE core.product_image
  DROP CONSTRAINT product_image_position;

ALTER TABLE core.product_image
  ADD CONSTRAINT product_image_position UNIQUE (product_id, position)
  DEFERRABLE INITIALLY IMMEDIATE;

COMMENT ON CONSTRAINT product_image_position ON core.product_image IS
  'DEFERRABLE INITIALLY IMMEDIATE since 0048 (T18 Phase 2). IMMEDIATE is the '
  'default so an ordinary duplicate still raises at its own INSERT and the '
  'seller is told POSITION_TAKEN; DEFERRABLE exists so the reorder path alone '
  'can SET CONSTRAINTS ... DEFERRED and assign final positions 1..n directly, '
  'passing through states where two rows briefly share a position. The '
  'BETWEEN 1 AND 5 CHECK remains non-deferrable - a position outside the '
  'range is never valid, not even transiently, and it is the constraint that '
  'caught the parking trick this replaced.';
