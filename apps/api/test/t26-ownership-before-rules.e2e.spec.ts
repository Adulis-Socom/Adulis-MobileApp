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
import { armFixtureSessions, sessionToken } from './session-fixture';

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
const DEVICE_A = `${N}07`;
const DEVICE_B = `${N}08`;
const SELLER_A = `${N}09`;
const SELLER_B = `${N}0a`;
const A_OWNER_S = `${N}0b`;
const B_OWNER_S = `${N}0c`;
const BUYER_A_S = `${N}0d`;
const BUYER_B_S = `${N}0e`;

// Seller B's objects. Every one of them is a thing seller A must not be able
// to confirm the existence of.
const B_PRODUCT = `${N}10`;
const B_VARIANT = `${N}11`;
const B_CONVERSATION = `${N}17`;
const B_TEAM_MEMBER = `${N}18`;
const B_COURIER_INVITE = `${N}19`;
const B_NOTIFICATION = `${N}1a`;
const B_SOCIAL = `${N}1b`;
const B_IMAGE = `${N}1c`;
const B_ACCOUNT_DEVICE = `${N}1f`;
const B_CART = `${N}20`;
const B_CART_LINE = `${N}21`;
const B_TEAM_ACCOUNT = `${N}22`;
const OTP = `${N}25`;
/** Seller B's natural person -- what a company representative would name. */
const B_PERSON = `${N}28`;
/*
 * Seller A's owner also holds an INDIVIDUAL store, so A_OWNER has a
 * `core.person` -- the only thing a company representative may legitimately
 * name. Without it the D-361 check has no positive control at all.
 */
const A_SOLO = `${N}2e`;
const A_PERSON = `${N}2f`;
/** A team member of seller A: ADMIN holds seller.store:write and is not the Owner. */
const A_STAFF = `${N}30`;
const A_STAFF_S = `${N}31`;
/** BUYER_A's OWN cart, so the cart-line cases actually reach the line id. */
const A_CART = `${N}29`;
const A_CART_LINE = `${N}2a`;

const storage = new FakeMediaStorageAdapter();
const links = new FakePostLinkAdapter();

type Actor = 'SELLER_A' | 'BUYER_A';
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
  readonly stepUp?: 'TEAM_CHANGE';
}

@Module({ imports: [AppModule] })
class T26AppModule {}

describe('T26 Phase 1 -- a foreign object and a nonexistent one are indistinguishable', () => {
  let app: INestApplication;
  let admin: Pool;

  const cookie = (t: string) => `__Host-adulis_session=${sessionToken(t)}`;

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
    } else {
      r = r.set('Authorization', `Bearer ${sessionToken(BUYER_A_S)}`).set('X-Adulis-Device', DEVICE_A);
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

  /**
   * The response, minus the two things that may legitimately differ between
   * the two requests and nothing else.
   *
   *  - `request_id`: the per-request correlation id, different between ANY
   *    two requests including two identical ones.
   *  - THE IDS THE CALLER SUPPLIED. An endpoint that echoes back the object
   *    id it was given discloses nothing -- the caller sent it; without the
   *    substitution such a case's two branches could never compare equal and
   *    it would assert nothing.
   */
  const comparable = (body: unknown, ids: readonly string[] = []): string => {
    if (body === null || typeof body !== 'object') return JSON.stringify(body);
    const { request_id: _ignored, ...rest } = body as Record<string, unknown>;
    let text = JSON.stringify(rest);
    ids.forEach((id, i) => {
      text = text.split(id).join(`<id-${i}>`);
    });
    return text;
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
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251922260001',$5,'ACTIVE'), ($2,'+251922260002',$5,'ACTIVE'),
        ($3,'+251922260003',$5,'ACTIVE'), ($4,'+251922260004',$5,'ACTIVE'),
        ($6,'+251922260006',$5,'ACTIVE')`,
      [A_OWNER, B_OWNER, BUYER_A, BUYER_B, M, B_TEAM_ACCOUNT],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$3), ($2,'ANDROID',$3)`,
      [DEVICE_A, DEVICE_B, M],
    );

    // TWO STORES, NEITHER RELATED TO THE OTHER. Seller A's owner holds every
    // permission on seller A and no relationship at all to seller B -- which
    // is the whole point: assertPermission SUCCEEDS on every request below.
    await admin.query(
      /*
       * SELLER A IS A COMPANY, deliberately. `seller_company_detail` carries a
       * composite FK on (seller_id, entity_type), so an INDIVIDUAL seller is
       * refused by the constraint before `representative_person_id` is
       * reached -- both branches would answer 409 SELLER_NOT_COMPANY and the
       * D-361 case would pass while discriminating nothing. It is the only
       * thing A's entity type decides in this file.
       */
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
         store_name, handle, status, description)
       VALUES ($1,$3,$4,'COMPANY','T26 A','t26-a','ACTIVE','a'),
              ($2,$3,$5,'INDIVIDUAL','T26 B','t26-b','ACTIVE','b')`,
      [SELLER_A, SELLER_B, M, A_OWNER, B_OWNER],
    );

    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$5,'CONSOLE',$9, now()+interval '12 hours'),
        ($2,$6,'CONSOLE',$10, now()+interval '12 hours'),
        ($3,$7,'MOBILE',$9, now()+interval '12 hours'),
        ($4,$8,'MOBILE',$10, now()+interval '12 hours')`,
      [
        A_OWNER_S, B_OWNER_S, BUYER_A_S, BUYER_B_S,
        A_OWNER, B_OWNER, BUYER_A, BUYER_B, DEVICE_A, DEVICE_B,
      ],
    );
    await armFixtureSessions(admin, [A_OWNER_S, B_OWNER_S, BUYER_A_S, BUYER_B_S]);

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
    /*
     * BUYER_A GETS A CART OF THEIR OWN, and it is not decoration. Without it
     * `resolveCart` returns null and both cart-line cases throw NOT_FOUND
     * before `lineId` appears in any statement -- so they would pass against a
     * handler with no cart predicate at all. Found by the refutation pass on
     * the first version of this file.
     */
    await admin.query(
      `INSERT INTO core.cart (id, device_id, buyer_account_id, market_id, seller_id, status)
       VALUES ($1,$2,$3,$4,$5,'ACTIVE')`,
      [A_CART, DEVICE_A, BUYER_A, M, SELLER_B],
    );
    await admin.query(
      `INSERT INTO core.cart_line (id, cart_id, seller_id, variant_id, quantity)
       VALUES ($1,$2,$3,$4,1)`,
      [A_CART_LINE, A_CART, SELLER_B, B_VARIANT],
    );
    /*
     * Seller B's natural person. A COMPANY seller's representative is named
     * by `representative_person_id`, and this is the person id an attacker
     * would name to borrow somebody else's identity attestation (D-361).
     */
    await admin.query(`INSERT INTO core.person (id) VALUES ($1)`, [B_PERSON]);
    await admin.query(`INSERT INTO core.person (id) VALUES ($1)`, [A_PERSON]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
         store_name, handle, status, person_id)
       VALUES ($1,$2,$3,'INDIVIDUAL','T26 A solo','t26-a-solo','ACTIVE',$4)`,
      [A_SOLO, M, A_OWNER, A_PERSON],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       VALUES ($1,'+251922260007',$2,'ACTIVE')`,
      [A_STAFF, M],
    );
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role, invited_by)
       VALUES (gen_random_uuid(), $1, $2, 'ADMIN', $3)`,
      [SELLER_A, A_STAFF, A_OWNER],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
       VALUES ($1,$2,'CONSOLE',$3, now()+interval '12 hours')`,
      [A_STAFF_S, A_STAFF, DEVICE_A],
    );
    await armFixtureSessions(admin, [A_STAFF_S]);
    await admin.query(`UPDATE core.seller SET person_id = $1 WHERE id = $2`, [
      B_PERSON,
      SELLER_B,
    ]);
    // The OTP row every step-up challenge hangs off.
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash,
         expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP','+251922260001', decode('00','hex'),
               now()+interval '1 hour', now(), 'TEAM_CHANGE')`,
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
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${A_OWNER}','${BUYER_A}','${A_STAFF}')`,
      `DELETE FROM core.cart_line WHERE cart_id IN ('${B_CART}','${A_CART}')`,
      `DELETE FROM core.cart WHERE id IN ('${B_CART}','${A_CART}')`,
      `DELETE FROM core.seller_company_detail WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.account_device WHERE id='${B_ACCOUNT_DEVICE}'`,
      // INF-03: A_STAFF too -- its session's NEW_DEVICE_SIGNIN notice outlived the account.
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${A_OWNER}','${B_OWNER}','${BUYER_A}','${BUYER_B}','${B_TEAM_ACCOUNT}','${A_STAFF}')`,
      `DELETE FROM core.seller_courier_invite WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.seller_team_member WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM chat.message WHERE conversation_id='${B_CONVERSATION}'`,
      `DELETE FROM chat.conversation WHERE id='${B_CONVERSATION}'`,
      `DELETE FROM core.stock_event WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.seller_social_account WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.product_video WHERE product_id='${B_PRODUCT}'`,
      `DELETE FROM core.product_image WHERE product_id='${B_PRODUCT}'`,
      `DELETE FROM core.product_variant WHERE seller_id='${SELLER_B}'`,
      `DELETE FROM core.product WHERE seller_id='${SELLER_B}'`,
      // A_SOLO's row is the TRIGGER's, not this fixture's INSERT -- and
      // deleting what you created means what your INSERT caused. The orphan
      // sweep gate caught it.
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${SELLER_A}','${SELLER_B}','${A_SOLO}')`,
      `DELETE FROM core.seller_level_event WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.seller WHERE market_id='${M}'`,
      `DELETE FROM core.person WHERE id IN ('${B_PERSON}','${A_PERSON}')`,
      `DELETE FROM core.step_up_challenge WHERE account_id='${A_OWNER}'`,
      `DELETE FROM core.otp_challenge WHERE id='${OTP}'`,
      `DELETE FROM core.session WHERE account_id IN ('${A_OWNER}','${B_OWNER}','${BUYER_A}','${BUYER_B}','${A_STAFF}')`,
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
   * THE POPULATION WAS 62, AND THIS TABLE HELD 55 (register D-363). The first
   * version of this file counted PATH parameters and stopped -- 53 routes,
   * arithmetically right and answering a narrower question than the one asked.
   * Nine more routes take an owned-object id ONLY in the BODY, and the two
   * worst findings of this phase were both among them (D-360, D-361). The
   * other seven were traced by hand and are clean; D-363 lists them.
   *
   * THE RESERVATION RETIREMENT (migration 0063) REMOVED 26 ROWS with their
   * routes: buyer and seller orders, payment, refunds, the financial boundary,
   * handoff (D-360's POST /v1/handoffs/sync with it), courier orders, claims
   * and review creation. Those routes now 404 for everybody, which is not an
   * ownership answer and so is not swept here. 29 rows remain.
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
    // ---- seller: people ---------------------------------------------------
    { route: 'DELETE /v1/seller/team/{id}', method: 'delete', actor: 'SELLER_A',
      foreign: [B_TEAM_MEMBER], path: (i) => `/v1/seller/team/${i[0]}`,
      body: () => ({}), stepUp: 'TEAM_CHANGE' },
    { route: 'DELETE /v1/seller/couriers/{id}', method: 'delete', actor: 'SELLER_A',
      foreign: [B_COURIER_INVITE], path: (i) => `/v1/seller/couriers/${i[0]}` },
    { route: 'POST /v1/seller/social-accounts/{id}/verify', method: 'post', actor: 'SELLER_A',
      foreign: [B_SOCIAL], path: (i) => `/v1/seller/social-accounts/${i[0]}/verify` },
    // ---- the buyer's side, one buyer against another --------------------
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
    /*
     * ---- the object id in the BODY, not the path -------------------------
     *
     * The first version of this table counted PATH parameters and stopped
     * there, and the refutation pass found the class's worst remaining member
     * one layer down. An id is client-supplied wherever the client supplies
     * it; a route that reads one from its body is in the class exactly as
     * much as one that reads it from its path.
     */
    // D-361. `representative_person_id` was written straight through, and
    // fn_seller_attestation_person hands it to has_attestation -- so naming
    // another store's person borrowed that person's identity verification.
    { route: 'PATCH /v1/seller/company-details {representative_person_id}',
      method: 'patch', actor: 'SELLER_A',
      foreign: [B_PERSON], path: () => '/v1/seller/company-details',
      body: (i) => ({
        registration_identifier: 'REG-T26',
        trade_licence_number: 'TL-T26',
        tin: '0012345678',
        representative_person_id: i[0],
        representative_relationship: 'Director',
      }) },
  ];

  it('the table covers every id-taking route the controllers declare', () => {
    // A number, so that adding a route without adding a case is a failing
    // test rather than a silent gap. The three deliberate exclusions are
    // named in the comment above CASES.
    expect(CASES.length).toBe(29);
    expect(new Set(CASES.map((c) => c.route)).size).toBe(CASES.length);
  });

  describe.each(CASES.map((c) => [c.route, c] as const))(
    '%s',
    (_route, c) => {
      it('answers a foreign id and a nonexistent id with the same 404', async () => {
        const stepA = c.stepUp ? await mintStepUp(c.stepUp) : null;
        const foreign = await send(c, c.foreign, stepA);

        const stepB = c.stepUp ? await mintStepUp(c.stepUp) : null;
        const missingIds = c.foreign.map(() => randomUUID());
        const missing = await send(c, missingIds, stepB);

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
        expect({
          route: c.route,
          body: comparable(foreign.body, c.foreign),
        }).toEqual({
          route: c.route,
          body: comparable(missing.body, missingIds),
        });

        // 3. The replay channel says the same thing on both branches.
        expect(foreign.replay).toBe(missing.replay);
      });
    },
  );

  /*
   * ---------------------------------------------------- the review's findings
   *
   * A regression the first version of these fixes introduced, pinned by the
   * test that would have caught it. Found by review, after the sweep above
   * was green -- which is the point of running one. (Its handoff twin went
   * with the handoff routes in 0063.)
   */
  describe('the fixes did not cost what they were fixing', () => {
    it('a team member with seller.store:write may still set company details', async () => {
      /*
       * The representative is resolved against the STORE'S OWNER, not the
       * caller. Scoped to the caller it would 404 a staff member on an
       * endpoint the permission matrix lets them use -- a permission granted
       * by one check and taken away by the next.
       */
      const r = await request(app.getHttpServer())
        .patch('/v1/seller/company-details')
        .set('Cookie', cookie(A_STAFF_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', SELLER_A)
        .send({
          registration_identifier: 'REG-STAFF',
          trade_licence_number: 'TL-STAFF',
          tin: '0012345679',
          representative_person_id: A_PERSON,
          representative_relationship: 'Director',
        });
      expect({ status: r.status, body: r.body }).toEqual({
        status: 200,
        body: { updated: true },
      });
    });
  });

  /**
   * The D-320 endpoints, after the Reservation retirement (0063). Their
   * live-reservation 409 is gone with the model, but the ownership resolution
   * that had to precede it is not: a foreign Product or Variant still answers
   * the same 404 as an absent one, and seller B's rows are left untouched.
   */
  describe('D-320, after the live-reservation guard was retired', () => {
    const asSellerA = (r: request.Test) =>
      r.set('Cookie', cookie(A_OWNER_S)).set('Origin', CONSOLE_ORIGIN).set('X-Adulis-Seller', SELLER_A);

    it("seller A cannot delete seller B's product, nor tell it from an absent one", async () => {
      const foreign = await asSellerA(request(app.getHttpServer()).delete(`/v1/seller/products/${B_PRODUCT}`));
      const absent = await asSellerA(request(app.getHttpServer()).delete(`/v1/seller/products/${randomUUID()}`));

      expect(foreign.status).toBe(404);
      expect(foreign.body.code).not.toBe('PRODUCT_HAS_ACTIVE_ORDERS');
      expect(comparable(foreign.body)).toBe(comparable(absent.body));
      const still = await admin.query(`SELECT 1 FROM core.product WHERE id = $1`, [B_PRODUCT]);
      expect(still.rowCount).toBe(1);
    });

    it("seller A cannot withdraw seller B's variant, by DELETE or by PATCH", async () => {
      const byDelete = await asSellerA(request(app.getHttpServer()).delete(`/v1/seller/variants/${B_VARIANT}`));
      const byPatch = await asSellerA(
        request(app.getHttpServer()).patch(`/v1/seller/variants/${B_VARIANT}`),
      ).send({ status: 'WITHDRAWN' });
      const absent = await asSellerA(
        request(app.getHttpServer()).patch(`/v1/seller/variants/${randomUUID()}`),
      ).send({ status: 'WITHDRAWN' });

      expect(byDelete.status).toBe(404);
      expect(byPatch.status).toBe(404);
      expect(comparable(byPatch.body)).toBe(comparable(absent.body));
      const v = await admin.query<{ status: string }>(
        `SELECT status::text AS status FROM core.product_variant WHERE id = $1`,
        [B_VARIANT],
      );
      expect(v.rows[0]?.status).not.toBe('WITHDRAWN');
    });
  });

  /**
   * D-362, at the function layer. Its sibling cases on fn_cancel_line (D-325)
   * went with the function in 0063; the NULL-actor guard on the ownership
   * transfer is unrelated to Reservations and stays pinned.
   */
  describe('D-362, at the function layer', () => {
    /*
     * D-362, the class member 0051's grep missed. `NOT IN` against a list of
     * NOT NULL columns is total on the list side and NOT total on the actor's:
     * `NULL NOT IN (a, b)` is NULL and the guard does not fire. Latent rather
     * than live -- the pipeline refuses a request with no account before a
     * handler runs -- and fixed in 0052 because the property belonged to the
     * call sites and not to the guard.
     */
    it('fn_cancel_ownership_transfer refuses a NULL actor rather than falling through', async () => {
      // Minted BEFORE the connection is checked out: this pool holds ONE
      // connection, so an admin.query() while a client is out would wait on
      // itself forever.
      const challenge = await mintStepUp('OWNERSHIP_TRANSFER');
      const c = await admin.connect();
      try {
        await c.query('BEGIN');
        await c.query(
          `INSERT INTO core.seller_ownership_transfer
             (id, seller_id, from_account_id, to_account_id,
              step_up_challenge_id, activates_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, now() + interval '7 days')`,
          [SELLER_B, B_OWNER, BUYER_B, challenge],
        );
        await expect(
          c.query(`SELECT core.fn_cancel_ownership_transfer($1, NULL, NULL)`, [SELLER_B]),
        ).rejects.toMatchObject({ code: 'U0002' });
      } finally {
        await c.query('ROLLBACK');
        c.release();
      }
    });
  });
});
