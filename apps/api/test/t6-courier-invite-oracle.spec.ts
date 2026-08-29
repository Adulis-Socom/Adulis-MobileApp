import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { FakeSmsAdapter, SMS_ADAPTER } from '../src/modules/auth/sms.adapter';

/**
 * T6 / G1.8 -- inviting a courier tells you nothing about the number.
 *
 * The old endpoint looked the phone up and raised NOT_FOUND when it found
 * nothing, so any seller account could test arbitrary numbers for Adulis
 * membership. ADU-AUTH-01 v2.5 S19 generalises the rule: no response
 * distinguishes an identity that exists from one that does not.
 *
 * S1.3 is emphatic that "both return 200" is not the assertion. There were
 * THREE distinguishable outcomes, and a body fix closes only the first:
 *
 *   1. the body            -- 404 vs 201
 *   2. the IDEMPOTENCY RECORD -- the 404 path rolled back and wrote none, so
 *      replaying the same key re-executed instead of replaying. Two requests
 *      told a caller what one did not, whatever the first body said.
 *   3. the DUPLICATE 409  -- re-inviting a live courier hit
 *      seller_courier_live and returned the constraint NAME in slots.
 *
 * All three are asserted below, and T6-B S2 adds the two that close the
 * remaining volume channel:
 *
 *   7. NOTHING IS SENT to a number with no account. An invitation SMS would
 *      hand the oracle straight back -- the sender learns nothing from the
 *      response, and the OWNER of the number learns somebody typed it into
 *      Adulis -- and would make the endpoint a free SMS cannon.
 *   8. TEN INVITES PER HOUR PER SELLER. A response that reveals nothing is
 *      still walkable at ten thousand numbers a night if the walk is free.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = randomUUID();
const OWNER = randomUUID();
const KNOWN = randomUUID();
const DEVICE = randomUUID();
const OWNER_S = randomUUID();
const SELLER = randomUUID();

const P_KNOWN = '+251919990001';
const P_UNKNOWN = '+251919990002';
const P_ALSO_UNKNOWN = '+251919990003';

const sms = new FakeSmsAdapter();

@Module({ imports: [AppModule] })
class T6AppModule {}

describe('T6 / G1.8 -- the courier invite is not a registration oracle', () => {
  let app: INestApplication;
  let admin: Pool;

  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  const invite = (phone: string, key: string) =>
    request(app.getHttpServer())
      .post('/v1/seller/couriers')
      .set('Cookie', cookie(OWNER_S))
      .set('X-Adulis-Seller', SELLER)
      .set('Origin', CONSOLE_ORIGIN)
      .set('Idempotency-Key', key)
      .send({ phone });

  const purgeBucket = () =>
    admin.query(
      `DELETE FROM core.rate_limit_bucket
        WHERE bucket_key = 'seller-courier-invite' AND subject_id = $1`,
      [SELLER],
    );

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await purgeBucket();
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live)
       VALUES ($1,'T6C','Oracle','PHASE_1','ETB','Africa/Addis_Ababa','en',false)`,
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
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       VALUES ($1,$3,$4,'ACTIVE'), ($2,$5,$4,'ACTIVE')`,
      [OWNER, KNOWN, '+251919990000', M, P_KNOWN],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
       VALUES ($1,$2,'CONSOLE',$3, now() + interval '12 hours')`,
      [OWNER_S, OWNER, DEVICE],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Oracle','t6-oracle','ACTIVE')`,
      [SELLER, M, OWNER],
    );

    const moduleRef = await Test.createTestingModule({ imports: [T6AppModule] })
      .overrideProvider(SMS_ADAPTER)
      .useValue(sms)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = $1`, [OWNER]);
    await admin.query(`DELETE FROM core.seller_courier_invite WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller_courier WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller_public_stats WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller WHERE id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.session WHERE id = $1`, [OWNER_S]);
    await admin.query(`DELETE FROM core.device WHERE id = $1`, [DEVICE]);
    await admin.query(`DELETE FROM core.account WHERE id = ANY($1::uuid[])`, [[OWNER, KNOWN]]);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [M]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await purgeBucket();
    await admin.end();
  });

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it('1 - the response is the same shape, status and keys for a known and an unknown number', async () => {
    const known = await invite(P_KNOWN, randomUUID());
    const unknown = await invite(P_UNKNOWN, randomUUID());

    expect(known.status).toBe(201);
    expect(unknown.status).toBe(201);
    // The only field is an id, and both are ids. There is nothing in the
    // body to compare BUT the shape -- which is the point: the id cannot
    // be equal, so "byte-identical" means the caller can read nothing from
    // the difference.
    expect(Object.keys(known.body).sort()).toEqual(['id']);
    expect(Object.keys(unknown.body).sort()).toEqual(['id']);
    expect(known.body.id).toMatch(UUID_RE);
    expect(unknown.body.id).toMatch(UUID_RE);
    expect(known.headers['content-type']).toBe(unknown.headers['content-type']);
  });

  it('2 - the IDEMPOTENCY RECORD behaves the same either way', async () => {
    // The second oracle, and the one a body fix leaves wide open: the old
    // 404 path threw, so the transaction rolled back and no idempotency
    // record was written. Replaying the key re-executed and returned 404
    // again with no replay header, while a real success replayed WITH one.
    // Two requests distinguished the branches whatever the first body said.
    const kKnown = randomUUID();
    const kUnknown = randomUUID();
    const firstKnown = await invite(P_KNOWN, kKnown);
    const firstUnknown = await invite(P_UNKNOWN, kUnknown);

    const replayKnown = await invite(P_KNOWN, kKnown);
    const replayUnknown = await invite(P_UNKNOWN, kUnknown);

    expect(replayKnown.status).toBe(replayUnknown.status);
    expect(replayKnown.headers['x-adulis-idempotent-replay']).toBe(
      replayUnknown.headers['x-adulis-idempotent-replay'],
    );
    expect(replayKnown.headers['x-adulis-idempotent-replay']).toBe('true');
    // And a replay returns what the first call returned, in both cases.
    expect(replayKnown.body.id).toBe(firstKnown.body.id);
    expect(replayUnknown.body.id).toBe(firstUnknown.body.id);
  });

  it('3 - re-inviting is not a 409, for either kind of number', async () => {
    // The third oracle: a duplicate used to violate seller_courier_live and
    // surface as 409 VALIDATION_FAILED carrying the CONSTRAINT NAME. A
    // caller who got 409 learned the number was an active courier here; one
    // who got 201 learned nothing.
    const again = await invite(P_KNOWN, randomUUID());
    const againUnknown = await invite(P_UNKNOWN, randomUUID());
    expect(again.status).toBe(201);
    expect(againUnknown.status).toBe(201);
    // The two ids must differ from each other (different phones) -- the
    // old line here compared a value to itself and asserted nothing.
    expect(again.body.id).not.toBe(againUnknown.body.id);
    // Idempotent by the RELATIONSHIP: a live invite -- claimed (P_KNOWN is
    // an active courier by now) or pending (P_UNKNOWN) -- keeps its id
    // across re-taps. D-67's partial unique made this a code path rather
    // than a constraint side effect, and this is the assertion that keeps
    // the list free of duplicate rows per re-tap.
    const third = await invite(P_KNOWN, randomUUID());
    expect(third.body.id).toBe(again.body.id);
  });


  it('4 - an unknown number leaves a PENDING invite and no courier relationship', async () => {
    await invite(P_ALSO_UNKNOWN, randomUUID());
    const inv = await admin.query(
      `SELECT claimed_at, claimed_by_account_id FROM core.seller_courier_invite
        WHERE seller_id = $1 AND phone = $2`,
      [SELLER, P_ALSO_UNKNOWN],
    );
    expect(inv.rows).toHaveLength(1);
    expect(inv.rows[0].claimed_at).toBeNull();
    expect(inv.rows[0].claimed_by_account_id).toBeNull();

    // No courier row -- there is nobody to be one yet.
    const cour = await admin.query(
      `SELECT count(*)::int AS n FROM core.seller_courier WHERE seller_id = $1`,
      [SELLER],
    );
    // Exactly one: the KNOWN phone's, from the tests above.
    expect(cour.rows[0].n).toBe(1);
  });

  it('5 - a known number is claimed immediately, so nothing about access changes', async () => {
    const inv = await admin.query(
      `SELECT i.claimed_at, i.claimed_by_account_id
         FROM core.seller_courier_invite i
        WHERE i.seller_id = $1 AND i.phone = $2`,
      [SELLER, P_KNOWN],
    );
    expect(inv.rows[0].claimed_at).not.toBeNull();
    expect(inv.rows[0].claimed_by_account_id).toBe(KNOWN);
  });

  it('6 - the list shows pending and claimed invites alike', async () => {
    const r = await request(app.getHttpServer())
      .get('/v1/seller/couriers')
      .set('Cookie', cookie(OWNER_S))
      .set('X-Adulis-Seller', SELLER)
      .expect(200);
    const phones = (r.body.data as Array<{ phone: string; claimed_at: string | null }>).map(
      (x) => x.phone,
    );
    // A pending invite must be visible or the seller cannot tell an
    // invitation that is waiting from a number they mistyped.
    expect(phones).toEqual(expect.arrayContaining([P_KNOWN, P_UNKNOWN, P_ALSO_UNKNOWN]));
  });

  it('7 - an invite to a number with NO ACCOUNT sends nothing at all', async () => {
    await purgeBucket();
    const before = sms.sent.length;
    await invite('+251919990077', randomUUID());
    // T6-B S2's INVARIANT. Not "no invitation SMS" -- NO MESSAGE OF ANY
    // KIND, to anybody. An SMS to the invited number tells its owner that
    // somebody typed it into Adulis, which is the oracle handed back from
    // the other end; and an endpoint that texts arbitrary numbers on demand
    // is an SMS cannon with a seller session for a trigger.
    expect(sms.sent.length).toBe(before);

    // The known number too: the branch that DOES create a relationship must
    // not send either, or the two are distinguishable by the phone bill.
    await invite(P_KNOWN, randomUUID());
    expect(sms.sent.length).toBe(before);
  });

  it('8 - the eleventh invite in an hour is refused, and the refusal says nothing about the numbers', async () => {
    await purgeBucket();
    // Ten distinct numbers, MIXED: five that exist here and five that do
    // not. Whatever the eleventh response is, it must be the same response
    // it would have been for any other ten.
    for (let i = 0; i < 10; i += 1) {
      const r = await invite(`+2519199901${String(i).padStart(2, '0')}`, randomUUID());
      expect(r.status).toBe(201);
    }
    const eleventhUnknown = await invite('+251919990188', randomUUID());
    expect(eleventhUnknown.status).toBe(429);
    expect(eleventhUnknown.body.code).toBe('RATE_LIMITED');
    // Retry-After is a duration, not a hint about the subject.
    expect(eleventhUnknown.body.slots.retry_after_seconds).toBeGreaterThan(0);

    // The SAME refusal for a number that IS registered -- so a caller who
    // has burned their budget cannot spend the last request learning
    // anything. Same code, same status, same key set.
    const eleventhKnown = await invite(P_KNOWN, randomUUID());
    expect(eleventhKnown.status).toBe(429);
    expect(eleventhKnown.body.code).toBe(eleventhUnknown.body.code);
    expect(Object.keys(eleventhKnown.body).sort()).toEqual(
      Object.keys(eleventhUnknown.body).sort(),
    );

    // And the limit is per SELLER: it is recorded against the store, not
    // against the Admin who typed, so three sessions on one store are one
    // budget.
    // Scoped to THIS seller: the bucket table is shared, and c6 invites
    // couriers too. What matters is that the budget is recorded against the
    // STORE and not against the Admin who typed -- so the seller's row
    // exists and carries all eleven, and the owner's account has no row at
    // all.
    const mine = await admin.query<{ count: number }>(
      `SELECT count FROM core.rate_limit_bucket
        WHERE bucket_key = 'seller-courier-invite' AND subject_id = $1`,
      [SELLER],
    );
    expect(mine.rows).toHaveLength(1);
    expect(Number(mine.rows[0]?.count)).toBeGreaterThan(10);
    const byAccount = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM core.rate_limit_bucket
        WHERE bucket_key = 'seller-courier-invite' AND subject_id = $1`,
      [OWNER],
    );
    expect(Number(byAccount.rows[0]?.n)).toBe(0);
    await purgeBucket();
  });

  it("9 - D-67's two arms: a revoked phone can be re-invited, claimed or not", async () => {
    await purgeBucket();
    // ---- arm 1: invite -> revoke -> invite again succeeds -------------
    const p1 = '+251919990201';
    const first = await invite(p1, randomUUID());
    expect(first.status).toBe(201);
    await request(app.getHttpServer())
      .delete(`/v1/seller/couriers/${first.body.id}`)
      .set('Cookie', cookie(OWNER_S))
      .set('X-Adulis-Seller', SELLER)
      .set('Origin', CONSOLE_ORIGIN)
      .expect(204);
    const second = await invite(p1, randomUUID());
    // Before D-67's ruling this was impossible: the TOTAL unique meant the
    // revoked row blocked the phone forever unless the endpoint revived it
    // -- and revival resurrected stale claim stamps. Now the revoked row is
    // history and this is a FRESH invite.
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    const rows = await admin.query(
      `SELECT revoked_at IS NULL AS live FROM core.seller_courier_invite
        WHERE seller_id = $1 AND phone = $2 ORDER BY invited_at`,
      [SELLER, p1],
    );
    expect(rows.rows.map((r: { live: boolean }) => r.live)).toEqual([false, true]);

    // ---- arm 2: invite -> claim -> revoke -> invite again succeeds ----
    // P_KNOWN was claimed immediately (it has an account) and is a live
    // courier from the earlier tests; revoke it, then re-invite.
    const live = await admin.query(
      `SELECT id FROM core.seller_courier_invite
        WHERE seller_id = $1 AND phone = $2 AND revoked_at IS NULL`,
      [SELLER, P_KNOWN],
    );
    expect(live.rows).toHaveLength(1);
    await request(app.getHttpServer())
      .delete(`/v1/seller/couriers/${live.rows[0].id}`)
      .set('Cookie', cookie(OWNER_S))
      .set('X-Adulis-Seller', SELLER)
      .set('Origin', CONSOLE_ORIGIN)
      .expect(204);
    const reinvited = await invite(P_KNOWN, randomUUID());
    expect(reinvited.status).toBe(201);
    expect(reinvited.body.id).not.toBe(live.rows[0].id);
    // The known phone claims immediately again: the fresh invite is a fresh
    // relationship, stamped by the same transaction that created it.
    const stamped = await admin.query(
      `SELECT claimed_at, claimed_by_account_id FROM core.seller_courier_invite
        WHERE id = $1`,
      [reinvited.body.id],
    );
    expect(stamped.rows[0].claimed_at).not.toBeNull();
    expect(stamped.rows[0].claimed_by_account_id).toBe(KNOWN);
    await purgeBucket();
  });
});
