import { sql } from 'kysely';
import type { Job, JobContext, JobResult } from './context';

/**
 * E6 — billing and NLU. Two reminders that must not nag, and the ETL that
 * is the whole reason the two chat stores are separate.
 */

export const subscriptionWarn: Job = {
  name: 'subscription.warn',
  cron: '0 5 * * *',
  cadenceNote: 'S24: daily. 14, 3, 1 day (S16.3)',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    // S16.3: "Warnings at 14 days, 3 days and 1 day." Three warnings, not a
    // daily countdown — the trial is 60 days from each seller's OWN signup,
    // so the milestone is computed per subscription and never from a
    // calendar cutoff.
    let enqueued = 0;
    for (const days of [14, 3, 1]) {
      const inserted = await sql<{ id: string }>`
        INSERT INTO core.notification
          (recipient_account_id, channel, template_key, locale, slots, suppressible, scheduled_for)
        SELECT s.owner_account_id, 'PUSH', 'TRIAL_ENDING', m.default_locale,
               jsonb_build_object('days_remaining', ${days}::int,
                                  'trial_ends_at', sub.trial_ends_at),
               true, ${at}
          FROM billing.subscription sub
          JOIN core.seller s ON s.id = sub.seller_id
          JOIN core.market m ON m.id = s.market_id
         WHERE sub.state = 'TRIAL'
           AND sub.trial_ends_at IS NOT NULL
           -- The day this milestone falls on, in whole days: >= days-1 and
           -- < days keeps each seller in exactly one bucket per run.
           AND sub.trial_ends_at >= ${at}::timestamptz + make_interval(days => ${days}::int - 1)
           AND sub.trial_ends_at <  ${at}::timestamptz + make_interval(days => ${days}::int)
           -- Idempotent by effect: one warning per milestone per seller,
           -- ever. A re-run, or two ticks in a day, insert nothing.
           AND NOT EXISTS (
             SELECT 1 FROM core.notification n
              WHERE n.recipient_account_id = s.owner_account_id
                AND n.template_key = 'TRIAL_ENDING'
                AND (n.slots ->> 'days_remaining')::int = ${days}::int
                AND n.scheduled_for > sub.trial_started_at)
        RETURNING id`.execute(ctx.db);
      enqueued += inserted.rows.length;
    }
    return { enqueued };
  },
};

export const subscriptionCollectReminder: Job = {
  name: 'subscription.collect_reminder',
  cron: '30 5 * * *',
  cadenceNote: 'S24: per schedule. SMS (S16.7)',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();

    // G1.7 -- THE EXIT CONDITION, FIRST. Before this call the loop below
    // had none: reconciled_at was the only way out and no code wrote it, so
    // every open record SMSed its seller every seven days forever. Worse,
    // core.fn_delete_seller_effects cancels a deleted seller's subscription
    // but holds no grant on collection_record, and core.fn_delete_account
    // has by then rewritten that account's phone to a synthetic '+999...'
    // number -- so the terminal state was an SMS provider called every
    // seven days, in perpetuity, with a fabricated number, for an account
    // that no longer exists.
    //
    // NOT A TWENTY-FIRST JOB. ADU-DB-01 S24's table IS the job set and the
    // registry asserts exactly its twenty names. The job whose termination
    // condition was missing is the right owner of it anyway.
    const closed = await sql<{ n: number }>`
      SELECT billing.fn_close_stale_collections() AS n`.execute(ctx.db);

    // An outstanding collection the seller has not yet said they paid.
    // reminder_sent_at is BOTH the idempotency guard and the record: the
    // compare-and-set on it means a crash after the SMS at worst skips a
    // later reminder, never repeats today's.
    const due = await sql<{ id: string; owner_account_id: string; locale: string; phone: string }>`
      UPDATE billing.collection_record cr
         SET reminder_sent_at = ${at}
        FROM billing.subscription sub, core.seller s, core.market m, core.account a
       WHERE sub.id = cr.subscription_id
         AND s.id = sub.seller_id
         AND m.id = s.market_id
         AND a.id = s.owner_account_id
         AND cr.marked_transferred_at IS NULL
         AND cr.reconciled_at IS NULL
         AND cr.voided_at IS NULL
         AND (cr.reminder_sent_at IS NULL
              OR cr.reminder_sent_at < ${at}::timestamptz - interval '7 days')
       RETURNING cr.id, s.owner_account_id, m.default_locale AS locale, a.phone_e164 AS phone`.execute(
      ctx.db,
    );

    let sent = 0;
    for (const row of due.rows) {
      try {
        // S16.7 says SMS. The provider call is after the claim committed.
        await ctx.sms.send({
          phone: row.phone,
          templateKey: 'sms.billing.collection_reminder',
          slots: { collection_id: row.id },
        });
        sent += 1;
      } catch (e) {
        ctx.log.error({ msg: 'collection reminder failed', id: row.id, err: String(e) });
      }
    }
    return { closed: Number(closed.rows[0]?.n ?? 0), due: due.rows.length, sent };
  },
};

export const nluHarvestUnmatched: Job = {
  name: 'nlu.harvest_unmatched',
  cron: '0 4 * * *',
  cadenceNote: 'S24: daily. Identity-stripped ETL (S15.3)',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();

    // THE POINT OF THIS JOB IS WHAT IT DOES NOT CARRY (S15.3, check 4).
    // nlu.unmatched_phrase has no conversation_id and no buyer_id, and that
    // absence is the invariant: the operational conversation record and the
    // identity-stripped phrase library are two stores, and this is the only
    // path between them. It reads chat and writes nlu, one way, carrying
    // text, locale and a bare market id — nothing that identifies a person.
    const harvested = await sql`
      INSERT INTO nlu.unmatched_phrase (text, locale, market_id, observed_at)
      SELECT m.body, m.locale, c.market_id, m.sent_at
        FROM chat.bot_turn bt
        JOIN chat.message bot ON bot.id = bt.message_id
        JOIN chat.conversation c ON c.id = bot.conversation_id
        -- The BUYER message that provoked the escalation: the last buyer
        -- line before the bot's. That text is the unmatched phrase; the
        -- bot's own message is a template key and would teach nothing.
        JOIN LATERAL (
          SELECT m2.body, m2.locale, m2.sent_at
            FROM chat.message m2
           WHERE m2.conversation_id = bot.conversation_id
             AND m2.sender_kind = 'BUYER'
             AND m2.sent_at <= bot.sent_at
           ORDER BY m2.sent_at DESC
           LIMIT 1) m ON true
       WHERE bt.escalated
         AND bot.sent_at >= ${at}::timestamptz - interval '1 day'
         AND bot.sent_at <  ${at}
         -- Idempotent: the same phrase from the same instant is one row.
         -- unmatched_phrase is append-only, so a duplicate could never be
         -- cleaned up afterwards.
         AND NOT EXISTS (
           SELECT 1 FROM nlu.unmatched_phrase u
            WHERE u.text = m.body AND u.observed_at = m.sent_at)`.execute(ctx.db);
    return { harvested: Number(harvested.numAffectedRows ?? 0) };
  },
};

export const E6_JOBS: readonly Job[] = [
  subscriptionWarn,
  subscriptionCollectReminder,
  nluHarvestUnmatched,
];
