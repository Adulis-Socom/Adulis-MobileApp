import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

/**
 * D-173, RULED (WORK ORDER T12 S1).
 *
 * "The release derives its quantity from the reserving stock_event, not from
 * the reservation row. If no ORDER_CREATED event exists for that reservation,
 * the release returns nothing and the order fails loudly."
 *
 * WHY THE RULING EXISTS. Nothing enforces the reservation/stock-event
 * pairing -- it lives only inside fn_create_order -- so a reservation arriving
 * by any other path used to RELEASE STOCK THAT WAS NEVER TAKEN when it was
 * cancelled or expired. Two things made that worse than it sounds:
 * CHECK (stock_count >= 0) held throughout, so the invented stock was
 * silently correct-looking inventory; and A3.2's release idempotency is
 * keyed (reservation_id, reason), which prevents releasing TWICE and says
 * nothing about releasing something never reserved.
 *
 * BOTH ARMS ARE PINNED, because a wrong fix here looks exactly like a right
 * one: a release path that silently skips the event-less reservation would
 * pass arm 2's "no stock created" and fail the ruling's OTHER clause -- the
 * order must fail LOUDLY, where somebody is looking, not proceed with the
 * anomaly intact. So arm 2 asserts all three: the call raises, names D-173,
 * and writes nothing.
 *
 * Everything goes through core.fn_cancel_line exactly as the API reaches it
 * (orders.service.ts cancelLineAsSeller); nothing pokes the release helper
 * bare except the derivation assertions themselves.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = randomUUID();
const SELLER_ACC = randomUUID();
const BUYER_ACC = randomUUID();
const SELLER = randomUUID();
const PRODUCT = randomUUID();
const V_PAIRED = randomUUID();
const V_BARE = randomUUID();
const O_PAIRED = randomUUID();
const O_BARE = randomUUID();
const R_PAIRED = randomUUID();
const R_BARE = randomUUID();

describe('D-173 -- the release derives from the reserving ledger event', () => {
  let admin: Pool;

  const stock = async (variant: string): Promise<number> => {
    const r = await admin.query('SELECT stock_count FROM core.product_variant WHERE id = $1', [
      variant,
    ]);
    return r.rows[0].stock_count as number;
  };

  beforeAll(async () => {
    if (!ADMIN) throw new Error('DATABASE_URL_MIGRATE is not set.');
    admin = new Pool({ connectionString: ADMIN, max: 2 });

    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1, 'D173', 'Ethiopia', 'PHASE_1', 'ETB', 'Africa/Addis_Ababa', 'en', 'ACTIVE', true, 'AFROMESSAGE')`,
      [M],
    );
    for (const [acc, phone] of [
      [SELLER_ACC, '+251911000173'],
      [BUYER_ACC, '+251911000174'],
    ] as const) {
      await admin.query(
        `INSERT INTO core.account (id, phone_e164, market_id, status, age_declared_over_18)
         VALUES ($1, $2, $3, 'ACTIVE', true)`,
        [acc, phone, M],
      );
    }
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1, $2, $3, 'INDIVIDUAL', 'D173 Store', 'd173-store', 'ACTIVE')`,
      [SELLER, M, SELLER_ACC],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, visibility,
                                 base_price_minor, base_price_currency)
       VALUES ($1, $2, $3, 'D173 Coffee', 'PUBLISHED', 1000, 'ETB')`,
      [PRODUCT, SELLER, M],
    );
    // Variants start at ZERO; the ledger produces every count below, exactly
    // as the seed does since T11 Phase 6.
    for (const [v, key] of [
      [V_PAIRED, 'paired'],
      [V_BARE, 'bare'],
    ] as const) {
      await admin.query(
        `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
                                           price_currency, stock_count, variant_key)
         VALUES ($1, $2, $3, 1000, 'ETB', 0, $4)`,
        [v, PRODUCT, SELLER, key],
      );
      await admin.query(
        `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason, actor_account_id)
         VALUES ($1, $2, $3, 10, 'SELLER_SET', $4)`,
        [randomUUID(), v, SELLER, SELLER_ACC],
      );
    }

    /*
     * THE ROW LIES, DELIBERATELY (adversarial pass on #43, finding 3 --
     * mutation-confirmed): the paired reservation says quantity FIVE while
     * its reserving event says three. The first fixture had the two numbers
     * agreeing, and a row-derivation implementation -- the exact wrong fix
     * the ruling exists to prevent -- passed every assertion. With the row
     * lying, ledger-derivation releases 3 (stock 7 -> 10) and row-derivation
     * releases 5 (stock -> 12): arm 1 now DISCRIMINATES. Nothing prevents
     * the disagreement existing, which is D-173's whole point.
     */
    for (const [o, r, v, qty] of [
      [O_PAIRED, R_PAIRED, V_PAIRED, 5],
      [O_BARE, R_BARE, V_BARE, 3],
    ] as const) {
      await admin.query(
        `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state,
                                   expires_at, total_minor, total_currency,
                                   display_currency, seller_level_at_order)
         VALUES ($1, $2, $3, $4, 'CREATED', now() + interval '2 days', 3000, 'ETB', 'ETB', 'NEW')`,
        [o, M, SELLER, BUYER_ACC],
      );
      await admin.query(
        `INSERT INTO core.reservation (id, order_id, variant_id, seller_id,
                                       buyer_account_id, quantity, unit_price_minor,
                                       unit_price_currency, state)
         VALUES ($1, $2, $3, $4, $5, $6, 1000, 'ETB', 'ACTIVE')`,
        [r, o, v, SELLER, BUYER_ACC, qty],
      );
    }

    // THE DIFFERENCE UNDER TEST: exactly one of the two reservations carries
    // its reserving event. The bare one is the state D-173 records --
    // impossible through fn_create_order, possible through everything else.
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason,
                                     order_id, reservation_id, actor_account_id)
       VALUES ($1, $2, $3, -3, 'ORDER_CREATED', $4, $5, $6)`,
      [randomUUID(), V_PAIRED, SELLER, O_PAIRED, R_PAIRED, BUYER_ACC],
    );
  });

  afterAll(async () => {
    // Fixture teardown only, the c1..c5 idiom: replica mode silences the
    // append-only triggers for THIS superuser session so test rows can leave
    // (order_state_transition forbids DELETE otherwise). Nothing in a runtime
    // code path ever does this -- and the orphan-sweep gate exists precisely
    // because this pattern deletes referential integrity's brakes too, so
    // the list below must be COMPLETE: every FK into core.seller, swept.
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.order_state_transition WHERE order_id IN ('${O_PAIRED}','${O_BARE}')`,
      `DELETE FROM core.stock_event WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.reservation WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core."order" WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.buyer_cancellation_counter WHERE buyer_account_id = '${BUYER_ACC}'`,
      `DELETE FROM core.product_variant WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.product WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.seller_level_state WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.seller WHERE id = '${SELLER}'`,
      `DELETE FROM core.account WHERE id IN ('${SELLER_ACC}','${BUYER_ACC}')`,
      `DELETE FROM core.timing_config WHERE market_id = '${M}'`,
      `DELETE FROM core.market WHERE id = '${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = origin`);
    await admin.end();
  });

  test('arm 1: a reservation WITH its event releases what the LEDGER took, not what the row claims', async () => {
    // Ledger story so far: SELLER_SET +10, ORDER_CREATED -3 -> 7 available.
    // The reservation ROW says 5. The row is lying; the ledger is not.
    expect(await stock(V_PAIRED)).toBe(7);

    await admin.query(`SELECT core.fn_cancel_line($1, $2, $3, true)`, [
      O_PAIRED,
      R_PAIRED,
      SELLER_ACC,
    ]);

    // Back to 10, NOT 12: the release returned the LEDGER's 3, not the
    // row's 5. This is the assertion that failed the mutation (a
    // row-derivation implementation) and the reason the fixture lies.
    expect(await stock(V_PAIRED)).toBe(10);
    const rel = await admin.query(
      `SELECT delta, variant_id, seller_id FROM core.stock_event
        WHERE reservation_id = $1 AND reason = 'LINE_CANCELLED'`,
      [R_PAIRED],
    );
    expect(rel.rows).toHaveLength(1);
    expect(rel.rows[0]).toEqual({ delta: 3, variant_id: V_PAIRED, seller_id: SELLER });
  });

  test('arm 2: a reservation WITHOUT its event fails loudly and creates no stock', async () => {
    expect(await stock(V_BARE)).toBe(10); // SELLER_SET only; nothing ever held

    await expect(
      admin.query(`SELECT core.fn_cancel_line($1, $2, $3, true)`, [O_BARE, R_BARE, SELLER_ACC]),
    ).rejects.toThrow(/no ORDER_CREATED stock event.*D-173/);

    // LOUD AND CLEAN: the whole transaction rolled back -- no release event,
    // no invented stock, and the reservation is still ACTIVE (an aborted
    // cancellation must not leave the line half-cancelled with stock unmoved).
    expect(await stock(V_BARE)).toBe(10);
    const rel = await admin.query(
      `SELECT 1 FROM core.stock_event WHERE reservation_id = $1 AND reason = 'LINE_CANCELLED'`,
      [R_BARE],
    );
    expect(rel.rows).toHaveLength(0);
    const res = await admin.query(`SELECT state::text AS state FROM core.reservation WHERE id = $1`, [
      R_BARE,
    ]);
    expect(res.rows[0].state).toBe('ACTIVE');
  });

  test('the A3.2 anchor survives the derivation: a second release still refuses', async () => {
    // Arm 1 released R_PAIRED. Releasing it again must refuse on the
    // (reservation_id, reason) unique index -- the derivation replaced where
    // the QUANTITY comes from, not the once-only guarantee.
    await expect(
      admin.query(`SELECT core.fn_release_reservation_stock($1, $2, 'LINE_CANCELLED')`, [
        R_PAIRED,
        O_PAIRED,
      ]),
    ).rejects.toThrow(/duplicate key|stock_release_once/);
    expect(await stock(V_PAIRED)).toBe(10);
  });
});
