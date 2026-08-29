-- 0031 -- G1.10: chat.conversation gains an anchor.
--
-- ADU-DB-01 v1.12 S17.1 (G1.10)  -  ADU-API-01 v1.7 S12.7
-- WORK ORDER T6 S2.
--
-- WHY AN ANCHOR. "Without an anchor a slotted answer template cannot be
-- filled, so the assistant escalates instead of answering. That is worse
-- than a missed answer: containment then measures the missing anchor rather
-- than the assistant, and S15.3's improvement loop optimises against a
-- signal that is wrong about which intents are failing" (ADU-API-01 S12.7).
--
-- ------------------------------------------------------------------------
-- THE TWO DOCUMENTS SAY DIFFERENT THINGS, AND THAT IS RESOLVED RATHER THAN
-- SPLIT THE DIFFERENCE. ADU-API-01 S12.7 says "exactly one" (twice).
-- ADU-DB-01 S17.1 says "at most one" and prints
-- `CHECK (num_nonnulls(product_id, order_id) <= 1)`, which permits ZERO.
--
-- DOCUMENT_AUTHORITY.md assigns precedence BY DOMAIN: ADU-DB-01 governs
-- database enforcement, ADU-API-01 governs the wire. They are not competing.
-- The CHECK is `<= 1` exactly as printed -- the database forbids TWO anchors
-- -- and the ENDPOINT requires exactly one, which is Phase B. An unanchored
-- row therefore remains legal, and it has to: chat.conversation rows already
-- exist that predate anchors, and a job test inserts one directly.
-- ------------------------------------------------------------------------
--
-- NO FOREIGN KEYS, TRANSCRIBED AS PRINTED. S17.1 gives two bare uuid columns
-- and no REFERENCES, and building them as printed is also the safer reading:
-- a product_id FK would make DELETE /v1/seller/products/{id} raise 23503,
-- and catalogue.service.ts maps EVERY 23503 there to 409
-- PRODUCT_HAS_ACTIVE_ORDERS with reason HISTORICAL_ORDERS_RETAIN_THE_RECORD
-- -- telling a seller that an ORDER retains the record when in fact a chat
-- message does. Same shape as nlu.answer_template.seller_id, which is a bare
-- uuid for its own stated reason.

ALTER TABLE chat.conversation
  ADD COLUMN product_id uuid NULL,
  ADD COLUMN order_id   uuid NULL;

ALTER TABLE chat.conversation
  ADD CONSTRAINT conversation_one_anchor
  CHECK (num_nonnulls(product_id, order_id) <= 1);

COMMENT ON COLUMN chat.conversation.product_id IS
  'G1.10. Bare uuid, no FK, exactly as S17.1 prints it -- and an FK would make deleting a product a 23503 that catalogue.service.ts reports as PRODUCT_HAS_ACTIVE_ORDERS, which would be a lie.';
COMMENT ON COLUMN chat.conversation.order_id IS
  'G1.10. See product_id. At most one of the two is set, by conversation_one_anchor.';

-- Set at creation, and not moved afterwards (S17.1) -------------------------
--
-- Written from scratch rather than reusing core.fn_forbid_mutation, which
-- refuses EVERY update unconditionally: attached here it would break
-- chat.fn_bump_conversation's UPDATE of last_message_at on every message,
-- and openConversation's own ON CONFLICT DO UPDATE. This one compares the
-- anchors and nothing else, so both keep working.
CREATE FUNCTION chat.fn_conversation_anchor_write_once() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'conversation anchor is set at creation'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_conversation_anchor_write_once
  BEFORE UPDATE ON chat.conversation
  FOR EACH ROW EXECUTE FUNCTION chat.fn_conversation_anchor_write_once();

-- [!] REGISTERED, AND IT IS THE THING TO READ TWICE.
--
-- `one_conversation_per_pair UNIQUE (seller_id, buyer_account_id, market_id)`
-- is UNCHANGED, because S17.1 still says "Unique together" and widening it is
-- a design decision no ruling makes. The consequence is that a buyer and a
-- seller have ONE conversation, whose anchor is whatever it was created
-- with. The SECOND product that buyer asks about reuses the first product's
-- anchor.
--
-- That is worse than no anchor, and it is worse in the direction G1.10 exists
-- to prevent: a slotted template would fill confidently with the WRONG
-- product rather than escalate. Phase B's endpoint therefore does NOT
-- re-anchor an existing conversation, and the containment signal keeps the
-- honest shape until a ruling says whether a conversation is per pair or per
-- anchor.
