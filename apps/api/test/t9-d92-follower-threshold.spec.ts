import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

/**
 * D-92, RULED (WORK ORDER T9 S3.1).
 *
 * `core.eligibility_config.follower_threshold` is nullable, and until T9 the
 * register carried it as a DEFERRED value -- something nobody had chosen yet.
 * The ruling says it is not: NULL there is a DECIDED value, "this market sets
 * no bar", and ADU-PRD-01 S4.1 governs. The consumer therefore FAILS OPEN on
 * it, which is the opposite of ADU-RUL-02's default and the reason the
 * distinction had to be ruled rather than assumed.
 *
 * Before migration 0041 the audience arm read
 *
 *     v_audience := coalesce(v_best >= v_cfg.follower_threshold, false);
 *
 * and `v_best >= NULL` is NULL, coalesced to false. A market that had
 * deliberately set no follower bar refused EVERY seller for
 * FOLLOWER_THRESHOLD_NOT_MET.
 *
 * TWO NULLS, AND THEY ARE NOT THE SAME. This suite pins both, because a fix
 * that collapsed them would pass the first test and silently open the gate to
 * sellers with no evidence at all:
 *
 *   (1) threshold NULL, seller with NO verified social account -> SATISFIED
 *       an absent RULE. There is no bar, so there is nothing to clear.
 *   (2) threshold SET,  seller with NO verified social account -> NOT_SATISFIED
 *       absent EVIDENCE. Still fails closed, exactly as before.
 *
 * Everything goes through `core.fn_evaluate_eligibility` as the API reaches
 * it; nothing pokes `seller_eligibility_evaluation` directly.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M_OPEN = randomUUID();
const M_BARRED = randomUUID();
const ACC_OPEN = randomUUID();
const ACC_BARRED = randomUUID();
const S_OPEN = randomUUID();
const S_BARRED = randomUUID();

describe('D-92 -- a NULL follower_threshold is no bar, not an unmeetable one', () => {
  let admin: Pool;

  beforeAll(async () => {
    if (!ADMIN) throw new Error('DATABASE_URL_MIGRATE is not set.');
    admin = new Pool({ connectionString: ADMIN, max: 2 });

    for (const [m, code] of [
      [M_OPEN, 'D92O'],
      [M_BARRED, 'D92B'],
    ] as const) {
      await admin.query(
        `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                  display_timezone, default_locale, is_live)
         VALUES ($1, $2, 'Ethiopia', 'PHASE_1', 'ETB', 'Africa/Addis_Ababa', 'en', false)`,
        [m, code],
      );
    }

    for (const [acc, seller, market] of [
      [ACC_OPEN, S_OPEN, M_OPEN],
      [ACC_BARRED, S_BARRED, M_BARRED],
    ] as const) {
      await admin.query(
        `INSERT INTO core.account (id, market_id, phone_e164, status)
         VALUES ($1, $2, $3, 'ACTIVE')`,
        [acc, market, `+2519${Math.floor(Math.random() * 90000000 + 10000000)}`],
      );
      await admin.query(
        `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                  store_name, handle, status)
         VALUES ($1, $2, $3, 'INDIVIDUAL', 'D92 Co', $4, 'ACTIVE')`,
        [seller, market, acc, `d92-${seller.slice(0, 8)}`],
      );
    }

    // The only difference between the two markets is the threshold.
    await admin.query(
      `INSERT INTO core.eligibility_config
         (id, market_id, audience_required, follower_threshold, counting_platforms,
          threshold_basis, permitted_seller_types, id_verification_requirement, effective)
       VALUES ($1, $2, true, NULL, ARRAY['TIKTOK']::core.platform[],
               'HIGHEST_SINGLE', ARRAY['INDIVIDUAL']::core.seller_entity_type[],
               'OPTIONAL', tstzrange(now() - interval '1 day', NULL))`,
      [randomUUID(), M_OPEN],
    );
    await admin.query(
      `INSERT INTO core.eligibility_config
         (id, market_id, audience_required, follower_threshold, counting_platforms,
          threshold_basis, permitted_seller_types, id_verification_requirement, effective)
       VALUES ($1, $2, true, 5000, ARRAY['TIKTOK']::core.platform[],
               'HIGHEST_SINGLE', ARRAY['INDIVIDUAL']::core.seller_entity_type[],
               'OPTIONAL', tstzrange(now() - interval '1 day', NULL))`,
      [randomUUID(), M_BARRED],
    );
  });

  afterAll(async () => {
    const c = await admin.connect();
    try {
      await c.query('SET session_replication_role = replica');
      for (const [seller, acc, market] of [
        [S_OPEN, ACC_OPEN, M_OPEN],
        [S_BARRED, ACC_BARRED, M_BARRED],
      ] as const) {
        // THREE ROWS THIS SUITE CAUSED AND DID NOT NAME, and the third was
        // missed by the comment that named the first two.
        //
        //   seller_eligibility_evaluation  written by the function under test
        //   seller_public_stats            trg_create_public_stats, on the
        //                                  core.seller INSERT (0010:191)
        //   seller_level_state             trg_enter_ladder, on the
        //                                  seller_eligibility_evaluation
        //                                  INSERT (0008) -- one trigger further
        //                                  out, and therefore not where anyone
        //                                  looking at `core.seller` would look
        //
        // The first version of this teardown deleted the first two, under a
        // comment citing D-134 and the rule that deleting what you created
        // means what your INSERT CAUSED. It still missed the third, because
        // the cause was two steps away: the seller insert fires one trigger,
        // and the evaluation THAT function writes fires another.
        //
        // The orphan-sweep gate found it on its first run (D-151). That is the
        // argument for the gate rather than for more care: this teardown was
        // written by someone who had just read D-134 and was thinking about
        // exactly this, and it was still wrong.
        await c.query('DELETE FROM core.seller_level_state WHERE seller_id = $1', [seller]);
        await c.query('DELETE FROM core.seller_eligibility_evaluation WHERE seller_id = $1', [seller]);
        await c.query('DELETE FROM core.seller_public_stats WHERE seller_id = $1', [seller]);
        await c.query('DELETE FROM core.seller WHERE id = $1', [seller]);
        await c.query('DELETE FROM core.account WHERE id = $1', [acc]);
        await c.query('DELETE FROM core.eligibility_config WHERE market_id = $1', [market]);
        await c.query('DELETE FROM core.market WHERE id = $1', [market]);
      }
    } finally {
      await c.query('SET session_replication_role = DEFAULT').catch(() => {});
      c.release();
    }
    await admin.end();
  });

  it('admits an audience-less seller when the market sets no follower bar', async () => {
    const r = await admin.query(
      'SELECT (core.fn_evaluate_eligibility($1)).*',
      [S_OPEN],
    );
    const row = r.rows[0];

    expect(row.outcome).toBe('SATISFIED');
    expect(row.reasons ?? []).not.toContain('FOLLOWER_THRESHOLD_NOT_MET');
  });

  it('still refuses an audience-less seller when the market DOES set a bar', async () => {
    const r = await admin.query(
      'SELECT (core.fn_evaluate_eligibility($1)).*',
      [S_BARRED],
    );
    const row = r.rows[0];

    // Absent EVIDENCE, not an absent rule: this arm must not move.
    expect(row.outcome).toBe('NOT_SATISFIED');
    expect(row.reasons).toContain('FOLLOWER_THRESHOLD_NOT_MET');
  });
});
