import 'reflect-metadata';
import { Controller, Get, Post, type ExecutionContext, type INestApplication, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiDefaultResponse, ApiHeader, ApiOperation, ApiResponse, ApiSecurity, DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AuthGuard, Public } from '../auth/auth.guard';
import type { SessionService } from '../auth/session.service';
import { AdulisException } from '../errors/adulis-exception';
import { ERROR_CATALOGUE } from '../errors/error-catalogue';
import { ApiIdempotencyKey } from '../idempotency/api-idempotency-key';
import { SESSION_COOKIE } from './cookies';
import { ApiGate } from './api-gate';
import { ApiDeviceHeaders } from './api-headers';
import { SELLER_HEADER, applyGateDescriptions, applyGuardErrors, applyProblemResponses, applySellerHeader } from './openapi-derived';
import { applyGuardSecurity } from './openapi-security';

/**
 * The seller header and the problem response of the contract are derived from
 * what the pipeline does, not restated per route. These specs hold each
 * derivation to the real AuthGuard and to the shapes it must leave alone.
 */

@Controller('seller')
class SellerController {
  @Get('things')
  things(): string {
    return 'things';
  }

  /** The caller's own store list: no seller header can describe it, the guard exempts it. */
  @Get('list')
  list(): string {
    return 'list';
  }

  /** Creation: nothing to name yet. */
  @Post()
  create(): string {
    return 'create';
  }

  @Get('declared')
  @ApiHeader({ name: 'x-adulis-seller', required: true, description: 'declared by hand', schema: { type: 'string' } })
  declared(): string {
    return 'declared';
  }

  @Get('own-problem')
  @ApiDefaultResponse({ description: 'declared by hand' })
  ownProblem(): string {
    return 'own-problem';
  }
}

/** Under a path that starts like the seller routes but public (as GET /v1/sellers/lookup is): the guard returns before the seller stage. */
@Controller('sellers')
class PublicController {
  @Get('lookup')
  @Public()
  lookup(): string {
    return 'lookup';
  }

  /** An anonymous keyed POST: nobody is signed in, so the device (or a browser cookie) is what keys it. */
  @Post('device-keyed')
  @Public()
  @ApiIdempotencyKey()
  @ApiDeviceHeaders()
  deviceKeyed(): string {
    return 'device-keyed';
  }
}

@Controller('buyer')
class BuyerController {
  @Get('plain')
  plain(): string {
    return 'plain';
  }

  @Post('keyed')
  @ApiIdempotencyKey()
  keyed(): string {
    return 'keyed';
  }

  @Get('ticket')
  @Public()
  @ApiSecurity('deletionTicket')
  ticket(): string {
    return 'ticket';
  }

  @Get('own-409')
  @ApiResponse({ status: 401, description: 'declared by hand' })
  ownRefusal(): string {
    return 'own-refusal';
  }
}

/** Not named like the real controller on purpose: the pin is the route (post /auth/logout), not a class or method name. */
@Controller('auth')
class RenamedSessionController {
  @Post('logout')
  logout(): string {
    return 'logout';
  }
}

@Controller('gated')
class GatedController {
  @Get('console')
  @ApiGate({ permission: ['seller.products:read'], surfaces: ['CONSOLE'] })
  console(): string {
    return 'console';
  }

  @Get('both')
  @ApiGate({ permission: ['seller.analytics.basic:read'], surfaces: ['MOBILE', 'CONSOLE'] })
  both(): string {
    return 'both';
  }

  @Get('two')
  @ApiGate({ permission: ['seller.broadcasts:send', 'seller.media:write'], surfaces: ['CONSOLE'] })
  @ApiOperation({ summary: 'Own summary.', description: 'Own description.' })
  two(): string {
    return 'two';
  }

  @Get('audience')
  @ApiGate({ surfaces: ['CONSOLE'] })
  audience(): string {
    return 'audience';
  }

  @Get('ungated')
  ungated(): string {
    return 'ungated';
  }
}

@Controller('legacy')
class LegacyController {
  @Get('x')
  x(): string {
    return 'x';
  }
}

const CONTROLLERS: Type[] = [SellerController, PublicController, BuyerController, GatedController, RenamedSessionController, LegacyController];

describe('contract metadata derived from the request pipeline', () => {
  let app: INestApplication;
  let build: () => OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: CONTROLLERS }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    build = () => SwaggerModule.createDocument(app, new DocumentBuilder().build());
  });
  afterAll(async () => {
    await app.close();
  });

  const sellerHeaders = (document: OpenAPIObject, path: string, method: 'get' | 'post' = 'get') =>
    (document.paths[path]?.[method]?.parameters ?? []).filter((p) => 'name' in p && p.in === 'header' && p.name.toLowerCase() === 'x-adulis-seller');

  describe('applySellerHeader', () => {
    it('declares the required header exactly on the protected routes under /v1/seller', () => {
      const document = build();
      applySellerHeader(document, CONTROLLERS);
      expect(sellerHeaders(document, '/seller/things')).toEqual([SELLER_HEADER]);
      expect(sellerHeaders(document, '/seller/list')).toEqual([]);
      expect(sellerHeaders(document, '/seller', 'post')).toEqual([]);
      expect(sellerHeaders(document, '/sellers/lookup')).toEqual([]);
      expect(sellerHeaders(document, '/buyer/plain')).toEqual([]);
    });

    it('is written out here, not compared with the constant under test', () => {
      expect(SELLER_HEADER).toEqual({
        name: 'X-Adulis-Seller',
        in: 'header',
        required: true,
        description: 'The Seller context (ADU-API-01 S4.2).',
        schema: { type: 'string', format: 'uuid' },
      });
    });

    it('keeps a header a route already declares, once', () => {
      const document = build();
      applySellerHeader(document, CONTROLLERS);
      expect(sellerHeaders(document, '/seller/declared')).toHaveLength(1);
      expect(sellerHeaders(document, '/seller/declared')[0]).toMatchObject({ description: 'declared by hand' });
    });

    it('leaves a skipped controller alone', () => {
      const document = build();
      applySellerHeader(document, CONTROLLERS, new Set(['SellerController']));
      expect(sellerHeaders(document, '/seller/things')).toEqual([]);
    });

    it('declares the header on exactly the routes where the real guard demands it', async () => {
      const document = build();
      applySellerHeader(document, CONTROLLERS);
      const demands = async (controller: Type, handler: string, path: string, method: string): Promise<boolean> => {
        const session = { sessionId: 's', accountId: 'a', audience: 'CONSOLE', deviceId: null, marketId: 'm' };
        const guard = new AuthGuard(new Reflector(), { authenticate: () => Promise.resolve(session) } as unknown as SessionService);
        const context = {
          getHandler: () => (controller.prototype as Record<string, () => unknown>)[handler],
          getClass: () => controller,
          switchToHttp: () => ({ getRequest: () => ({ headers: { cookie: `${SESSION_COOKIE}=token` }, path, method }) }),
        } as unknown as ExecutionContext;
        return guard.canActivate(context).then(
          () => false,
          (e: unknown) => {
            if (e instanceof AdulisException && e.code === 'SELLER_CONTEXT_REQUIRED') return true;
            throw e;
          },
        );
      };
      const cases: [Type, string, string, string, 'get' | 'post', string][] = [
        [SellerController, 'things', '/v1/seller/things', 'GET', 'get', '/seller/things'],
        [SellerController, 'list', '/v1/seller/list', 'GET', 'get', '/seller/list'],
        [SellerController, 'create', '/v1/seller', 'POST', 'post', '/seller'],
        [SellerController, 'declared', '/v1/seller/declared', 'GET', 'get', '/seller/declared'],
        [PublicController, 'lookup', '/v1/sellers/lookup', 'GET', 'get', '/sellers/lookup'],
        [BuyerController, 'plain', '/v1/buyer/plain', 'GET', 'get', '/buyer/plain'],
      ];
      for (const [controller, handler, requestPath, method, verb, documentPath] of cases) {
        const required = sellerHeaders(document, documentPath, verb).some((p) => 'required' in p && p.required === true);
        expect(`${method} ${requestPath} documents it: ${required}`).toBe(
          `${method} ${requestPath} documents it: ${await demands(controller, handler, requestPath, method)}`,
        );
      }
    });
  });

  describe('applyProblemResponses', () => {
    const problem = (document: OpenAPIObject, path: string) => document.paths[path]?.get?.responses?.['default'];

    it('gives every operation without one the problem response the filter sends', () => {
      const document = build();
      applyProblemResponses(document, CONTROLLERS);
      for (const path of ['/seller/things', '/seller/list', '/buyer/plain', '/legacy/x']) {
        expect(problem(document, path)).toEqual({
          description: 'Problem details (ProblemDetailsFilter).',
          content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDto' } } },
        });
      }
    });

    it('keeps a default response an operation declares', () => {
      const document = build();
      applyProblemResponses(document, CONTROLLERS);
      expect(problem(document, '/seller/own-problem')).toEqual({ description: 'declared by hand' });
    });

    it('leaves a skipped controller alone', () => {
      const document = build();
      applyProblemResponses(document, CONTROLLERS, new Set(['LegacyController']));
      expect(problem(document, '/legacy/x')).toBeUndefined();
      expect(problem(document, '/buyer/plain')).toBeDefined();
    });
  });
});

describe('ApiGate and applyGateDescriptions', () => {
  let app: INestApplication;
  let built: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [GatedController] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    built = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'bearer')
        .addCookieAuth('session', { type: 'apiKey', in: 'cookie' }, 'cookie')
        .build(),
    );
    applyGuardSecurity(built, [GatedController]);
    applyGateDescriptions(built, [GatedController]);
  });
  afterAll(async () => {
    await app.close();
  });

  const op = (path: string) => built.paths[path]?.get as unknown as Record<string, unknown>;

  it('offers the cookie alone where the gate admits only a Console session', () => {
    expect(op('/gated/console')['security']).toEqual([{ cookie: [] }]);
    expect(op('/gated/audience')['security']).toEqual([{ cookie: [] }]);
    expect(op('/gated/two')['security']).toEqual([{ cookie: [] }]);
  });

  it('leaves both credentials where a mobile session can pass the gate, and on a route with no gate', () => {
    expect(op('/gated/both')['security']).toEqual([{ cookie: [] }, { bearer: [] }]);
    expect(op('/gated/ungated')['security']).toEqual([{ cookie: [] }, { bearer: [] }]);
  });

  it('states the permission and the surfaces as extensions', () => {
    expect(op('/gated/console')['x-adulis-permission']).toEqual(['seller.products:read']);
    expect(op('/gated/console')['x-adulis-surfaces']).toEqual(['CONSOLE']);
    expect(op('/gated/both')['x-adulis-surfaces']).toEqual(['MOBILE', 'CONSOLE']);
    expect(op('/gated/two')['x-adulis-permission']).toEqual(['seller.broadcasts:send', 'seller.media:write']);
    expect(op('/gated/audience')['x-adulis-permission']).toBeUndefined();
    expect(op('/gated/ungated')['x-adulis-surfaces']).toBeUndefined();
  });

  it('says it in the description, after the description the operation has', () => {
    expect(op('/gated/console')['description']).toBe(
      'Requires `seller.products:read` in the Seller named by X-Adulis-Seller. Console (cookie) sessions only: a mobile (bearer) session cannot perform it.',
    );
    expect(op('/gated/both')['description']).toBe(
      'Requires `seller.analytics.basic:read` in the Seller named by X-Adulis-Seller. A mobile (bearer) or a Console (cookie) session can hold it.',
    );
    expect(op('/gated/two')['description']).toBe(
      'Own description.\n\nRequires `seller.broadcasts:send` and `seller.media:write` in the Seller named by X-Adulis-Seller. Console (cookie) sessions only: a mobile (bearer) session cannot perform it.',
    );
    expect(op('/gated/audience')['description']).toBe('Console (cookie) sessions only: a mobile (bearer) session cannot perform it.');
    expect(op('/gated/ungated')['description']).toBeUndefined();
  });
});

describe('applyGuardErrors', () => {
  let app: INestApplication;
  let built: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: CONTROLLERS }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    built = SwaggerModule.createDocument(app, new DocumentBuilder().addApiKey({ type: 'apiKey', in: 'header', name: 'Authorization' }, 'deletionTicket').build());
    applyGuardSecurity(built, CONTROLLERS);
    applySellerHeader(built, CONTROLLERS);
    applyGateDescriptions(built, CONTROLLERS);
    applyGuardErrors(built, CONTROLLERS);
  });
  afterAll(async () => {
    await app.close();
  });

  const responses = (path: string, method: 'get' | 'post' = 'get') => built.paths[path]?.[method]?.responses ?? {};
  const text = (path: string, code: string, method: 'get' | 'post' = 'get') => (responses(path, method)[code] as { description?: string } | undefined)?.description ?? '';

  it('declares the session refusals on a protected route, and the seller header refusal where it is required', () => {
    expect(text('/seller/things', '401')).toContain('SESSION_EXPIRED');
    expect(text('/seller/things', '403')).toContain('AUDIENCE_NOT_PERMITTED');
    expect(text('/seller/things', '400')).toContain('SELLER_CONTEXT_REQUIRED');
    expect(responses('/buyer/plain')['400']).toBeUndefined();
    expect(responses('/buyer/plain')['409']).toBeUndefined();
  });

  it('declares the Origin refusal on a write and not on a read', () => {
    expect(text('/buyer/keyed', '403', 'post')).toContain('Origin');
    expect(text('/buyer/plain', '403')).not.toContain('Origin');
  });

  it('declares the idempotency refusals on a keyed route', () => {
    expect(text('/buyer/keyed', '400', 'post')).toContain('IDEMPOTENCY_KEY_MISSING');
    expect(text('/buyer/keyed', '409', 'post')).toContain('IDEMPOTENCY_KEY_REUSED');
  });

  it('does not read as exhaustive: a 400 or a 409 can also be a refusal of the operation itself', () => {
    expect(text('/buyer/keyed', '400', 'post')).toContain('for example');
    expect(text('/buyer/keyed', '400', 'post')).toContain('carry their own code');
    expect(text('/buyer/keyed', '409', 'post')).toContain('its own code');
  });

  it('says when the device header is needed on an anonymous keyed route, and keeps it optional', () => {
    expect(text('/sellers/device-keyed', '400', 'post')).toContain('X-Adulis-Device');
    const header = (built.paths['/sellers/device-keyed']?.post?.parameters ?? []).find((p) => 'name' in p && p.name === 'X-Adulis-Device') as { required?: boolean; description?: string };
    expect(header.required).toBe(false);
    expect(header.description).toContain('nobody is signed in');
    // A keyed route a signed-in caller uses says nothing about the device.
    expect(text('/buyer/keyed', '400', 'post')).not.toContain('X-Adulis-Device');
  });

  it('declares the permission refusal where a permission is stated, and only there', () => {
    expect(text('/gated/console', '403')).toContain('lacks the permission');
    expect(text('/gated/audience', '403')).not.toContain('lacks the permission');
  });

  it('names the audience check as the refusal of another surface where no permission is stated', () => {
    expect(text('/gated/audience', '403')).toContain('A session of another surface is refused (PERMISSION_DENIED)');
    expect(text('/gated/console', '403')).not.toContain('another surface is refused');
    expect(text('/buyer/plain', '403')).not.toContain('another surface is refused');
  });

  it('says that a public route refuses only a credential that was presented', () => {
    expect(text('/sellers/lookup', '401')).toContain('A credential was presented');
    expect(text('/sellers/lookup', '403')).toContain('A credential was presented');
    expect(responses('/sellers/lookup')['400']).toBeUndefined();
  });

  it('declares the ticket refusal alone on a ticket route', () => {
    expect(text('/buyer/ticket', '401')).toContain('ticket');
    expect(responses('/buyer/ticket')['403']).toBeUndefined();
  });

  it('keeps a response an operation declares, and leaves a pinned operation and a skipped controller alone', () => {
    expect(text('/buyer/own-409', '401')).toBe('declared by hand');
    expect(Object.keys(responses('/auth/logout', 'post'))).toEqual(['201']);
    const skipped = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    applyGuardErrors(skipped, CONTROLLERS, new Set(['SellerController']));
    expect(skipped.paths['/seller/things']?.get?.responses['401']).toBeUndefined();
  });

  it('names, in every description it writes, only codes whose catalogue status is the status it is filed under', () => {
    const wrong: string[] = [];
    for (const item of Object.values(built.paths)) {
      for (const operation of Object.values(item)) {
        for (const [code, response] of Object.entries((operation as { responses?: Record<string, { description?: string }> }).responses ?? {})) {
          if (!['400', '401', '403', '409'].includes(code)) continue;
          if ((response.description ?? '') === 'declared by hand') continue;
          for (const name of (response.description ?? '').match(/[A-Z][A-Z_]{5,}/g) ?? []) {
            const entry = (ERROR_CATALOGUE as Record<string, { status: number }>)[name];
            // PERMISSION_DENIED and AUDIENCE_NOT_PERMITTED travel together in one 403 description, and the Origin
            // refusal is a PERMISSION_DENIED; every name must be a real code of that status.
            if (!entry || String(entry.status) !== code) wrong.push(`${code}: ${name}`);
          }
        }
      }
    }
    expect([...new Set(wrong)]).toEqual([]);
  });
});
