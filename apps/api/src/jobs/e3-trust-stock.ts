import { sql } from 'kysely';
import type { Job, JobContext, JobResult } from './context';

/**
 * E3 — trust and stock. The three jobs that keep derived state honest when
 * nothing happened: a window expiring is not an event, so only a sweep
 * notices it.
 */

export const levelRecompute: Job = {
  name: 'level.recompute',
  cron: '30 2 * * *',
  cadenceNote: 'S24: on write + nightly sweep. The nightly catches window expiry',
  async run(ctx: JobContext): Promise<JobResult> {
    // WHY A SWEEP EXISTS AT ALL: the ladder's inputs are rates over a
    // trailing window (S5.1). A seller whose last handoff falls out of the
    // 90-day window has changed level without anything being written — no
    // trigger can fire on the passage of time, so the nightly pass is the
    // only thing that notices.
    //
    // fn_recompute_seller_level is the authority and is definer-owned: it
    // reads the ladder helpers as their owner, which is why revoking those
    // from PUBLIC in 0025 did not break it.
    const sellers = await sql<{ id: string }>`
      SELECT id FROM core.seller WHERE status IN ('ACTIVE','CLOSING','BILLING_SUSPENDED')`.execute(
      ctx.db,
    );
    let recomputed = 0;
    let failed = 0;
    for (const seller of sellers.rows) {
      try {
        // One transaction per seller: the sweep must not be all-or-nothing
        // across every seller in the market.
        await ctx.db.transaction().execute(async (trx) => {
          await sql`
            SELECT core.fn_recompute_seller_level(${seller.id}, false, NULL)`.execute(trx);
        });
        recomputed += 1;
      } catch (e) {
        ctx.log.error({ msg: 'level.recompute failed', seller: seller.id, err: String(e) });
        failed += 1;
      }
    }
    return { sellers: sellers.rows.length, recomputed, failed };
  },
};

export const stockConfidenceNudge: Job = {
  name: 'stock.confidence_nudge',
  cron: '5 * * * *',
  cadenceNote: 'S24: hourly. Levels 1-5, 3-hourly once critical (S13.3)',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();

    // S13.3's graduated consequences are READ-TIME, every one of them: a
    // staleness notice on the product page (2), a hedging chatbot (3), a
    // degraded badge (4), blocked broadcasts (5). Each is computed from
    // v_stock_confidence where it is displayed. The JOB owns exactly one
    // effect — level 1, "seller nudged to confirm" — and deliberately holds
    // no power to unpublish anything.
    //
    // The cadence rule ("3-hourly once critical") is a REMINDER INTERVAL,
    // not a second escalation: a critical variant is nudged more often, not
    // punished more.
    const due = await sql<{ seller_id: string; variant_id: string; confidence_level: number }>`
      SELECT v.seller_id, c.variant_id, c.confidence_level
        FROM core.v_stock_confidence c
        JOIN core.product_variant v ON v.id = c.variant_id
        JOIN core.product p ON p.id = v.product_id
       WHERE c.confidence_level >= 2
         AND p.published_at IS NOT NULL
         AND v.status = 'ACTIVE'
         AND NOT EXISTS (
           SELECT 1 FROM core.notification n
            WHERE n.template_key = 'STOCK_CONFIDENCE_NUDGE'
              AND n.slots ->> 'variant_id' = c.variant_id::text
              AND n.scheduled_for > ${at}::timestamptz
                - CASE WHEN c.confidence_level >= 4
                       THEN interval '3 hours' ELSE interval '24 hours' END)
       LIMIT 500`.execute(ctx.db);

    let nudged = 0;
    for (const row of due.rows) {
      const inserted = await sql<{ id: string }>`
        INSERT INTO core.notification
          (recipient_account_id, channel, template_key, locale, slots, suppressible, scheduled_for)
        SELECT s.owner_account_id, 'PUSH', 'STOCK_CONFIDENCE_NUDGE', m.default_locale,
               jsonb_build_object('variant_id', ${row.variant_id}::text,
                                  'confidence_level', ${row.confidence_level}::int),
               true, ${at}
          FROM core.seller s JOIN core.market m ON m.id = s.market_id
         WHERE s.id = ${row.seller_id}
        RETURNING id`.execute(ctx.db);
      nudged += inserted.rows.length;
    }
    return { due: due.rows.length, nudged };
  },
};

export const socialPostAvailabilityCheck: Job = {
  name: 'social_post.availability_check',
  cron: '40 4 * * *',
  cadenceNote: 'S24: daily (S9.6)',
  async run(ctx: JobContext): Promise<JobResult> {
    // S9.6: a post a seller linked can be deleted on the platform. The
    // storefront must stop claiming it exists, and the check is an ADAPTER
    // call — the platform is the only authority on its own content.
    const posts = await sql<{ id: string; platform: string; canonical_post_id: string }>`
      SELECT id, platform::text AS platform, canonical_post_id
        FROM core.social_post
       WHERE status <> 'UNAVAILABLE'
       ORDER BY first_seen_at
       LIMIT 200`.execute(ctx.db);

    let unavailable = 0;
    let live = 0;
    let unknown = 0;
    for (const post of posts.rows) {
      let status: 'LIVE' | 'UNAVAILABLE' | 'UNKNOWN';
      try {
        // The adapter call is outside any transaction, deliberately.
        const present = await ctx.social.postExists(post.platform, post.canonical_post_id);
        status = present ? 'LIVE' : 'UNAVAILABLE';
      } catch (e) {
        // A PLATFORM OUTAGE IS NOT A DELETED POST. UNKNOWN exists in the
        // enum for exactly this, and marking an outage as UNAVAILABLE would
        // quietly unlink every seller's catalogue during a TikTok incident.
        ctx.log.warn({ msg: 'social_post check failed', post: post.id, err: String(e) });
        status = 'UNKNOWN';
      }
      if (status === 'UNAVAILABLE') unavailable += 1;
      else if (status === 'LIVE') live += 1;
      else unknown += 1;
      await sql`
        UPDATE core.social_post SET status = ${status}::core.social_post_status
         WHERE id = ${post.id}`.execute(ctx.db);
    }
    return { checked: posts.rows.length, live, unavailable, unknown };
  },
};

export const E3_JOBS: readonly Job[] = [
  levelRecompute,
  stockConfidenceNudge,
  socialPostAvailabilityCheck,
];
