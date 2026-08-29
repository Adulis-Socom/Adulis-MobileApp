import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createJobHarness, type Harness } from './jobs-harness';
import {
  notificationSend,
  notificationPushSeller,
  notificationMorningReminder,
} from '../src/jobs/e2-notification';
import {
  levelRecompute,
  stockConfidenceNudge,
  socialPostAvailabilityCheck,
} from '../src/jobs/e3-trust-stock';
import {
  financialPurgePaymentEvidence,
  mediaLifecycle,
  waitlistRetentionPurge,
} from '../src/jobs/e4-retention';
import {
  idempotencyPurgeExpired,
  rateLimitPurgeStale,
  ledgerAssertZero,
  analyticsCreatePartition,
} from '../src/jobs/e5-transport-ledger';
import {
  subscriptionWarn,
  subscriptionCollectReminder,
  nluHarvestUnmatched,
} from '../src/jobs/e6-billing-nlu';
import { S24_JOBS, S24_JOB_NAMES } from '../src/jobs/registry';

/**
 * E2-E6, plus the registry's agreement with S24 itself.
 *
 * Every job here runs TWICE and the second run must change nothing. Two
 * assertions in this file are the ones that could not be undone if they
 * were wrong: that the evidence purge leaves payout credentials untouched,
 * and that the morning reminder resolves 08:00 in the market's timezone.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = 'bbbbe222-0000-4000-8000-000000000001';
const M_UTC = 'bbbbe222-0000-4000-8000-000000000021';
const OWNER = 'bbbbe222-0000-4000-8000-000000000002';
const BUYER = 'bbbbe222-0000-4000-8000-000000000003';
const SELLER = 'bbbbe222-0000-4000-8000-000000000004';
const PRODUCT = 'bbbbe222-0000-4000-8000-000000000005';
const VARIANT = 'bbbbe222-0000-4000-8000-000000000006';
const DEVICE = 'bbbbe222-0000-4000-8000-000000000007';
const PD = 'bbbbe222-0000-4000-8000-000000000008'; // payout details
const EV_ORDER = 'bbbbe222-0000-4000-8000-000000000009';
const EV_KEEP = 'bbbbe222-0000-4000-8000-00000000000a'; // evidence under claim
const EV_PURGE = 'bbbbe222-0000-4000-8000-00000000000b';
const SOCIAL_LIVE = 'bbbbe222-0000-4000-8000-00000000000c';
const SOCIAL_GONE = 'bbbbe222-0000-4000-8000-00000000000d';
const SOCIAL_OUTAGE = 'bbbbe222-0000-4000-8000-00000000000e';
const CONV = 'bbbbe222-0000-4000-8000-00000000000f';

const T0 = new Date('2026-06-01T09:00:00.000Z');
/** 08:00 in Addis (UTC+3) is 05:00 UTC — the whole point of the trap. */
const EAT_0800 = new Date('2026-06-02T05:00:00.000Z');

const timingCols = `reservation_window, payment_confirmation_window, fulfilment_window,
  offline_sync_horizon, payout_activation_delay, recovery_cooling_period,
  deleted_number_cooling_period, refund_ack_window, media_retention,
  level_credit_grace, mobile_session_lifetime, console_session_lifetime,
  console_idle_timeout, console_remembered_lifetime, console_remembered_idle,
  otp_ttl, otp_max_attempts, step_up_freshness, new_device_payout_lock,
  same_seller_cancellation_threshold, same_seller_cooldown,
  cross_seller_cooldown_ladder, cancellation_counter_decay, effective`;
const timingVals = `'48 hours','24 hours','72 hours','7 days','24 hours','7 days',
  '30 days','48 hours','90 days','24 hours','30 days','12 hours','30 minutes',
  '7 days','8 hours','5 minutes',5,'5 minutes','24 hours',3,'1 hour',
  ARRAY['1 day','2 days','4 days']::interval[],'30 days',
  tstzrange('2020-01-01T00:00:00Z','2030-01-01T00:00:00Z','[)')`;

describe('E2-E6 — notification, trust, retention, transport, billing', () => {
  let admin: Pool;
  let h: Harness;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
         display_timezone, default_locale, is_live) VALUES
        ($1,'E2T','Addis','PHASE_1','ETB','Africa/Addis_Ababa','en',false),
        ($2,'E2U','Utc','PHASE_1','ETB','UTC','en',false)`,
      [M, M_UTC],
    );
    for (const market of [M, M_UTC]) {
      await admin.query(
        `INSERT INTO core.timing_config (id, market_id, ${timingCols})
         VALUES (gen_random_uuid(), $1, ${timingVals})`,
        [market],
      );
    }
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251912001701',$3,'ACTIVE'), ($2,'+251912001702',$3,'ACTIVE')`,
      [OWNER, BUYER, M],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, push_token, notification_permission, account_id)
       VALUES ($1,'ANDROID','tok-owner','GRANTED',$2)`,
      [DEVICE, OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
         store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','E2 Store','e2-store','ACTIVE')`,
      [SELLER, M, OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller_public_stats (seller_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [SELLER],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility, published_at)
       VALUES ($1,$2,$3,'E2',1000,'ETB','PUBLISHED', $4)`,
      [PRODUCT, SELLER, M, T0],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key, stock_confirmed_at)
       VALUES ($1,$2,$3,1000,'ETB','one',$4)`,
      [VARIANT, PRODUCT, SELLER, new Date(T0.getTime() - 10 * 86_400_000)],
    );
    // Payout details + credential: the row the evidence purge must NOT touch.
    await admin.query(
      `INSERT INTO core.payout_details (id, seller_id, bank_code, account_last4,
         state, activated_at, requested_by_account_id)
       VALUES ($1,$2,'CBE','4321','ACTIVE',$3,$4)`,
      [PD, SELLER, T0, OWNER],
    );
    await admin.query(
      `INSERT INTO financial.payout_credential (payout_details_id, account_ciphertext,
         account_name_ciphertext, encryption_key_ref)
       VALUES ($1, decode('00','hex'), decode('00','hex'), 'PAYOUT_ENCRYPTION_KEY_V1')`,
      [PD],
    );
    h = createJobHarness(T0);
  });

  afterAll(async () => {
    await h.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM chat.bot_turn WHERE message_id IN (SELECT id FROM chat.message WHERE conversation_id='${CONV}')`,
      `DELETE FROM chat.message WHERE conversation_id='${CONV}'`,
      `DELETE FROM chat.conversation WHERE id='${CONV}'`,
      `DELETE FROM nlu.unmatched_phrase WHERE market_id='${M}'`,
      `DELETE FROM core.claim_evidence_item WHERE claim_id IN (SELECT id FROM core.claim WHERE order_id='${EV_ORDER}')`,
      `DELETE FROM core.claim WHERE order_id='${EV_ORDER}'`,
      `DELETE FROM financial.payment_evidence WHERE order_id='${EV_ORDER}'`,
      `DELETE FROM financial.payout_credential WHERE payout_details_id='${PD}'`,
      `DELETE FROM core.payout_details WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.social_post WHERE id IN ('${SOCIAL_LIVE}','${SOCIAL_GONE}','${SOCIAL_OUTAGE}')`,
      `DELETE FROM core.media_lifecycle WHERE reason='E2_TEST'`,
      `DELETE FROM waitlist.application WHERE reference_code LIKE 'E2T-%'`,
      `DELETE FROM core.idempotency_record WHERE endpoint='E2_TEST'`,
      `DELETE FROM core.rate_limit_bucket WHERE bucket_key='e2-test'`,
      `DELETE FROM billing.collection_record WHERE subscription_id IN (SELECT id FROM billing.subscription WHERE seller_id='${SELLER}')`,
      `DELETE FROM billing.subscription_state_transition WHERE subscription_id IN (SELECT id FROM billing.subscription WHERE seller_id='${SELLER}')`,
      `DELETE FROM billing.subscription WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${BUYER}')`,
      `DELETE FROM core.notification_preference WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.stock_event WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.reservation WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_state_transition WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.cart_line WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.cart WHERE seller_id='${SELLER}'`,
      `DELETE FROM core."order" WHERE market_id='${M}'`,
      `DELETE FROM core.product_variant WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_eligibility_evaluation WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_level_state WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller WHERE id='${SELLER}'`,
      `DELETE FROM core.device WHERE account_id IN ('${OWNER}','${BUYER}') OR id='${DEVICE}'`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id IN ('${M}','${M_UTC}')`,
      `DELETE FROM core.market WHERE id IN ('${M}','${M_UTC}')`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('the registry agrees with ADU-DB-01 S24', () => {
    it('registers exactly the twenty jobs S24 names, and no others', () => {
      const registered = S24_JOBS.map((j) => j.name).sort();
      expect(registered).toHaveLength(20);
      expect(registered).toEqual([...S24_JOB_NAMES].sort());
    });

    it('every job carries a cadence and a note tracing it to the document', () => {
      for (const job of S24_JOBS) {
        expect(job.cron).toBeTruthy();
        expect(job.cadenceNote).toContain('S24');
      }
    });
  });

  describe('E2 — notification', () => {
    const queue = async (opts: {
      channel: string;
      template: string;
      recipient?: string;
      orderId?: string | null;
      suppressible?: boolean;
    }): Promise<string> => {
      const r = await admin.query(
        `INSERT INTO core.notification (recipient_account_id, channel, template_key,
           locale, slots, order_id, suppressible, scheduled_for)
         VALUES ($1,$2::core.notification_channel,$3,'en','{}'::jsonb,$4,$5,$6) RETURNING id`,
        [
          opts.recipient ?? OWNER,
          opts.channel,
          opts.template,
          opts.orderId ?? null,
          opts.suppressible ?? true,
          T0,
        ],
      );
      return r.rows[0].id;
    };
    const stateOf = async (id: string): Promise<string> =>
      (await admin.query(`SELECT state FROM core.notification WHERE id=$1`, [id])).rows[0].state;

    it('sends an SMS once, and the second run sends nothing', async () => {
      const id = await queue({ channel: 'SMS', template: 'E2_SMS' });
      h.clock.set(T0);
      const first = await notificationSend.run(h.ctx);
      expect(first['sent']).toBe(1);
      expect(await stateOf(id)).toBe('SENT');
      const smsCount = h.sms.sent.length;

      const second = await notificationSend.run(h.ctx);
      expect(second['sent']).toBe(0);
      // The provider was called exactly once — the failure that costs money
      // and trust is the second SMS, not the missing one.
      expect(h.sms.sent.length).toBe(smsCount);
    });

    it('does NOT send for an order whose clock has stopped (S17.3 re-read)', async () => {
      const orderId = randomUUID();
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(
        `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state,
           total_minor, total_currency, display_currency, expires_at, clock_stopped_at)
         VALUES ($1,$2,$3,$4,'PAYMENT_CONFIRMED',1000,'ETB','ETB',$5,$5)`,
        [orderId, M, SELLER, BUYER, T0],
      );
      await admin.query(`SET session_replication_role = DEFAULT`);
      const id = await queue({ channel: 'SMS', template: 'E2_STALE', orderId });
      const before = h.sms.sent.length;
      await notificationSend.run(h.ctx);
      // Still queued, never sent: the buyer must not receive "awaiting
      // payment" for an order that was confirmed overnight.
      expect(await stateOf(id)).toBe('QUEUED');
      expect(h.sms.sent.length).toBe(before);
    });

    it('suppresses a disabled suppressible class, and never an unsuppressible one', async () => {
      await admin.query(
        `INSERT INTO core.notification_preference (seller_id, account_id, template_key, enabled)
         VALUES ($1,$2,'E2_OPTOUT',false)`,
        [SELLER, OWNER],
      );
      const optedOut = await queue({ channel: 'SMS', template: 'E2_OPTOUT' });
      const mandatory = await queue({
        channel: 'SMS',
        template: 'PAYOUT_CHANGE_REQUESTED',
        suppressible: false,
      });
      const r = await notificationSend.run(h.ctx);
      expect(r['suppressed']).toBe(1);
      expect(await stateOf(optedOut)).toBe('SUPPRESSED');
      // suppressible = false cannot be turned off — the endpoint refuses the
      // toggle (12.14) and the sender refuses it again here.
      expect(await stateOf(mandatory)).toBe('SENT');
    });

    it('pushes to the registered device and clears a token the provider calls dead', async () => {
      const id = await queue({ channel: 'PUSH', template: 'E2_PUSH' });
      const sent = await notificationPushSeller.run(h.ctx);
      expect(sent['sent']).toBe(1);
      expect(h.push.lastTo('tok-owner')?.templateKey).toBe('E2_PUSH');
      expect(await stateOf(id)).toBe('SENT');

      h.push.outcomes.set('tok-owner', 'TOKEN_DEAD');
      const id2 = await queue({ channel: 'PUSH', template: 'E2_PUSH_DEAD' });
      const dead = await notificationPushSeller.run(h.ctx);
      expect(dead['dead_tokens']).toBe(1);
      expect(await stateOf(id2)).toBe('FAILED');
      const tok = await admin.query(`SELECT push_token FROM core.device WHERE id=$1`, [DEVICE]);
      expect(tok.rows[0].push_token).toBeNull();
      // Restore for later tests.
      await admin.query(`UPDATE core.device SET push_token='tok-owner' WHERE id=$1`, [DEVICE]);
      h.push.outcomes.clear();
    });

    it('the morning reminder fires at 08:00 EAT and NOT at 08:00 UTC (trap 3)', async () => {
      const orderId = randomUUID();
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(
        `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state,
           total_minor, total_currency, display_currency, expires_at, created_at)
         VALUES ($1,$2,$3,$4,'NOTIFIED',1000,'ETB','ETB',$5,$6)`,
        [
          orderId,
          M,
          SELLER,
          BUYER,
          // Far future on purpose: the expiry sweep is global across every
          // market, and a sibling suite advancing its own clock must not
          // expire this order out from under the reminder.
          new Date('2029-01-01T00:00:00.000Z'),
          new Date(EAT_0800.getTime() - 20 * 3_600_000),
        ],
      );
      await admin.query(`SET session_replication_role = DEFAULT`);

      // 08:00 UTC — which is 11:00 in Addis. A UTC implementation would
      // send here, three hours late, and nobody would ever see the bug.
      const remindersFor = async (): Promise<number> =>
        (
          await admin.query(
            `SELECT count(*)::int AS n FROM core.notification
              WHERE order_id=$1 AND template_key='ORDER_AWAITING_PAYMENT_MORNING'`,
            [orderId],
          )
        ).rows[0].n;

      h.clock.set(new Date('2026-06-02T08:00:00.000Z'));
      await notificationMorningReminder.run(h.ctx);
      // Nothing for THIS order: at 08:00 UTC it is 11:00 in Addis, three
      // hours late. A UTC implementation sends here and nobody notices.
      expect(await remindersFor()).toBe(0);

      // 05:00 UTC — 08:00 in Addis.
      h.clock.set(EAT_0800);
      await notificationMorningReminder.run(h.ctx);
      expect(await remindersFor()).toBe(1);

      // Twice in the same morning is still one reminder.
      await notificationMorningReminder.run(h.ctx);
      expect(await remindersFor()).toBe(1);

      const n = await admin.query(
        `SELECT slots FROM core.notification
          WHERE order_id=$1 AND template_key='ORDER_AWAITING_PAYMENT_MORNING'`,
        [orderId],
      );
      expect(n.rows).toHaveLength(1);
      // A deadline is a timestamp, never a duration (S17.3).
      expect(n.rows[0].slots.expires_at).toBeTruthy();
    });
  });

  describe('E3 — trust and stock', () => {
    it('level.recompute sweeps every live seller and is idempotent', async () => {
      h.clock.set(T0);
      const first = await levelRecompute.run(h.ctx);
      expect(Number(first['recomputed'])).toBeGreaterThan(0);
      expect(first['failed']).toBe(0);
      const second = await levelRecompute.run(h.ctx);
      expect(second['failed']).toBe(0);
    });

    it('stock.confidence_nudge nudges a stale variant once per window, and never unpublishes', async () => {
      h.clock.set(T0);
      const first = await stockConfidenceNudge.run(h.ctx);
      expect(Number(first['nudged'])).toBeGreaterThan(0);
      // Second run inside the same window: no second nudge.
      expect((await stockConfidenceNudge.run(h.ctx))['nudged']).toBe(0);
      // S13.3's levels 2-5 are read-time effects; the job has no power to
      // unpublish and the product is still published.
      const p = await admin.query(`SELECT published_at FROM core.product WHERE id=$1`, [PRODUCT]);
      expect(p.rows[0].published_at).not.toBeNull();
    });

    it('social_post.availability_check distinguishes a deleted post from a platform outage', async () => {
      await admin.query(
        `INSERT INTO core.social_post (id, platform, canonical_post_id, status) VALUES
          ($1,'TIKTOK','live-1','LIVE'), ($2,'TIKTOK','gone-1','LIVE'), ($3,'TIKTOK','outage-1','LIVE')`,
        [SOCIAL_LIVE, SOCIAL_GONE, SOCIAL_OUTAGE],
      );
      h.social.registerPost('TIKTOK', 'live-1', true);
      h.social.registerPost('TIKTOK', 'gone-1', false);
      // outage-1 is deliberately unregistered: the fake throws, which is a
      // platform outage.
      const r = await socialPostAvailabilityCheck.run(h.ctx);
      expect(Number(r['unavailable'])).toBeGreaterThanOrEqual(1);

      const rows = await admin.query(
        `SELECT id, status FROM core.social_post WHERE id = ANY($1::uuid[])`,
        [[SOCIAL_LIVE, SOCIAL_GONE, SOCIAL_OUTAGE]],
      );
      const byId = Object.fromEntries(rows.rows.map((x) => [x.id, x.status]));
      expect(byId[SOCIAL_LIVE]).toBe('LIVE');
      expect(byId[SOCIAL_GONE]).toBe('UNAVAILABLE');
      // AN OUTAGE IS NOT A DELETED POST. Marking it UNAVAILABLE would
      // unlink every seller's catalogue during a TikTok incident.
      expect(byId[SOCIAL_OUTAGE]).toBe('UNKNOWN');
    });
  });

  describe('E4 — retention', () => {
    it('the evidence purge leaves PAYOUT CREDENTIALS untouched (S24, the destructive line)', async () => {
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(
        `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state,
           total_minor, total_currency, display_currency, expires_at, clock_stopped_at)
         VALUES ($1,$2,$3,$4,'COMPLETED',1000,'ETB','ETB',$5,$5)`,
        [EV_ORDER, M, SELLER, BUYER, T0],
      );
      await admin.query(
        `INSERT INTO financial.payment_evidence (id, order_id, object_key,
           encryption_key_ref, frame_size_bytes, frame_count, validated_at, retention_reason)
         VALUES ($1,$3,'evidence/keep','EVID_V1',65536,1,$4,'OPEN_CLAIM'),
                ($2,$3,'evidence/purge','EVID_V1',65536,1,$4,NULL)`,
        [EV_KEEP, EV_PURGE, EV_ORDER, T0],
      );
      await admin.query(`SET session_replication_role = DEFAULT`);
      h.evidenceStorage.seed('evidence/keep', Buffer.from('keep'));
      h.evidenceStorage.seed('evidence/purge', Buffer.from('purge'));

      const credsBefore = (
        await admin.query(`SELECT count(*)::int AS n FROM financial.payout_credential`)
      ).rows[0].n;

      const r = await financialPurgePaymentEvidence.run(h.ctx);
      expect(Number(r['purged'])).toBeGreaterThanOrEqual(1);

      // THE ASSERTION THAT MATTERS: every payout credential still exists.
      const credsAfter = (
        await admin.query(`SELECT count(*)::int AS n FROM financial.payout_credential`)
      ).rows[0].n;
      expect(credsAfter).toBe(credsBefore);
      const mine = await admin.query(
        `SELECT count(*)::int AS n FROM financial.payout_credential WHERE payout_details_id=$1`,
        [PD],
      );
      expect(mine.rows[0].n).toBe(1);

      // Evidence pinned by an open claim survives; the unpinned one goes.
      const kept = await admin.query(
        `SELECT deleted_at FROM financial.payment_evidence WHERE id=$1`,
        [EV_KEEP],
      );
      expect(kept.rows[0].deleted_at).toBeNull();
      const purged = await admin.query(
        `SELECT deleted_at FROM financial.payment_evidence WHERE id=$1`,
        [EV_PURGE],
      );
      expect(purged.rows[0].deleted_at).not.toBeNull();

      // Idempotent: nothing left to purge.
      expect((await financialPurgePaymentEvidence.run(h.ctx))['purged']).toBe(0);
    });

    it('media.lifecycle deletes the object before the row, and is idempotent', async () => {
      await admin.query(
        `INSERT INTO core.media_lifecycle (object_key, class, purge_after, reason)
         VALUES ('e2/old.jpg','INFREQUENT',$1,'E2_TEST'), ('e2/new.jpg','INFREQUENT',$2,'E2_TEST')`,
        [new Date(T0.getTime() - 86_400_000), new Date(T0.getTime() + 86_400_000)],
      );
      h.mediaStorage.put('e2/old.jpg', { bytes: 10, contentType: 'image/jpeg' });
      h.clock.set(T0);
      const r = await mediaLifecycle.run(h.ctx);
      expect(r['deleted']).toBe(1);
      const left = await admin.query(
        `SELECT object_key FROM core.media_lifecycle WHERE reason='E2_TEST'`,
      );
      expect(left.rows.map((x) => x.object_key)).toEqual(['e2/new.jpg']);
      expect((await mediaLifecycle.run(h.ctx))['deleted']).toBe(0);
    });

    it('waitlist.retention_purge honours the stamp already on the row (S25)', async () => {
      await admin.query(
        `INSERT INTO waitlist.application (full_name, phone_e164, primary_platform,
           primary_handle, city, consent_at, consent_text_version, reference_code, purge_after,
           sells_what)
         VALUES ('Old','+251913001701','TIKTOK','old','Addis',$1,'v1','E2T-OLD',$2,'scarves'),
                ('New','+251913001702','TIKTOK','new','Addis',$1,'v1','E2T-NEW',$3,'scarves')`,
        [T0, new Date(T0.getTime() - 86_400_000), new Date(T0.getTime() + 400 * 86_400_000)],
      );
      // purge_after is written by a BEFORE trigger (the same shape the media
      // lifecycle uses), so an explicit value on INSERT is overwritten.
      // Backdate it with triggers off — the job's behaviour is what is
      // under test, not the trigger's.
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(
        `UPDATE waitlist.application SET purge_after=$1 WHERE reference_code='E2T-OLD'`,
        [new Date(T0.getTime() - 86_400_000)],
      );
      await admin.query(`SET session_replication_role = DEFAULT`);

      h.clock.set(T0);
      expect((await waitlistRetentionPurge.run(h.ctx))['purged']).toBe(1);
      expect((await waitlistRetentionPurge.run(h.ctx))['purged']).toBe(0);
      const left = await admin.query(
        `SELECT reference_code FROM waitlist.application WHERE reference_code LIKE 'E2T-%'`,
      );
      expect(left.rows.map((x) => x.reference_code)).toEqual(['E2T-NEW']);
    });

    // device.purge_unbound IS NOT TESTED HERE ANY MORE, and that is a fix
    // rather than a loss. apps/api/test/t6-device-retention.spec.ts owns it
    // since T6 Phase A -- written because this test could not detect the
    // change G1.11 is about (register D-65), and it covers the market
    // lookup, the shortest-interval fallback and both wedge guards, none of
    // which this one did.
    //
    // TWO SUITES RUNNING ONE GLOBAL SWEEP IS A FLAKE, not a redundancy. The
    // job deletes carts fleet-wide; run from two jest workers at once, one
    // suite's cart_line INSERT lands between the other's cart_line DELETE
    // and its cart DELETE, and the sweep dies on
    // cart_line_single_seller -- which reads as a real failure in whichever
    // suite happened to lose. Exactly one suite may own a global sweep.
    // Registered as D-83.
  });

  describe('E5 — transport and ledger', () => {
    it('idempotency and rate-limit purges honour their own retention', async () => {
      await admin.query(
        `INSERT INTO core.idempotency_record (id, key, actor_kind, actor_id, endpoint,
           request_hash, response_status, response_body, expires_at)
         VALUES (gen_random_uuid(), gen_random_uuid(),'ACCOUNT',$1,'E2_TEST',
                 decode('00','hex'),200,'{}'::jsonb,$2)`,
        [OWNER, new Date(T0.getTime() - 3_600_000)],
      );
      await admin.query(
        `INSERT INTO core.rate_limit_bucket (subject_kind, subject_id, bucket_key, window_start, count)
         VALUES ('ACCOUNT',$1,'e2-test',$2,1)`,
        [OWNER, new Date(T0.getTime() - 5 * 86_400_000)],
      );
      h.clock.set(T0);
      expect((await idempotencyPurgeExpired.run(h.ctx))['purged']).toBe(1);
      expect((await idempotencyPurgeExpired.run(h.ctx))['purged']).toBe(0);
      expect((await rateLimitPurgeStale.run(h.ctx))['purged']).toBe(1);
      expect((await rateLimitPurgeStale.run(h.ctx))['purged']).toBe(0);
    });

    it('ledger.assert_zero passes at zero and FAILS LOUDLY when the ledger does not balance', async () => {
      h.clock.set(T0);
      await expect(ledgerAssertZero.run(h.ctx)).resolves.toMatchObject({ all_zero: true });

      // Plant an imbalance. fn_assert_balanced guards a TRANSACTION's own
      // entries, so an unbalanced ADULIS position is planted as two
      // transactions that balance internally but leave ADULIS holding.
      const txA = randomUUID();
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(
        `INSERT INTO ledger.transaction (id, kind, reference_kind, reference_id)
         VALUES ($1,'E2_TEST','ORDER',$2)`,
        [txA, EV_ORDER],
      );
      await admin.query(
        `INSERT INTO ledger.entry (transaction_id, account_code, party_kind, direction,
           amount_minor, currency)
         VALUES ($1,'ADULIS:CASH','ADULIS','DEBIT',500,'ETB')`,
        [txA],
      );
      await admin.query(`SET session_replication_role = DEFAULT`);

      await expect(ledgerAssertZero.run(h.ctx)).rejects.toThrow(/non-zero/i);

      await admin.query(`SET session_replication_role = replica`);
      await admin.query(`DELETE FROM ledger.entry WHERE transaction_id=$1`, [txA]);
      await admin.query(`DELETE FROM ledger.transaction WHERE id=$1`, [txA]);
      await admin.query(`SET session_replication_role = DEFAULT`);
      await expect(ledgerAssertZero.run(h.ctx)).resolves.toMatchObject({ all_zero: true });
    });

    it('analytics.create_partition creates ahead and is idempotent', async () => {
      // NOT T0, and that is the whole of this comment. The job creates the
      // NEXT two months from its clock, and T0 (2026-06-01) makes those July
      // and August 2026 -- which drift into the REAL current month as time
      // passes. Any analytics.event another suite writes for "now" then sits
      // in event_default, and CREATE of that month's partition fails with
      // "updated partition constraint for default partition would be
      // violated by some row". The DROP below made it worse: it would take
      // another suite's rows with it.
      //
      // A clock far enough ahead that nothing writes into its months, and
      // the assertion is unchanged: two created, ahead, idempotently.
      const FAR = new Date('2027-06-01T00:00:00.000Z');
      h.clock.set(FAR);
      const first = await analyticsCreatePartition.run(h.ctx);
      expect(first['ensured']).toBe(2);
      expect(String(first['partitions'])).toContain('event_2027_07');
      expect(String(first['partitions'])).toContain('event_2027_08');
      const second = await analyticsCreatePartition.run(h.ctx);
      expect(second['partitions']).toBe(first['partitions']);
      await admin.query(`DROP TABLE IF EXISTS analytics.event_2027_07`);
      await admin.query(`DROP TABLE IF EXISTS analytics.event_2027_08`);
      h.clock.set(T0);
    });
  });

  describe('E6 — billing and NLU', () => {
    it('subscription.warn warns once per milestone, never daily', async () => {
      const trialEnds = new Date(T0.getTime() + 3 * 86_400_000 - 3_600_000);
      await admin.query(
        `INSERT INTO billing.subscription (seller_id, state, tier, term, trial_started_at, trial_ends_at)
         VALUES ($1,'TRIAL','BUSINESS','MONTHLY',$2,$3)`,
        [SELLER, new Date(T0.getTime() - 57 * 86_400_000), trialEnds],
      );
      h.clock.set(T0);
      expect((await subscriptionWarn.run(h.ctx))['enqueued']).toBe(1);
      // Same day again, and the day after: no second 3-day warning.
      expect((await subscriptionWarn.run(h.ctx))['enqueued']).toBe(0);
      const warnings = await admin.query(
        `SELECT count(*)::int AS n FROM core.notification
          WHERE template_key='TRIAL_ENDING' AND recipient_account_id=$1`,
        [OWNER],
      );
      expect(warnings.rows[0].n).toBe(1);
    });

    it('subscription.collect_reminder sends once and stamps the record', async () => {
      const sub = await admin.query(`SELECT id FROM billing.subscription WHERE seller_id=$1`, [
        SELLER,
      ]);
      await admin.query(
        `INSERT INTO billing.collection_record (subscription_id, amount_minor, currency, provider_kind)
         VALUES ($1, 100000, 'ETB', 'BANK_TRANSFER')`,
        [sub.rows[0].id],
      );
      h.clock.set(T0);
      const before = h.sms.sent.length;
      expect((await subscriptionCollectReminder.run(h.ctx))['sent']).toBe(1);
      expect(h.sms.sent.length).toBe(before + 1);
      // Inside the seven-day window, no second nag.
      expect((await subscriptionCollectReminder.run(h.ctx))['sent']).toBe(0);
      expect(h.sms.sent.length).toBe(before + 1);
    });

    it('nlu.harvest_unmatched carries text and NO identity across the store boundary', async () => {
      const buyerMsg = randomUUID();
      const botMsg = randomUUID();
      await admin.query(
        `INSERT INTO chat.conversation (id, seller_id, buyer_account_id, market_id)
         VALUES ($1,$2,$3,$4)`,
        [CONV, SELLER, BUYER, M],
      );
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(
        `INSERT INTO chat.message (id, conversation_id, sender_kind, sender_account_id, body, locale, sent_at)
         VALUES ($1,$3,'BUYER',$4,'do you gift wrap','en',$5),
                ($2,$3,'BOT',NULL,'chat.bot.escalated','en',$6)`,
        [
          buyerMsg,
          botMsg,
          CONV,
          BUYER,
          new Date(T0.getTime() - 3_600_000),
          new Date(T0.getTime() - 3_500_000),
        ],
      );
      await admin.query(
        `INSERT INTO chat.bot_turn (message_id, turn_index, resolution_path, escalated)
         VALUES ($1, 0, 'ESCALATED', true)`,
        [botMsg],
      );
      await admin.query(`SET session_replication_role = DEFAULT`);

      h.clock.set(T0);
      expect((await nluHarvestUnmatched.run(h.ctx))['harvested']).toBe(1);
      // Append-only: a duplicate could never be cleaned up, so the second
      // run must insert nothing.
      expect((await nluHarvestUnmatched.run(h.ctx))['harvested']).toBe(0);

      const phrases = await admin.query(
        `SELECT text, locale, market_id FROM nlu.unmatched_phrase WHERE market_id=$1`,
        [M],
      );
      expect(phrases.rows).toHaveLength(1);
      expect(phrases.rows[0].text).toBe('do you gift wrap');
      // The invariant is what the row does NOT carry (S15.3, check 4).
      const cols = await admin.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='nlu' AND table_name='unmatched_phrase'`,
      );
      const names = cols.rows.map((c) => c.column_name);
      expect(names).not.toContain('conversation_id');
      expect(names).not.toContain('buyer_account_id');
    });
  });
});
