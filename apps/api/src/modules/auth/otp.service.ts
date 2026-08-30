import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { sql, type Kysely, type Transaction } from 'kysely';
import { APP_DATABASE } from '../../common/db/database.module';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';
import { resolveKey } from '../../common/crypto/aead';
import type { SmsMessage } from './sms.adapter';

/**
 * The one-time code (ADU-AUTH-01 section 4), shared by sign-in, step-up and
 * the deletion ticket.
 *
 *  - CSPRNG, uniform, 6 digits; hash only, never plaintext (4.1).
 *  - Exactly one live challenge per (phone, purpose): issuing supersedes
 *    (4.2). A superseded code answers with the expired error, whose string
 *    tells the person to check for a newer message — the specific
 *    OTP_SUPERSEDED code ADU-AUTH-01 4.2 names does not exist in
 *    ADU-API-01 7.1's closed taxonomy, and the wire contract governs wire
 *    behaviour (registered, amendment owed).
 *  - 5 attempts per challenge, then the challenge is dead (4.1); three dead
 *    challenges in an hour lock the phone for an hour (section 22).
 *  - OTP_INVALID never distinguishes a wrong code from an unknown phone
 *    (section 22 — the sign-in form must not be an enumeration oracle).
 *
 * The keyed hash: HMAC over `otp:{challenge}:{code}` with the identity
 * hash key. A plain digest of a 6-digit code is a 10^6 rainbow table; the
 * key never enters PostgreSQL (R15's doctrine).
 */

export interface OtpChallengeRow {
  id: string;
  phone_e164: string;
  purpose: string;
  attempt_count: number;
  expires_at: Date;
  consumed_at: Date | null;
  step_up_action: string | null;
}

interface TimingRow {
  otp_ttl: string;
  otp_max_attempts: number;
}

const otpKey = (): Buffer =>
  resolveKey(process.env['IDENTITY_HASH_KEY_V1'], 'OTP_HASH');

export function codeHash(challengeId: string, code: string): Buffer {
  return createHmac('sha256', otpKey()).update(`otp:${challengeId}:${code}`).digest();
}

@Injectable()
export class OtpService {
  constructor(@Inject(APP_DATABASE) private readonly db: Kysely<Database>) {}

  /**
   * A wrong guess must SURVIVE the request that carried it: the handler
   * transaction rolls back on the raise, so the attempt counter is written
   * on its own connection, outside that transaction. Without this, five
   * wrong guesses arrive as five requests that each roll their increment
   * back, and the attempt budget is fiction.
   */
  private async burnAttempt(challengeId: string, maxAttempts: number): Promise<never> {
    const r = await sql<{ attempt_count: number }>`
      UPDATE core.otp_challenge SET attempt_count = attempt_count + 1
       WHERE id = ${challengeId}
       RETURNING attempt_count`.execute(this.db);
    if ((result_first(r.rows)?.attempt_count ?? 0) >= maxAttempts) {
      throw new AdulisException('OTP_ATTEMPTS_EXCEEDED');
    }
    throw new AdulisException('OTP_INVALID');
  }

  /**
   * The market timing that governs this phone: the account's market where an
   * account exists, and THE DEVICE'S market before one does -- which is the
   * same market the account is about to be created in (ADU-RUL-03 S3).
   *
   * The second arm was `SELECT m.id FROM core.market m WHERE m.is_live LIMIT
   * 1`: unordered, unconstrained, and answering a question nobody asked --
   * which market a person belongs to. /v1/bootstrap is the only place that
   * is decided now, and this reads its answer off the device.
   *
   * Absent configuration still fails closed, and so does an absent device:
   * both leave the coalesce NULL, no row matches, and the caller gets a
   * refusal rather than a guess.
   */
  private async timingFor(
    trx: Transaction<Database>,
    phone: string,
    deviceId: string | null,
    requireDevice: boolean,
  ): Promise<TimingRow> {
    /**
     * THE REFUSAL LOOKS AT THE CALLER'S OWN DEVICE, NEVER AT THE PHONE.
     *
     * The first version refused when coalesce(account market, device market)
     * came back NULL, which made the refusal depend on whether the phone had
     * an account -- so `POST /v1/auth/otp/resend` answered 202 for a
     * registered number and 400 for an unregistered one. That is an
     * account-enumeration oracle on an unauthenticated, unthrottled endpoint,
     * and ADU-AUTH-01 S22 forbids it in as many words: "a rate-limit
     * rejection never reveals whether the number belongs to an account...
     * otherwise the sign-in form is an account-enumeration oracle, and in
     * this product an account is a business." This file's own header says the
     * same thing. I wrote the oracle while removing a different defect.
     *
     * So the device is checked FIRST and ALONE. Every anonymous caller on a
     * phone-taking endpoint must present a bootstrapped device, whoever the
     * phone belongs to, and the answer is identical either way.
     */
    let deviceMarket: string | null = null;
    if (requireDevice) {
      const d = await sql<{ market_id: string | null }>`
        SELECT market_id FROM core.device WHERE id = ${deviceId}`.execute(trx);
      deviceMarket = result_first(d.rows)?.market_id ?? null;
      if (!deviceMarket) {
        throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'bootstrap' } });
      }
    }

    // The account's market still governs where one exists -- timing is
    // per-market configuration and a person's account names their market.
    const m = await sql<{ market_id: string | null }>`
      SELECT coalesce(
        (SELECT a.market_id FROM core.account a WHERE a.phone_e164 = ${phone}),
        ${deviceMarket}::uuid
      ) AS market_id`.execute(trx);
    const marketId = result_first(m.rows)?.market_id ?? null;
    if (!marketId) {
      // Reachable only on the authenticated paths, where an account always
      // exists; a missing one there is our problem, not the caller's.
      throw new AdulisException('INTERNAL');
    }

    const r = await sql<TimingRow>`
      SELECT tc.otp_ttl::text AS otp_ttl, tc.otp_max_attempts
        FROM core.timing_config tc
       WHERE tc.effective @> now()
         AND tc.market_id = ${marketId}
       LIMIT 1`.execute(trx);
    const row = result_first(r.rows);
    if (!row) throw new AdulisException('INTERNAL');
    return row;
  }

  /**
   * Section 22's phone lockout: three dead challenges in the last hour is
   * an hour-long block, indistinguishable for a known and unknown number.
   */
  private async assertNotLockedOut(
    trx: Transaction<Database>,
    phone: string,
    maxAttempts: number,
  ): Promise<void> {
    const r = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM core.otp_challenge
       WHERE phone_e164 = ${phone}
         AND attempt_count >= ${maxAttempts}
         AND created_at > now() - interval '1 hour'`.execute(trx);
    if ((result_first(r.rows)?.n ?? 0) >= 3) {
      throw new AdulisException('RATE_LIMITED', {
        slots: { retry_after_seconds: 3600 },
      });
    }
  }

  /**
   * The resend ladder (4.3, section 22): 3 per 15 minutes, exponential
   * backoff 30s -> 60s -> 120s surfaced as Retry-After. Counted off the
   * challenge table itself — the issue history IS the counter.
   */
  async assertResendAllowed(
    trx: Transaction<Database>,
    phone: string,
    purpose: 'SIGN_IN' | 'STEP_UP' | 'ACCOUNT_DELETION',
  ): Promise<void> {
    const r = await sql<{ n: number; last: Date | null }>`
      SELECT count(*)::int AS n, max(created_at) AS last
        FROM core.otp_challenge
       WHERE phone_e164 = ${phone}
         AND purpose = ${purpose}::core.otp_purpose
         AND created_at > now() - interval '15 minutes'`.execute(trx);
    const row = result_first(r.rows);
    if (!row || row.n === 0 || row.last === null) return;
    if (row.n >= 3) {
      throw new AdulisException('RATE_LIMITED', { slots: { retry_after_seconds: 900 } });
    }
    const backoff = [30, 60, 120][Math.min(row.n - 1, 2)] as number;
    const allowedAt = new Date(row.last).getTime() + backoff * 1000;
    if (Date.now() < allowedAt) {
      throw new AdulisException('RATE_LIMITED', {
        slots: { retry_after_seconds: Math.ceil((allowedAt - Date.now()) / 1000) },
      });
    }
  }

  /**
   * Issue a challenge, superseding any live one for the (phone, purpose)
   * pair — 4.2's invariant, done by expiring the prior rows so a stale
   * code verifies as expired, not as invalid.
   *
   * Returns the SMS to send — the CALLER transmits it after the
   * transaction commits, so a rolled-back issue sends nothing and an
   * idempotent replay (which never re-executes this) sends nothing (4.3).
   */
  async issueChallenge(
    trx: Transaction<Database>,
    args: {
      phone: string;
      purpose: 'SIGN_IN' | 'STEP_UP' | 'ACCOUNT_DELETION';
      stepUpAction?: string;
      templateKey: string;
      extraSlots?: Record<string, string>;
      /**
       * The device this request speaks for. Required on every ANONYMOUS
       * phone-taking path -- sign-in and account deletion both let a caller
       * name any phone, so both must answer identically whether or not that
       * phone is known, and the only phone-independent thing to check is the
       * caller's own device.
       */
      deviceId?: string | null;
      /** False only for authenticated paths, which resolve via the account. */
      requireDevice?: boolean;
    },
  ): Promise<{ challengeId: string; expiresAt: Date; sms: SmsMessage }> {
    const timing = await this.timingFor(
      trx,
      args.phone,
      args.deviceId ?? null,
      args.requireDevice ?? true,
    );
    await this.assertNotLockedOut(trx, args.phone, timing.otp_max_attempts);

    await sql`
      UPDATE core.otp_challenge
         SET expires_at = now()
       WHERE phone_e164 = ${args.phone}
         AND purpose = ${args.purpose}::core.otp_purpose
         AND consumed_at IS NULL
         AND expires_at > now()`.execute(trx);

    const id = randomUUID();
    // CSPRNG, uniform over the full 10^6 space; zero-padded for the keypad.
    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const hash = codeHash(id, code);

    const inserted = await sql<{ expires_at: Date }>`
      INSERT INTO core.otp_challenge
        (id, purpose, phone_e164, code_hash, expires_at, step_up_action)
      VALUES (${id}, ${args.purpose}::core.otp_purpose, ${args.phone}, ${hash},
              now() + ${timing.otp_ttl}::interval,
              ${args.stepUpAction ?? null}::core.step_up_action)
      RETURNING expires_at`.execute(trx);

    const expiresAt = result_first(inserted.rows)?.expires_at as Date;
    return {
      challengeId: id,
      expiresAt,
      sms: {
        phone: args.phone,
        templateKey: args.templateKey,
        slots: { code, ...(args.extraSlots ?? {}) },
      },
    };
  }

  /**
   * Verify a code against the live challenge for (phone, purpose) and
   * consume it. Every failure is one of the section 7.1 auth codes; every
   * comparison is constant-time.
   */
  async verifyCode(
    trx: Transaction<Database>,
    args: {
      phone: string;
      purpose: 'SIGN_IN' | 'STEP_UP' | 'ACCOUNT_DELETION';
      code: string;
      deviceId?: string | null;
      requireDevice?: boolean;
    },
  ): Promise<OtpChallengeRow> {
    const timing = await this.timingFor(
      trx,
      args.phone,
      args.deviceId ?? null,
      args.requireDevice ?? true,
    );

    // No FOR UPDATE here: the attempt counter writes on a second
    // connection (burnAttempt), and a row lock held by this transaction
    // would deadlock against it. Single consumption is serialised by the
    // conditional consume below instead.
    const live = await sql<OtpChallengeRow>`
      SELECT id, phone_e164, purpose::text AS purpose, attempt_count,
             expires_at, consumed_at, step_up_action::text AS step_up_action,
             code_hash
        FROM core.otp_challenge
       WHERE phone_e164 = ${args.phone}
         AND purpose = ${args.purpose}::core.otp_purpose
         AND consumed_at IS NULL
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1`.execute(trx);

    const row = result_first(live.rows) as
      | (OtpChallengeRow & { code_hash: Buffer })
      | undefined;

    if (!row) {
      // No live challenge. If the code matches a RECENTLY superseded or
      // expired one, say expired — 4.2's "check for a newer message" —
      // otherwise the enumeration-safe invalid.
      const recent = await sql<{ id: string; code_hash: Buffer }>`
        SELECT id, code_hash FROM core.otp_challenge
         WHERE phone_e164 = ${args.phone}
           AND purpose = ${args.purpose}::core.otp_purpose
           AND consumed_at IS NULL
           AND created_at > now() - interval '15 minutes'`.execute(trx);
      for (const old of recent.rows) {
        if (constantTimeMatches(old.code_hash, codeHash(old.id, args.code))) {
          throw new AdulisException('OTP_EXPIRED');
        }
      }
      throw new AdulisException('OTP_INVALID');
    }

    if (row.attempt_count >= timing.otp_max_attempts) {
      // Dead means dead — no reset by requesting a new one (4.1).
      throw new AdulisException('OTP_ATTEMPTS_EXCEEDED');
    }

    if (!constantTimeMatches(row.code_hash, codeHash(row.id, args.code))) {
      // A code from a SUPERSEDED challenge is expired, not wrong (4.2's
      // "check for a newer message"), and burns no attempt on the live one.
      const recent = await sql<{ id: string; code_hash: Buffer }>`
        SELECT id, code_hash FROM core.otp_challenge
         WHERE phone_e164 = ${args.phone}
           AND purpose = ${args.purpose}::core.otp_purpose
           AND consumed_at IS NULL
           AND id <> ${row.id}
           AND created_at > now() - interval '15 minutes'`.execute(trx);
      for (const old of recent.rows) {
        if (constantTimeMatches(old.code_hash, codeHash(old.id, args.code))) {
          throw new AdulisException('OTP_EXPIRED');
        }
      }
      return this.burnAttempt(row.id, timing.otp_max_attempts);
    }

    // Conditional consume: of two concurrent correct verifies, exactly one
    // proceeds; the loser reads zero rows.
    const consumed = await sql<{ id: string }>`
      UPDATE core.otp_challenge SET consumed_at = now()
       WHERE id = ${row.id} AND consumed_at IS NULL
       RETURNING id`.execute(trx);
    if (!result_first(consumed.rows)) throw new AdulisException('OTP_INVALID');
    return row;
  }

  /**
   * Verify against ONE named challenge (the step-up path: the
   * step_up_challenge row names its otp_challenge_id, so the lookup is by
   * id, not by phone). Same budget, same constant-time compare, same
   * consumption.
   */
  async verifyChallengeById(
    trx: Transaction<Database>,
    challengeId: string,
    code: string,
  ): Promise<void> {
    const r = await sql<{
      id: string;
      phone_e164: string;
      attempt_count: number;
      expires_at: Date;
      consumed_at: Date | null;
      code_hash: Buffer;
    }>`
      SELECT id, phone_e164, attempt_count, expires_at, consumed_at, code_hash
        FROM core.otp_challenge
       WHERE id = ${challengeId}`.execute(trx);
    const row = result_first(r.rows);
    if (!row || row.consumed_at) throw new AdulisException('OTP_INVALID');
    if (new Date() > row.expires_at) throw new AdulisException('OTP_EXPIRED');

    // No device, and none required: this path verifies a challenge by ID and
    // its ONLY caller is step-up (auth.service), which is authenticated --
    // the account exists, so the account arm always resolves and there is no
    // anonymous caller to leak anything to. Deletion does NOT come through
    // here; it uses verifyCode, and it threads a device like every other
    // anonymous phone-taking path.
    const timing = await this.timingFor(trx, row.phone_e164, null, false);
    if (row.attempt_count >= timing.otp_max_attempts) {
      throw new AdulisException('OTP_ATTEMPTS_EXCEEDED');
    }
    if (!constantTimeMatches(row.code_hash, codeHash(row.id, code))) {
      return this.burnAttempt(row.id, timing.otp_max_attempts);
    }
    const consumed = await sql<{ id: string }>`
      UPDATE core.otp_challenge SET consumed_at = now()
       WHERE id = ${row.id} AND consumed_at IS NULL
       RETURNING id`.execute(trx);
    if (!result_first(consumed.rows)) throw new AdulisException('OTP_INVALID');
  }
}

function constantTimeMatches(stored: Buffer, presented: Buffer): boolean {
  return stored.length === presented.length && timingSafeEqual(stored, presented);
}

/** rows[0] under noUncheckedIndexedAccess, without the repeated cast noise. */
function result_first<T>(rows: readonly T[]): T | undefined {
  return rows[0];
}
