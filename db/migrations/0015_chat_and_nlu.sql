-- ===========================================================================
-- MIGRATION 13 - CHAT AND NLU
--
-- Source: ADU-DB-01 v1.10 section 28 item 13. Transcribed from section 17
-- and section 3's schema table. (File 0015; see 0010's header.)
--
-- TWO STORES, SEPARATED STRUCTURALLY (S15.3, section 3). chat is the
-- operational record - buyer, seller, message bodies - and may reference
-- core freely. nlu is the identity-stripped library: NO foreign key and NO
-- column referencing a buyer, a seller, a conversation or an order.
-- Separation enforced by a structural absence is checkable in five seconds
-- by reading the DDL; separation enforced by convention is checkable by
-- nobody. Appendix C check 4 reads this file.
--
-- THE MODEL NEVER GENERATES A RESPONSE - IT RETURNS AN INTENT ID (S15.1).
-- bot_turn carries intent_id and deliberately has NO column for
-- model-produced prose (the second load-bearing absence in CLAUDE.md; check
-- 2 greps this migration for the column name). The body sent to the buyer
-- is always rendered from nlu.answer_template - there is nowhere to put
-- generated prose, so none can be stored or sent.
--
-- D-05 (register): vector(N)'s dimension is ruled by no document, so
-- embedding is a DIMENSIONLESS vector column and the HNSW index section
-- 27 wants cannot be built yet - HNSW requires a typed dimension. The
-- index arrives with the ruling; layer 3 is sequential-scan until then.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. chat.conversation (section 17.1)
-- ---------------------------------------------------------------------------
CREATE TABLE chat.conversation (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        uuid NOT NULL REFERENCES core.seller(id),
  buyer_account_id uuid NOT NULL REFERENCES core.account(id),
  market_id        uuid NOT NULL REFERENCES core.market(id),
  started_at       timestamptz NOT NULL DEFAULT now(),
  last_message_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_conversation_per_pair UNIQUE (seller_id, buyer_account_id, market_id)
);

CREATE INDEX idx_conversation_by_seller ON chat.conversation (seller_id, last_message_at DESC);
CREATE INDEX idx_conversation_by_buyer  ON chat.conversation (buyer_account_id, last_message_at DESC);

-- ---------------------------------------------------------------------------
-- 2. chat.message
-- ---------------------------------------------------------------------------
CREATE TABLE chat.message (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES chat.conversation(id),
  sender_kind       chat.message_sender_kind NOT NULL,
  sender_account_id uuid NULL REFERENCES core.account(id),
  body              text NOT NULL,
  locale            text NOT NULL,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  read_at           timestamptz NULL,

  -- The bot is the one sender with no account; every human sender has one.
  CONSTRAINT message_sender_shape CHECK (
    (sender_kind = 'BOT') = (sender_account_id IS NULL))
);

CREATE INDEX idx_message_by_conversation ON chat.message (conversation_id, sent_at);

CREATE FUNCTION chat.fn_bump_conversation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = chat AS $fn$
BEGIN
  UPDATE chat.conversation
     SET last_message_at = NEW.sent_at
   WHERE id = NEW.conversation_id AND last_message_at < NEW.sent_at;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_bump_conversation
  AFTER INSERT ON chat.message
  FOR EACH ROW EXECUTE FUNCTION chat.fn_bump_conversation();

-- ---------------------------------------------------------------------------
-- 3. chat.bot_turn - APPEND-ONLY
--
-- intent_id is a BARE uuid, deliberately: the id is nlu's, but an FK from
-- chat into nlu would weld the two stores together at the catalogue level -
-- S15.3's separation is what lets nlu move to its own cluster without
-- taking the conversation record with it. The join happens at read time,
-- by id, in the one direction that carries no identity.
-- ---------------------------------------------------------------------------
CREATE TABLE chat.bot_turn (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL REFERENCES chat.message(id),
  turn_index      int NOT NULL,
  resolution_path chat.resolution_path NOT NULL,
  intent_id       uuid NULL,
  confidence      numeric(5,4) NULL,
  model_id        text NULL,
  tokens_in       int NOT NULL DEFAULT 0,
  tokens_cached   int NOT NULL DEFAULT 0,
  tokens_out      int NOT NULL DEFAULT 0,
  latency_ms      int NOT NULL DEFAULT 0,
  escalated       boolean NOT NULL DEFAULT false,
  CONSTRAINT one_turn_per_index UNIQUE (message_id, turn_index)
);

COMMENT ON TABLE chat.bot_turn IS
  'Section 17.1. The cascade record: which layer resolved, at what cost. '
  'resolution_path mirrors the six S15.1 layers exactly, so containment is '
  'a GROUP BY rather than a derivation. Deliberately carries NO column for '
  'model-produced prose - the reply is always rendered from '
  'nlu.answer_template by intent id.';

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON chat.bot_turn
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

-- ---------------------------------------------------------------------------
-- 4. chat.v_seller_chat_burden (section 17.1, S15)
--
-- Free sellers carry the load manually and THE BURDEN MUST BE VISIBLE.
-- A view, not a table: the console reads it per seller, and the numbers
-- must never be arguable with the messages they summarise.
--   unanswered:   conversations whose latest message is the buyer's.
--   median:       seconds from a buyer message to the first non-buyer reply.
--   out-of-hours: buyer messages sent while the R27 availability state said
--                 closed (evaluated against the CURRENT schedule - the
--                 schedule table is not versioned, and pretending otherwise
--                 would be invention).
-- ---------------------------------------------------------------------------
CREATE VIEW chat.v_seller_chat_burden AS
SELECT c.seller_id,
       count(*) FILTER (WHERE last_msg.sender_kind = 'BUYER') AS unanswered_count,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY resp.response_seconds)
         AS median_response_seconds,
       coalesce(sum(ooh.out_of_hours_questions), 0) AS out_of_hours_question_count
  FROM chat.conversation c
  LEFT JOIN LATERAL (
    SELECT m.sender_kind FROM chat.message m
     WHERE m.conversation_id = c.id
     ORDER BY m.sent_at DESC LIMIT 1
  ) last_msg ON true
  LEFT JOIN LATERAL (
    SELECT extract(epoch FROM (nb.first_reply - mb.sent_at)) AS response_seconds
      FROM chat.message mb
      CROSS JOIN LATERAL (
        SELECT min(mr.sent_at) AS first_reply
          FROM chat.message mr
         WHERE mr.conversation_id = c.id
           AND mr.sent_at > mb.sent_at
           AND mr.sender_kind <> 'BUYER'
      ) nb
     WHERE mb.conversation_id = c.id
       AND mb.sender_kind = 'BUYER'
       AND nb.first_reply IS NOT NULL
  ) resp ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS out_of_hours_questions
      FROM chat.message mq
     WHERE mq.conversation_id = c.id
       AND mq.sender_kind = 'BUYER'
       AND NOT coalesce((SELECT s.is_open
                           FROM core.fn_seller_availability_state(c.seller_id, mq.sent_at) s),
                        false)
  ) ooh ON true
 GROUP BY c.seller_id;

-- ---------------------------------------------------------------------------
-- 5. nlu.intent, nlu.intent_phrase, nlu.answer_template (section 17.2)
-- ---------------------------------------------------------------------------
CREATE TABLE nlu.intent (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  description text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  retired_at  timestamptz NULL
);

CREATE TABLE nlu.intent_phrase (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES nlu.intent(id),
  locale    text NOT NULL,
  text      text NOT NULL,
  -- D-05: dimensionless until vector(N)'s N is ruled; HNSW waits with it.
  embedding vector NULL,
  source    nlu.phrase_source NOT NULL
);

CREATE INDEX idx_phrase_by_intent ON nlu.intent_phrase (intent_id, locale);

CREATE TABLE nlu.answer_template (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES nlu.intent(id),
  locale    text NOT NULL,
  -- THE ONE IDENTIFIER PERMITTED IN nlu, AND IT IS A BARE uuid WITH NO
  -- FOREIGN KEY TO core.seller - stated in section 17.2 precisely because
  -- this is the obvious place for a well-meaning agent to add one and
  -- quietly join the two stores S15.3 requires separated. Appendix C
  -- check 4. NULL means the global default answer.
  seller_id uuid NULL,
  template  text NOT NULL,
  slots     text[] NOT NULL DEFAULT '{}'
);

-- One template per (intent, locale, seller-or-global): the same coalesce
-- device as claim scope, because NULLs never collide in a unique index.
CREATE UNIQUE INDEX answer_template_one_per_scope
  ON nlu.answer_template (intent_id, locale,
      coalesce(seller_id, '00000000-0000-0000-0000-000000000000'));

-- ---------------------------------------------------------------------------
-- 6. nlu.unmatched_phrase, regression set (section 17.2) - APPEND-ONLY
-- ---------------------------------------------------------------------------
CREATE TABLE nlu.unmatched_phrase (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text        text NOT NULL,
  locale      text NOT NULL,
  -- market_id is context, not identity, and it is a BARE uuid: an FK would
  -- reach into core, and section 3 rules that no such FK exists.
  market_id   uuid NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nlu.unmatched_phrase IS
  'Written by the nlu.harvest_unmatched ETL from escalated turns with '
  'identifiers removed (S15.3). NO conversation_id, NO buyer_id - the '
  'absence is the invariant.';

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON nlu.unmatched_phrase
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE TABLE nlu.regression_case (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text               text NOT NULL,
  locale             text NOT NULL,
  expected_intent_id uuid NOT NULL REFERENCES nlu.intent(id),
  frozen_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nlu.regression_case IS
  'Section 17.2 - append-only with no UPDATE grant: a "frozen" set that can '
  'be edited to make a run pass is not a regression set.';

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON nlu.regression_case
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

CREATE TABLE nlu.regression_run (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at           timestamptz NOT NULL DEFAULT now(),
  change_reference text NOT NULL,
  precision_before numeric(5,4) NOT NULL,
  precision_after  numeric(5,4) NOT NULL,
  accepted         boolean NOT NULL
);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON nlu.regression_run
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

-- ---------------------------------------------------------------------------
-- 7. Ownership and grants (section 3's table, exactly)
--    chat: full DML for the app, minus the append-only revoke.
--    nlu:  read + insert, nothing else, for everyone at runtime.
--    readonly gets NOTHING here: its grant is core and analytics only.
-- ---------------------------------------------------------------------------
ALTER FUNCTION chat.fn_bump_conversation() OWNER TO adulis_migrate;

GRANT USAGE ON SCHEMA chat TO adulis_app, adulis_jobs;
GRANT USAGE ON SCHEMA nlu  TO adulis_app, adulis_jobs;

GRANT SELECT, INSERT, UPDATE ON chat.conversation, chat.message TO adulis_app;
GRANT SELECT, INSERT ON chat.bot_turn TO adulis_app;
REVOKE UPDATE, DELETE ON chat.bot_turn FROM adulis_app;

-- The harvest ETL reads escalated turns and writes stripped phrases.
GRANT SELECT ON chat.conversation, chat.message, chat.bot_turn TO adulis_jobs;
GRANT INSERT ON nlu.unmatched_phrase TO adulis_jobs;

GRANT SELECT, INSERT ON nlu.intent, nlu.intent_phrase, nlu.answer_template,
                        nlu.unmatched_phrase, nlu.regression_case, nlu.regression_run
  TO adulis_app;
GRANT SELECT ON nlu.intent, nlu.intent_phrase, nlu.answer_template TO adulis_jobs;

-- The bump trigger fires as the inserting role's definer (adulis_migrate).
GRANT SELECT, UPDATE ON chat.conversation TO adulis_migrate;
GRANT USAGE ON SCHEMA chat TO adulis_migrate;

GRANT SELECT ON chat.v_seller_chat_burden TO adulis_app;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 13 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
