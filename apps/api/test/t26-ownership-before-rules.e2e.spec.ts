import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  FakeMediaStorageAdapter,
  MEDIA_STORAGE_ADAPTER,
} from '../src/modules/catalogue/media-storage.adapter';
import {
  FakePostLinkAdapter,
  POST_LINK_ADAPTER,
} from '../src/modules/catalogue/post-link.adapter';

/**
 * T26 Phase 1 -- OWNERSHIP IS RESOLVED BEFORE ANY BUSINESS RULE IS EVALUATED.
 *
 * THE RULING THIS PINS. A handler taking a client-supplied object id resolves
 * that id against the actor's seller (or account) FIRST, and everything else
 * runs after. A business-rule check that precedes an ownership check is an
 * ORACLE, whatever the rule is -- D-320's 409 was never the defect, its
 * POSITION was.
 *
 * WHY THIS IS A GENERATED SWEEP AND NOT A CASE PER ENDPOINT. D-320 was found
 * on two endpoints and nobody had counted the rest. A hand-written test per
 * endpoint closes the endpoints somebody thought of; a table closes the class,
 * and adding a route to the table is the cost of adding a route.
 *
 * THE ASSERTION HAS TWO HALVES AND THE SECOND IS THE ONE THAT CATCHES D-320.
 *
 *   1. a foreign object answers 404
 *   2. an id THAT DOES NOT EXIST answers the SAME 404 -- byte for byte
 *
 * A test that only checks "not 200" passes against a 409. A test that only
 * checks 404-on-foreign passes against a handler that 404s foreign objects and
 * 409s nonexistent ones. The invariant is INDISTINGUISHABILITY, and only a
 * comparison of the two whole responses proves it.
 *
 * ONE FIELD IS EXEMPT FROM THE BYTE COMPARISON: `request_id`. It is the
 * correlation id minted per request by the pipeline and it differs between any
 * two requests whatsoever, including two identical ones. Everything else in
 * the RFC 9457 envelope -- type, title_key, status, code, retryable, slots,
 * items -- is compared as written.
 *
 * DRIVEN THROUGH THE RUNNING API, over HTTP, as the runtime role. D-320 lives
 * in the handler ABOVE anything a unit test on the service would reach, and
 * three of the endpoints below delegate their whole scope decision to a
 * SECURITY DEFINER function, which no service-layer test exercises at all.
 *
 * THE IDEMPOTENCY CHANNEL (D-69, and G1.8's second oracle). A handler that
 * throws writes no idempotency record, so a replay re-executes instead of
 * replaying. Both branches of every case below throw, so both write no record
 * and both re-execute: the channel carries the same answer for a foreign id
 * and a missing one by construction. The replay HEADER is compared anyway,
 * because "by construction" is what D-320 was too.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const N = '26262626-2626-4000-8000-0000000000';
const M = `${N}01`;
const A_OWNER = `${N}02`;
const B_OWNER = `${N}03`;
const BUYER_A = `${N}04`;
const BUYER_B = `${N}05`;
const COURIER = `${N}06`;
const DEVICE_A = `${N}07`;
const DEVICE_B = `${N}08`;
const SELLER_A = `${N}09`;
const SELLER_B = `${N}0a`;
const A_OWNER_S = `${N}0b`;
const B_OWNER_S = `${N}0c`;
const BUYER_A_S = `${N}0d`;
const BUYER_B_S = `${N}0e`;
const COURIER_S = `${N}0f`;

// Seller B's objects. Every one of them is a thing seller A must not be able
// to confirm the existence of.
const B_PRODUCT = `${N}10`;
const B_VARIANT = `${N}11`;
const B_ORDER = `${N}12`;
const B_RESERVATION = `${N}13`;
const B_RES_REFUNDED = `${N}14`;
const B_REFUND = `${N}15`;
const B_CLAIM = `${N}16`;
const B_CONVERSATION = `${N}17`;
const B_TEAM_MEMBER = `${N}18`;
const B_COURIER_INVITE = `${N}19`;
const B_NOTIFICATION = `${N}1a`;
const B_SOCIAL = `${N}1b`;
const B_IMAGE = `${N}1c`;
const B_EVIDENCE = `${N}1d`;
const B_SUBMISSION = `${N}1e`;
const B_ACCOUNT_DEVICE = `${N}1f`;
const B_CART = `${N}20`;
const B_CART_LINE = `${N}21`;
const B_TEAM_ACCOUNT = `${N}22`;
const B_PAYOUT = `${N}23`;
const B_SNAPSHOT = `${N}24`;
const OTP = `${N}25`;

const storage = new FakeMediaStorageAdapter();
const links = new FakePostLinkAdapter();

type Actor = 'SELLER_A' | 'BUYER_A' | 'COURIER';
type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

interface Case {
  /** The route, as it appears in the controller. */
  readonly route: string;
  readonly method: Method;
  /** Seller B's ids, in path order. */
  readonly foreign: readonly string[];
  readonly path: (ids: readonly string[]) => string;
  readonly actor: Actor;
  readonly body?: (ids: readonly string[]) => unknown;
  /**
   * A one-per-request value the handler consumes before it reaches the id.
   * Step-up challenges are single-use, so each request gets its own even
   * though a rolled-back handler leaves the challenge unconsumed (D-323).
   */
  readonly stepUp?: 'REISSUE_INSTRUCTIONS' | 'TEAM_CHANGE';
}

@Module({ imports: [AppModule] })
class T26AppModule {}

describe('T26 Phase 1 -- a foreign object and a nonexistent one are indistinguishable', () => {
  let app: INestApplication;
  let admin: Pool;

  const cookie = (t: string) => `__Host-adulis_session=${t}`;

  const send = async (
    c: Case,
    ids: readonly string[],
    stepUpId: string | null,
  ): Promise<{ status: number; body: unknown; replay: string | undefined }> => {
    let r = request(app.getHttpServer())[c.method](c.path(ids));
    if (c.actor === 'SELLER_A') {
      r = r
        .set('Cookie', cookie(A_OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', SELLER_A);
    } else if (c.actor === 'BUYER_A') {
      r = r.set('Authorization', `Bearer ${BUYER_A_S}`).set('X-Adulis-Device', DEVICE_A);
    } else {
      r = r.set('Authorization', `Bearer ${COURIER_S}`).set('X-Adulis-Device', DEVICE_A);
    }
    if (c.method === 'post') r = r.set('Idempotency-Key', randomUUID());
    const body = c.body ? (c.body(ids) as Record<string, unknown>) : undefined;
    const withStepUp =
      body && stepUpId ? { ...body, step_up_challenge_id: stepUpId } : body;
    const res = await (withStepUp === undefined ? r.send() : r.send(withStepUp));
    return {
      status: res.status,
      body: res.body as unknown,
      replay: res.headers['x-adulis-idempotent-replay'] as string | undefined,
    };
  };

  /** The envelope minus the one field that legitimately differs. */
  const comparable = (body: unknown): string => {
    if (body === null || typeof body !== 'object') return JSON.stringify(body);
    const { request_id: _ignored, ...rest } = body as Record<string, unknown>;
    return JSON.stringify(rest);
  };

  const mintStepUp = async (action: string): Promise<string> => {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.step_up_challenge
         (id, account_id, action, otp_challenge_id, satisfied_at, expires_at)
       VALUES ($1, $2, $3, $4, now(), now() + interval '1 hour')`,
      [id, A_OWNER, action, OTP],
    );
    return id;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });

    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
         display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'T26','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
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
        ($1,'+251922260001',$6,'ACTIVE'), ($2,'+251922260002',$6,'ACTIVE'),
        ($3,'+251922260003',$6,'ACTIVE'), ($4,'+251922260004',$6,'ACTIVE'),
        ($5,'+251922260005',$6,'ACTIVE'), ($7,'+251922260006',$6,'ACTIVE')`,
      [A_OWNER, B_OWNER, BUYER_A, BUYER_B, COURIER, M, B_TEAM_ACCOUNT],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$3), ($2,'ANDROID',$3)`,
      [DEVICE_A, DEVICE_B, M],
    );

    // TWO STORES, NEITHER RELATED TO THE OTHER. Seller A's owner holds every
    // permission on seller A and no relationship at all to seller B -- which
    // is the whole point: assertPermission SUCCEEDS on every request below.
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
         store_name, handle, status, description)
       VALUES ($1,$3,$4,'INDIVIDUAL','T26 A','t26-a','ACTIVE','a'),
              ($2,$3,$5,'INDIVIDUAL','T26 B','t26-b','ACTIVE','b')`,
      [SELLER_A, SELLER_B, M, A_OWNER, B_OWNER],
    );

    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$6,'CONSOLE',$11, now()+interval '12 hours'),
        ($2,$7,'CONSOLE',$12, now()+interval '12 hours'),
        ($3,$8,'MOBILE',$11, now()+interval '12 hours'),
        ($4,$9,'MOBILE',$12, now()+interval '12 hours'),
        ($5,$10,'MOBILE',$11, now()+interval '12 hours')`,
      [
        A_OWNER_S, B_OWNER_S, BUYER_A_S, BUYER_B_S, COURIER_S,
        A_OWNER, B_OWNER, BUYER_A, BUYER_B, COURIER, DEVICE_A, DEVICE_B,
      ],
    );

    // ---- seller B's catalogue -------------------------------------------
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, description,
         base_price_minor, base_price_currency, visibility)
       VALUES ($1,$2,$3,'B product','desc',1000,'ETB','PUBLISHED')`,
      [B_PRODUCT, SELLER_B, M],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, variant_key,
         price_minor, price_currency)
       VALUES ($1,$2,$3,'default',1000,'ETB')`,
      [B_VARIANT, B_PRODUCT, SELLER_B],
    );
    await admin.query(
      `INSERT INTO core.product_image (id, product_id, position, thumb_key, card_key, full_key)
       VALUES ($1,$2,1,'products/b/t.webp','products/b/c.webp','products/b/f.webp')`,
      [B_IMAGE, B_PRODUCT],
    );
    await admin.query(
      `INSERT INTO core.product_video (id, product_id, key, duration_seconds, height_px, bytes)
       VALUES ($1,$2,'products/b/v.mp4',10,480,1000)`,
      [randomUUID(), B_PRODUCT],
    );
    await admin.query(
      `INSERT INTO core.seller_social_account (id, seller_id, platform, handle, status)
       VALUES ($1,$2,'TIKTOK','@t26b','PENDING')`,
      [B_SOCIAL, SELLER_B],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(), $1, $2, 10, 'RESTOCK')`,
      [B_VARIANT, SELLER_B],
    );

    // ---- seller B's order, with a live reservation ------------------------
    // The ACTIVE reservation is what made D-320 a SELLING signal rather than
    // an existence signal: the pre-check counted exactly this row.
    await admin.query(
      `INSERT INTO core.payout_details (id, seller_id, bank_code, account_last4,
         state, requested_by_account_id, activated_at)
       VALUES ($1,$2,'CBE','4321','ACTIVE',$3, now())`,
      [B_PAYOUT, SELLER_B, B_OWNER],
    );
    await admin.query(
      `INSERT INTO core.order_payout_snapshot (id, seller_id, payout_details_id,
         bank_code, account_last4)
       VALUES ($1,$2,$3,'CBE','4321')`,
      [B_SNAPSHOT, SELLER_B, B_PAYOUT],
    );
    await admin.query(
      `INSERT INTO core."order" (id, seller_id, buyer_account_id, market_id,
         state, total_minor, total_currency, display_currency, expires_at,
         payout_snapshot_id)
       VALUES ($1,$2,$3,$4,'PAYMENT_SUBMITTED',1000,'ETB','ETB',
               now()+interval '48 hours', $5)`,
      [B_ORDER, SELLER_B, BUYER_B, M, B_SNAPSHOT],
    );
    await admin.query(
      `INSERT INTO core.reservation (id, order_id, seller_id, buyer_account_id,
         variant_id, quantity, unit_price_minor, unit_price_currency, state)
       VALUES ($1,$3,$4,$5,$6,1,1000,'ETB','ACTIVE'),
              ($2,$3,$4,$5,$6,1,1000,'ETB','REFUNDED')`,
      [B_RESERVATION, B_RES_REFUNDED, B_ORDER, SELLER_B, BUYER_B, B_VARIANT],
    );
    await admin.query(
      `INSERT INTO core.refund (id, reservation_id, amount_minor, amount_currency,
         reported_by_seller_at)
       VALUES ($1,$2,1000,'ETB', now())`,
      [B_REFUND, B_RES_REFUNDED],
    );
    await admin.query(
      `INSERT INTO financial.payment_evidence (id, order_id, object_key,
         encryption_key_ref, frame_count)
       VALUES ($1,$2,'evidence/framed/b/x','EVID_V1',1)`,
      [B_EVIDENCE, B_ORDER],
    );
    await admin.query(
      `INSERT INTO core.payment_submission (id, order_id, submitted_at,
         evidence_ref, state, sla_deadline)
       VALUES ($1,$2, now(), $3, 'SUBMITTED', now()+interval '24 hours')`,
      [B_SUBMISSION, B_ORDER, B_EVIDENCE],
    );
    await admin.query(
      `INSERT INTO core.claim (id, order_id, opened_by_kind, opened_by_account_id,
         trigger, state, severity)
       VALUES ($1,$2,'BUYER',$3,'GOODS_NOT_RECEIVED','AWAITING_SELLER_EVIDENCE','ORDINARY')`,
      [B_CLAIM, B_ORDER, BUYER_B],
    );

    // ---- seller B's people, threads and inbox -----------------------------
    await admin.query(
      `INSERT INTO chat.conversation (id, seller_id, buyer_account_id, market_id)
       VALUES ($1,$2,$3,$4)`,
      [B_CONVERSATION, SELLER_B, BUYER_B, M],
    );
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role, invited_by)
       VALUES ($1,$2,$3,'ANALYST',$4)`,
      [B_TEAM_MEMBER, SELLER_B, B_TEAM_ACCOUNT, B_OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller_courier_invite (id, seller_id, phone, invited_by_account_id)
       VALUES ($1,$2,'+251922260009',$3)`,
      [B_COURIER_INVITE, SELLER_B, B_OWNER],
    );
    await admin.query(
      `INSERT INTO core.notification (id, recipient_account_id, channel,
         template_key, locale, slots)
       VALUES ($1,$2,'PUSH','notification.chat.escalated','en','{}'::jsonb)`,
      [B_NOTIFICATION, B_OWNER],
    );
    await admin.query(
      `INSERT INTO core.account_device (id, account_id, device_id, token_hash, expires_at)
       VALUES ($1,$2,$3, decode('00','hex'), now()+interval '7 days')`,
      [B_ACCOUNT_DEVICE, B_OWNER, DEVICE_B],
    );
    await admin.query(
      `INSERT INTO core.cart (id, device_id, buyer_account_id, market_id, seller_id, status)
       VALUES ($1,$2,$3,$4,$5,'ACTIVE')`,
      [B_CART, DEVICE_B, BUYER_B, M, SELLER_B],
    );
    await admin.query(
      `INSERT INTO core.cart_line (id, cart_id, seller_id, variant_id, quantity)
       VALUES ($1,$2,$3,$4,1)`,
      [B_CART_LINE, B_CART, SELLER_B, B_VARIANT],
    );

    // The OTP row every step-up challenge hangs off.
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash,
         expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP','+251922260001', decode('00','hex'),
               now()+interval '1 hour', now(), 'REISSUE_INSTRUCTIONS')`,
      [OTP],
    );
    const moduleRef = await Test.createTestingModule({ imports: [T26AppModule] })
      .overrideProvider(MEDIA_STORAGE_ADAPTER)
      .useValue(storage)
      .overrideProvider(POST_LINK_ADAPTER)
      .useValue(links)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${A_OWNER}','${BUYER_A}','${COURIER}')`,
      `DELETE FROM core.cart_line WHERE cart_id='${B_CART}'`,
      `DELETE FROM core.cart WHERE id='${B_CART}'`,
      `DELETE FROM core.account_device WHERE id='${B_ACCOUNT_DEVICE}'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${A_OWNER}','${B_OWNER}','${BUYER_A}','${BUYER_B}','${COURIER}','${B_TEAM_ACCOUNT}')`,
      `DELETE FROM core.seller_courier_invite WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.seller_team_member WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM chat.message WHERE conversation_id='${B_CONVERSATION}'`,
      `DELETE FROM chat.conversation WHERE id='${B_CONVERSATION}'`,
      `DELETE FROM core.claim_evidence_item WHERE claim_id='${B_CLAIM}'`,
      `DELETE FROM core.claim WHERE id='${B_CLAIM}'`,
      `DELETE FROM core.payment_submission WHERE order_id='${B_ORDER}'`,
      `DELETE FROM financial.access_log WHERE subject_id='${B_EVIDENCE}' OR order_id='${B_ORDER}'`,
      `DELETE FROM financial.payment_evidence WHERE id='${B_EVIDENCE}'`,
      `DELETE FROM core.refund WHERE id='${B_REFUND}'`,
      `DELETE FROM core.reservation WHERE order_id='${B_ORDER}'`,
      `DELETE FROM core.order_state_transition WHERE order_id='${B_ORDER}'`,
      `DELETE FROM core."order" WHERE id='${B_ORDER}'`,
      `DELETE FROM core.order_payout_snapshot WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.payout_details WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.stock_event WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.seller_social_account WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.product_video WHERE product_id='${B_PRODUCT}'`,
      `DELETE FROM core.product_image WHERE product_id='${B_PRODUCT}'`,
      `DELETE FROM core.product_variant WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.product WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.seller_level_event WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.seller WHERE market_id='${M}'`,
      `DELETE FROM core.step_up_challenge WHERE account_id='${A_OWNER}'`,
      `DELETE FROM core.otp_challenge WHERE id='${OTP}'`,
      `DELETE FROM core.session WHERE account_id IN ('${A_OWNER}','${B_OWNER}','${BUYER_A}','${BUYER_B}','${COURIER}')`,
      `DELETE FROM core.device WHERE id IN ('${DEVICE_A}','${DEVICE_B}')`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = origin`);
    await admin.end();
  }, 60_000);

  /**
   * THE TABLE. Every route in apps/api that takes a client-supplied object id
   * in its path. Adding a route to a controller and not to this table is the
   * omission the sweep exists to make visible, so the count is asserted below.
   *
   * NOT IN THE TABLE, and each for a stated reason rather than by oversight:
   *   - PUT/DELETE /v1/seller/availability-overrides/{date}: the path segment
   *     is a DATE, not an object id; the row is addressed by (seller, date) and
   *     no other seller's row is nameable.
   *   - PATCH /v1/devices/{id}: @Public(), pre-identity, and there is NO owner
   *     to resolve a device against until an account claims one. Registered as
   *     D-355 rather than swept, because the answer is a ruling.
   *   - GET /v1/storefronts/{handle}/...: public catalogue by design.
   */
  const CASES: readonly Case[] = [
    // ---- catalogue: products ------------------------------------------
    { route: 'GET /v1/seller/products/{id}', method: 'get', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}` },
    { route: 'PATCH /v1/seller/products/{id}', method: 'patch', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}`,
      body: () => ({ name: 'taken' }) },
    { route: 'POST /v1/seller/products/{id}/publish', method: 'post', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}/publish` },
    { route: 'POST /v1/seller/products/{id}/unpublish', method: 'post', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}/unpublish` },
    // D-320, the endpoint the order stopped on.
    { route: 'DELETE /v1/seller/products/{id}', method: 'delete', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}` },
    { route: 'POST /v1/seller/products/{id}/variants', method: 'post', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}/variants`,
      body: () => ({ variant_key: 'x', price_minor: 1, price_currency: 'ETB' }) },
    // ---- catalogue: variants ------------------------------------------
    { route: 'PATCH /v1/seller/variants/{id}', method: 'patch', actor: 'SELLER_A',
      foreign: [B_VARIANT], path: (i) => `/v1/seller/variants/${i[0]}`,
      body: () => ({ price_minor: 5 }) },
    // D-320's twin.
    { route: 'DELETE /v1/seller/variants/{id}', method: 'delete', actor: 'SELLER_A',
      foreign: [B_VARIANT], path: (i) => `/v1/seller/variants/${i[0]}` },
    { route: 'POST /v1/seller/variants/{id}/stock', method: 'post', actor: 'SELLER_A',
      foreign: [B_VARIANT], path: (i) => `/v1/seller/variants/${i[0]}/stock`,
      body: () => ({ delta: 1 }) },
    { route: 'POST /v1/seller/variants/{id}/confirm-stock', method: 'post', actor: 'SELLER_A',
      foreign: [B_VARIANT], path: (i) => `/v1/seller/variants/${i[0]}/confirm-stock` },
    { route: 'GET /v1/seller/variants/{id}/stock-events', method: 'get', actor: 'SELLER_A',
      foreign: [B_VARIANT], path: (i) => `/v1/seller/variants/${i[0]}/stock-events` },
    // ---- catalogue: media and posts -----------------------------------
    { route: 'POST /v1/seller/products/{id}/images', method: 'post', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}/images`,
      body: () => ({ action: 'REQUEST_UPLOAD', position: 1 }) },
    { route: 'DELETE /v1/seller/products/{id}/images/{position}', method: 'delete', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}/images/1` },
    { route: 'PUT /v1/seller/products/{id}/images/order', method: 'put', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}/images/order`,
      body: () => ({ order: [B_IMAGE] }) },
    { route: 'POST /v1/seller/products/{id}/video', method: 'post', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}/video`,
      body: () => ({ action: 'REQUEST_UPLOAD' }) },
    { route: 'DELETE /v1/seller/products/{id}/video', method: 'delete', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}/video` },
    { route: 'POST /v1/seller/products/{id}/social-posts', method: 'post', actor: 'SELLER_A',
      foreign: [B_PRODUCT], path: (i) => `/v1/seller/products/${i[0]}/social-posts`,
      body: () => ({ url: 'https://www.tiktok.com/@x/video/1234567890123456789' }) },
    // ---- seller orders -------------------------------------------------
    { route: 'GET /v1/seller/orders/{id}', method: 'get', actor: 'SELLER_A',
      foreign: [B_ORDER], path: (i) => `/v1/seller/orders/${i[0]}` },
    { route: 'POST /v1/seller/orders/{id}/ready', method: 'post', actor: 'SELLER_A',
      foreign: [B_ORDER], path: (i) => `/v1/seller/orders/${i[0]}/ready` },
    { route: 'POST /v1/seller/orders/{id}/payment/confirm', method: 'post', actor: 'SELLER_A',
      foreign: [B_ORDER], path: (i) => `/v1/seller/orders/${i[0]}/payment/confirm` },
    { route: 'POST /v1/seller/orders/{id}/payment/reject', method: 'post', actor: 'SELLER_A',
      foreign: [B_ORDER], path: (i) => `/v1/seller/orders/${i[0]}/payment/reject`,
      body: () => ({ reason: 'no' }) },
    // D-325: a COMMITTED cross-tenant destructive write before 0051.
    { route: 'POST /v1/seller/orders/{id}/reservations/{rid}/cancel', method: 'post', actor: 'SELLER_A',
      foreign: [B_ORDER, B_RESERVATION],
      path: (i) => `/v1/seller/orders/${i[0]}/reservations/${i[1]}/cancel` },
    { route: 'POST /v1/seller/orders/{id}/refunds', method: 'post', actor: 'SELLER_A',
      foreign: [B_ORDER], path: (i) => `/v1/seller/orders/${i[0]}/refunds`,
      body: () => ({ reservation_id: B_RES_REFUNDED, amount_minor: 1, currency: 'ETB' }) },
    // ---- the financial boundary ----------------------------------------
    { route: 'GET /v1/seller/orders/{id}/payment-evidence', method: 'get', actor: 'SELLER_A',
      foreign: [B_ORDER], path: (i) => `/v1/seller/orders/${i[0]}/payment-evidence` },
    { route: 'POST /v1/seller/orders/{id}/reissue-instructions', method: 'post', actor: 'SELLER_A',
      foreign: [B_ORDER], path: (i) => `/v1/seller/orders/${i[0]}/reissue-instructions`,
      body: () => ({}), stepUp: 'REISSUE_INSTRUCTIONS' },
    // ---- handoff, seller side ------------------------------------------
    { route: 'GET /v1/seller/orders/{id}/qr', method: 'get', actor: 'SELLER_A',
      foreign: [B_ORDER], path: (i) => `/v1/seller/orders/${i[0]}/qr` },
    { route: 'POST /v1/seller/orders/{id}/custody-transfer', method: 'post', actor: 'SELLER_A',
      foreign: [B_ORDER], path: (i) => `/v1/seller/orders/${i[0]}/custody-transfer`,
      body: () => ({ courier_account_id: COURIER }) },
    { route: 'POST /v1/seller/orders/{id}/courier-assignment', method: 'post', actor: 'SELLER_A',
      foreign: [B_ORDER], path: (i) => `/v1/seller/orders/${i[0]}/courier-assignment`,
      body: () => ({ courier_account_id: COURIER }) },
    // ---- seller: people and claims --------------------------------------
    { route: 'POST /v1/seller/claims/{id}/remedy', method: 'post', actor: 'SELLER_A',
      foreign: [B_CLAIM], path: (i) => `/v1/seller/claims/${i[0]}/remedy`,
      body: () => ({ remedy: 'REFUND' }) },
    { route: 'DELETE /v1/seller/team/{id}', method: 'delete', actor: 'SELLER_A',
      foreign: [B_TEAM_MEMBER], path: (i) => `/v1/seller/team/${i[0]}`,
      body: () => ({}), stepUp: 'TEAM_CHANGE' },
    { route: 'DELETE /v1/seller/couriers/{id}', method: 'delete', actor: 'SELLER_A',
      foreign: [B_COURIER_INVITE], path: (i) => `/v1/seller/couriers/${i[0]}` },
    { route: 'POST /v1/seller/social-accounts/{id}/verify', method: 'post', actor: 'SELLER_A',
      foreign: [B_SOCIAL], path: (i) => `/v1/seller/social-accounts/${i[0]}/verify` },
    // ---- the buyer's side, one buyer against another --------------------
    { route: 'GET /v1/orders/{id}', method: 'get', actor: 'BUYER_A',
      foreign: [B_ORDER], path: (i) => `/v1/orders/${i[0]}` },
    { route: 'POST /v1/orders/{id}/cancel', method: 'post', actor: 'BUYER_A',
      foreign: [B_ORDER], path: (i) => `/v1/orders/${i[0]}/cancel` },
    { route: 'POST /v1/orders/{id}/confirm-receipt', method: 'post', actor: 'BUYER_A',
      foreign: [B_ORDER], path: (i) => `/v1/orders/${i[0]}/confirm-receipt` },
    { route: 'POST /v1/orders/{id}/reservations/{rid}/cancel', method: 'post', actor: 'BUYER_A',
      foreign: [B_ORDER, B_RESERVATION],
      path: (i) => `/v1/orders/${i[0]}/reservations/${i[1]}/cancel` },
    { route: 'POST /v1/orders/{id}/refunds/{rid}/acknowledge', method: 'post', actor: 'BUYER_A',
      foreign: [B_ORDER, B_REFUND],
      path: (i) => `/v1/orders/${i[0]}/refunds/${i[1]}/acknowledge` },
    { route: 'GET /v1/orders/{id}/payment-instructions', method: 'get', actor: 'BUYER_A',
      foreign: [B_ORDER], path: (i) => `/v1/orders/${i[0]}/payment-instructions` },
    { route: 'POST /v1/orders/{id}/payment-evidence', method: 'post', actor: 'BUYER_A',
      foreign: [B_ORDER], path: (i) => `/v1/orders/${i[0]}/payment-evidence`,
      body: () => ({ action: 'REQUEST_UPLOAD' }) },
    { route: 'POST /v1/orders/{id}/review', method: 'post', actor: 'BUYER_A',
      foreign: [B_ORDER], path: (i) => `/v1/orders/${i[0]}/review`,
      body: () => ({ seller_rating: 5 }) },
    { route: 'GET /v1/claims/{id}', method: 'get', actor: 'BUYER_A',
      foreign: [B_CLAIM], path: (i) => `/v1/claims/${i[0]}` },
    { route: 'POST /v1/claims/{id}/evidence', method: 'post', actor: 'BUYER_A',
      foreign: [B_CLAIM], path: (i) => `/v1/claims/${i[0]}/evidence`,
      body: () => ({ kind: 'BANK_RECORD', reference_id: B_SUBMISSION }) },
    { route: 'POST /v1/claims/{id}/evidence-export', method: 'post', actor: 'BUYER_A',
      foreign: [B_CLAIM], path: (i) => `/v1/claims/${i[0]}/evidence-export` },
    { route: 'GET /v1/conversations/{id}/messages', method: 'get', actor: 'BUYER_A',
      foreign: [B_CONVERSATION], path: (i) => `/v1/conversations/${i[0]}/messages` },
    { route: 'POST /v1/conversations/{id}/messages', method: 'post', actor: 'BUYER_A',
      foreign: [B_CONVERSATION], path: (i) => `/v1/conversations/${i[0]}/messages`,
      body: () => ({ text: 'hello' }) },
    { route: 'POST /v1/conversations/{id}/escalate', method: 'post', actor: 'BUYER_A',
      foreign: [B_CONVERSATION], path: (i) => `/v1/conversations/${i[0]}/escalate` },
    { route: 'PATCH /v1/cart/lines/{id}', method: 'patch', actor: 'BUYER_A',
      foreign: [B_CART_LINE], path: (i) => `/v1/cart/lines/${i[0]}`,
      body: () => ({ quantity: 2 }) },
    { route: 'DELETE /v1/cart/lines/{id}', method: 'delete', actor: 'BUYER_A',
      foreign: [B_CART_LINE], path: (i) => `/v1/cart/lines/${i[0]}` },
    { route: 'POST /v1/notifications/{id}/read', method: 'post', actor: 'BUYER_A',
      foreign: [B_NOTIFICATION], path: (i) => `/v1/notifications/${i[0]}/read` },
    { route: 'DELETE /v1/auth/sessions/{id}', method: 'delete', actor: 'BUYER_A',
      foreign: [B_OWNER_S], path: (i) => `/v1/auth/sessions/${i[0]}` },
    { route: 'DELETE /v1/auth/remembered-devices/{id}', method: 'delete', actor: 'BUYER_A',
      foreign: [B_ACCOUNT_DEVICE], path: (i) => `/v1/auth/remembered-devices/${i[0]}` },
    // ---- the courier's side ---------------------------------------------
    // Isolation here is ROW-LEVEL SECURITY, not a WHERE clause: the courier
    // policy on core."order" is the one tenant policy this schema has (D-319),
    // and it must answer the two ids identically like everything else.
    { route: 'GET /v1/courier/orders/{id}', method: 'get', actor: 'COURIER',
      foreign: [B_ORDER], path: (i) => `/v1/courier/orders/${i[0]}` },
    { route: 'POST /v1/courier/orders/{id}/custody-accept', method: 'post', actor: 'COURIER',
      foreign: [B_ORDER], path: (i) => `/v1/courier/orders/${i[0]}/custody-accept` },
  ];

  it('the table covers every id-taking route the controllers declare', () => {
    // A number, so that adding a route without adding a case is a failing
    // test rather than a silent gap. The three deliberate exclusions are
    // named in the comment above CASES.
    expect(CASES.length).toBe(53);
    expect(new Set(CASES.map((c) => c.route)).size).toBe(CASES.length);
  });

  describe.each(CASES.map((c) => [c.route, c] as const))(
    '%s',
    (_route, c) => {
      it('answers a foreign id and a nonexistent id with the same 404', async () => {
        const stepA = c.stepUp ? await mintStepUp(c.stepUp) : null;
        const foreign = await send(c, c.foreign, stepA);

        const stepB = c.stepUp ? await mintStepUp(c.stepUp) : null;
        const missing = await send(c, c.foreign.map(() => randomUUID()), stepB);

        // 1. NOT FOUND, on both. 403 confirms the object exists; 409 confirms
        //    more than that, which is what D-320 was.
        expect({ route: c.route, status: foreign.status }).toEqual({
          route: c.route,
          status: 404,
        });
        expect({ route: c.route, status: missing.status }).toEqual({
          route: c.route,
          status: 404,
        });

        // 2. THE BYTE COMPARISON. This is the half that catches D-320: the
        //    status alone was already 404 for a foreign product WITHOUT a live
        //    reservation, and 409 only for one that was selling.
        expect({ route: c.route, body: comparable(foreign.body) }).toEqual({
          route: c.route,
          body: comparable(missing.body),
        });

        // 3. The replay channel says the same thing on both branches.
        expect(foreign.replay).toBe(missing.replay);
      });
    },
  );

  /**
   * The D-320 reproduction, stated as the register states it. The middle line
   * is the one that used to be a 409, and it is here as its own test because a
   * table row that passes for the wrong reason is worth nothing: this asserts
   * the ACTIVE reservation really is there, so the pre-check really would have
   * counted it.
   */
  describe('D-320, reproduced', () => {
    it("seller B's product has a live reservation, and A still cannot tell", async () => {
      const live = await admin.query(
        `SELECT count(*)::int AS n
           FROM core.reservation r
           JOIN core.product_variant v ON v.id = r.variant_id
          WHERE v.product_id = $1 AND r.state = 'ACTIVE'`,
        [B_PRODUCT],
      );
      expect(live.rows[0].n).toBe(1);

      const selling = await request(app.getHttpServer())
        .delete(`/v1/seller/products/${B_PRODUCT}`)
        .set('Cookie', cookie(A_OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', SELLER_A);
      const absent = await request(app.getHttpServer())
        .delete(`/v1/seller/products/${randomUUID()}`)
        .set('Cookie', cookie(A_OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', SELLER_A);

      expect(selling.status).toBe(404);
      expect(selling.body.code).not.toBe('PRODUCT_HAS_ACTIVE_ORDERS');
      expect(comparable(selling.body)).toBe(comparable(absent.body));
    });

    it("seller B's variant with a live reservation is equally silent", async () => {
      const selling = await request(app.getHttpServer())
        .delete(`/v1/seller/variants/${B_VARIANT}`)
        .set('Cookie', cookie(A_OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', SELLER_A);
      expect(selling.status).toBe(404);
      expect(selling.body.code).not.toBe('VARIANT_HAS_ACTIVE_ORDERS');
    });
  });

  /**
   * D-325, at the layer it lives in. The HTTP case is in the table above; this
   * asserts the DATABASE refuses too, because the function is reachable from
   * two merged migrations as well as from the endpoint, and because a service
   * fix over a broken guard is the shape that produced this defect's cousin.
   */
  describe('D-325, at the function layer', () => {
    it('fn_cancel_line refuses a stranger acting as seller, and changes nothing', async () => {
      await expect(
        admin.query(`SELECT core.fn_cancel_line($1, $2, $3, true)`, [
          B_ORDER,
          B_RESERVATION,
          A_OWNER,
        ]),
      ).rejects.toMatchObject({ code: 'U0002' });

      const after = await admin.query(
        `SELECT state::text AS state FROM core.reservation WHERE id = $1`,
        [B_RESERVATION],
      );
      expect(after.rows[0].state).toBe('ACTIVE');
    });

    it('a total stranger to every seller is refused on the same arm', async () => {
      await expect(
        admin.query(`SELECT core.fn_cancel_line($1, $2, $3, true)`, [
          B_ORDER,
          B_RESERVATION,
          BUYER_A,
        ]),
      ).rejects.toMatchObject({ code: 'U0002' });
    });

    it('the buyer arm still refuses a NULL actor rather than falling through', async () => {
      await expect(
        admin.query(`SELECT core.fn_cancel_line($1, $2, NULL, false)`, [
          B_ORDER,
          B_RESERVATION,
        ]),
      ).rejects.toMatchObject({ code: 'U0002' });
    });

    it("the order's own seller is still allowed -- the guard did not close on everybody", async () => {
      const held = await admin.query(
        `SELECT EXISTS (
           SELECT 1 FROM core.seller s
            WHERE s.id = $1 AND s.owner_account_id = $2) AS ok`,
        [SELLER_B, B_OWNER],
      );
      expect(held.rows[0].ok).toBe(true);
    });
  });
});
