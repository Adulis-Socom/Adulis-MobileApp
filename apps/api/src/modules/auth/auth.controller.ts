import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { IdempotencyService, hashRequest } from '../../common/idempotency/idempotency';
import { Public, type AuthedRequest } from '../../common/auth/auth.guard';
import { AdulisException } from '../../common/errors/adulis-exception';
import { RateLimitService, subjectHash } from '../../common/rate-limit/rate-limit.service';
import { resolveKey } from '../../common/crypto/aead';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SMS_ADAPTER, type SmsAdapter, type SmsMessage } from './sms.adapter';
import {
  BROWSER_DEVICE_COOKIE,
  REMEMBERED_DEVICE_COOKIE,
  SESSION_COOKIE,
  hostCookie,
  readCookie,
} from '../../common/http/cookies';
import {
  deviceRegisterBody,
  devicePatchBody,
  otpRequestBody,
  otpResendBody,
  otpVerifyBody,
  recoveryBody,
  revokeOthersBody,
  stepUpRequestBody,
  stepUpVerifyBody,
} from './auth.schemas';

/** C6 — identity and session (ADU-API-01 v1.6 section 12.2). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Which device is speaking, by surface: the app header for a native client,
 * the httpOnly cookie for a browser (ADU-RUL-03 S2). Both are validated as
 * uuids -- these values reach uuid columns.
 */
const requestingDevice = (req: LocalizedRequest): string | null => {
  const header = req.headers['x-adulis-device'];
  if (typeof header === 'string' && UUID_RE.test(header)) return header;
  const cookie = readCookie(req.headers.cookie, BROWSER_DEVICE_COOKIE);
  return cookie && UUID_RE.test(cookie) ? cookie : null;
};

const hashKey = (): string =>
  resolveKey(process.env['IDENTITY_HASH_KEY_V1'], 'RATE_LIMIT').toString('hex');



@Controller()
export class AuthController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly idempotency: IdempotencyService,
    private readonly rateLimit: RateLimitService,
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    @Inject(SMS_ADAPTER) private readonly sms: SmsAdapter,
  ) {}

  /**
   * Transport retries only (X11): the key replays the stored response and
   * SENDS NOTHING. A resend button calls /resend.
   */
  @Post('auth/otp/request')
  @Public()
  @HttpCode(202)
  @ApiOperation({ summary: 'Idempotency-keyed; a replay sends no SMS (X11).' })
  async otpRequest(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = otpRequestBody.parse(req.body);
    let toSend: SmsMessage | null = null;
    const result = await this.tx.runIdempotent(req, res, 202, async (trx) => {
      // Inside the closure so an idempotent replay burns no budget.
      await this.rateLimit.consume('PHONE_HASH', subjectHash(body.phone, hashKey()), {
        bucketKey: 'otp-request',
        windowSeconds: 3600,
        max: 3,
      });
      await this.rateLimit.consume('IP_HASH', subjectHash(req.ip ?? '', hashKey()), {
        bucketKey: 'otp-request-ip',
        windowSeconds: 3600,
        max: 10,
      });
      const issued = await this.otp.issueChallenge(trx, {
        phone: body.phone,
        purpose: 'SIGN_IN',
        templateKey: 'sms.otp.sign_in',
        // Before an account exists, the device is what says which market's
        // timing governs this code (ADU-RUL-03 S3).
        deviceId: requestingDevice(req),
      });
      toSend = issued.sms;
      return {};
    });
    // After commit, and only on a fresh execution — a rolled-back issue or
    // a replay dispatches nothing.
    if (toSend) await this.sms.send(toSend);
    return result;
  }

  /** The person never received the SMS: a NEW code, invalidating the old. */
  @Post('auth/otp/resend')
  @Public()
  @HttpCode(202)
  @ApiOperation({ summary: 'Not idempotency-keyed; backoff 30s-60s-120s (4.3).' })
  async otpResend(@Req() req: LocalizedRequest): Promise<unknown> {
    const body = otpResendBody.parse(req.body);
    let toSend: SmsMessage | null = null;
    await this.tx.run(req, async (trx) => {
      await this.otp.assertResendAllowed(trx, body.phone, 'SIGN_IN');
      const issued = await this.otp.issueChallenge(trx, {
        phone: body.phone,
        purpose: 'SIGN_IN',
        templateKey: 'sms.otp.sign_in',
        deviceId: requestingDevice(req),
      });
      toSend = issued.sms;
    });
    if (toSend) await this.sms.send(toSend);
    return {};
  }

  /**
   * Manual idempotency, because the CONSOLE credential leaves as a cookie:
   * the stored body carries the token internally, and BOTH the fresh path
   * and a replay set the cookie and strip the token from what a console
   * caller can read (S5.1 — a token JavaScript can read is a token XSS can
   * steal). MOBILE receives it in the body for native secure storage.
   */
  @Post('auth/otp/verify')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Creates buyer identity on first use (S6.1).' })
  async otpVerify(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = otpVerifyBody.parse(req.body);
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key === '') {
      throw new AdulisException('IDEMPOTENCY_KEY_MISSING');
    }
    // WHICH DEVICE THIS REQUEST SPEAKS FOR, by surface (ADU-RUL-03 S2).
    // On CONSOLE the answer is the browser cookie bootstrap minted, and a
    // client-supplied X-Adulis-Device or body.device_id is IGNORED -- reading
    // either as a fallback would re-open the arm the ruling closes.
    // Validated here, because zod no longer covers it: device_id became
    // optional for the console, so a malformed cookie would otherwise reach a
    // uuid column and answer 500 to an unauthenticated caller. Bootstrap has
    // tested the same shape since it was written; this is the other door.
    const browserCookieRaw = readCookie(req.headers.cookie, BROWSER_DEVICE_COOKIE);
    const browserDeviceId =
      browserCookieRaw && UUID_RE.test(browserCookieRaw) ? browserCookieRaw : null;
    const isConsole = body.audience === 'CONSOLE';
    const effectiveDeviceId = isConsole ? browserDeviceId : (body.device_id ?? null);
    if (isConsole && !effectiveDeviceId) {
      // The browser has not called /v1/bootstrap, so it has no device row and
      // no cookie. That is a client sequencing error, and naming the header
      // it is missing would be a lie -- there is no header to send.
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'bootstrap' } });
    }
    const device = req.headers['x-adulis-device'];
    const actor = {
      kind: 'DEVICE' as const,
      id: isConsole
        ? (effectiveDeviceId as string)
        : typeof device === 'string' && device !== ''
          ? device
          : (body.device_id ?? ''),
    };
    const endpoint = `${req.method} ${req.path}`;
    const requestHash = hashRequest(req.method, req.path, req.body);

    const replay = await this.idempotency.check(key, actor, endpoint, requestHash);
    if (replay) {
      res.setHeader('X-Adulis-Idempotent-Replay', 'true');
      return this.presentSession(res, replay.body as Record<string, unknown>);
    }

    const deviceCookie = readCookie(req.headers.cookie, REMEMBERED_DEVICE_COOKIE);
    const stored = await this.tx.run(req, async (trx) => {
      const minted = await this.auth.verifySignIn(
        trx,
        { ...body, device_id: effectiveDeviceId as string },
        deviceCookie,
      );
      const record: Record<string, unknown> = {
        session_token: minted.token,
        audience: minted.audience,
        account_id: minted.accountId,
        roles: minted.roles,
        expires_at: minted.expiresAt,
        device_cookie_token: minted.deviceCookieToken,
      };
      await this.idempotency.record(trx, key, actor, endpoint, requestHash, {
        status: 200,
        body: record,
      });
      return record;
    });
    return this.presentSession(res, stored);
  }

  /** Cookie for the console, body token for mobile — never both. */
  private presentSession(res: Response, stored: Record<string, unknown>): unknown {
    const token = stored['session_token'] as string;
    const audience = stored['audience'] as string;
    const expiresAt = new Date(stored['expires_at'] as string | Date);
    const out: Record<string, unknown> = {
      account_id: stored['account_id'],
      roles: stored['roles'],
      expires_at: stored['expires_at'],
      audience,
    };
    if (audience === 'CONSOLE') {
      const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      const cookies = [hostCookie(SESSION_COOKIE, token, maxAge)];
      const deviceToken = stored['device_cookie_token'] as string | null;
      if (deviceToken) {
        cookies.push(hostCookie(REMEMBERED_DEVICE_COOKIE, deviceToken, 7 * 24 * 3600));
      }
      res.setHeader('Set-Cookie', cookies);
    } else {
      out['token'] = token;
    }
    return out;
  }

  @Get('auth/sessions')
  @ApiOperation({ summary: 'Device, first seen, last activity, location (S8.2).' })
  async sessions(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, (trx) => this.auth.listSessions(trx, req));
  }

  @Delete('auth/sessions/:id')
  @HttpCode(204)
  async revokeSession(@Req() req: AuthedRequest, @Param('id') id: string): Promise<void> {
    if (!UUID_RE.test(id)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'id' } });
    }
    await this.tx.run(req as LocalizedRequest, (trx) =>
      this.auth.revokeSession(trx, req, id),
    );
  }

  @Post('auth/sessions/revoke-others')
  @HttpCode(200)
  @ApiOperation({ summary: 'Step-up REVOKE_ALL_SESSIONS; revocation is immediate.' })
  async revokeOthers(@Req() req: AuthedRequest): Promise<unknown> {
    const body = revokeOthersBody.parse(req.body);
    return this.tx.run(req as LocalizedRequest, (trx) =>
      this.auth.revokeOthers(trx, req, body.step_up_challenge_id),
    );
  }

  @Post('auth/step-up/request')
  @HttpCode(202)
  @ApiOperation({ summary: 'The SMS names the action (4.4); binds action and target (9.2).' })
  async stepUpRequest(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = stepUpRequestBody.parse(req.body);
    let toSend: SmsMessage | null = null;
    const result = await this.tx.runIdempotent(
      req as LocalizedRequest,
      res,
      202,
      async (trx) => {
        await this.rateLimit.consume('ACCOUNT', req.ctx?.accountId ?? '', {
          bucketKey: 'step-up-request',
          windowSeconds: 3600,
          max: 5,
        });
        const issued = await this.auth.stepUpRequest(trx, req, body);
        toSend = issued.sms;
        return issued.body;
      },
    );
    if (toSend) await this.sms.send(toSend);
    return result;
  }

  @Post('auth/step-up/verify')
  @HttpCode(200)
  async stepUpVerify(@Req() req: AuthedRequest): Promise<unknown> {
    const body = stepUpVerifyBody.parse(req.body);
    return this.tx.run(req as LocalizedRequest, (trx) =>
      this.auth.stepUpVerify(trx, req, body),
    );
  }

  @Post('devices')
  @Public()
  @HttpCode(201)
  @ApiOperation({ summary: 'Anonymous, app-generated id; binds at identity creation (S11.1).' })
  async registerDevice(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = deviceRegisterBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.auth.registerDevice(trx, body),
    );
  }

  @Patch('devices/:id')
  @Public()
  @HttpCode(200)
  async patchDevice(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    if (!UUID_RE.test(id)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'id' } });
    }
    const body = devicePatchBody.parse(req.body);
    return this.tx.run(req, (trx) => this.auth.patchDevice(trx, id, body));
  }

  @Post('auth/recovery')
  @Public()
  @HttpCode(202)
  @ApiOperation({ summary: 'Operator review, never self-service (S6.6). 202 for any number.' })
  async recovery(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = recoveryBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 202, async (trx) => {
      await this.rateLimit.consume('PHONE_HASH', subjectHash(body.phone, hashKey()), {
        bucketKey: 'auth-recovery',
        windowSeconds: 86400,
        max: 2,
      });
      await this.auth.openRecovery(trx, body);
      return {};
    });
  }
}
