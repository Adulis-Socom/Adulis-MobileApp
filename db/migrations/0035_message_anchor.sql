-- 0035 -- D-66: the anchor moves from the conversation to the message.
--
-- ADU-RUL-02 via WORK ORDER T7 S3.1 (the document text is owed -- register
-- D-84). ADU-VAL-01 v1.1 S4.12: "Ruled: the anchor moves to the message."
-- Register D-66 (the defect) and D-73 (the reasoning this ruling adopts).
--
-- A THREAD IS A RELATIONSHIP; A QUESTION IS ABOUT A THING. G1.10 anchored
-- the thread, and one_conversation_per_pair means a buyer and a seller have
-- ONE thread -- so the second product a buyer asked about inherited the
-- first product's anchor, and a slotted answer would have filled confidently
-- with the WRONG product rather than escalate. Anchoring the thread anchored
-- the wrong noun. The message is the thing that is about something.
--
-- WHAT THIS LOOKS LIKE AND IS NOT: a regression. It drops columns 0031
-- added at T6 Phase A and reshapes an endpoint #19 merged. That is a
-- deliberate roll-forward decided after both were built (T7 S3.1: "Build
-- it; do not park it as a conflict").
--
-- ------------------------------------------------------------------------
-- ORDER OF OPERATIONS, and why each step exists:
--
-- 1. The write-once trigger and its function go FIRST. plpgsql is
--    late-bound, so DROP COLUMN would succeed with the trigger still
--    attached -- and then chat.fn_bump_conversation's UPDATE of
--    last_message_at (fired by EVERY chat.message INSERT) would fire the
--    BEFORE UPDATE anchor trigger, whose NEW.product_id reference errors
--    (42703) on a record that no longer has the field. The whole chat
--    surface would die on the first message sent, at runtime, not at
--    migration time.
-- 2. The CHECK is dropped explicitly even though DROP COLUMN would take a
--    same-table constraint with it silently -- nothing outside this table
--    depends on the columns (verified: no view, no FK). Explicit is this
--    repo's style precisely BECAUSE nothing refuses at DDL time: the only
--    failure mode here is the late-bound one in step 1.
-- 3. NO BACKFILL from the dropped columns. A conversation's anchor is not
--    attributable to any particular message -- inventing an attribution
--    would be design, and the only anchored rows anywhere are local/test
--    data. The data is dropped, and this comment is the record of that
--    decision.
--
-- Pre-existing messages carry no anchor and the assistant escalates on
-- them, which is honest (the same posture G1.10's unanchored rows had).
-- ------------------------------------------------------------------------

DROP TRIGGER trg_conversation_anchor_write_once ON chat.conversation;
DROP FUNCTION chat.fn_conversation_anchor_write_once();
ALTER TABLE chat.conversation DROP CONSTRAINT conversation_one_anchor;
ALTER TABLE chat.conversation
  DROP COLUMN product_id,
  DROP COLUMN order_id;

-- one_conversation_per_pair is deliberately untouched: the chat list stays
-- a row per pair. Only what a message is ABOUT moves.

ALTER TABLE chat.message
  ADD COLUMN product_id uuid NULL,
  ADD COLUMN order_id   uuid NULL;

-- AT MOST ONE, exactly as the conversation carried (and as 0031 records,
-- the wire enforces its own cardinality; the database forbids TWO). The
-- constraint NAME feeds pg-error-translator's 23514 branch -- an unmatched
-- 23514 falls through to a 500, so the branch and this name change together.
ALTER TABLE chat.message
  ADD CONSTRAINT message_one_anchor
    CHECK (num_nonnulls(product_id, order_id) <= 1);

-- NO FOREIGN KEYS, for 0031's recorded reason which is still true: a
-- product FK would make DELETE /v1/seller/products/{id} raise 23503, and
-- catalogue.service.ts maps every 23503 there to PRODUCT_HAS_ACTIVE_ORDERS
-- -- telling a seller an ORDER retains the record when a chat message does.
-- Bare uuids, like the columns they replace.
--
-- NO INDEX: nothing reads messages by anchor today (the slot vocabulary is
-- unruled -- register D-85), and 0031 added none for the conversation.
--
-- NO NEW GRANT: chat.message carries table-level SELECT, INSERT, UPDATE for
-- adulis_app (0015:270) and SELECT for adulis_jobs (0015:275); table-level
-- grants extend to new columns automatically.

COMMENT ON COLUMN chat.message.product_id IS
  'D-66 via T7 S3.1. What this MESSAGE is about. Bare uuid, no FK (0031''s '
  'reason). At most one of product_id/order_id (message_one_anchor); the '
  'send path requires the anchor to belong to the conversation''s seller '
  'and, for orders, its buyer -- 404 on mismatch, per message.';
COMMENT ON COLUMN chat.message.order_id IS
  'D-66 via T7 S3.1. See product_id. Slot resolution reads the anchor of '
  'the message being answered, never the thread''s.';
