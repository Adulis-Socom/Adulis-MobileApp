import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * WO-007A -- public Reviews rest on REV-01's two evidence bases only (founder decision ON-033),
 * read through one projection (core.v_review_public, migration 0058) by the reviews list and the
 * header summary alike; and a Market's currency is fixed once it has Products (ON-009, 0059).
 *
 * TWO HALVES. "As built" runs against the real database: no Order has authoritatively verified
 * payment (K-1: Seller confirmation is not payment truth), so NO Review is public, whatever badge
 * or evidence it carries. "With a payment owner" stands in for WO-PAY-001 -- it replaces the body
 * of core.fn_order_payment_verified, in the database the suite runs against, with one that answers
 * true for THIS FILE'S fixture Orders only (other suites' Orders keep the real answer), and puts
 * back exactly the definition it found (pg_get_functiondef), whatever WO-PAY-001 has made it by
 * then. It never fabricates receipt or Claim evidence: those are real rows.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const CONSOLE_ORIGIN = 'http://localhost:5173';

const id = (n: number) => `0e07a000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const MA = id(1);
const MC = id(2); // a Market with no Product yet: its currency may still change
const OWNER = { a: id(10), b: id(11), c: id(12) };
const BUYER = { one: id(13), two: id(14), liveTeam: id(16), revokedTeam: id(17) };
const OPERATOR = id(15);
const SELLER = { a: id(20), b: id(21), c: id(22) };
const DEV = id(30);
const PRODUCT = id(40);
const order = (n: number) => id(0x100 + n);

// One Order per case, all of Seller A unless noted.
const O = {
  noPay: order(1), // valid receipt, payment NOT verified
  payOnly: order(2), // Seller-confirmed payment submission, no receipt
  pickup: order(3), // Courier PICKUP only
  fh1: order(4), // valid final receipt
  fh2: order(5), // valid final receipt (tied published_at with fh3)
  fh3: order(6),
  failure: order(7), // upheld GOODS_NOT_RECEIVED, no receipt
  openClaim: order(8), // GOODS_NOT_RECEIVED still open
  rejected: order(9), // GOODS_NOT_RECEIVED NOT_UPHELD
  overturn: order(10), // upheld, later overturned
  notAsDescribed: order(11), // upheld NOT_AS_DESCRIBED without receipt: not a failure basis
  mismatch: order(12), // Seller A's Order, review row naming Seller B
  unverified: order(13), // nothing at all
  confirmedByBuyer: order(14), // a buyer tap, no scan
  self: order(15), // the Seller's owner reviewing their own store
  refundUnpaid: order(16), // upheld REFUND_NOT_DELIVERED, no receipt
  liveTeam: order(17), // valid receipt, but the Buyer is a live team member of the Seller
  revokedTeam: order(18), // valid receipt; the Buyer's team membership was revoked
  horizon: order(19), // a scan past the sync horizon: REJECTED_HORIZON, not a receipt
  receiptAndClaim: order(20), // valid receipt AND an upheld non-delivery Claim: receipt wins
} as const;
const ALL_ORDERS = Object.values(O);
const PAID = ALL_ORDERS.filter((o) => o !== O.noPay);

@Module({ imports: [AppModule] })
class Wo007aAppModule {}

describe('WO-007A -- public Review eligibility and Market currency', () => {
  let app: INestApplication;
  let admin: Pool;
  const reviewOf: Record<string, string> = {};

  const server = () => request(app.getHttpServer());
  const get = (path: string) => server().get(path).set('X-Adulis-Client', 'android/1.0.0').set('X-Adulis-Device', DEV);
  const summary = async (handle: string) => (await get(`/v1/storefronts/${handle}?revalidate=true`).expect(200)).body.review_summary;
  const walk = async (handle: string, limit: number) => {
    const pages: Array<Array<{ id: string; seller_rating: number; evidence_basis: string }>> = [];
    let cursor: string | null = null;
    do {
      const r: request.Response = await get(`/v1/storefronts/${handle}/reviews?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`).expect(200);
      pages.push(r.body.data);
      cursor = r.body.next_cursor;
    } while (cursor && pages.length < 40);
    return pages;
  };

  const sql = (q: string, params: unknown[] = []) => admin.query(q, params);
  /** Rows a fixture writes past the order state machine (the c7 pattern). */
  const replica = async (q: string, params: unknown[] = []) => {
    const c = await admin.connect();
    try {
      await c.query('SET session_replication_role = replica');
      await c.query(q, params);
    } finally {
      await c.query('SET session_replication_role = DEFAULT');
      c.release();
    }
  };
  /** The definition found before this file touched it, restored exactly. */
  let paymentOwnerFound: string | undefined;
  const paymentOwner = (orders: readonly string[]) =>
    sql(`CREATE OR REPLACE FUNCTION core.fn_order_payment_verified(p_order uuid) RETURNS boolean
         LANGUAGE sql STABLE PARALLEL SAFE AS $fn$ SELECT p_order = ANY ('{${orders.join(',')}}'::uuid[]) $fn$`);
  const restorePaymentOwner = async () => {
    if (paymentOwnerFound) await sql(paymentOwnerFound);
  };

  const newOrder = (o: string, seller: string, buyer: string) =>
    replica(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state, clock_stopped_at, expires_at, total_currency, display_currency)
       VALUES ($1,$2,$3,$4,'PAYMENT_CONFIRMED', now(), now() + interval '48 hours','ETB','ETB')`,
      [o, MA, seller, buyer],
    );
  /** The Buyer's own QR scan of the final receipt, through the production triggers. */
  const finalReceipt = async (o: string, buyer: string, signedAgo = '0 seconds') => {
    await sql(`INSERT INTO core.order_qr_token (id, order_id, nonce, signing_key_version, issued_at) VALUES ($1,$2,$3,1, now() - interval '10 days')`, [
      randomUUID(),
      o,
      randomUUID(),
    ]);
    await sql(`INSERT INTO core.handoff_scan (order_id, scanned_by_account_id, nonce, signed_at) VALUES ($1,$2,$3, now() - $4::interval)`, [
      o,
      buyer,
      randomUUID(),
      signedAgo,
    ]);
  };
  const claim = (o: string, trigger: string, outcome: 'UPHELD' | 'NOT_UPHELD' | null) =>
    replica(
      `INSERT INTO core.claim (id, order_id, opened_by_kind, opened_by_account_id, trigger, state, outcome, decided_by, decided_at)
       VALUES ($1,$2,'BUYER',$3,$4::core.claim_trigger,
               CASE WHEN $5::core.claim_outcome IS NULL THEN 'AWAITING_SELLER_EVIDENCE' ELSE 'RESOLVED' END::core.claim_state,
               $5::core.claim_outcome, CASE WHEN $5 IS NULL THEN NULL ELSE $6::uuid END,
               CASE WHEN $5 IS NULL THEN NULL ELSE now() END)`,
      [randomUUID(), o, BUYER.one, trigger, outcome, OPERATOR],
    );
  const review = async (key: string, o: string, seller: string, buyer: string, rating: number) => {
    const r = await sql(
      `INSERT INTO core.review (order_id, buyer_account_id, seller_id, seller_rating, body, badge)
       VALUES ($1,$2,$3,$4,$5,'UNVERIFIED') RETURNING id, badge::text AS badge`,
      [o, buyer, seller, rating, `review ${key}`],
    );
    reviewOf[key] = r.rows[0].id;
    return r.rows[0].badge as string;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 4 });
    const found = await sql(`SELECT pg_get_functiondef('core.fn_order_payment_verified(uuid)'::regprocedure) AS def`);
    paymentOwnerFound = found.rows[0].def as string;
    // A run killed mid-way leaves the stand-in behind; restoring that would bless it.
    if (paymentOwnerFound.includes('0e07a000')) {
      throw new Error('core.fn_order_payment_verified still holds a WO-007A test stand-in: rebuild this database');
    }
    await sql(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'V7R','Reviews Market','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'V7C','Empty Market','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
      [MA, MC],
    );
    await sql(
      `INSERT INTO core.timing_config (id, market_id, reservation_window,
         payment_confirmation_window, fulfilment_window, offline_sync_horizon,
         payout_activation_delay, recovery_cooling_period,
         deleted_number_cooling_period, refund_ack_window, media_retention,
         level_credit_grace, mobile_session_lifetime, console_session_lifetime,
         console_idle_timeout, console_remembered_lifetime,
         console_remembered_idle, otp_ttl, otp_max_attempts, step_up_freshness,
         new_device_payout_lock, same_seller_cancellation_threshold,
         same_seller_cooldown, cross_seller_cooldown_ladder,
         cancellation_counter_decay)
       VALUES (gen_random_uuid(), $1, '48 hours','24 hours','72 hours','7 days',
         '24 hours','7 days','30 days','48 hours','90 days','24 hours',
         '30 days','12 hours','30 minutes','7 days','8 hours','5 minutes',5,
         '5 minutes','24 hours',3,'1 hour',
         ARRAY['1 day','2 days','4 days']::interval[],'30 days')`,
      [MA],
    );
    await sql(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251911707901',$7,'ACTIVE'), ($2,'+251911707902',$7,'ACTIVE'), ($3,'+251911707903',$8,'ACTIVE'),
        ($4,'+251911707904',$7,'ACTIVE'), ($5,'+251911707905',$7,'ACTIVE'), ($6,'+251911707906',$7,'ACTIVE'),
        ($9,'+251911707907',$7,'ACTIVE'), ($10,'+251911707908',$7,'ACTIVE')`,
      [OWNER.a, OWNER.b, OWNER.c, BUYER.one, BUYER.two, OPERATOR, MA, MC, BUYER.liveTeam, BUYER.revokedTeam],
    );
    await sql(`INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`, [DEV, MA]);
    await sql(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status) VALUES
        ($1,$4,$6,'INDIVIDUAL','Review Store','review-store','ACTIVE'),
        ($2,$4,$7,'INDIVIDUAL','Other Store','other-store','ACTIVE'),
        ($3,$5,$8,'INDIVIDUAL','Empty Market Store','empty-store','ACTIVE')`,
      [SELLER.a, SELLER.b, SELLER.c, MA, MC, OWNER.a, OWNER.b, OWNER.c],
    );
    await sql(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility, published_at)
       VALUES ($1,$2,$3,'Rated basket',1,'ETB','PUBLISHED',now())`,
      [PRODUCT, SELLER.a, MA],
    );

    await sql(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role, revoked_at) VALUES
        ($1,$3,$4,'SALES_SUPPORT',NULL), ($2,$3,$5,'SALES_SUPPORT', now())`,
      [id(50), id(51), SELLER.a, BUYER.liveTeam, BUYER.revokedTeam],
    );
    const buyerOf = (o: string) =>
      o === O.self ? OWNER.a : o === O.liveTeam ? BUYER.liveTeam : o === O.revokedTeam ? BUYER.revokedTeam : BUYER.one;
    for (const o of ALL_ORDERS) {
      await newOrder(o, SELLER.a, buyerOf(o));
    }
    // Evidence, all of it real rows written through the production triggers where they exist.
    for (const o of [O.noPay, O.fh1, O.fh2, O.fh3, O.mismatch]) await finalReceipt(o, BUYER.one);
    await finalReceipt(O.self, OWNER.a);
    await finalReceipt(O.liveTeam, BUYER.liveTeam);
    await finalReceipt(O.revokedTeam, BUYER.revokedTeam);
    await finalReceipt(O.receiptAndClaim, BUYER.one);
    await finalReceipt(O.horizon, BUYER.one, '8 days'); // the Market's offline_sync_horizon is 7 days
    await replica(
      `INSERT INTO core.payment_submission (id, order_id, evidence_ref, state, decided_by_account_id, decided_at)
       VALUES ($1,$2,$3,'CONFIRMED',$4, now())`,
      [randomUUID(), O.payOnly, randomUUID(), OWNER.a],
    );
    await sql(
      `INSERT INTO core.courier_custody_transfer (order_id, courier_account_id, seller_confirmed_at, courier_confirmed_at)
       VALUES ($1,$2, now(), now())`,
      [O.pickup, BUYER.two],
    );
    await sql(`INSERT INTO core.order_confirmation (id, order_id, tier) VALUES ($1,$2,'CONFIRMED_BY_BUYER')`, [randomUUID(), O.confirmedByBuyer]);
    await claim(O.failure, 'GOODS_NOT_RECEIVED', 'UPHELD');
    await claim(O.refundUnpaid, 'REFUND_NOT_DELIVERED', 'UPHELD');
    await claim(O.openClaim, 'GOODS_NOT_RECEIVED', null);
    await claim(O.rejected, 'GOODS_NOT_RECEIVED', 'NOT_UPHELD');
    await claim(O.overturn, 'GOODS_NOT_RECEIVED', 'UPHELD');
    await claim(O.notAsDescribed, 'NOT_AS_DESCRIBED', 'UPHELD');
    await claim(O.receiptAndClaim, 'GOODS_NOT_RECEIVED', 'UPHELD');

    // Reviews, one statement each so published_at orders them -- except fh2/fh3, one statement,
    // a timestamp tie. Ineligible 1-star reviews interleave the eligible ones.
    const badges: Record<string, string> = {};
    badges['noPay'] = await review('noPay', O.noPay, SELLER.a, BUYER.one, 1);
    badges['fh1'] = await review('fh1', O.fh1, SELLER.a, BUYER.one, 5);
    badges['payOnly'] = await review('payOnly', O.payOnly, SELLER.a, BUYER.one, 1);
    badges['failure'] = await review('failure', O.failure, SELLER.a, BUYER.one, 2);
    badges['pickup'] = await review('pickup', O.pickup, SELLER.a, BUYER.one, 1);
    const tie = await sql(
      `INSERT INTO core.review (order_id, buyer_account_id, seller_id, seller_rating, body, badge)
       VALUES ($1,$3,$4,4,'review fh2','UNVERIFIED'), ($2,$3,$4,3,'review fh3','UNVERIFIED')
       RETURNING id, order_id`,
      [O.fh2, O.fh3, BUYER.one, SELLER.a],
    );
    for (const row of tie.rows) reviewOf[row.order_id === O.fh2 ? 'fh2' : 'fh3'] = row.id;
    badges['openClaim'] = await review('openClaim', O.openClaim, SELLER.a, BUYER.one, 1);
    badges['rejected'] = await review('rejected', O.rejected, SELLER.a, BUYER.one, 1);
    badges['overturn'] = await review('overturn', O.overturn, SELLER.a, BUYER.one, 4);
    badges['notAsDescribed'] = await review('notAsDescribed', O.notAsDescribed, SELLER.a, BUYER.one, 1);
    badges['mismatch'] = await review('mismatch', O.mismatch, SELLER.b, BUYER.one, 1);
    badges['unverified'] = await review('unverified', O.unverified, SELLER.a, BUYER.one, 1);
    badges['confirmedByBuyer'] = await review('confirmedByBuyer', O.confirmedByBuyer, SELLER.a, BUYER.one, 1);
    badges['self'] = await review('self', O.self, SELLER.a, OWNER.a, 5);
    badges['refundUnpaid'] = await review('refundUnpaid', O.refundUnpaid, SELLER.a, BUYER.one, 3);
    badges['liveTeam'] = await review('liveTeam', O.liveTeam, SELLER.a, BUYER.liveTeam, 5);
    badges['revokedTeam'] = await review('revokedTeam', O.revokedTeam, SELLER.a, BUYER.revokedTeam, 4);
    badges['horizon'] = await review('horizon', O.horizon, SELLER.a, BUYER.one, 1);
    badges['receiptAndClaim'] = await review('receiptAndClaim', O.receiptAndClaim, SELLER.a, BUYER.one, 5);
    // A failure-only Order with a Product rating the legacy write path allowed: never public.
    await sql(`INSERT INTO core.review_item_rating (review_id, product_id, rating) VALUES ($1,$2,5)`, [reviewOf['failure'], PRODUCT]);

    // The legacy tiers the badge trigger derived: evidence the old reads treated as enough.
    expect(badges).toMatchObject({
      fh1: 'VERIFIED_HANDOFF',
      noPay: 'VERIFIED_HANDOFF',
      failure: 'CLAIM_UPHELD',
      confirmedByBuyer: 'CONFIRMED_BY_BUYER',
      unverified: 'UNVERIFIED',
      notAsDescribed: 'CLAIM_UPHELD',
      horizon: 'UNVERIFIED',
    });
    const horizon = await sql(`SELECT validity::text AS v FROM core.handoff_scan WHERE order_id = $1`, [O.horizon]);
    expect(horizon.rows[0].v).toBe('REJECTED_HORIZON');

    const moduleRef = await Test.createTestingModule({ imports: [Wo007aAppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await restorePaymentOwner();
    const sellers = `'${SELLER.a}','${SELLER.b}','${SELLER.c}'`;
    const c: PoolClient = await admin.connect();
    try {
      await c.query('SET session_replication_role = replica');
      for (const q of [
        `DELETE FROM analytics.event WHERE market_id IN ('${MA}','${MC}')`,
        `DELETE FROM core.review_item_rating WHERE product_id = '${PRODUCT}'`,
        `DELETE FROM core.review WHERE seller_id IN (${sellers})`,
        `DELETE FROM core.claim_evidence_item WHERE claim_id IN (SELECT id FROM core.claim WHERE order_id::text LIKE '0e07a000-%')`,
        `DELETE FROM core.claim WHERE order_id::text LIKE '0e07a000-%'`,
        `DELETE FROM core.order_confirmation WHERE order_id::text LIKE '0e07a000-%'`,
        `DELETE FROM core.handoff_scan WHERE order_id::text LIKE '0e07a000-%'`,
        `DELETE FROM core.order_qr_token WHERE order_id::text LIKE '0e07a000-%'`,
        `DELETE FROM core.courier_custody_transfer WHERE order_id::text LIKE '0e07a000-%'`,
        `DELETE FROM core.payment_submission WHERE order_id::text LIKE '0e07a000-%'`,
        `DELETE FROM core.order_state_transition WHERE order_id::text LIKE '0e07a000-%'`,
        `DELETE FROM core.seller_team_member WHERE seller_id IN (${sellers})`,
        `DELETE FROM core."order" WHERE seller_id IN (${sellers})`,
        `DELETE FROM core.product WHERE seller_id IN (${sellers})`,
        `DELETE FROM core.seller_level_state WHERE seller_id IN (${sellers})`,
        `DELETE FROM core.seller_public_stats WHERE seller_id IN (${sellers})`,
        `DELETE FROM core.seller WHERE id IN (${sellers})`,
        `DELETE FROM core.device WHERE id = '${DEV}'`,
        `DELETE FROM core.account WHERE id::text LIKE '0e07a000-%'`,
        `DELETE FROM core.timing_config WHERE market_id IN ('${MA}','${MC}')`,
        `DELETE FROM core.market WHERE id IN ('${MA}','${MC}')`,
      ]) {
        await c.query(q);
      }
    } finally {
      await c.query('SET session_replication_role = DEFAULT');
      c.release();
    }
    await admin.end();
  });

  describe('as built: no verified payment exists, so no Review is public (fail closed)', () => {
    it('the list is one empty, final page although 19 reviews are stored, some with receipt and upheld-claim badges', async () => {
      for (const limit of [1, 25, 50]) {
        const r = await get(`/v1/storefronts/review-store/reviews?limit=${limit}`).expect(200);
        expect(r.headers['cache-control']).toBe('no-store');
        expect(r.body).toEqual({ data: [], next_cursor: null });
      }
      const stored = await sql(`SELECT count(*)::int AS n FROM core.review WHERE seller_id = $1`, [SELLER.a]);
      expect(stored.rows[0].n).toBe(19);
    });

    it('the summary agrees: count 0, no average, no basis counts -- never a perfect score', async () => {
      expect(await summary('review-store')).toEqual({
        count: 0,
        average_rating: null,
        basis_counts: { FINAL_HANDOFF: 0, VERIFIED_ORDER_FAILURE: 0 },
      });
      expect(await summary('other-store')).toEqual({
        count: 0,
        average_rating: null,
        basis_counts: { FINAL_HANDOFF: 0, VERIFIED_ORDER_FAILURE: 0 },
      });
    });

    it('the payment interface answers false and the planner folds the view to nothing', async () => {
      const v = await sql(`SELECT core.fn_order_payment_verified($1) AS v`, [O.fh1]);
      expect(v.rows[0].v).toBe(false);
      const plan = await sql(`EXPLAIN SELECT * FROM core.v_review_public WHERE seller_id = $1`, [SELLER.a]);
      expect(plan.rows.map((r: { 'QUERY PLAN': string }) => r['QUERY PLAN']).join('\n')).toContain('One-Time Filter: false');
    });
  });

  describe('with a payment owner (stands in for WO-PAY-001, this file\'s Orders only)', () => {
    beforeAll(() => paymentOwner(PAID));
    afterAll(() => restorePaymentOwner());

    const eligible = ['receiptAndClaim', 'revokedTeam', 'refundUnpaid', 'overturn', 'fh2', 'fh3', 'failure', 'fh1'];

    it('lists exactly the reviews with a current evidence basis, newest first, labelled truthfully', async () => {
      const r = await get('/v1/storefronts/review-store/reviews').expect(200);
      const byId = new Map(Object.entries(reviewOf).map(([k, v]) => [v, k]));
      const keys = r.body.data.map((x: { id: string }) => byId.get(x.id));
      // fh2 and fh3 share published_at: the id tiebreak orders them, either way round.
      expect(new Set(keys)).toEqual(new Set(eligible));
      expect(keys.slice(0, 4)).toEqual(['receiptAndClaim', 'revokedTeam', 'refundUnpaid', 'overturn']);
      expect(keys[keys.length - 1]).toBe('fh1');
      const basis = Object.fromEntries(r.body.data.map((x: { id: string; evidence_basis: string }) => [byId.get(x.id), x.evidence_basis]));
      expect(basis).toEqual({
        fh1: 'FINAL_HANDOFF',
        fh2: 'FINAL_HANDOFF',
        fh3: 'FINAL_HANDOFF',
        failure: 'VERIFIED_ORDER_FAILURE',
        overturn: 'VERIFIED_ORDER_FAILURE',
        refundUnpaid: 'VERIFIED_ORDER_FAILURE',
        revokedTeam: 'FINAL_HANDOFF',
        // A receipt and an upheld non-delivery Claim on one Order: the receipt-based container stays.
        receiptAndClaim: 'FINAL_HANDOFF',
      });
      expect(r.body.next_cursor).toBeNull();
    });

    it('excludes every case without a complete basis, a rejected scan, and self or live-team reviews (cases 1-3, 6, 7, 12, 13)', async () => {
      const r = await get('/v1/storefronts/review-store/reviews').expect(200);
      const listed = new Set(r.body.data.map((x: { id: string }) => x.id));
      for (const key of ['noPay', 'payOnly', 'pickup', 'openClaim', 'rejected', 'notAsDescribed', 'unverified', 'confirmedByBuyer', 'self', 'mismatch', 'liveTeam', 'horizon']) {
        expect([key, listed.has(reviewOf[key])]).toEqual([key, false]);
      }
    });

    it('a review naming another Seller than its Order is public for neither (case 10)', async () => {
      const r = await get('/v1/storefronts/other-store/reviews').expect(200);
      expect(r.body).toEqual({ data: [], next_cursor: null });
      expect((await summary('other-store')).count).toBe(0);
    });

    it('the database refuses a Buyer mismatch outright (case 11)', async () => {
      await expect(
        sql(`INSERT INTO core.handoff_scan (order_id, scanned_by_account_id, nonce, signed_at) VALUES ($1,$2,$3, now())`, [O.fh1, BUYER.two, randomUUID()]),
      ).rejects.toMatchObject({ code: '23503', constraint: 'handoff_scanned_by_buyer' });
      const spare = order(99);
      await newOrder(spare, SELLER.a, BUYER.one);
      await expect(
        sql(`INSERT INTO core.review (order_id, buyer_account_id, seller_id, seller_rating, badge) VALUES ($1,$2,$3,5,'UNVERIFIED')`, [spare, BUYER.two, SELLER.a]),
      ).rejects.toMatchObject({ code: '23503', constraint: 'review_by_order_buyer' });
    });

    it('pages one review at a time across excluded rows and the tie: no gap, no repeat, no empty page (case 16)', async () => {
      const pages = await walk('review-store', 1);
      expect(pages.every((p) => p.length === 1)).toBe(true);
      const ids = pages.flat().map((x) => x.id);
      expect(ids).toHaveLength(eligible.length);
      expect(new Set(ids).size).toBe(eligible.length);
      expect(new Set(ids)).toEqual(new Set(eligible.map((k) => reviewOf[k])));
      const tied = await sql(`SELECT count(DISTINCT published_at)::int AS n FROM core.review WHERE id = ANY($1)`, [[reviewOf['fh2'], reviewOf['fh3']]]);
      expect(tied.rows[0].n).toBe(1);
    });

    it('the summary counts and averages exactly the listed population, by basis (cases 19, 20)', async () => {
      const listed = (await walk('review-store', 2)).flat();
      const s = await summary('review-store');
      expect(s.count).toBe(listed.length);
      // 5 + 4 + 3 + 4 + 4 + 3 + 2 + 5 = 30 over 8 = 3.75, rounded once to 3.8. Every stored review
      // would make it 49 / 19 = 2.6, as the pre-WO-007A summary did.
      const mean = listed.reduce((a, x) => a + x.seller_rating, 0) / listed.length;
      expect(s.average_rating).toBe(Math.round(mean * 10) / 10);
      expect(s.average_rating).toBe(3.8);
      expect(s.basis_counts).toEqual({ FINAL_HANDOFF: 5, VERIFIED_ORDER_FAILURE: 3 });
    });

    it('an overturned Claim leaves the list and the aggregate together (case 9)', async () => {
      await sql(`UPDATE core.claim SET outcome = 'NOT_UPHELD' WHERE order_id = $1`, [O.overturn]);
      try {
        const ids = (await walk('review-store', 50)).flat().map((x) => x.id);
        expect(ids).not.toContain(reviewOf['overturn']);
        const s = await summary('review-store');
        expect(s.count).toBe(ids.length);
        expect(s.count).toBe(7);
        expect(s.basis_counts).toEqual({ FINAL_HANDOFF: 5, VERIFIED_ORDER_FAILURE: 2 });
        expect(s.average_rating).toBe(3.7); // 26 / 7
      } finally {
        await sql(`UPDATE core.claim SET outcome = 'UPHELD' WHERE order_id = $1`, [O.overturn]);
      }
      expect((await summary('review-store')).count).toBe(8);
    });

    it('a public review carries only Seller-service fields: no buyer, order, claim, badge or item rating', async () => {
      const r = await get('/v1/storefronts/review-store/reviews').expect(200);
      for (const item of r.body.data) {
        expect(Object.keys(item).sort()).toEqual(['body', 'evidence_basis', 'id', 'published_at', 'seller_rating']);
      }
    });

    it('a Seller with no eligible review has count 0 and no average, and its list is empty (case 17)', async () => {
      expect(await summary('other-store')).toEqual({
        count: 0,
        average_rating: null,
        basis_counts: { FINAL_HANDOFF: 0, VERIFIED_ORDER_FAILURE: 0 },
      });
    });
  });

  describe("a Market's currency is fixed once it has Products (ON-009, 0059)", () => {
    const currency = async (m: string) => (await sql(`SELECT display_currency AS c FROM core.market WHERE id = $1`, [m])).rows[0].c;
    const productIn = (m: string, seller: string, cur: string, c: Pool | PoolClient = admin) =>
      c.query(
        `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility)
         VALUES ($1,$2,$3,'Race product',1,$4,'DRAFT')`,
        [randomUUID(), seller, m, cur],
      );
    /** Until the session is waiting on a lock: the race is real, not a timing guess. */
    const blocked = async (c: PoolClient) => {
      const pid = (await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
      return async () => {
        for (let i = 0; i < 100; i++) {
          const w = await sql(`SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1`, [pid]);
          if (w.rows[0]?.wait_event_type === 'Lock') return;
          await new Promise((r) => setTimeout(r, 50));
        }
        throw new Error('the second session never waited on the lock');
      };
    };
    const done = async (...clients: PoolClient[]) => {
      for (const c of clients) {
        await c.query('ROLLBACK').catch(() => undefined);
        c.release();
      }
    };
    afterEach(async () => {
      await sql(`DELETE FROM core.product WHERE seller_id = $1`, [SELLER.c]);
      await sql(`UPDATE core.market SET display_currency = 'ETB' WHERE id = $1 AND display_currency <> 'ETB'`, [MC]);
    });

    it('refuses the change for a Market with Products; the currency and prices stay as they were', async () => {
      await expect(sql(`UPDATE core.market SET display_currency = 'USD' WHERE id = $1`, [MA])).rejects.toMatchObject({
        code: '23514',
        constraint: 'market_currency_fixed_with_products',
      });
      expect(await currency(MA)).toBe('ETB');
      // A non-currency update of the same Market is untouched by the rule.
      await sql(`UPDATE core.market SET display_name = display_name WHERE id = $1`, [MA]);
    });

    it('allows the change while the Market has no Product (initial setup)', async () => {
      await sql(`UPDATE core.market SET display_currency = 'USD' WHERE id = $1`, [MC]);
      expect(await currency(MC)).toBe('USD');
    });

    it('a currency change racing an in-flight first Product waits for it, then refuses', async () => {
      const writer = await admin.connect();
      const changer = await admin.connect();
      try {
        const changerWaits = await blocked(changer);
        await writer.query('BEGIN');
        await productIn(MC, SELLER.c, 'ETB', writer);
        const change = changer.query(`UPDATE core.market SET display_currency = 'USD' WHERE id = $1`, [MC]).then(
          () => 'changed',
          (e: { constraint?: string }) => e.constraint,
        );
        await changerWaits();
        await writer.query('COMMIT');
        expect(await change).toBe('market_currency_fixed_with_products');
        expect(await currency(MC)).toBe('ETB');
      } finally {
        await done(writer, changer);
      }
    });

    it('a first Product racing an in-flight currency change waits for it, then is held to the new currency', async () => {
      const writer = await admin.connect();
      const changer = await admin.connect();
      try {
        const writerWaits = await blocked(writer);
        await changer.query('BEGIN');
        await changer.query(`UPDATE core.market SET display_currency = 'USD' WHERE id = $1`, [MC]);
        const insert = productIn(MC, SELLER.c, 'ETB', writer).then(
          () => 'inserted',
          (e: { constraint?: string }) => e.constraint,
        );
        await writerWaits();
        await changer.query('COMMIT');
        expect(await insert).toBe('product_seed_in_market_currency');
        expect(await currency(MC)).toBe('USD');
      } finally {
        await done(writer, changer);
      }
    });

    it('two currency changes queue behind each other instead of deadlocking', async () => {
      await sql(`INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                          default_locale, activation_state, otp_enabled, sms_primary_provider)
                 VALUES ($1,'V7D','Second empty Market','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`, [id(3)]);
      const first = await admin.connect();
      const second = await admin.connect();
      try {
        const secondWaits = await blocked(second);
        await first.query('BEGIN');
        await first.query(`UPDATE core.market SET display_currency = 'USD' WHERE id = $1`, [MC]);
        const other = second.query(`UPDATE core.market SET display_currency = 'USD' WHERE id = $1`, [id(3)]).then(
          () => 'changed',
          (e: { code?: string }) => e.code,
        );
        await secondWaits();
        await first.query('COMMIT');
        expect(await other).toBe('changed');
      } finally {
        await done(first, second);
        await sql(`DELETE FROM core.market WHERE id = $1`, [id(3)]);
      }
    });
  });
});
