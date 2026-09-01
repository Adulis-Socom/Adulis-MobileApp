import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { OtpService } from './otp.service';
import type { SmsMessage } from './sms.adapter';

/**
 * C6 — identity and session (ADU-API-01 section 12.2; ADU-AUTH-01 v2.4
 * sections 3-5, 8-10).
 *
 * The session token is the core.session row's id — opaque and stateful in
 * both presentations (S5.1); revocation is a row update the next request
 * reads. Nothing here computes an entitlement or a lifetime rule: the
 * lifetimes come from core.timing_config, the new-device notification is a
 * database trigger (D5), and step-up assertion lives in
 * core.fn_assert_step_up.
 */

export interface MintedSession {
  readonly token: string;
  readonly accountId: string;
  readonly audience: 'MOBILE' | 'CONSOLE';
  readonly roles: string[];
  readonly expiresAt: Date;
  /** Set when remember_device minted a new __Host-adulis_device token. */
  readonly deviceCookieToken: string | null;
}

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

@Injectable()
export class AuthService {
  constructor(private readonly otp: OtpService) {}

  /**
   * POST /v1/auth/otp/verify — creates identity on first use (S6.1: one
   * phone, one account), binds the device at identity creation (S11.1),
   * and mints the session whose insert fires the D5 new-device trigger.
   */
  async verifySignIn(
    trx: Transaction<Database>,
    body: {
      phone: string;
      code: string;
      device_id: string;
      /**
       * Which door the device id came through: the httpOnly cookie the
       * server minted, or the body a native client filled. A WEB row is
       * only ever cookie-addressed, whatever any challenge says.
       */
      deviceChannel: 'cookie' | 'body';
      age_declared_over_18?: boolean | undefined;
      remember_device?: boolean | undefined;
    },
    presentedDeviceToken: string | null,
  ): Promise<MintedSession> {
    /**
     * THE DEVICE IS READ FIRST AND REFUSED FIRST. An anonymous phone-taking
     * path demands a bootstrapped device before it touches the challenge, and
     * the refusal depends on the device alone -- identical for a registered
     * and an unregistered phone (S17). Verification itself resolves nothing
     * any more (ADU-RUL-06 S2), so the check that used to hide inside its
     * timing lookup stands here in the open.
     */
    const device = await sql<{
      id: string;
      platform: string;
      account_id: string | null;
      market_id: string | null;
    }>`
      SELECT id, platform::text AS platform, account_id, market_id
        FROM core.device WHERE id = ${body.device_id}`.execute(trx);
    const deviceRow = first(device.rows);
    if (!deviceRow?.market_id) {
      throw new AdulisException('VALIDATION_FAILED', {
        slots: { path: body.deviceChannel === 'cookie' ? 'bootstrap' : 'device_id' },
      });
    }

    const challenge = await this.otp.verifyCode(trx, {
      phone: body.phone,
      purpose: 'SIGN_IN',
      code: body.code,
    });

    /**
     * THE AUDIENCE IS THE CHALLENGE'S, STAMPED AT REQUEST (v2.6 S5.2,
     * ADU-RUL-06 S2). The body cannot carry one -- the controller refuses the
     * field by name -- so a MOBILE challenge can no longer mint a CONSOLE
     * session by saying so at verify. A SIGN_IN challenge with no stamp
     * cannot exist past 0044's transitional TTL; refusing it as INTERNAL is
     * ours to notice, not the caller's to cause.
     */
    const audience = challenge.audience;
    if (!audience) throw new AdulisException('INTERNAL');

    const existing = await sql<{ id: string; status: string; market_id: string }>`
      SELECT id, status, market_id FROM core.account
       WHERE phone_e164 = ${body.phone}`.execute(trx);

    let accountId: string;
    let marketId: string;
    const account = first(existing.rows);
    if (account) {
      if (account.status !== 'ACTIVE') {
        throw new AdulisException('PERMISSION_DENIED');
      }
      accountId = account.id;
      marketId = account.market_id;
    } else {
      // Identity creation blocks below 18 (ADU-AUTH-01 section 13): the
      // self-declared confirmation is required, and the confirmation is
      // stored, never a date of birth.
      if (body.age_declared_over_18 !== true) {
        // ITS OWN CODE since T12 S5.1 (D-101): a bare VALIDATION_FAILED
        // rendered as "The request is not valid" with nothing to correct.
        // The slot stays for anything keying on the field name.
        throw new AdulisException('AGE_DECLARATION_REQUIRED', {
          slots: { path: 'age_declared_over_18' },
        });
      }
      /**
       * THE MARKET COMES FROM THE DEVICE, and there is no fallback (D-104,
       * ADU-RUL-03 S3).
       *
       * This was `SELECT id FROM core.market WHERE is_live LIMIT 1` -- no
       * ORDER BY, nothing keeping there to be one live market, and a second
       * one silently decided which country a person's account belonged to.
       * Adding an ORDER BY would have made it deterministic and still wrong:
       * it would deterministically pick a market for a person nobody asked
       * about.
       *
       * /v1/bootstrap is now the only place a market is chosen. It assigns
       * one to the device at first contact (G1.11) and this reads it back.
       * A device with no market has not bootstrapped, and the honest answer
       * is to refuse rather than to guess on that person's behalf.
       */
      accountId = randomUUID();
      // Guaranteed above: the device was refused before the challenge if it
      // had no market.
      marketId = deviceRow.market_id;
      await sql`
        INSERT INTO core.account
          (id, phone_e164, market_id, status, age_declared_over_18, age_declared_at)
        VALUES (${accountId}, ${body.phone}, ${marketId}, 'ACTIVE', true, now())`.execute(trx);
    }

    /**
     * D-89's SECOND LEG (ruled at T12 S5.2; described by migrations 0029 and
     * 0037's headers and implemented nowhere until now). After successful
     * authentication of this exact normalized phone, every PENDING courier
     * invite for it is claimed and the relationship created -- server-side
     * only (a client cannot name an invite), in THIS transaction (the claim
     * and the relationship are one atomic act), idempotent (a second sign-in
     * finds no pending invites; an already-live relationship is DO NOTHING
     * under the seller_courier_live partial unique).
     *
     * NO ORACLE, stated precisely (the adversarial pass on #44 caught the
     * first version of this comment overclaiming): every NON-ROLE response
     * field is identical for invited and uninvited phones, and nothing in
     * this write can throw for a claimable phone. `roles` DOES reflect the
     * claim -- an invited phone's verify answers roles:["COURIER"] -- and
     * that is DISCLOSURE TO THE AUTHENTICATED HOLDER OF THE PHONE, not an
     * oracle: the observer holds a valid OTP for this exact number, roles is
     * "a rendering hint only" (S5) delivered so the courier's own console
     * can route them, and the pre-auth surfaces S17/S19/S22 protect are
     * untouched. The t12-d89 oracle test pins BOTH halves: non-role fields
     * compared BY VALUE, and the roles difference asserted explicitly so it
     * can never widen unexamined. Recorded in D-178 for ADU-AUTH-01 v2.6 to
     * confirm or supersede. Both branches run it: an invite may predate the
     * account or arrive years after it.
     *
     * The phone comparison is core.e164 against core.e164 -- both sides are
     * already normalized at their boundaries, which is what "that exact
     * normalized phone" requires (0029's index anticipates precisely this
     * lookup: seller_courier_invite_phone WHERE pending).
     */
    /*
     * SERIALIZE PER (seller, phone) FIRST -- the same pg_advisory_xact_lock
     * the invite endpoint takes (couriers.controller.ts), for the same
     * hazard it documents: the claim stamps the invite, which removes it
     * from the seller_courier_invite_live partial index, so a CONCURRENT
     * re-invite's ON CONFLICT recheck finds nothing to conflict with and
     * inserts a fresh pending row -- two live CLAIMED invites for one
     * (seller, phone), a phantom courier in the list forever. The
     * adversarial pass on #44 found this unlocked writer racing the locked
     * one (two lenses, independently). Locks are taken in seller_id order,
     * so two concurrent claimers of the same phone acquire in the same
     * sequence and cannot deadlock; the invite endpoint takes a single
     * lock and orders with nobody.
     */
    await sql`
      SELECT pg_advisory_xact_lock(
               hashtextextended(p.seller_id::text || ':' || ${body.phone}, 7))
        FROM (SELECT i.seller_id
                FROM core.seller_courier_invite i
               WHERE i.phone = ${body.phone}
                 AND i.claimed_at IS NULL AND i.revoked_at IS NULL
               ORDER BY i.seller_id) p`.execute(trx);
    await sql`
      WITH claimed AS (
        UPDATE core.seller_courier_invite i
           SET claimed_at = now(), claimed_by_account_id = ${accountId}
         WHERE i.phone = ${body.phone}
           AND i.claimed_at IS NULL AND i.revoked_at IS NULL
         RETURNING i.seller_id
      )
      INSERT INTO core.seller_courier (id, seller_id, account_id)
      SELECT gen_random_uuid(), claimed.seller_id, ${accountId} FROM claimed
      ON CONFLICT (seller_id, account_id) WHERE revoked_at IS NULL
      DO NOTHING`.execute(trx);

    /**
     * THE COOKIE IS NOT A CREDENTIAL AND IS NOT TREATED AS ONE.
     *
     * httpOnly stops a browser's JavaScript; it does not stop a client that
     * writes its own Cookie header. So the device a CONSOLE sign-in claims is
     * checked here, not merely looked up:
     *
     *   - it must be a WEB row. /v1/bootstrap already refuses to reuse a
     *     native row; without the same check here a console session could be
     *     anchored to a row whose platform says ANDROID -- the exact false
     *     statement migration 0040 exists to prevent, in a column the
     *     new-device payout lock's neighbourhood reads.
     *   - it must be unbound, or already this account's. The bind below is
     *     guarded by `account_id IS NULL` and nothing read its row count, so
     *     a cookie naming ANOTHER account's device was refused the bind and
     *     given a session anyway -- pinning a stranger's device row against
     *     the retention purge, which is the D-64 residue class by a new route.
     *
     * All three failures answer identically, so the response says nothing
     * about which device ids exist or whom they belong to.
     */
    const deviceUnusable =
      // A WEB ROW IS ADDRESSED BY ITS COOKIE AND NEVER BY A BODY FIELD. The
      // audience used to gate this and the audience was a field the caller
      // filled in; the CHANNEL is not fillable -- it is which door the id
      // physically came through -- so the rule finally rests on something the
      // caller cannot claim.
      (deviceRow.platform === 'WEB' && body.deviceChannel !== 'cookie') ||
      // The real cookie path can only name a WEB row; anything else arriving
      // by cookie is a forged header, refused rather than reasoned about.
      (body.deviceChannel === 'cookie' && deviceRow.platform !== 'WEB') ||
      // A CONSOLE-stamped challenge mints only through the browser's own
      // cookie-addressed WEB row, unbound or already this account's.
      (audience === 'CONSOLE' &&
        (body.deviceChannel !== 'cookie' ||
          (deviceRow.account_id !== null && deviceRow.account_id !== accountId))) ||
      // A MOBILE-stamped challenge minting through a browser cookie is the
      // surface conversion S5.2's invariants exist to stop (D-180).
      (audience === 'MOBILE' && body.deviceChannel !== 'body');
    if (deviceUnusable) {
      throw new AdulisException('VALIDATION_FAILED', {
        // A console client has no device_id field to correct; what it can do
        // is call /v1/bootstrap again and get an identity that works.
        slots: { path: body.deviceChannel === 'cookie' ? 'bootstrap' : 'device_id' },
      });
    }
    // Binds at identity creation, never before (S11.1) — and never rebinds.
    await sql`
      UPDATE core.device SET account_id = ${accountId}, last_seen_at = now()
       WHERE id = ${body.device_id} AND account_id IS NULL`.execute(trx);

    // R17 — remembered devices, console only. A presented device cookie
    // selects the remembered lifetime; remember_device mints a new one.
    let accountDeviceId: string | null = null;
    let deviceCookieToken: string | null = null;
    if (audience === 'CONSOLE') {
      if (presentedDeviceToken) {
        const hash = createHash('sha256').update(presentedDeviceToken).digest();
        const known = await sql<{ id: string }>`
          SELECT id FROM core.account_device
           WHERE token_hash = ${hash} AND account_id = ${accountId}
             AND revoked_at IS NULL AND expires_at > now()`.execute(trx);
        accountDeviceId = first(known.rows)?.id ?? null;
        if (accountDeviceId) {
          await sql`
            UPDATE core.account_device SET last_used_at = now()
             WHERE id = ${accountDeviceId}`.execute(trx);
        }
      }
      if (!accountDeviceId && body.remember_device === true) {
        deviceCookieToken = randomUUID();
        const hash = createHash('sha256').update(deviceCookieToken).digest();
        accountDeviceId = randomUUID();
        await sql`
          INSERT INTO core.account_device
            (id, account_id, device_id, token_hash, expires_at)
          SELECT ${accountDeviceId}, ${accountId}, ${body.device_id}, ${hash},
                 now() + tc.console_remembered_lifetime
            FROM core.timing_config tc
           WHERE tc.market_id = ${marketId} AND tc.effective @> now()`.execute(trx);
      }
    }

    const sessionId = randomUUID();
    const minted = await sql<{ expires_at: Date }>`
      INSERT INTO core.session
        (id, account_id, audience, device_id, account_device_id,
         expires_at, created_from_otp_id)
      SELECT ${sessionId}, ${accountId},
             ${audience}::core.session_audience, ${body.device_id},
             ${accountDeviceId},
             now() + CASE
               WHEN ${audience} = 'MOBILE' THEN tc.mobile_session_lifetime
               WHEN ${accountDeviceId}::uuid IS NOT NULL THEN tc.console_remembered_lifetime
               ELSE tc.console_session_lifetime
             END,
             ${challenge.id}
        FROM core.timing_config tc
       WHERE tc.market_id = ${marketId} AND tc.effective @> now()
      RETURNING expires_at`.execute(trx);
    const row = first(minted.rows);
    // Fail closed on absent timing configuration: a session whose lifetime
    // cannot be computed is a session that must not exist.
    if (!row) throw new AdulisException('INTERNAL');

    return {
      token: sessionId,
      accountId,
      audience,
      roles: await this.rolesOf(trx, accountId),
      expiresAt: row.expires_at,
      deviceCookieToken,
    };
  }

  /** roles[] is a rendering hint only (S5); authorisation is per request. */
  private async rolesOf(trx: Transaction<Database>, accountId: string): Promise<string[]> {
    const r = await sql<{ role: string }>`
      SELECT 'BUYER' AS role FROM core.buyer_profile WHERE account_id = ${accountId}
      UNION
      SELECT 'SELLER' FROM core.seller
       WHERE owner_account_id = ${accountId} AND status <> 'DELETED'
      UNION
      SELECT 'TEAM' FROM core.seller_team_member
       WHERE account_id = ${accountId} AND revoked_at IS NULL
      UNION
      SELECT 'COURIER' FROM core.seller_courier
       WHERE account_id = ${accountId} AND revoked_at IS NULL`.execute(trx);
    return r.rows.map((x) => x.role).sort();
  }

  /** GET /v1/auth/sessions — device, first seen, last activity, location. */
  async listSessions(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    const accountId = req.ctx?.accountId as string;
    const current = req.auth?.sessionId;
    const r = await sql<Record<string, unknown>>`
      SELECT s.id, s.audience, s.first_seen_at, s.last_activity_at,
             s.approx_location, s.expires_at,
             s.device_id, d.platform AS device_platform,
             ad.label AS remembered_label,
             (s.account_device_id IS NOT NULL) AS remembered
        FROM core.session s
        LEFT JOIN core.device d ON d.id = s.device_id
        LEFT JOIN core.account_device ad ON ad.id = s.account_device_id
       WHERE s.account_id = ${accountId}
         AND s.revoked_at IS NULL AND s.expires_at > now()
       ORDER BY s.last_activity_at DESC`.execute(trx);
    return {
      data: r.rows.map((s) => ({ ...s, current: s['id'] === current })),
    };
  }

  /** DELETE /v1/auth/sessions/{id} — own sessions only; others are 404. */
  async revokeSession(
    trx: Transaction<Database>,
    req: AuthedRequest,
    sessionId: string,
  ): Promise<void> {
    const accountId = req.ctx?.accountId as string;
    const r = await sql`
      UPDATE core.session
         SET revoked_at = now(), revoked_by_session_id = ${req.auth?.sessionId ?? null}
       WHERE id = ${sessionId} AND account_id = ${accountId}
         AND revoked_at IS NULL`.execute(trx);
    if (Number(r.numAffectedRows ?? 0) === 0) {
      throw new AdulisException('NOT_FOUND');
    }
  }

  /**
   * POST /v1/auth/sessions/revoke-others — step-up REVOKE_ALL_SESSIONS.
   * CONSOLE only: ADU-AUTH-01 9.1 restricts every step-up action to the
   * console. (12.2's B-S-C row conflicts; the AUTH invariant governs
   * authorization — registered.)
   */
  async revokeOthers(
    trx: Transaction<Database>,
    req: AuthedRequest,
    stepUpChallengeId: string,
  ): Promise<unknown> {
    const accountId = req.ctx?.accountId as string;
    if (req.ctx?.audience !== 'CONSOLE') {
      throw new AdulisException('PERMISSION_DENIED');
    }
    await sql`
      SELECT core.fn_assert_step_up(
        ${stepUpChallengeId}, ${accountId}, 'REVOKE_ALL_SESSIONS')`.execute(trx);
    const r = await sql`
      UPDATE core.session
         SET revoked_at = now(), revoked_by_session_id = ${req.auth?.sessionId ?? null}
       WHERE account_id = ${accountId}
         AND id <> ${req.auth?.sessionId ?? ''}
         AND revoked_at IS NULL`.execute(trx);
    return { revoked: Number(r.numAffectedRows ?? 0) };
  }

  /**
   * POST /v1/auth/step-up/request — the SMS names the action (4.4); the
   * challenge binds to action AND target (9.2). Console only (9.1).
   */
  async stepUpRequest(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: { action: string; target_ref?: string | null | undefined },
  ): Promise<{ body: unknown; sms: SmsMessage; challengeId: string; marketId: string }> {
    const accountId = req.ctx?.accountId as string;
    if (req.ctx?.audience !== 'CONSOLE') {
      throw new AdulisException('PERMISSION_DENIED');
    }
    const acc = await sql<{ phone_e164: string }>`
      SELECT phone_e164 FROM core.account WHERE id = ${accountId}`.execute(trx);
    const phone = first(acc.rows)?.phone_e164;
    if (!phone) throw new AdulisException('INTERNAL');

    const issued = await this.otp.issueChallenge(trx, {
      // Authenticated: req.ctx.accountId is set, the account names the
      // market, and no anonymous caller can learn anything from the answer.
      // Demanding a device here would refuse a signed-in seller a step-up
      // code for no security gain.
      requireDevice: false,
      // SERVER-DERIVED, never from a body: the guard above has already
      // required this session to be CONSOLE, and the stamp is that fact.
      audience: 'CONSOLE',
      phone,
      purpose: 'STEP_UP',
      stepUpAction: body.action,
      templateKey: `sms.otp.step_up.${body.action.toLowerCase()}`,
    });

    const stepUpId = randomUUID();
    await sql`
      INSERT INTO core.step_up_challenge
        (id, account_id, action, target_ref, otp_challenge_id, expires_at)
      VALUES (${stepUpId}, ${accountId}, ${body.action}::core.step_up_action,
              ${body.target_ref ?? null}, ${issued.challengeId},
              ${issued.expiresAt})`.execute(trx);

    return {
      body: { challenge_id: stepUpId, expires_at: issued.expiresAt },
      sms: issued.sms,
      challengeId: issued.challengeId,
      marketId: issued.marketId,
    };
  }

  /** POST /v1/auth/step-up/verify — satisfies the named challenge. */
  async stepUpVerify(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: { challenge_id: string; code: string },
  ): Promise<unknown> {
    const accountId = req.ctx?.accountId as string;
    const r = await sql<{
      id: string;
      otp_challenge_id: string;
      satisfied_at: Date | null;
      expires_at: Date;
    }>`
      SELECT su.id, su.otp_challenge_id, su.satisfied_at, su.expires_at
        FROM core.step_up_challenge su
       WHERE su.id = ${body.challenge_id} AND su.account_id = ${accountId}
         FOR UPDATE`.execute(trx);
    const su = first(r.rows);
    if (!su) throw new AdulisException('STEP_UP_REQUIRED');
    if (su.satisfied_at) {
      return { challenge_id: su.id, satisfied_at: su.satisfied_at };
    }
    if (new Date() > su.expires_at) throw new AdulisException('STEP_UP_EXPIRED');

    await this.otp.verifyChallengeById(trx, su.otp_challenge_id, body.code);

    const updated = await sql<{ satisfied_at: Date }>`
      UPDATE core.step_up_challenge SET satisfied_at = now()
       WHERE id = ${su.id}
       RETURNING satisfied_at`.execute(trx);
    return {
      challenge_id: su.id,
      satisfied_at: first(updated.rows)?.satisfied_at,
    };
  }

  /** POST /v1/devices — anonymous registration; idempotent by id. */
  async registerDevice(
    trx: Transaction<Database>,
    body: { id: string; platform: 'ANDROID' | 'IOS' },
  ): Promise<unknown> {
    await sql`
      INSERT INTO core.device (id, platform)
      VALUES (${body.id}, ${body.platform}::core.device_platform)
      ON CONFLICT (id) DO NOTHING`.execute(trx);
    return { id: body.id };
  }

  /** PATCH /v1/devices/{id} — push token, permission result. */
  async patchDevice(
    trx: Transaction<Database>,
    deviceId: string,
    body: {
      push_token?: string | null | undefined;
      notification_permission?: 'GRANTED' | 'DENIED' | 'NOT_ASKED' | undefined;
    },
  ): Promise<unknown> {
    const r = await sql<{ id: string }>`
      UPDATE core.device
         SET push_token = CASE WHEN ${body.push_token !== undefined}
                               THEN ${body.push_token ?? null} ELSE push_token END,
             notification_permission = coalesce(
               ${body.notification_permission ?? null}::core.notification_permission,
               notification_permission),
             last_seen_at = now()
       WHERE id = ${deviceId}
       RETURNING id`.execute(trx);
    if (!first(r.rows)) throw new AdulisException('NOT_FOUND');
    return { id: deviceId };
  }

  /**
   * POST /v1/auth/recovery — number changed or SIM lost: opens an operator
   * review case (S10), never self-service. 202 whether or not the number
   * belongs to an account — the response must not be an enumeration oracle.
   */
  async openRecovery(
    trx: Transaction<Database>,
    body: { phone: string; reason?: string | undefined },
  ): Promise<void> {
    const acc = await sql<{ id: string }>`
      SELECT id FROM core.account
       WHERE phone_e164 = ${body.phone} AND status = 'ACTIVE'`.execute(trx);
    const account = first(acc.rows);
    if (account) {
      await sql`
        INSERT INTO core.account_recovery_case (id, account_id, reason)
        VALUES (${randomUUID()}, ${account.id}, ${body.reason ?? null})`.execute(trx);
    }
  }
}
