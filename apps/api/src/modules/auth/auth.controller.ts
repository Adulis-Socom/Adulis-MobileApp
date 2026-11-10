import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiDefaultResponse,
  ApiExtraModels,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { IdempotencyService, hashRequest } from '../../common/idempotency/idempotency';
import { Public, type AuthedRequest } from '../../common/auth/auth.guard';
import { AdulisException } from '../../common/errors/adulis-exception';
import { RateLimitService, subjectHash } from '../../common/rate-limit/rate-limit.service';
import { resolveKey } from '../../common/crypto/aead';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { PROBLEM_RESPONSE, ProblemDto } from '../../common/errors/problem.dto';
import { AuthService, type MintedSession } from './auth.service';
import {
  DevicePatchBodyDto,
  DeviceRefDto,
  DeviceRegisterBodyDto,
  EmptyResponseDto,
  OtpRequestBodyDto,
  OtpVerifyBodyDto,
  OtpVerifyResponseDto,
  RevokeOthersBodyDto,
  RevokeOthersResponseDto,
  RevokeSessionBodyDto,
  SessionListResponseDto,
} from './auth.dto';
import { OtpService } from './otp.service';
import { OtpDeliveryService, type IssuedOtp } from './otp-delivery.service';
import {
  BROWSER_DEVICE_COOKIE,
  REMEMBERED_DEVICE_COOKIE,
  SESSION_COOKIE,
  clearedHostCookie,
  hostCookie,
  readCookie,
  requestingDevice,
} from '../../common/http/cookies';
import {
  deviceRegisterBody,
  devicePatchBody,
  otpRequestBody,
  otpResendBody,
  otpVerifyBody,
  recoveryBody,
  revokeOthersBody,
  revokeSessionBody,
  stepUpRequestBody,
  stepUpVerifyBody,
} from './auth.schemas';

/** C6 — identity and session (ADU-API-01 v1.6 section 12.2). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


const hashKey = (): string =>
  resolveKey(process.env['IDENTITY_HASH_KEY_V1'], 'RATE_LIMIT').toString('hex');

const IDEMPOTENCY_KEY_HEADER = {
  name: 'Idempotency-Key',
  required: true,
  schema: { type: 'string', format: 'uuid' },
} as const;
const DEVICE_HEADER = {
  name: 'X-Adulis-Device',
  required: false,
  description: 'App clients: the registered device id. Browsers are identified by cookie instead.',
  schema: { type: 'string', format: 'uuid' },
} as const;
const CLIENT_HEADER = {
  name: 'X-Adulis-Client',
  required: false,
  description: '<surface>/<version>, e.g. android/1.0.0 or web/1.0.0.',
} as const;

@Controller()
@ApiExtraModels(ProblemDto)
export class AuthController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly idempotency: IdempotencyService,
    private readonly rateLimit: RateLimitService,
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly delivery: OtpDeliveryService,
  ) {}

  /**
   * Transport retries only (X11): the key replays the stored response and
   * SENDS NOTHING. A resend button calls /resend.
   */
  @Post('auth/otp/request')
  @Public()
  @HttpCode(202)
  @ApiOperation({ summary: 'Idempotency-keyed; a replay sends no SMS (X11).' })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiHeader(DEVICE_HEADER)
  @ApiHeader(CLIENT_HEADER)
  @ApiBody({ type: OtpRequestBodyDto })
  @ApiResponse({ status: 202, type: EmptyResponseDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async otpRequest(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = otpRequestBody.parse(req.body);
    let issued: IssuedOtp | null = null;
    const result = await this.tx.runIdempotent(req, res, 202, async (trx) => {
      /**
       * THE IP LIMITER IS REMOVED, NOT RELAXED (ADU-AUTH-01 v2.6 S15).
       *
       * What stood here was `10/hour/IP_KEY` -- the exact control v2.6 names
       * and then declares DISABLED. The document is explicit that this is not
       * a matter of degree: "It is not merely non-authoritative. IT MUST NOT
       * EXECUTE in a topology where every request may appear to originate
       * from the same proxy."
       *
       * That topology is ours. Nothing in this API sets Express's `trust
       * proxy`, so `req.ip` is the SOCKET address -- which behind any CDN,
       * load balancer or reverse proxy is the PROXY's address, identical for
       * every user. The limiter was therefore not weak, it was a shared
       * counter: ten OTP requests per hour for the entire platform, and the
       * eleventh person to sign in that hour gets 429 because ten strangers
       * did first. It has never run in that topology, which is the only
       * reason it has not already caused an outage.
       *
       * The phone-keyed limit (S14, 3/hour/PHONE_KEY, counted before this
       * transaction opens -- see the last argument below) is untouched and
       * is the control that actually binds. S15.1 lists what must be
       * documented and tested before an IP limit may exist at all -- trusted
       * hops, forwarding header, spoofed-header behaviour -- and none of it
       * is done, so the honest state is no IP limiter rather than one that
       * cannot be trusted either way.
       */
      const fresh = await this.otp.issueChallenge(trx, {
        phone: body.phone,
        purpose: 'SIGN_IN',
        // Stamped at creation (S5.2); the verify endpoint refuses the field.
        audience: body.audience,
        templateKey: 'sms.otp.sign_in',
        // Before an account exists, the device is what says which market's
        // timing governs this code (ADU-RUL-03 S3).
        deviceId: requestingDevice(req.headers),
      });
      issued = fresh;
      return {};
    },
    // After the replay check, before the transaction (OVN-045): an idempotent
    // replay burns no budget, no pooled connection is held while counting,
    // and a failed issue keeps its count.
    () =>
      this.rateLimit.consume('PHONE_HASH', subjectHash(body.phone, hashKey()), {
        bucketKey: 'otp-request',
        windowSeconds: 3600,
        max: 3,
      }),
    );
    // After commit, and only on a fresh execution — a rolled-back issue or
    // a replay transports nothing.
    await this.delivery.transport(issued);
    return result;
  }

  /** The person never received the SMS: a NEW code, invalidating the old. */
  @Post('auth/otp/resend')
  @Public()
  @HttpCode(202)
  @ApiOperation({ summary: 'Not idempotency-keyed; backoff 30s-60s-120s (4.3).' })
  @ApiHeader(DEVICE_HEADER)
  @ApiHeader(CLIENT_HEADER)
  @ApiBody({ type: OtpRequestBodyDto })
  @ApiResponse({ status: 202, type: EmptyResponseDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async otpResend(@Req() req: LocalizedRequest): Promise<unknown> {
    const body = otpResendBody.parse(req.body);
    let issued: IssuedOtp | null = null;
    await this.tx.run(req, async (trx) => {
      await this.otp.assertResendAllowed(trx, body.phone, 'SIGN_IN');
      /**
       * A RESEND IS NOT A FAILOVER (v2.6 S5.5). This path issues a NEW
       * challenge, which supersedes the live one: the old code dies, a new
       * code is generated, and the expiry and attempt budget start again.
       * Delivery failover -- which transports the SAME code over a second
       * vendor -- happens inside OtpDeliveryService and never comes through
       * here. The two operations must never be conflated, and the structure
       * is what keeps them apart: nothing in the delivery service can reach
       * `issueChallenge`.
       */
      const fresh = await this.otp.issueChallenge(trx, {
        phone: body.phone,
        purpose: 'SIGN_IN',
        audience: body.audience,
        templateKey: 'sms.otp.sign_in',
        deviceId: requestingDevice(req.headers),
      });
      issued = fresh;
    });
    await this.delivery.transport(issued);
    return {};
  }

  /**
   * Manual idempotency, because the credential must never be stored
   * (WO-API-001A, SEC-3; founder ruling E). The idempotency record holds a
   * NON-SECRET completion marker only: the public session id and the fact
   * that the credential was withheld. No bearer token, no cookie value, no
   * remembered-device secret.
   *
   * RETRY SEMANTICS: an identical replay of a COMPLETED verify does not
   * return a credential. It answers OTP_EXPIRED ("this code is no longer
   * valid ... request a new one"), which is true: the code was consumed. The
   * client starts a fresh sign-in. The session the lost response minted stays
   * listed in GET /v1/auth/sessions until it expires or is revoked. A replay
   * of a FAILED verify re-executes, because failures record nothing. Same
   * key with a different body is still 409 IDEMPOTENCY_KEY_REUSED.
   *
   * The CONSOLE credential leaves as a cookie and never in the body (S5.1 —
   * a token JavaScript can read is a token XSS can steal). MOBILE receives it
   * in the body for native secure storage.
   */
  @Post('auth/otp/verify')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Creates buyer identity on first use (S6.1). A replay after success answers OTP_EXPIRED.',
  })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiBody({ type: OtpVerifyBodyDto })
  @ApiOkResponse({ type: OtpVerifyResponseDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async otpVerify(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    /**
     * S5.2: "The verification request does not accept `audience`." REJECTED
     * BY NAME, not stripped (S31.1's third test -- "verify endpoint cannot
     * override audience"). A field silently discarded is a field a client
     * keeps sending, and this one used to decide which surface a session was
     * minted for. The audience now lives on the challenge, stamped at
     * request (ADU-RUL-06 S2).
     */
    if (req.body && typeof req.body === 'object' && 'audience' in req.body) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'audience' } });
    }
    const body = otpVerifyBody.parse(req.body);
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key === '') {
      throw new AdulisException('IDEMPOTENCY_KEY_MISSING');
    }
    /**
     * WHICH DEVICE THIS REQUEST SPEAKS FOR -- by WHAT IS PRESENTED, never by
     * a claimed audience (the body no longer carries one to claim).
     *
     * Cookie first: a browser's identity is never a body field (ADU-RUL-03
     * S2), so if a valid __Host- cookie is present it is the device. The
     * service then binds the surface to the CHALLENGE's stamped audience.
     *
     * NOT proof of client type, and the earlier wording here overclaimed it
     * (Phase A pass). A raw HTTP client reads its own bootstrap Set-Cookie and
     * can present it; a browser can omit its cookie and send a body id. So the
     * channel is what the caller PRESENTS. What is actually enforced is the
     * S5.2 challenge->session audience binding and the account boundary --
     * never client-type attestation, which is not achievable here.
     *
     * The cookie shape is validated here because zod cannot see it: a
     * malformed cookie would otherwise reach a uuid column and answer 500 to
     * an unauthenticated caller.
     */
    const browserCookieRaw = readCookie(req.headers.cookie, BROWSER_DEVICE_COOKIE);
    const browserDeviceId =
      browserCookieRaw && UUID_RE.test(browserCookieRaw) ? browserCookieRaw : null;
    const deviceChannel: 'cookie' | 'body' = browserDeviceId ? 'cookie' : 'body';
    const effectiveDeviceId = browserDeviceId ?? body.device_id ?? null;
    if (!effectiveDeviceId) {
      // No cookie and no body device: nothing bootstrapped is speaking.
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'bootstrap' } });
    }
    const actor = { kind: 'DEVICE' as const, id: effectiveDeviceId };
    const endpoint = `${req.method} ${req.path}`;
    const requestHash = hashRequest(req.method, req.path, req.body);

    const replay = await this.idempotency.check(key, actor, endpoint, requestHash);
    if (replay) {
      res.setHeader('X-Adulis-Idempotent-Replay', 'true');
      throw new AdulisException('OTP_EXPIRED');
    }

    const deviceCookie = readCookie(req.headers.cookie, REMEMBERED_DEVICE_COOKIE);
    const minted = await this.tx.run(req, async (trx) => {
      const session = await this.auth.verifySignIn(
        trx,
        { ...body, device_id: effectiveDeviceId, deviceChannel },
        deviceCookie,
      );
      await this.idempotency.record(trx, key, actor, endpoint, requestHash, {
        status: 200,
        body: { credential_withheld: true, session_id: session.sessionId },
      });
      return session;
    });
    return this.presentSession(res, minted);
  }

  /** Cookie for the console, body token for mobile — never both. */
  private presentSession(res: Response, minted: MintedSession): OtpVerifyResponseDto {
    const out: OtpVerifyResponseDto = {
      account_id: minted.accountId,
      roles: minted.roles,
      expires_at: minted.expiresAt.toISOString(),
      audience: minted.audience,
    };
    if (minted.audience === 'CONSOLE') {
      const maxAge = Math.max(1, Math.floor((minted.expiresAt.getTime() - Date.now()) / 1000));
      const cookies = [hostCookie(SESSION_COOKIE, minted.token, maxAge)];
      if (minted.deviceCookieToken) {
        cookies.push(hostCookie(REMEMBERED_DEVICE_COOKIE, minted.deviceCookieToken, 7 * 24 * 3600));
      }
      res.setHeader('Set-Cookie', cookies);
    } else {
      out.token = minted.token;
    }
    return out;
  }

  /**
   * Ordinary sign-out (founder ruling C; AUTH-02 v3.3 S118): revokes the
   * calling session only, never another, and needs no step-up. A CONSOLE
   * caller's session cookie is cleared; the remembered-device cookie is not,
   * because forgetting a device is its own act. A retry after success answers
   * 401: the credential is already dead, which is the outcome asked for.
   */
  @Post('auth/logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out: revokes the calling session only. No step-up.' })
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('cookie')
  @ApiNoContentResponse()
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async logout(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.tx.run(req as LocalizedRequest, (trx) => this.auth.logout(trx, req));
    if (req.auth?.audience === 'CONSOLE') {
      res.setHeader('Set-Cookie', clearedHostCookie(SESSION_COOKIE));
    }
  }

  @Get('auth/sessions')
  @ApiOperation({ summary: 'Device, first seen, last activity, location (S8.2). Public ids only.' })
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('cookie')
  @ApiOkResponse({ type: SessionListResponseDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async sessions(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, (trx) => this.auth.listSessions(trx, req));
  }

  @Delete('auth/sessions/:id')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Revoke one session. Own session: no step-up. Another session: CONSOLE only, with a ' +
      'REVOKE_ALL_SESSIONS step-up (SEC-4).',
  })
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('cookie')
  @ApiBody({ type: RevokeSessionBodyDto, required: false })
  @ApiNoContentResponse()
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async revokeSession(@Req() req: AuthedRequest, @Param('id') id: string): Promise<void> {
    if (!UUID_RE.test(id)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'id' } });
    }
    const body = revokeSessionBody.parse(req.body ?? {});
    await this.tx.run(req as LocalizedRequest, (trx) =>
      this.auth.revokeSession(trx, req, id, body.step_up_challenge_id ?? null),
    );
  }

  @Delete('auth/remembered-devices/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Forget a remembered device (v1.9 S15.0b); the session stays live.' })
  async forgetRememberedDevice(@Req() req: AuthedRequest, @Param('id') id: string): Promise<void> {
    if (!UUID_RE.test(id)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'id' } });
    }
    await this.tx.run(req as LocalizedRequest, (trx) =>
      this.auth.forgetRememberedDevice(trx, req, id),
    );
  }

  @Post('auth/sessions/revoke-others')
  @HttpCode(200)
  @ApiOperation({ summary: 'Step-up REVOKE_ALL_SESSIONS; revocation is immediate.' })
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('cookie')
  @ApiBody({ type: RevokeOthersBodyDto })
  @ApiOkResponse({ type: RevokeOthersResponseDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
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
    let issued: IssuedOtp | null = null;
    const result = await this.tx.runIdempotent(
      req as LocalizedRequest,
      res,
      202,
      async (trx) => {
        const fresh = await this.auth.stepUpRequest(trx, req, body);
        issued = fresh;
        return fresh.body;
      },
      // Before the transaction, as at otp/request (OVN-045).
      () =>
        this.rateLimit.consume('ACCOUNT', req.ctx?.accountId ?? '', {
          bucketKey: 'step-up-request',
          windowSeconds: 3600,
          max: 5,
        }),
    );
    await this.delivery.transport(issued);
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
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiBody({ type: DeviceRegisterBodyDto })
  @ApiResponse({ status: 201, type: DeviceRefDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async registerDevice(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = deviceRegisterBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.auth.registerDevice(trx, body),
    );
  }

  /** Authenticated since WO-API-001A (SEC-2): the calling session's own device only. */
  @Patch('devices/:id')
  @HttpCode(200)
  @ApiOperation({ summary: "Push token and permission for the calling session's own device; other ids 404." })
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('cookie')
  @ApiBody({ type: DevicePatchBodyDto })
  @ApiOkResponse({ type: DeviceRefDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async patchDevice(@Req() req: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    if (!UUID_RE.test(id)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'id' } });
    }
    const body = devicePatchBody.parse(req.body);
    return this.tx.run(req as LocalizedRequest, (trx) => this.auth.patchDevice(trx, req, id, body));
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
    return this.tx.runIdempotent(
      req,
      res,
      202,
      async (trx) => {
        await this.auth.openRecovery(trx, body);
        return {};
      },
      // Before the transaction, as at otp/request (OVN-045).
      () =>
        this.rateLimit.consume('PHONE_HASH', subjectHash(body.phone, hashKey()), {
          bucketKey: 'auth-recovery',
          windowSeconds: 86400,
          max: 2,
        }),
    );
  }
}
