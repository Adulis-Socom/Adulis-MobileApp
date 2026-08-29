import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * T7 Phase 1 -- the two rulings whose behavior is new surface area.
 *
 * D-66 (ADU-RUL-02 via T7 S3.1): the anchor moved from the conversation to
 * the MESSAGE. "A thread is a relationship; a question is about a thing.
 * Anchoring the thread anchored the wrong noun." The gate this file exists
 * for: a second product in one thread now resolves correctly -- each
 * message carries its OWN anchor, where the old shape silently inherited
 * the first product's.
 *
 * D-57 (via T7 S3.2): POST /v1/seller with type INDIVIDUAL creates
 * core.person and sets seller.person_id in the same transaction. "The row
 * is an anchor, not an identity claim" -- and one person per OWNER, because
 * S4.4 stores the hash once per person "referenced by each seller account"
 * and S6.1's one-phone-one-account makes the same account's declarations
 * the same natural person.
 *
 * (D-67's arms live in t6-courier-invite-oracle.spec.ts, beside the oracle
 * they must not reopen; D-64's asserts live in c6's deletion flow.)
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = randomUUID();
const OWNER = randomUUID();
const OWNER2 = randomUUID();
const BUYER = randomUUID();
const DEVICE = randomUUID();
const OWNER_S = randomUUID();
const BUYER_S = randomUUID();
const SELLER = randomUUID();
const SELLER2 = randomUUID();
const PRODUCT_A = randomUUID();
const PRODUCT_B = randomUUID();
const FOREIGN_PRODUCT = randomUUID();
const ORDER = randomUUID();

@Module({ imports: [AppModule] })
class T7AppModule {}

describe('T7 Phase 1 -- the message anchor and the person row', () => {
  let app: INestApplication;
  let admin: Pool;

  const http = () => request(app.getHttpServer());
  const cookie = (t: string) => `__Host-adulis_session=${t}`;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live)
       VALUES ($1,'T7A','Anchor','PHASE_1','ETB','Africa/Addis_Ababa','en',false)`,
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
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251919940001',$4,'ACTIVE'), ($2,'+251919940002',$4,'ACTIVE'),
        ($3,'+251919940003',$4,'ACTIVE')`,
      [OWNER, BUYER, OWNER2, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$3,'CONSOLE',$5, now() + interval '12 hours'),
        ($2,$4,'MOBILE',$5, now() + interval '12 hours')`,
      [OWNER_S, BUYER_S, OWNER, BUYER, DEVICE],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status) VALUES
        ($1,$3,$4,'INDIVIDUAL','Anchor Store','t7-anchor','ACTIVE'),
        ($2,$3,$5,'INDIVIDUAL','Foreign Store','t7-foreign','ACTIVE')`,
      [SELLER, SELLER2, M, OWNER, OWNER2],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility) VALUES
        ($1,$4,$5,'Product A',50000,'ETB','PUBLISHED'),
        ($2,$4,$5,'Product B',60000,'ETB','PUBLISHED'),
        ($3,$6,$5,'Foreign Product',70000,'ETB','PUBLISHED')`,
      [PRODUCT_A, PRODUCT_B, FOREIGN_PRODUCT, SELLER, M, SELLER2],
    );
    // An order for THIS pair, so the seller-side order anchor is testable.
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id,
         state, expires_at, total_minor, total_currency, display_currency)
       VALUES ($1,$2,$3,$4,'CREATED', now() + interval '2 days',
               50000,'ETB','ETB')`,
      [ORDER, M, SELLER, BUYER],
    );

    const moduleRef = await Test.createTestingModule({ imports: [T7AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [
      [OWNER, OWNER2, BUYER],
    ]);
    await admin.query(`DELETE FROM chat.bot_turn WHERE message_id IN
      (SELECT m.id FROM chat.message m JOIN chat.conversation c ON c.id = m.conversation_id
        WHERE c.market_id = $1)`, [M]);
    await admin.query(`DELETE FROM chat.message WHERE conversation_id IN
      (SELECT id FROM chat.conversation WHERE market_id = $1)`, [M]);
    await admin.query(`DELETE FROM chat.conversation WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.notification WHERE recipient_account_id = ANY($1::uuid[])`, [
      [OWNER, OWNER2],
    ]);
    await admin.query(`DELETE FROM core."order" WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.product WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.seller_level_state WHERE seller_id IN
      (SELECT id FROM core.seller WHERE market_id = $1)`, [M]);
    await admin.query(`DELETE FROM core.seller_eligibility_evaluation WHERE seller_id IN
      (SELECT id FROM core.seller WHERE market_id = $1)`, [M]);
    // Persons are never deleted in production (no DELETE grant exists), but
    // fixture persons would otherwise accumulate forever -- the c1 teardown
    // precedent: unhook, then remove, under replica.
    const persons = await admin.query(
      `SELECT DISTINCT person_id FROM core.seller
        WHERE market_id = $1 AND person_id IS NOT NULL`, [M]);
    await admin.query(`UPDATE core.seller SET person_id = NULL WHERE market_id = $1`, [M]);
    if (persons.rows.length > 0) {
      await admin.query(`DELETE FROM core.person WHERE id = ANY($1::uuid[])`, [
        persons.rows.map((r: { person_id: string }) => r.person_id),
      ]);
    }
    await admin.query(
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id = $1)`,
      [M],
    );
    await admin.query(`DELETE FROM core.seller WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.session WHERE id = ANY($1::uuid[])`, [[OWNER_S, BUYER_S]]);
    await admin.query(`DELETE FROM core.device WHERE id = $1`, [DEVICE]);
    await admin.query(`DELETE FROM core.account WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [M]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('D-66 -- the anchor rides the message', () => {
    let conversationId = '';

    const post = (body: Record<string, unknown>) =>
      http()
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', randomUUID())
        .send(body);

    it('opening a conversation takes no anchor any more', async () => {
      const open = await http()
        .post('/v1/conversations')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', randomUUID())
        .send({ seller_id: SELLER })
        .expect(201);
      conversationId = open.body.conversation_id;
      expect(conversationId).toBeTruthy();
    });

    it('THE GATE: a second product in one thread resolves to its own anchor', async () => {
      const m1 = await post({ text: 'How much is the woven basket?', product_id: PRODUCT_A }).expect(
        201,
      );
      const m2 = await post({ text: 'And the clay pot?', product_id: PRODUCT_B }).expect(201);

      const rows = await admin.query(
        `SELECT id, product_id FROM chat.message
          WHERE id = ANY($1::uuid[]) ORDER BY sent_at`,
        [[m1.body.message_id, m2.body.message_id]],
      );
      // Under the pre-T7 shape both questions shared the THREAD's single
      // anchor -- the second inherited the first product, and a slotted
      // answer would have been confidently wrong. Now each question is
      // about its own thing.
      expect(rows.rows[0].product_id).toBe(PRODUCT_A);
      expect(rows.rows[1].product_id).toBe(PRODUCT_B);
    });

    it('the messages GET returns each message with its own anchor', async () => {
      const list = await http()
        .get(`/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(200);
      const anchors = (list.body.data as Array<{ product_id?: string }>)
        .map((m) => m.product_id)
        .filter(Boolean);
      expect(anchors).toContain(PRODUCT_A);
      expect(anchors).toContain(PRODUCT_B);
    });

    it("a foreign seller's product 404s -- per message, never confirmed to exist", async () => {
      const refused = await post({ text: 'What about this one?', product_id: FOREIGN_PRODUCT });
      expect(refused.status).toBe(404);
      expect(refused.body.code).toBe('NOT_FOUND');
      expect(refused.body.items).toBeUndefined();
    });

    it("the SELLER side may anchor on the buyer's order -- the pair owns it, not the typist", async () => {
      // Trap: moved to the send path, the order-ownership predicate must
      // read the CONVERSATION's buyer. Checking the caller's account here
      // would 404 every seller reply anchored on the order being discussed.
      const reply = await http()
        .post(`/v1/conversations/${conversationId}/messages`)
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', SELLER)
        .set('Idempotency-Key', randomUUID())
        .send({ text: 'It ships tomorrow.', order_id: ORDER })
        .expect(201);
      const row = await admin.query(`SELECT order_id FROM chat.message WHERE id=$1`, [
        reply.body.message_id,
      ]);
      expect(row.rows[0].order_id).toBe(ORDER);
    });

    it('both anchors on one message: 400 at the wire, 23514 in the database', async () => {
      const refused = await post({
        text: 'both?',
        product_id: PRODUCT_A,
        order_id: ORDER,
      });
      expect(refused.status).toBe(400);

      // And the database forbids two independently of the wire: the CHECK
      // is named message_one_anchor, which is what keys the translator's
      // 23514 branch -- rename either and a violation becomes a 500.
      await expect(
        admin.query(
          `INSERT INTO chat.message (id, conversation_id, sender_kind,
             sender_account_id, body, locale, product_id, order_id)
           VALUES ($1,$2,'BUYER',$3,'x','en',$4,$5)`,
          [randomUUID(), conversationId, BUYER, PRODUCT_A, ORDER],
        ),
      ).rejects.toMatchObject({ code: '23514', constraint: 'message_one_anchor' });
    });

    it('the conversation no longer has anchor columns at all', async () => {
      const cols = await admin.query(
        `SELECT count(*)::int AS n FROM information_schema.columns
          WHERE table_schema='chat' AND table_name='conversation'
            AND column_name IN ('product_id','order_id')`,
      );
      expect(cols.rows[0].n).toBe(0);
    });
  });

  describe('D-57 -- the person row exists from the declaration', () => {
    const createSeller = (body: Record<string, unknown>) =>
      http()
        .post('/v1/seller')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', randomUUID())
        .send(body);

    it('an INDIVIDUAL declaration creates the person, same transaction', async () => {
      const r = await createSeller({
        entity_type: 'INDIVIDUAL',
        store_name: 'T7 Person One',
        handle: 't7-person-one',
      }).expect(201);
      const row = await admin.query(
        `SELECT s.person_id, (p.id IS NOT NULL) AS person_exists
           FROM core.seller s LEFT JOIN core.person p ON p.id = s.person_id
          WHERE s.id = $1`,
        [r.body.seller_id],
      );
      expect(row.rows[0].person_id).toBeTruthy();
      expect(row.rows[0].person_exists).toBe(true);
    });

    it("a second INDIVIDUAL store REUSES the owner's person -- one human, one row", async () => {
      const r2 = await createSeller({
        entity_type: 'INDIVIDUAL',
        store_name: 'T7 Person Two',
        handle: 't7-person-two',
      }).expect(201);
      const rows = await admin.query(
        `SELECT DISTINCT person_id FROM core.seller
          WHERE owner_account_id = $1 AND entity_type = 'INDIVIDUAL'
            AND handle LIKE 't7-person-%'`,
        [OWNER],
      );
      // S4.4: once per person, referenced by each seller account. Two rows
      // here would mean the same human verifies identity twice and their
      // attestation history splits.
      expect(rows.rows).toHaveLength(1);
      expect(r2.body.seller_id).toBeTruthy();
    });

    it('a COMPANY declaration creates no person -- the representative arrives later', async () => {
      const r = await createSeller({
        entity_type: 'COMPANY',
        store_name: 'T7 Company',
        handle: 't7-company',
      }).expect(201);
      const row = await admin.query(`SELECT person_id FROM core.seller WHERE id=$1`, [
        r.body.seller_id,
      ]);
      expect(row.rows[0].person_id).toBeNull();
    });

    it('the backfill left no INDIVIDUAL seller behind (fixtures excepted, by design)', async () => {
      // The migration's DO-block asserted this at migrate time over the
      // whole table. Here the assertion is scoped to sellers the ENDPOINT
      // created -- other suites' fixtures insert INDIVIDUAL sellers
      // directly and legitimately carry NULL (the endpoint is the forward
      // enforcement point; the register records why there is no CHECK).
      const rows = await admin.query(
        `SELECT count(*)::int AS n FROM core.seller
          WHERE market_id = $1 AND entity_type = 'INDIVIDUAL'
            AND handle LIKE 't7-person-%' AND person_id IS NULL`,
        [M],
      );
      expect(rows.rows[0].n).toBe(0);
    });
  });
});
