import { sql } from 'kysely';
import type { Job, JobContext, JobResult } from './context';

/**
 * E2 — notification. The three jobs that actually deliver, and the two
 * traps that make delivery wrong in ways nobody sees.
 *
 * TRAP (S17.3) — the sender RE-READS ORDER STATE AT SEND TIME. A
 * notification queued while an order was awaiting payment must not arrive
 * after it was confirmed or cancelled saying it is awaiting payment. The
 * guard is `clock_stopped_at IS NULL` on the order — the SAME column the
 * expiry sweep uses, so the two rules cannot drift apart (S20's invariant).
 *
 * TRAP (S24) — at-least-once delivery. Every send is a compare-and-set from
 * QUEUED to SENT/SUPPRESSED, claimed with FOR UPDATE SKIP LOCKED, so two
 * workers cannot both send one row and a crash after the provider call
 * re-sends at most that row rather than the batch.
 *
 * The channel split between `notification.send` and `notification.push_seller`
 * is by CHANNEL, not by recipient, so no row is eligible for both jobs.
 */

/** How many rows one tick claims. Phase D drained 10k in 99ms at this size. */
const BATCH = 500;

interface Claimable {
  id: string;
  recipient_account_id: string;
  channel: string;
  template_key: string;
  locale: string;
  slots: Record<string, unknown>;
  order_id: string | null;
  suppressible: boolean;
  phone_e164: string;
}

/**
 * Claim a batch of due notifications for one channel set, applying every
 * send-time guard IN THE CLAIM — a row that must not be sent is never
 * handed to a provider, rather than being handed over and skipped.
 */
async function claim(
  ctx: JobContext,
  channels: readonly string[],
  at: Date,
): Promise<{ send: Claimable[]; suppressed: number }> {
  const rows = await ctx.db.transaction().execute(async (trx) => {
    const claimed = await sql<Claimable & { suppress: boolean }>`
      WITH due AS (
        SELECT n.id
          FROM core.notification n
          LEFT JOIN core."order" o ON o.id = n.order_id
         WHERE n.state = 'QUEUED'
           AND n.scheduled_for <= ${at}
           AND n.channel::text = ANY(${sql.val(channels as string[])})
           -- S17.3 / S9.2, re-read AT SEND: no notification for an order
           -- whose clock has stopped. Orderless rows (sign-in, payout) are
           -- unaffected.
           AND (n.order_id IS NULL OR o.clock_stopped_at IS NULL)
         ORDER BY n.scheduled_for
         LIMIT ${BATCH}
           FOR UPDATE OF n SKIP LOCKED
      )
      SELECT n.id, n.recipient_account_id, n.channel::text AS channel,
             n.template_key, n.locale, n.slots, n.order_id, n.suppressible,
             a.phone_e164,
             -- A suppressible class the recipient turned off in the seller
             -- context this notification belongs to. suppressible = false
             -- can never be suppressed - the endpoint refuses the toggle
             -- (12.14) and the sender refuses it again here.
             (n.suppressible AND EXISTS (
                SELECT 1 FROM core.notification_preference p
                 WHERE p.account_id = n.recipient_account_id
                   AND p.template_key = n.template_key
                   AND p.enabled = false
                   AND (n.order_id IS NULL
                        OR p.seller_id = (SELECT o2.seller_id FROM core."order" o2
                                           WHERE o2.id = n.order_id))
             )) AS suppress
        FROM due
        JOIN core.notification n ON n.id = due.id
        JOIN core.account a ON a.id = n.recipient_account_id`.execute(trx);

    const suppress = claimed.rows.filter((r) => r.suppress).map((r) => r.id);
    if (suppress.length > 0) {
      await sql`
        UPDATE core.notification SET state = 'SUPPRESSED'
         WHERE id = ANY(${sql.val(suppress)}::uuid[]) AND state = 'QUEUED'`.execute(trx);
    }
    return {
      send: claimed.rows.filter((r) => !r.suppress),
      suppressed: suppress.length,
    };
  });
  return rows;
}

/** Mark one row sent, only if it is still QUEUED — the compare-and-set. */
async function markSent(ctx: JobContext, id: string, at: Date): Promise<void> {
  await sql`
    UPDATE core.notification
       SET state = 'SENT', sent_at = ${at}
     WHERE id = ${id} AND state = 'QUEUED'`.execute(ctx.db);
}

async function markFailed(ctx: JobContext, id: string): Promise<void> {
  await sql`
    UPDATE core.notification SET state = 'FAILED'
     WHERE id = ${id} AND state = 'QUEUED'`.execute(ctx.db);
}

export const notificationSend: Job = {
  name: 'notification.send',
  cron: '* * * * *',
  cadenceNote: 'S24: 1 min. Re-reads order state at send (S17.3). SMS and IN_APP',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    // IN_APP is the S9.3 fallback for a denied push permission: there is no
    // provider to call, the row IS the delivery, and marking it sent is what
    // moves it into the buyer's list.
    const { send, suppressed } = await claim(ctx, ['SMS', 'IN_APP'], at);

    let sent = 0;
    let failed = 0;
    for (const row of send) {
      try {
        if (row.channel === 'SMS') {
          // The provider call is OUTSIDE any transaction (T4 gate): the
          // claim committed, this row is ours, and a crash here re-sends
          // one row rather than losing or duplicating a batch.
          await ctx.sms.send({
            phone: row.phone_e164,
            templateKey: row.template_key,
            slots: Object.fromEntries(
              Object.entries(row.slots ?? {}).map(([k, v]) => [k, String(v)]),
            ),
          });
        }
        await markSent(ctx, row.id, at);
        sent += 1;
      } catch (e) {
        ctx.log.error({ msg: 'notification.send failed', id: row.id, err: String(e) });
        await markFailed(ctx, row.id);
        failed += 1;
      }
    }
    return { claimed: send.length + suppressed, sent, suppressed, failed };
  },
};

export const notificationPushSeller: Job = {
  name: 'notification.push_seller',
  cron: '* * * * *',
  cadenceNote: "S24: 1 min. Native push to the seller's registered devices (S6.4)",
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    const { send, suppressed } = await claim(ctx, ['PUSH'], at);

    let sent = 0;
    let failed = 0;
    let deadTokens = 0;
    let fellBackToInApp = 0;
    for (const row of send) {
      // Every device the account has registered a token on. A person with
      // two phones gets it on both; a person with none gets no push and the
      // row fails, which is what the IN_APP fallback exists to prevent
      // upstream (S9.3).
      const devices = await sql<{ id: string; push_token: string }>`
        SELECT id, push_token FROM core.device
         WHERE account_id = ${row.recipient_account_id}
           AND push_token IS NOT NULL
           AND notification_permission = 'GRANTED'`.execute(ctx.db);

      if (devices.rows.length === 0) {
        await markFailed(ctx, row.id);
        failed += 1;
        continue;
      }

      let delivered = false;
      let noProvider = false;
      for (const device of devices.rows) {
        const outcome = await ctx.push.send({
          token: device.push_token,
          templateKey: row.template_key,
          locale: row.locale,
          slots: row.slots ?? {},
        });
        if (outcome === 'DELIVERED') delivered = true;
        // T20 S5: no vendor is bound. Not this device's fault and not
        // transient -- so stop asking the devices and fall back once, below.
        if (outcome === 'NO_PROVIDER') noProvider = true;
        if (outcome === 'TOKEN_DEAD') {
          // A permanently dead token is a fact about the device, not about
          // this notification: clearing it stops every future push wasting
          // a provider call, and the device row itself survives (it is the
          // anonymous cart key).
          await sql`
            UPDATE core.device SET push_token = NULL WHERE id = ${device.id}`.execute(ctx.db);
          deadTokens += 1;
        }
      }
      if (delivered) {
        await markSent(ctx, row.id, at);
        sent += 1;
      } else if (noProvider) {
        /*
         * THE IN_APP FALLBACK, WHICH HAD NO PRODUCER (T20 S5).
         *
         * S9.3 names IN_APP as the fallback and the sender has always CLAIMED
         * it -- notification.send takes ['SMS','IN_APP'] -- but nothing ever
         * wrote a row on that channel, so the fallback existed on the read
         * side with no writer. Meanwhile four templates are PUSH-only with no
         * SMS twin (ORDER_AWAITING_PAYMENT_MORNING, STOCK_CONFIDENCE_NUDGE,
         * TRIAL_ENDING and notification.chat.escalated), and with no vendor
         * bound every one of them died FAILED. The escalation is the one that
         * costs money: a buyer asks what the assistant cannot answer, it
         * escalates, and the seller never learns -- a lost sale with no trace.
         *
         * THE ROW IS MOVED, NOT COPIED. A twin row would appear twice in the
         * seller's list, because notifications.controller does not filter by
         * channel: the same event, told twice, which is how a list people must
         * read becomes a list people ignore. Moving it keeps one row per event
         * and leaves it QUEUED, so notification.send -- which already claims
         * IN_APP -- delivers it on its next minute and marks it SENT. The row
         * IS the delivery; there is no provider to call.
         *
         * It needs no vendor and no credentials, which is why this could be
         * built now and the push provider could not.
         */
        await sql`
          UPDATE core.notification SET channel = 'IN_APP'
           WHERE id = ${row.id} AND state = 'QUEUED'`.execute(ctx.db);
        fellBackToInApp += 1;
      } else {
        await markFailed(ctx, row.id);
        failed += 1;
      }
    }
    return {
      claimed: send.length + suppressed,
      sent,
      suppressed,
      failed,
      dead_tokens: deadTokens,
      in_app_fallback: fellBackToInApp,
    };
  },
};

export const notificationMorningReminder: Job = {
  name: 'notification.morning_reminder',
  // Hourly, not daily: 08:00 is per MARKET timezone (S24), so the job wakes
  // every hour and acts only in the markets where it is locally 08:00.
  cron: '0 * * * *',
  cadenceNote: 'S24: daily 08:00 EAT, per market timezone',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();

    // THE TRAP (T4 S2.3 trap 3): 08:00 is resolved in
    // core.market.display_timezone, never UTC. A UTC implementation sends
    // Ethiopia's morning reminder at 11:00 local — the same timezone error
    // the availability override exists to prevent, against the same column.
    const markets = await sql<{ id: string; default_locale: string }>`
      SELECT id, default_locale FROM core.market
       WHERE extract(hour FROM (${at}::timestamptz AT TIME ZONE display_timezone)) = 8`.execute(
      ctx.db,
    );
    if (markets.rows.length === 0) return { markets: 0, enqueued: 0 };

    let enqueued = 0;
    for (const market of markets.rows) {
      // "The morning after" (S9.3): an order still awaiting payment whose
      // clock is running. The reminder states the deadline as a TIMESTAMP,
      // never a duration — a duration is stale the moment it is read from
      // a notification tray (S17.3).
      const inserted = await sql<{ id: string }>`
        INSERT INTO core.notification
          (recipient_account_id, channel, template_key, locale, slots, order_id, suppressible,
           scheduled_for)
        SELECT o.buyer_account_id, 'PUSH', 'ORDER_AWAITING_PAYMENT_MORNING',
               ${market.default_locale},
               jsonb_build_object('expires_at', o.expires_at, 'order_id', o.id::text),
               o.id, true, ${at}
          FROM core."order" o
         WHERE o.market_id = ${market.id}
           AND o.clock_stopped_at IS NULL
           AND o.state IN ('CREATED','NOTIFIED')
           AND o.created_at < ${at}::timestamptz - interval '8 hours'
           -- Idempotent by EFFECT: one morning reminder per order per local
           -- day. A second tick in the same hour, or a retry, finds the row
           -- and inserts nothing.
           AND NOT EXISTS (
             SELECT 1 FROM core.notification n
              WHERE n.order_id = o.id
                AND n.template_key = 'ORDER_AWAITING_PAYMENT_MORNING'
                AND n.scheduled_for > ${at}::timestamptz - interval '20 hours')
        RETURNING id`.execute(ctx.db);
      enqueued += inserted.rows.length;
    }
    return { markets: markets.rows.length, enqueued };
  },
};

export const E2_JOBS: readonly Job[] = [
  notificationSend,
  notificationPushSeller,
  notificationMorningReminder,
];
