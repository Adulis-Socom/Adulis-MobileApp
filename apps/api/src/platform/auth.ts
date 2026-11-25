import { Inject, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { checkOrigin, type BrowserAudience } from './http';
import { AdulisException } from './problem';

/**
 * Authentication and authorization EXTENSION POINTS (ARC-BE-02). No session system exists yet: sign-in,
 * sessions, step-up and permission resolution arrive with AUTH-02's own work orders (SC-BE-02 onward).
 * Until then every route is DENIED unless it is explicitly @Public(), and a non-public route that declares
 * no audience is refused even for an authenticated caller. Fail closed is the only default.
 */

export type Audience = 'CONSOLE' | 'MOBILE' | 'OPERATOR';

/** ARCH-PLATFORM-01 S13: discriminated principal. Anonymous input is never SYSTEM. */
export type Principal =
  | { kind: 'ANONYMOUS_PUBLIC' }
  | { kind: 'ORDINARY_ACCOUNT'; accountId: string; audience: Exclude<Audience, 'OPERATOR'> }
  | { kind: 'OPERATOR_ACCOUNT'; operatorAccountId: string; audience: 'OPERATOR' };

/** Resolves the caller from the request's credentials. Implemented by the AUTH-02 work order. */
export interface Authenticator {
  authenticate(req: FastifyRequest): Promise<Exclude<Principal, { kind: 'ANONYMOUS_PUBLIC' }> | null>;
}
export const AUTHENTICATOR = Symbol('AUTHENTICATOR');
export const BROWSER_ORIGINS = Symbol('BROWSER_ORIGINS');

/** The only authenticator until AUTH-02 lands: nobody is authenticated. */
@Injectable()
export class NoSessionsAuthenticator implements Authenticator {
  async authenticate(): Promise<null> {
    return null;
  }
}

const PUBLIC = 'adulis:public';
const AUDIENCES = 'adulis:audiences';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC, true);
export const Audiences = (...audiences: Audience[]): MethodDecorator & ClassDecorator => SetMetadata(AUDIENCES, audiences);

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTHENTICATOR) private readonly authenticator: Authenticator,
    @Inject(BROWSER_ORIGINS) private readonly origins: ReadonlyMap<string, BrowserAudience>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    checkOrigin(req, this.origins);
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets) === true) {
      req.principal = { kind: 'ANONYMOUS_PUBLIC' };
      return true;
    }
    const principal = await this.authenticator.authenticate(req);
    if (principal === null) throw new AdulisException('AUTHENTICATION_REQUIRED');
    const allowed = this.reflector.getAllAndOverride<Audience[] | undefined>(AUDIENCES, targets) ?? [];
    // Surface derives from the validated session and the route, never from a request field (RBL-04 S3).
    if (!allowed.includes(principal.audience)) throw new AdulisException('PERMISSION_DENIED');
    if (req.originAudience !== undefined && req.originAudience !== principal.audience) throw new AdulisException('PERMISSION_DENIED');
    req.principal = principal;
    return true;
  }
}
