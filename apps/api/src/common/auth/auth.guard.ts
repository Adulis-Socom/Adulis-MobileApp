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
 *  - GET /v1/seller/list is the caller's OWN store list (T18 Phase 3,
 *    register D-97). The other two are POSTs; this one is a GET, and it is
 *    the third member of the same category rather than a special case: a
 *    path under /v1/seller that no seller header can describe. Creation has
 *    nothing to name yet, identity verification is held by an operator who
 *    holds no seller, and this one is asking WHICH sellers exist for the
 *    caller -- so requiring the answer as input is circular.
 *
 *    Inventing a /v1/accounts namespace for one endpoint would have been the
 *    larger change; the exemption list is where the category already lives.
 *
 * The path keeps its /v1/seller prefix because ADU-API-01 v1.7 keeps it:
 * removing the path would be the shape change doctrine 6 forbids, and the
 * capability did not disappear -- it moved to whoever holds the grant.
 *
 * A SECOND-ORDER EFFECT WORTH KNOWING: this function is called TWICE per
 * request -- once for the header requirement and once to derive actorRole
 * (declaredRole ?? (requiresSellerContext(...) ? 'SELLER' : 'BUYER')). An
 * exemption therefore also sets adulis.actor_role to BUYER for that request.
 * That is safe for all three: none of them reads a seller-scoped RLS policy,
 * and the only policy that reads actor_role tests it against 'COURIER'. The
 * list endpoint additionally does its own filtering by account, so the role
 * decides nothing there.
 */
function requiresSellerContext(rawPath: string, method: string): boolean {
  // LOWERCASED ONCE, and this is a fix rather than a nicety (T18 Phase 3 pass).
  // Express routes case-INSENSITIVELY -- neither configure-app.ts nor main.ts
  // sets 'case sensitive routing', so GET /v1/SELLER/payout reaches the payout
  // handler. Every predicate below was case-SENSITIVE, so that request skipped
  // BOTH effects of section 4.2: no SELLER_CONTEXT_REQUIRED, and actorRole
  // silently BUYER instead of SELLER. It fails closed one layer down today
  // (assertPermission throws on a null sellerId rather than querying), so
  // nothing leaks -- but the docstring above promises "absent on a
  // seller-scoped path -> 400", and that promise was false for any
  // capitalisation. Normalising here makes the guard agree with the router.
  const path = rawPath.toLowerCase();

  // The THIRD exemption (T18 Phase 3, register D-97). It is tested BEFORE the
  // method gate below, because that gate returns unconditionally for every
  // non-POST under /v1/seller and has no exemption slot of its own.
  //
  // GET /v1/seller/list is the same category as the two POSTs: a path under
  // /v1/seller that NO seller header can describe. Creation has nothing to name
  // yet; identity verification is held by an operator who holds no seller; and
  // this one asks WHICH sellers the caller holds, so demanding the answer as
  // input is circular.
  //
  // It discloses nothing: it returns the caller's OWN relationships, which they
  // could already reach by holding the id. There is no relationship oracle here
  // because there is no id to probe with.
  //
  // GET AND HEAD ONLY. The two exemptions it joins are method-gated for free by
  // sitting below the POST check; this one is above it and would otherwise
  // exempt every verb, so a later @Post('seller/list') would inherit the
  // exemption silently. HEAD is included because Express routes HEAD to the GET
  // handler, and a HEAD that demanded a header the endpoint cannot accept would
  // be a 400 nobody could fix.
  if (
    (method === 'GET' || method === 'HEAD') &&
    (path === '/v1/seller/list' || path === '/v1/seller/list/')
  ) {
    return false;
  }

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
