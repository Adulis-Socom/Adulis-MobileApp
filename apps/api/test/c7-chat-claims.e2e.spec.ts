import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { expectConforms } from './contract-support';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * C7 — chat (12.7) and seller review reads (12.11, S12): R10's defaultless
 * scope, the cascade's implementable layers with escalation as a
 * notification, and reviews whose badge nobody sends.
 *
 * Claims and review creation were retired with the Reservation model
 * (migration 0063): every /v1/claims* and /v1/seller/claims* route and
 * POST /v1/orders/{id}/review are gone, and this file pins that they 404.
 * The one review the seller reads is an inert historical row on an inert
 * order, inserted directly -- no function creates either any more.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = 'dddd7777-3333-4000-8000-000000000001';
const OWNER = 'dddd7777-3333-4000-8000-000000000002';
const BUYER = 'dddd7777-3333-4000-8000-000000000003';
const STRANGER = 'dddd7777-3333-4000-8000-000000000004';
const OWNER2 = 'dddd7777-3333-4000-8000-000000000005';
const DEVICE = 'dddd7777-3333-4000-8000-000000000006';
const SELLER = 'dddd7777-3333-4000-8000-000000000007';
const SELLER2 = 'dddd7777-3333-4000-8000-000000000008';
const PRODUCT = 'dddd7777-3333-4000-8000-000000000009';
// D-66 (T7): anchors moved to the MESSAGE and opens are anchorless again,
// so this second seller's product is no longer anchored anywhere in this
// file. It stays as SELLER2's one catalogue row (the entitlement tests talk
// to a store that plausibly sells something); the per-message anchor and
// mismatch probes live in t7-rulings.spec.ts.
const PRODUCT2 = 'dddd7777-3333-4000-8000-00000000000f';
const VARIANT = 'dddd7777-3333-4000-8000-00000000000a';
const OWNER_S = 'dddd7777-3333-4000-8000-00000000000b';
const OWNER_MOB_S = 'dddd7777-3333-4000-8000-00000000000c';
const BUYER_S = 'dddd7777-3333-4000-8000-00000000000d';
const STRANGER_S = 'dddd7777-3333-4000-8000-00000000000e';
const OWNER2_S = 'dddd7777-3333-4000-8000-00000000000f';
const INTENT_PLAIN = 'dddd7777-3333-4000-8000-000000000010';
const INTENT_SLOTTED = 'dddd7777-3333-4000-8000-000000000011';
const ORDER = 'dddd7777-3333-4000-8000-000000000012'; // inert, COMPLETED

const P = {
  owner: '+251911551701',
  buyer: '+251911551702',
  stranger: '+251911551703',
  owner2: '+251911551704',
};

@Module({ imports: [AppModule] })
class C7AppModule {}

describe('C7 — chat, claims, reviews', () => {
  let app: INestApplication;
  let admin: Pool;
  let conversationId = '';

  const key = () => randomUUID();
  const http = () => request(app.getHttpServer());
  const cookie = (t: string) => `__Host-adulis_session=${sessionToken(t)}`;
  const buyerReq = (method: 'post' | 'get', path: string, token = BUYER_S) => {
    const r = http()[method](path)
      .set('Authorization', `Bearer ${sessionToken(token)}`)
      .set('X-Adulis-Device', DEVICE);
    if (method === 'post') r.set('Idempotency-Key', key());
    return r;
  };
  const sellerReq = (method: 'post' | 'get', path: string, token = OWNER_S, seller = SELLER) => {
    const r = http()[method](path)
      .set('Cookie', cookie(token))
      .set('X-Adulis-Seller', seller);
    if (method !== 'get') r.set('Origin', CONSOLE_ORIGIN);
    if (method === 'post') r.set('Idempotency-Key', key());
    return r;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'C7E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.timing_config (id, market_id, payment_confirmation_window, fulfilment_window, offline_sync_horizon,
         payout_activation_delay, recovery_cooling_period,
         deleted_number_cooling_period, refund_ack_window, media_retention,
         level_credit_grace, mobile_session_lifetime, console_session_lifetime,
         console_idle_timeout, console_remembered_lifetime,
         console_remembered_idle, otp_ttl, otp_max_attempts, step_up_freshness,
         new_device_payout_lock, same_seller_cancellation_threshold,
         same_seller_cooldown, cross_seller_cooldown_ladder,
         cancellation_counter_decay)
       VALUES (gen_random_uuid(), $1,'24 hours','72 hours','7 days',
         '24 hours','7 days','30 days','48 hours','90 days','24 hours',
         '30 days','12 hours','30 minutes','7 days','8 hours','5 minutes',5,
         '5 minutes','24 hours',3,'1 hour',
         ARRAY['1 day','2 days','4 days']::interval[],'30 days')`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.ladder_config (id, market_id, established_min_handoffs,
         established_window, established_min_avg_rating, established_max_claim_rate,
         trusted_min_handoffs, trusted_window, trusted_min_scan_completion_rate,
         trusted_max_claim_rate, demotion_max_claim_rate,
         demotion_max_cancellation_rate, demotion_min_scan_completion_rate,
         demotion_window, new_level_product_cap, new_level_transaction_cap_minor,
         distinct_buyer_window, distinct_buyer_max_count)
       VALUES (gen_random_uuid(), $1, 25,'90 days',4.0,0.02,100,'180 days',0.9,
         0.01,0.05,0.25,0.5,'60 days',10,50000000,'30 days',5)`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'${P.owner}',$5,'ACTIVE'), ($2,'${P.buyer}',$5,'ACTIVE'),
        ($3,'${P.stranger}',$5,'ACTIVE'), ($4,'${P.owner2}',$5,'ACTIVE')`,
      [OWNER, BUYER, STRANGER, OWNER2, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status) VALUES
        ($1,$3,$4,'INDIVIDUAL','C7 Store','c7-store','ACTIVE'),
        ($2,$3,$5,'INDIVIDUAL','C7 Quiet','c7-quiet','ACTIVE')`,
      [SELLER, SELLER2, M, OWNER, OWNER2],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility)
       VALUES ($1,$2,$3,'Lamp',30000,'ETB','PUBLISHED')`,
      [PRODUCT, SELLER, M],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility)
       VALUES ($1,$2,$3,'Lamp',30000,'ETB','PUBLISHED')`,
      [PRODUCT2, SELLER2, M],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key)
       VALUES ($1,$2,$3,30000,'ETB','brass')`,
      [VARIANT, PRODUCT, SELLER],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(),$1,$2,10,'SELLER_SET')`,
      [VARIANT, SELLER],
    );
    // The historical review the seller reads: an inert COMPLETED order and
    // its review, badge derived by the trigger (the caller's value is ignored).
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state,
         expires_at, clock_stopped_at, total_minor, total_currency, display_currency)
       VALUES ($1,$2,$3,$4,'COMPLETED', now(), now(), 30000,'ETB','ETB')`,
      [ORDER, M, SELLER, BUYER],
    );
    const review = await admin.query<{ id: string }>(
      `INSERT INTO core.review (order_id, buyer_account_id, seller_id, seller_rating, body, badge)
       VALUES ($1,$2,$3,4,'Quick handoff.','CLAIM_UPHELD') RETURNING id`,
      [ORDER, BUYER, SELLER],
    );
    await admin.query(
      `INSERT INTO core.review_item_rating (review_id, product_id, rating) VALUES ($1,$2,5)`,
      [review.rows[0]?.id, PRODUCT],
    );
    // BETA subscription: chatbot on all products (the seeded BETA tier row).
    await admin.query(
      `INSERT INTO billing.subscription (seller_id, state, beta_started_at)
       VALUES ($1,'BETA', now())`,
      [SELLER],
    );
    // The intent library: one answerable intent, one whose template needs
    // slots this surface cannot fill.
    await admin.query(
      `INSERT INTO nlu.intent (id, code, description) VALUES
        ($1,'DELIVERY_OFFERED','Does the seller deliver'),
        ($2,'ITEM_PRICE','What does it cost')`,
      [INTENT_PLAIN, INTENT_SLOTTED],
    );
    await admin.query(
      `INSERT INTO nlu.intent_phrase (intent_id, locale, text, source) VALUES
        ($1,'en','do you deliver','SEED'),
        ($2,'en','how much is it','SEED')`,
      [INTENT_PLAIN, INTENT_SLOTTED],
    );
    await admin.query(
      `INSERT INTO nlu.answer_template (intent_id, locale, seller_id, template, slots) VALUES
        ($1,'en',NULL,'chat.answer.delivery_offered','{}'),
        ($2,'en',NULL,'chat.answer.item_price','{price}')`,
      [INTENT_PLAIN, INTENT_SLOTTED],
    );

    await admin.query(`SET session_replication_role = replica`);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$6,'CONSOLE',NULL, now()+interval '12 hours'),
        ($2,$6,'MOBILE',$10, now()+interval '30 days'),
        ($3,$7,'MOBILE',$10, now()+interval '30 days'),
        ($4,$8,'MOBILE',$10, now()+interval '30 days'),
        ($5,$9,'CONSOLE',NULL, now()+interval '12 hours')`,
      [OWNER_S, OWNER_MOB_S, BUYER_S, STRANGER_S, OWNER2_S, OWNER, BUYER, STRANGER, OWNER2, DEVICE],
    );
    await armFixtureSessions(admin, [OWNER_S, OWNER_MOB_S, BUYER_S, STRANGER_S, OWNER2_S]);
    await admin.query(`SET session_replication_role = DEFAULT`);

    const moduleRef = await Test.createTestingModule({ imports: [C7AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM chat.bot_turn WHERE message_id IN (SELECT id FROM chat.message WHERE conversation_id IN (SELECT id FROM chat.conversation WHERE market_id='${M}'))`,
      `DELETE FROM chat.message WHERE conversation_id IN (SELECT id FROM chat.conversation WHERE market_id='${M}')`,
      `DELETE FROM chat.conversation WHERE market_id='${M}'`,
      `DELETE FROM nlu.answer_template WHERE intent_id IN ('${INTENT_PLAIN}','${INTENT_SLOTTED}')`,
      `DELETE FROM nlu.intent_phrase WHERE intent_id IN ('${INTENT_PLAIN}','${INTENT_SLOTTED}')`,
      `DELETE FROM nlu.intent WHERE id IN ('${INTENT_PLAIN}','${INTENT_SLOTTED}')`,
      `DELETE FROM core.review_item_rating WHERE review_id IN (SELECT id FROM core.review WHERE seller_id IN ('${SELLER}','${SELLER2}'))`,
      `DELETE FROM core.review WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.claim_evidence_item WHERE claim_id IN (SELECT id FROM core.claim WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}'))`,
      `DELETE FROM core.claim WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.stock_event WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.buyer_cancellation_counter WHERE buyer_account_id='${BUYER}'`,
      `DELETE FROM core.order_payout_snapshot WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${BUYER}','${OWNER2}')`,
      `DELETE FROM core."order" WHERE market_id='${M}'`,
      `DELETE FROM core.cart_line WHERE cart_id IN (SELECT id FROM core.cart WHERE seller_id IN ('${SELLER}','${SELLER2}'))`,
      `DELETE FROM core.cart WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.payout_change_log WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.payout_details WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM billing.subscription_state_transition WHERE subscription_id IN (SELECT id FROM billing.subscription WHERE seller_id IN ('${SELLER}','${SELLER2}'))`,
      `DELETE FROM billing.subscription WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.product_variant WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.product WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.seller_eligibility_evaluation WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller WHERE market_id='${M}'`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER}','${BUYER}','${STRANGER}','${OWNER2}')`,
      `DELETE FROM core.idempotency_record WHERE actor_id::text LIKE 'dddd7777%' OR actor_id IN ('${OWNER}','${BUYER}','${STRANGER}','${OWNER2}')`,
      `DELETE FROM core.buyer_profile WHERE account_id IN ('${OWNER}','${BUYER}','${STRANGER}','${OWNER2}')`,
      `DELETE FROM core.device WHERE id='${DEVICE}'`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.ladder_config WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
    await app.close();
  });

  describe('chat (12.7, S15)', () => {
    it('the scope parameter has NO default (R10): absent -> 400, mismatched seller -> 400', async () => {
      const bare = await buyerReq('get', '/v1/conversations').expect(400);
      expect(bare.body.code).toBe('SCOPE_PARAMETER_REQUIRED');
      const mismatch = await sellerReq('get', `/v1/conversations?as=seller&seller_id=${SELLER2}`).expect(400);
      expect(mismatch.body.code).toBe('SCOPE_PARAMETER_REQUIRED');
    });

    it('one conversation per pair: open twice, same id both times', async () => {
      const a = await buyerReq('post', '/v1/conversations')
        .send({ seller_id: SELLER })
        .expect(201);
      expectConforms(a, 'post', '/v1/conversations', true);
      conversationId = a.body.conversation_id;
      const b = await buyerReq('post', '/v1/conversations')
        .send({ seller_id: SELLER })
        .expect(201);
      expect(b.body.conversation_id).toBe(conversationId);
    });

    it('an unmatched question ESCALATES: bot message is a key, delivery is a notification', async () => {
      const r = await buyerReq('post', `/v1/conversations/${conversationId}/messages`)
        .send({ text: 'can you engrave initials on the lamp' })
        .expect(201);
      expectConforms(r, 'post', '/v1/conversations/{id}/messages', true);
      expect(r.body.bot.resolution_path).toBe('ESCALATED');
      const bot = await admin.query(
        `SELECT m.body, bt.escalated FROM chat.message m
          JOIN chat.bot_turn bt ON bt.message_id = m.id
         WHERE m.conversation_id=$1 AND m.sender_kind='BOT'
         ORDER BY m.sent_at DESC LIMIT 1`,
        [conversationId],
      );
      expect(bot.rows[0]).toMatchObject({ body: 'chat.bot.escalated', escalated: true });
      const notice = await admin.query(
        `SELECT count(*)::int AS n FROM core.notification
          WHERE recipient_account_id=$1 AND template_key='notification.chat.escalated'`,
        [OWNER],
      );
      expect(notice.rows[0].n).toBeGreaterThan(0);
    });

    it('a chip answers from its template (layer 1); a keyword match answers (layer 2)', async () => {
      const chip = await buyerReq('post', `/v1/conversations/${conversationId}/messages`)
        .send({ chip_id: INTENT_PLAIN })
        .expect(201);
      expectConforms(chip, 'post', '/v1/conversations/{id}/messages', true);
      expect(chip.body.bot).toMatchObject({
        resolution_path: 'CHIP',
        template_key: 'chat.answer.delivery_offered',
      });
      const kw = await buyerReq('post', `/v1/conversations/${conversationId}/messages`)
        .send({ text: 'Do You Deliver' })
        .expect(201);
      expectConforms(kw, 'post', '/v1/conversations/{id}/messages', true);
      expect(kw.body.bot.resolution_path).toBe('KEYWORD');
    });

    it('a template with unfillable slots escalates rather than replying with holes', async () => {
      const r = await buyerReq('post', `/v1/conversations/${conversationId}/messages`)
        .send({ text: 'how much is it' })
        .expect(201);
      expect(r.body.bot.resolution_path).toBe('ESCALATED');
    });

    it('no chatbot entitlement: the message lands, the bot stays silent, humans are free', async () => {
      const open = await buyerReq('post', '/v1/conversations')
        .send({ seller_id: SELLER2 })
        .expect(201);
      const r = await buyerReq('post', `/v1/conversations/${open.body.conversation_id}/messages`)
        .send({ text: 'do you deliver' })
        .expect(201);
      expectConforms(r, 'post', '/v1/conversations/{id}/messages', true);
      expect(r.body.bot).toBeNull();
    });

    it('the seller reads and replies through the seller scope; a stranger sees nothing', async () => {
      const list = await sellerReq('get', `/v1/conversations?as=seller&seller_id=${SELLER}`).expect(200);
      expectConforms(list, 'get', '/v1/conversations', true);
      expect(list.body.data.length).toBeGreaterThan(0);
      const mine = await buyerReq('get', '/v1/conversations?as=buyer').expect(200);
      expectConforms(mine, 'get', '/v1/conversations', true);
      expect(mine.body.data.length).toBeGreaterThan(0);
      await sellerReq('post', `/v1/conversations/${conversationId}/messages`)
        .send({ text: 'Yes, we can engrave initials.' })
        .expect(201);
      const messages = await buyerReq('get', `/v1/conversations/${conversationId}/messages`).expect(200);
      expectConforms(messages, 'get', '/v1/conversations/{id}/messages', true);
      const kinds = messages.body.data.map((m: { sender_kind: string }) => m.sender_kind);
      expect(kinds).toContain('SELLER');
      const bot = messages.body.data.find((m: { sender_kind: string }) => m.sender_kind === 'BOT');
      expect(bot.template_key).toBeTruthy();
      expect(bot.body).toBeUndefined();

      const stranger = await buyerReq('get', `/v1/conversations/${conversationId}/messages`, STRANGER_S).expect(404);
      expect(stranger.body.code).toBe('NOT_FOUND');
    });

    it('explicit escalation is free and needs no failed cascade first', async () => {
      const r = await buyerReq('post', `/v1/conversations/${conversationId}/escalate`).expect(200);
      expectConforms(r, 'post', '/v1/conversations/{id}/escalate', true);
      expect(r.body.escalated).toBe(true);
    });
  });

  describe('retired: claims and review creation (migration 0063)', () => {
    const CLAIM = randomUUID();
    it.each([
      ['buyer', 'get', '/v1/claims'],
      ['buyer', 'post', '/v1/claims'],
      ['buyer', 'get', `/v1/claims/${CLAIM}`],
      ['buyer', 'post', `/v1/claims/${CLAIM}/evidence`],
      ['buyer', 'post', `/v1/claims/${CLAIM}/evidence-export`],
      ['buyer', 'post', `/v1/orders/${ORDER}/review`],
      ['seller', 'get', '/v1/seller/claims'],
      ['seller', 'post', `/v1/seller/claims/${CLAIM}/remedy`],
    ] as const)('%s %s %s is 404 and writes nothing', async (who, method, path) => {
      const r = who === 'buyer' ? buyerReq(method, path) : sellerReq(method, path);
      const res = await (method === 'post'
        ? r.send({ order_id: ORDER, trigger: 'GOODS_NOT_RECEIVED', seller_rating: 5, remedy: 'REFUND' })
        : r);
      expect(res.status).toBe(404);
      const written = await admin.query(
        `SELECT (SELECT count(*) FROM core.claim WHERE order_id = $1)::int AS claims,
                (SELECT count(*) FROM core.review WHERE seller_id = $2)::int AS reviews,
                (SELECT count(*) FROM core."order" WHERE market_id = $3)::int AS orders,
                (SELECT count(*) FROM core.stock_event WHERE seller_id = $2)::int AS stock_events`,
        [ORDER, SELLER, M],
      );
      expect(written.rows[0]).toEqual({ claims: 0, reviews: 1, orders: 1, stock_events: 1 });
    });
  });

  describe('reviews (S12)', () => {
    it('the seller reads reviews with badges and item ratings, and can write nothing', async () => {
      const r = await sellerReq('get', '/v1/seller/reviews').expect(200);
      const review = r.body.data[0];
      // The fixture sent CLAIM_UPHELD; the trigger derived the badge from evidence, of which there is none.
      expect(review).toMatchObject({ seller_rating: 4, badge: 'UNVERIFIED' });
      expect(review.item_ratings).toHaveLength(1);
    });
  });
});
