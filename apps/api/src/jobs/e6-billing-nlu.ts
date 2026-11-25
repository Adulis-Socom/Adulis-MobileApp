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
  nluHarvestUnmatched,
];
