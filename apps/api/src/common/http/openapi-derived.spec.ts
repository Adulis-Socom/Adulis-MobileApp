import 'reflect-metadata';
import { Controller, Get, Post, type ExecutionContext, type INestApplication, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiDefaultResponse, ApiHeader, DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AuthGuard, Public } from '../auth/auth.guard';
import type { SessionService } from '../auth/session.service';
import { AdulisException } from '../errors/adulis-exception';
import { SESSION_COOKIE } from './cookies';
import { SELLER_HEADER, applyProblemResponses, applySellerHeader } from './openapi-derived';

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

@Controller('open')
class PublicController {
  /** Under a seller-looking path but public: the guard returns before the seller stage. */
  @Get('seller-ish')
  @Public()
  open(): string {
    return 'open';
  }

  @Get('plain')
  plain(): string {
    return 'plain';
  }
}

@Controller('legacy')
class LegacyController {
  @Get('x')
  x(): string {
    return 'x';
  }
}

const CONTROLLERS: Type[] = [SellerController, PublicController, LegacyController];

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
      expect(sellerHeaders(document, '/open/seller-ish')).toEqual([]);
      expect(sellerHeaders(document, '/open/plain')).toEqual([]);
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
        [PublicController, 'open', '/v1/open/seller-ish', 'GET', 'get', '/open/seller-ish'],
        [PublicController, 'plain', '/v1/open/plain', 'GET', 'get', '/open/plain'],
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
      for (const path of ['/seller/things', '/seller/list', '/open/plain', '/legacy/x']) {
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
      expect(problem(document, '/open/plain')).toBeDefined();
    });
  });
});
