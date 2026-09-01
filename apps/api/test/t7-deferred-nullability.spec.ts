import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

/**
 * T7 Phase 3 -- what D-61 said could not be written before.
 *
 * ADU-RUL-02 (via T7 S5): every ADU-VAL-01 S1.1 column is nullable, and its
 * consumer fails closed on NULL. This suite seeds a ladder_config row with
 * EVERY OPEN column NULL -- expressible for the first time since 0002 --
 * and proves the two halves of the assertion T7 orders:
 *
 *   with ladder_config seeded and every OPEN column NULL,
 *   (1) no seller is promoted beyond ESTABLISHED, and
 *   (2) none is demoted except by an upheld claim.
 *
 * The promotion arm and the demotion arm need DIFFERENT levels to prove
 * anything (the demotion gate only runs when level <> NEW), so the seller
 * here climbs legitimately to ESTABLISHED first -- trivially-low SET
 * values, the migration-08-15 pattern -- and is then given adverse
 * evidence, good evidence, and finally an upheld claim.
 *
 * Everything runs through fn_recompute_seller_level as adulis_app would
 * reach it (the admin pool calls the function directly, like the t6
 * boundary suite), never by poking seller_level_state -- except the
 * fixture seed of the state row itself, which is the t6 precedent.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = randomUUID();
const OWNER = randomUUID();
const BUYER = randomUUID();
const SELLER = randomUUID();
const ORDER = randomUUID();
const CLAIM = randomUUID();

describe('T7 Phase 3 -- deferral is a state the schema holds, and every consumer fails closed', () => {
  let admin: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'T7N','Nullable','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251919930001',$3,'ACTIVE'), ($2,'+251919930002',$3,'ACTIVE')`,
      [OWNER, BUYER, M],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Null Ladder','t7-null-ladder','ACTIVE')`,
      [SELLER, M, OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller_level_state (seller_id, level, since, computed_at)
       VALUES ($1,'NEW', now() - interval '1 day', now())`,
      [SELLER],
    );

    // THE ROW D-61 SAID COULD NOT EXIST: every OPEN column NULL, only the
    // SET values (G1.2's NEW exit, trivially low so promotion is reachable)
    // and the identity columns supplied. Before 0039 this INSERT raised
    // 23502 on ten different columns.
    await admin.query(
      `INSERT INTO core.ladder_config (id, market_id,
         new_to_established_min_tenure, new_to_established_min_orders,
         new_level_product_cap, new_level_transaction_cap_minor)
       VALUES (gen_random_uuid(), $1, interval '0 seconds', 1, 10, NULL)`,
      [M],
    );

    // A completed order (the NEW exit's order arm) that is also the claim
    // vehicle for the demotion half.
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id,
         state, expires_at, clock_stopped_at, total_minor, total_currency,
         display_currency)
       VALUES ($1,$2,$3,$4,'COMPLETED', now() + interval '2 days', now(),
               50000,'ETB','ETB')`,
      [ORDER, M, SELLER, BUYER],
    );
  });

  afterAll(async () => {
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.moderation_event WHERE id IN
      (SELECT moderation_event_id FROM core.seller_level_event
        WHERE seller_id = $1 AND moderation_event_id IS NOT NULL)`, [SELLER]);
    await admin.query(`DELETE FROM core.seller_level_event WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller_level_state WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.claim_evidence_item WHERE claim_id = $1`, [CLAIM]);
    await admin.query(`DELETE FROM core.claim WHERE id = $1`, [CLAIM]);
    await admin.query(`DELETE FROM core."order" WHERE id = $1`, [ORDER]);
    await admin.query(`DELETE FROM core.ladder_config WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.seller_public_stats WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller WHERE id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.account WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [M]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  const recompute = () =>
    admin.query(`SELECT core.fn_recompute_seller_level($1, false, NULL)`, [SELLER]);
  const level = async (): Promise<string> =>
    (await admin.query(`SELECT level::text FROM core.seller_level_state WHERE seller_id=$1`, [SELLER]))
      .rows[0].level;

  it('the seller climbs to ESTABLISHED on the SET values -- the NEW exit is untouched by the NULLs', async () => {
    await recompute();
    expect(await level()).toBe('ESTABLISHED');
  });

  it('ESTABLISHED holds on recompute while trusted_* are NULL, and no TRUSTED event exists', async () => {
    // What is ASSERTED here is the closed gate on zero counting evidence:
    // a recompute with no scans stays ESTABLISHED and mints no TRUSTED
    // event. A run WITH counting evidence cannot be staged -- while
    // distinct_buyer_* are NULL, 0013:159 stamps counts_toward_level
    // false at INSERT -- which is the deferral itself working; note that
    // this leaves fn_recompute's counting-scan arm (0028:388-392)
    // exercised nowhere in the tree until those values are ruled. The
    // gate is a coalesce(AND-chain, false): one NULL threshold poisons
    // the conjunction.
    await recompute();
    expect(await level()).toBe('ESTABLISHED');
    const events = await admin.query(
      `SELECT count(*)::int AS n FROM core.seller_level_event
        WHERE seller_id = $1 AND to_level = 'TRUSTED'`,
      [SELLER],
    );
    expect(events.rows[0].n).toBe(0);
  });

  it('adverse evidence does not demote while demotion_* are NULL', async () => {
    // The adverse signal actually staged is claim VOLUME without an
    // upheld outcome (one UNDER_REVIEW claim). No cancellation is
    // inserted: the cancellation-rate leg is exercised only through its
    // NULL-window collapse -- with demotion_window NULL the helpers
    // return NULL and the OR-gate collapses inside coalesce(..., false).
    await admin.query(
      `INSERT INTO core.claim (id, order_id, opened_by_kind, opened_by_account_id,
         trigger, state)
       VALUES ($1,$2,'BUYER',$3,'GOODS_NOT_RECEIVED','UNDER_REVIEW')`,
      [CLAIM, ORDER, BUYER],
    );
    await recompute();
    expect(await level()).toBe('ESTABLISHED');
  });

  it('the upheld claim demotes anyway -- the one lever no configuration touches', async () => {
    // S5.2 / ADU-VAL-01 S6: "an upheld claim always demotes regardless of
    // every value here. Not configuration." The trigger path runs BEFORE
    // the config read in fn_recompute_seller_level, so it works against a
    // row of NULLs -- and the audit chain must say MODERATION, never
    // COMPUTED.
    await admin.query(`UPDATE core.claim SET state='RESOLVED', outcome='UPHELD',
        severity='ORDINARY', decided_by=$2, decided_at=now() WHERE id=$1`, [CLAIM, OWNER]);
    expect(await level()).toBe('NEW');
    const events = await admin.query(
      `SELECT e.source::text, m.decision::text
         FROM core.seller_level_event e
         JOIN core.moderation_event m ON m.id = e.moderation_event_id
        WHERE e.seller_id = $1 AND e.from_level = 'ESTABLISHED' AND e.to_level = 'NEW'`,
      [SELLER],
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].source).toBe('MODERATION');
    expect(events.rows[0].decision).toBe('CLAIM_UPHELD');
  });

  it('afterwards the seller re-climbs to ESTABLISHED on the SET values -- and never past it', async () => {
    // The demotion reset `since`, but the SET tenure arm is 0 seconds and
    // the completed order still counts: recompute legitimately re-promotes
    // to ESTABLISHED. What the NULL row must never produce is a COMPUTED
    // move beyond it, or a COMPUTED demotion -- the full event history is
    // the assertion.
    await recompute();
    expect(await level()).toBe('ESTABLISHED');
    const badMoves = await admin.query(
      `SELECT count(*)::int AS n FROM core.seller_level_event
        WHERE seller_id = $1 AND source = 'COMPUTED'
          AND (to_level = 'TRUSTED' OR to_level < from_level)`,
      [SELLER],
    );
    expect(badMoves.rows[0].n).toBe(0);
  });
});
