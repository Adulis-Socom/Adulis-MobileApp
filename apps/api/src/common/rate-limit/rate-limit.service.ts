import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { APP_DATABASE } from '../db/database.module';
import type { Database } from '../db/database.types';
import { AdulisException } from '../errors/adulis-exception';

/**
 * The origin-tier rate limit (ADU-API-01 section 10, ADU-AUTH-01 section
 * 22): a fixed-window token bucket in core.rate_limit_bucket, because
 * Postgres is the sole datastore and the queue, the cache and the limiter
 * do not each get their own infrastructure.
 *
 * One small write per limited request, on top of the session read — the
 * accepted cost, priced in ADU-CON-02 section 17 and worth measuring
 * before it is not. The EDGE tier (Cloudflare, by IP and ASN) fields all
 * anonymous read volume; nothing anonymous reaches this table.
 *
 * INVARIANT — a phone-keyed limit stores a HASH, never the number. The OTP
 * limit must work before an account exists, which is precisely when the
 * raw number would otherwise sit in a counter table with no retention
 * story and no DPIA coverage. Keyed (HMAC), not bare SHA-256: the phone
 * number space is small enough to walk, so an unkeyed digest is the number
 * wearing a hat.
 *
 * INVARIANT — a rate-limit rejection never reveals whether the number
 * belongs to an account: RATE_LIMITED with Retry-After, identical for a
 * known and an unknown number.
 */

export type RateLimitSubjectKind = 'ACCOUNT' | 'DEVICE' | 'PHONE_HASH' | 'IP_HASH';

export interface RateLimitRule {
  /** Names the endpoint family; one bucket row per (subject, key, window). */
  readonly bucketKey: string;
  readonly windowSeconds: number;
  readonly max: number;
}

@Injectable()
export class RateLimitService {
  constructor(@Inject(APP_DATABASE) private readonly db: Kysely<Database>) {}

  /**
   * Count this request against the rule; 429 when the window is full.
   * Fixed windows: window_start is now() floored to the window length, so
   * the primary key does the bucketing and the purge job's predicate
   * ("older than the widest window") stays a one-liner.
   */
  async consume(
    kind: RateLimitSubjectKind,
    subjectId: string,
    rule: RateLimitRule,
  ): Promise<void> {
    const r = await sql<{ count: number; window_start: Date }>`
      INSERT INTO core.rate_limit_bucket
        (subject_kind, subject_id, bucket_key, window_start, count)
      VALUES (
        ${kind}, ${subjectId}, ${rule.bucketKey},
        to_timestamp(floor(extract(epoch FROM now()) / ${rule.windowSeconds})
                     * ${rule.windowSeconds}),
        1)
      ON CONFLICT (subject_kind, subject_id, bucket_key, window_start)
      DO UPDATE SET count = core.rate_limit_bucket.count + 1
      RETURNING count, window_start`.execute(this.db);

    const row = r.rows[0];
    if (!row) return;
    if (row.count > rule.max) {
      const windowEnd = new Date(row.window_start.getTime() + rule.windowSeconds * 1000);
      const retryAfter = Math.max(1, Math.ceil((windowEnd.getTime() - Date.now()) / 1000));
      throw new AdulisException('RATE_LIMITED', {
        slots: { retry_after_seconds: retryAfter },
      });
    }
  }
}

/**
 * The keyed phone/IP digest. Reuses the identity hash key — one secret,
 * versioned like the rest (`..._V1`) — with a domain prefix so a
 * rate-limit digest can never collide with an identity digest of the same
 * input.
 */
export function subjectHash(raw: string, key: string): string {
  return createHmac('sha256', key).update(`rl:${raw}`).digest('hex');
}
