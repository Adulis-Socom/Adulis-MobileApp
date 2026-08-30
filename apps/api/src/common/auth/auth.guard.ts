import {
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { RequestContext } from '../db/request-context';
import { AdulisException } from '../errors/adulis-exception';
import { SessionService, type SessionContext } from './session.service';
import { SESSION_COOKIE, readCookie } from '../http/cookies';

/**
 * The authenticate + seller-context stages of the section 5 pipeline, as a
 * GLOBAL guard: every route is authenticated unless it declares otherwise,
 * so forgetting a decorator fails closed — an unmarked new endpoint demands
 * a session rather than serving anonymously.
 *
 * Two presentations, chosen by surface (ADU-API-01 section 5.1, R3):
 *   MOBILE   Authorization: Bearer <token>   (native secure storage)
 *   CONSOLE  __Host-adulis_session cookie    (HttpOnly; never JavaScript's)
 * The token is the same opaque core.session row either way; only the
 * carrier differs — and the carrier must MATCH the session's audience, or
 * a cookie minted for the console could be replayed as a bearer token.
 */

const PUBLIC_KEY = 'adulis:public';
/** Anonymous route: no credential demanded, none read. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

const ACTOR_ROLE_KEY = 'adulis:actor-role';
/**
 * Declares the adulis.actor_role this route acts under. Only COURIER is
 * load-bearing today — the courier's isolation is row-level security keyed
 * on this setting, resolved per request, not per session (R2) — but the
 * value always travels explicitly so RLS never guesses.
 */
export const ActorRole = (role: 'BUYER' | 'SELLER' | 'COURIER') =>
  SetMetadata(ACTOR_ROLE_KEY, role);

export interface AuthedRequest extends Request {
  requestId?: string;
  auth?: SessionContext;
  ctx?: RequestContext;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The seller-context prefixes of ADU-API-01 section 4.2, and its two
 * exemptions. Both are paths under /v1/seller that no seller header can
 * describe, for opposite reasons.
 *
 *  - POST /v1/seller is seller CREATION: the act that brings the seller
 *    into existence, so no header can name it yet, and no permission gate
 *    runs because a relationship cannot be checked before it exists.
 *
 *  - POST /v1/seller/identity-verification is OPERATOR-only since G1.1.
 *    An operator holds no seller relationship, so a seller-scoped
 *    permission check would raise U0002 -- a 404 -- before the boundary
 *    function was ever reached, and the caller would be told the seller
 *    does not exist rather than that they may not do this. Its gate is
 *    verification.write_attestation's own derivation from
 *    core.operator_grant, which is the only place that can decide it.
 *
 * The path keeps its /v1/seller prefix because ADU-API-01 v1.7 keeps it:
 * removing the path would be the shape change doctrine 6 forbids, and the
 * capability did not disappear -- it moved to whoever holds the grant.
 */
function requiresSellerContext(path: string, method: string): boolean {
  if (method !== 'POST') {
    return path.startsWith('/v1/seller') || path.startsWith('/v1/billing');
  }
  if (path === '/v1/seller' || path === '/v1/seller/') return false;
  if (
    path === '/v1/seller/identity-verification' ||
    path === '/v1/seller/identity-verification/'
  ) {
    return false;
  }
  return path.startsWith('/v1/seller') || path.startsWith('/v1/billing');
}


@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice('Bearer '.length).trim()
      : null;
    const cookie = readCookie(req.headers.cookie, SESSION_COOKIE);
    const token = bearer ?? cookie;

    if (isPublic) {
      // Public means AUTH-OPTIONAL, never auth-ignored: a presented
      // credential still authenticates (a signed-in buyer's cart must be
      // theirs, not their device's), and a presented-but-invalid one is
      // refused rather than silently downgraded to anonymous - a client
      // holding a dead token must learn it now, not at checkout.
      if (!token) {
        req.ctx = { accountId: null, actorRole: '', sellerId: null };
        return true;
      }
      const session = await this.sessions.authenticate(token);
      const carrier = bearer !== null ? 'MOBILE' : 'CONSOLE';
      if (session.audience !== carrier) {
        throw new AdulisException('AUDIENCE_NOT_PERMITTED');
      }
      req.auth = session;
      req.ctx = { accountId: session.accountId, actorRole: 'BUYER', sellerId: null, audience: session.audience };
      return true;
    }

    if (!token) throw new AdulisException('SESSION_EXPIRED');

    const session = await this.sessions.authenticate(token);

    // The carrier must match the surface the session was minted for. A
    // mismatch is not an expiry — it is a presentation the surface may not
    // use (section 5.1), and it is refused before any endpoint logic.
    const carrierAudience = bearer !== null ? 'MOBILE' : 'CONSOLE';
    if (session.audience !== carrierAudience) {
      throw new AdulisException('AUDIENCE_NOT_PERMITTED');
    }

    // Section 4.2 — the active seller travels per request, never as session
    // state. Absent on a seller-scoped path -> 400. Whether the account
    // actually holds the seller is NOT decided here: that is
    // fn_has_permission's U0002, a 404 from below the endpoint, so this
    // header's presence check can never become a relationship oracle.
    let sellerId: string | null = null;
    const sellerHeader = req.headers['x-adulis-seller'];
    if (requiresSellerContext(req.path, req.method)) {
      if (typeof sellerHeader !== 'string' || sellerHeader === '') {
        throw new AdulisException('SELLER_CONTEXT_REQUIRED');
      }
      if (!UUID_RE.test(sellerHeader)) {
        throw new AdulisException('VALIDATION_FAILED', {
          slots: { path: 'X-Adulis-Seller' },
        });
      }
      sellerId = sellerHeader;
    } else if (typeof sellerHeader === 'string' && UUID_RE.test(sellerHeader)) {
      // A buyer-group call may still carry it (a seller browsing as buyer
      // does); it is recorded for the context and decides nothing.
      sellerId = sellerHeader;
    }

    const declaredRole = this.reflector.getAllAndOverride<
      'BUYER' | 'SELLER' | 'COURIER' | undefined
    >(ACTOR_ROLE_KEY, [context.getHandler(), context.getClass()]);
    const actorRole =
      declaredRole ?? (requiresSellerContext(req.path, req.method) ? 'SELLER' : 'BUYER');

    req.auth = session;
    req.ctx = { accountId: session.accountId, actorRole, sellerId, audience: session.audience };
    return true;
  }
}
