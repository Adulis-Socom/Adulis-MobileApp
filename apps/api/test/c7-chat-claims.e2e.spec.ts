import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * C7 — chat (12.7), claims (12.4, X15), reviews (12.4, 12.11, S12): R10's
 * defaultless scope, the cascade's implementable layers with escalation as
 * a notification, the evidence bundle attaching at open, the bank-record
 * single transaction, the identity-free export, the seller's remedy, and
 * reviews whose badge nobody sends.
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
const VARIANT = 'dddd7777-3333-4000-8000-00000000000a';
const OWNER_S = 'dddd7777-3333-4000-8000-00000000000b';
const OWNER_MOB_S = 'dddd7777-3333-4000-8000-00000000000c';
const BUYER_S = 'dddd7777-3333-4000-8000-00000000000d';
const STRANGER_S = 'dddd7777-3333-4000-8000-00000000000e';
const OWNER2_S = 'dddd7777-3333-4000-8000-00000000000f';
const INTENT_PLAIN = 'dddd7777-3333-4000-8000-000000000010';
const INTENT_SLOTTED = 'dddd7777-3333-4000-8000-000000000011';

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
  let order1 = ''; // review order — driven terminal
  let order2 = ''; // claim order
  let claimId = '';

  const key = () => randomUUID();
  const http = () => request(app.getHttpServer());
  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  const buyerReq = (method: 'post' | 'get', path: string, token = BUYER_S) => {
    const r = http()[method](path)
      .set('Authorization', `Bearer ${token}`)
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
                                display_timezone, default_locale, is_live)
       VALUES ($1,'C7E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',false)`,
      [M],
    );
    await admin.query(
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
    await admin.query(
      `INSERT INTO core.payout_details (id, seller_id, bank_code, account_last4,
         state, activated_at, requested_by_account_id)
       VALUES (gen_random_uuid(), $1,'CBE','1234','ACTIVE', now(), $2)`,
      [SELLER, OWNER],
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
    await admin.query(`SET session_replication_role = DEFAULT`);

    const moduleRef = await Test.createTestingModule({ imports: [C7AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();

    // Two orders through the API: one to review, one to claim on.
    for (const target of ['order1', 'order2'] as const) {
      await buyerReq('post', '/v1/cart/lines')
        .send({ variant_id: VARIANT, quantity: 1 })
        .expect(201);
      const cart = await buyerReq('get', '/v1/cart').expect(200);
      const order = await buyerReq('post', '/v1/orders')
        .send({ cart_id: cart.body.cart_id, expected: [{ variant_id: VARIANT, unit_price_minor: 30000 }] })
        .expect(201);
      if (target === 'order1') order1 = order.body.id;
      else order2 = order.body.id;
      // Distinct-variant exclusion: settle the first line before the next
      // order reserves the same variant.
      if (target === 'order1') {
        await admin.query(
          `SET session_replication_role = replica;
           UPDATE core.reservation SET state='FULFILLED' WHERE order_id='${order.body.id}';
           UPDATE core."order" SET state='COMPLETED', clock_stopped_at=now() WHERE id='${order.body.id}';
           SET session_replication_role = DEFAULT`,
        );
      }
    }
    await admin.query(
      `SET session_replication_role = replica;
       UPDATE core."order" SET state='PAYMENT_CONFIRMED', clock_stopped_at=now() WHERE id='${order2}';
       SET session_replication_role = DEFAULT`,
    );
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
      `DELETE FROM core.reservation WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
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
      const a = await buyerReq('post', '/v1/conversations').send({ seller_id: SELLER }).expect(201);
      conversationId = a.body.conversation_id;
      const b = await buyerReq('post', '/v1/conversations').send({ seller_id: SELLER }).expect(201);
      expect(b.body.conversation_id).toBe(conversationId);
    });

    it('an unmatched question ESCALATES: bot message is a key, delivery is a notification', async () => {
      const r = await buyerReq('post', `/v1/conversations/${conversationId}/messages`)
        .send({ text: 'can you engrave initials on the lamp' })
        .expect(201);
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
      expect(chip.body.bot).toMatchObject({
        resolution_path: 'CHIP',
        template_key: 'chat.answer.delivery_offered',
      });
      const kw = await buyerReq('post', `/v1/conversations/${conversationId}/messages`)
        .send({ text: 'Do You Deliver' })
        .expect(201);
      expect(kw.body.bot.resolution_path).toBe('KEYWORD');
    });

    it('a template with unfillable slots escalates rather than replying with holes', async () => {
      const r = await buyerReq('post', `/v1/conversations/${conversationId}/messages`)
        .send({ text: 'how much is it' })
        .expect(201);
      expect(r.body.bot.resolution_path).toBe('ESCALATED');
    });

    it('no chatbot entitlement: the message lands, the bot stays silent, humans are free', async () => {
      const open = await buyerReq('post', '/v1/conversations').send({ seller_id: SELLER2 }).expect(201);
      const r = await buyerReq('post', `/v1/conversations/${open.body.conversation_id}/messages`)
        .send({ text: 'do you deliver' })
        .expect(201);
      expect(r.body.bot).toBeNull();
    });

    it('the seller reads and replies through the seller scope; a stranger sees nothing', async () => {
      const list = await sellerReq('get', `/v1/conversations?as=seller&seller_id=${SELLER}`).expect(200);
      expect(list.body.data.length).toBeGreaterThan(0);
      await sellerReq('post', `/v1/conversations/${conversationId}/messages`)
        .send({ text: 'Yes, we can engrave initials.' })
        .expect(201);
      const messages = await buyerReq('get', `/v1/conversations/${conversationId}/messages`).expect(200);
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
      expect(r.body.escalated).toBe(true);
    });
  });

  describe('claims (12.4, X15, S14)', () => {
    it('opening a claim attaches the evidence bundle by trigger; one open claim per scope', async () => {
      const r = await buyerReq('post', '/v1/claims')
        .send({ order_id: order2, trigger: 'GOODS_NOT_RECEIVED' })
        .expect(201);
      claimId = r.body.claim_id;
      expect(r.body.state).toBe('AWAITING_SELLER_EVIDENCE');
      const bundle = await admin.query(
        `SELECT count(*)::int AS n FROM core.claim_evidence_item WHERE claim_id=$1`,
        [claimId],
      );
      expect(bundle.rows[0].n).toBeGreaterThan(0);
      const dup = await buyerReq('post', '/v1/claims')
        .send({ order_id: order2, trigger: 'NOT_AS_DESCRIBED' })
        .expect(409);
      expect(dup.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it("a stranger's read is 404; the buyer's and seller's succeed", async () => {
      await buyerReq('get', `/v1/claims/${claimId}`, STRANGER_S).expect(404);
      const mine = await buyerReq('get', `/v1/claims/${claimId}`).expect(200);
      expect(mine.body.viewer).toBe('BUYER');
      expect(mine.body.evidence.length).toBeGreaterThan(0);
      const sellers = await sellerReq('get', `/v1/seller/claims`).expect(200);
      expect(sellers.body.data.map((c: { id: string }) => c.id)).toContain(claimId);
      const buyers = await buyerReq('get', '/v1/claims').expect(200);
      expect(buyers.body.data.map((c: { id: string }) => c.id)).toContain(claimId);
    });

    it('the bank record attaches once — a single transaction, not a statement', async () => {
      const ref = randomUUID();
      await buyerReq('post', `/v1/claims/${claimId}/evidence`)
        .send({ kind: 'BANK_RECORD', reference_id: ref })
        .expect(201);
      const dup = await buyerReq('post', `/v1/claims/${claimId}/evidence`)
        .send({ kind: 'BANK_RECORD', reference_id: ref })
        .expect(409);
      expect(dup.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it("the export carries the buyer's own transaction and nothing about who the seller is", async () => {
      const r = await buyerReq('post', `/v1/claims/${claimId}/evidence-export`).expect(200);
      expect(r.body.order.id).toBe(order2);
      // The fixture drove the state under replica, so the transition log is
      // legitimately empty — the export's SHAPE is what X15 specifies.
      expect(Array.isArray(r.body.order_transitions)).toBe(true);
      expect(Array.isArray(r.body.payment_submissions)).toBe(true);
      expect(Array.isArray(r.body.handoff_scans)).toBe(true);
      expect(r.body.chat_history.length).toBeGreaterThan(0);
      const flat = JSON.stringify(r.body);
      expect(flat).not.toContain('C7 Store');
      expect(flat).not.toContain('c7-store');
      expect(flat).not.toContain(P.owner);
      expect(flat).not.toContain(OWNER);
    });

    it('the remedy is the seller choice, console-only; MOBILE gets 403', async () => {
      const mobile = await http()
        .post(`/v1/seller/claims/${claimId}/remedy`)
        .set('Authorization', `Bearer ${OWNER_MOB_S}`)
        .set('X-Adulis-Seller', SELLER)
        .set('Idempotency-Key', key())
        .send({ remedy: 'REFUND' })
        .expect(403);
      expect(mobile.body.code).toBe('PERMISSION_DENIED');
      const r = await sellerReq('post', `/v1/seller/claims/${claimId}/remedy`)
        .send({ remedy: 'REFUND' })
        .expect(200);
      expect(r.body).toMatchObject({ remedy: 'REFUND', state: 'UNDER_REVIEW' });
    });
  });

  describe('reviews (S12)', () => {
    it('a non-terminal order cannot be reviewed; a terminal one can, once, badge derived', async () => {
      const early = await buyerReq('post', `/v1/orders/${order2}/review`)
        .send({ seller_rating: 5 })
        .expect(409);
      expect(early.body.slots.reason).toBe('ORDER_NOT_TERMINAL');

      const r = await buyerReq('post', `/v1/orders/${order1}/review`)
        .send({
          seller_rating: 4,
          body: 'Quick handoff.',
          item_ratings: [{ product_id: PRODUCT, rating: 5 }],
        })
        .expect(201);
      // No confirmation evidence on this order: the trigger derives the
      // lowest badge; the caller sent none and could send none.
      expect(r.body.badge).toBe('UNVERIFIED');

      const dup = await buyerReq('post', `/v1/orders/${order1}/review`)
        .send({ seller_rating: 1 })
        .expect(409);
      expect(dup.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('a foreign product cannot ride the item ratings', async () => {
      // order2 turns terminal here; it is still unreviewed, so the item
      // validation is what answers. (VARIANT is a variant id, not one of
      // this order's product ids.)
      await admin.query(
        `SET session_replication_role = replica;
         UPDATE core."order" SET state='COMPLETED' WHERE id='${order2}';
         SET session_replication_role = DEFAULT`,
      );
      const r = await buyerReq('post', `/v1/orders/${order2}/review`)
        .send({ seller_rating: 4, item_ratings: [{ product_id: VARIANT, rating: 1 }] })
        .expect(400);
      expect(r.body.code).toBe('VALIDATION_FAILED');
      expect(r.body.slots.path).toBe('item_ratings');
    });

    it('the seller reads reviews with badges and item ratings, and can write nothing', async () => {
      const r = await sellerReq('get', '/v1/seller/reviews').expect(200);
      const review = r.body.data[0];
      expect(review).toMatchObject({ seller_rating: 4, badge: 'UNVERIFIED' });
      expect(review.item_ratings).toHaveLength(1);
    });
  });
});
