import 'reflect-metadata';
import { Controller, Get, Post, type ExecutionContext, type INestApplication, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AuthGuard, Public } from '../auth/auth.guard';
import type { SessionService } from '../auth/session.service';
import { GUARD_SECURITY, applyGuardSecurity, isPublicRoute } from './openapi-security';

/**
 * The security metadata of the contract is derived from the @Public metadata
 * the AuthGuard reads. This holds the derivation to the guard itself: for
 * every shape of route (anonymous by method, anonymous by controller,
 * protected), the guard's verdict and the documented one are the same.
 */

@Controller('mixed')
class MixedController {
  @Get('open')
  @Public()
  open(): string {
    return 'open';
  }

  @Get('closed')
  closed(): string {
    return 'closed';
  }

  @Post('own')
  @ApiBearerAuth('bearer')
  own(): string {
    return 'own';
  }
}

@Controller('anon')
@Public()
class AnonymousController {
  @Get('a')
  a(): string {
    return 'a';
  }
}

@Controller('legacy')
class LegacyController {
  @Get('x')
  x(): string {
    return 'x';
  }
}

const CONTROLLERS: Type[] = [MixedController, AnonymousController, LegacyController];

describe('applyGuardSecurity', () => {
  let app: INestApplication;
  let build: () => OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: CONTROLLERS }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    build = () =>
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'bearer')
          .addCookieAuth('session', { type: 'apiKey', in: 'cookie' }, 'cookie')
          .build(),
      );
  });
  afterAll(async () => {
    await app.close();
  });

  const guardVerdict = async (controller: Type, handler: string): Promise<'allows' | 'demands a session'> => {
    const guard = new AuthGuard(new Reflector(), {} as SessionService);
    const context = {
      getHandler: () => (controller.prototype as Record<string, () => unknown>)[handler],
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ headers: {}, path: '/', method: 'GET' }) }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context).then(
      () => 'allows' as const,
      () => 'demands a session' as const,
    );
  };

  it('documents security exactly where the guard demands a session', async () => {
    const document = build();
    applyGuardSecurity(document, CONTROLLERS);
    const documented = (path: string, method: 'get' | 'post') => (document.paths[path]?.[method]?.security ? 'demands a session' : 'allows');
    expect(documented('/mixed/open', 'get')).toBe(await guardVerdict(MixedController, 'open'));
    expect(documented('/mixed/closed', 'get')).toBe(await guardVerdict(MixedController, 'closed'));
    expect(documented('/anon/a', 'get')).toBe(await guardVerdict(AnonymousController, 'a'));
    expect(documented('/mixed/closed', 'get')).toBe('demands a session');
    expect(documented('/mixed/open', 'get')).toBe('allows');
    expect(documented('/anon/a', 'get')).toBe('allows');
  });

  it('declares the credentials the guard accepts', () => {
    const document = build();
    applyGuardSecurity(document, CONTROLLERS);
    // Written out, not compared with the constant under test: either credential authenticates (cookie or bearer).
    expect(document.paths['/mixed/closed']?.get?.security).toEqual([{ cookie: [] }, { bearer: [] }]);
    expect(GUARD_SECURITY).toEqual([{ cookie: [] }, { bearer: [] }]);
  });

  it('keeps the security a route already declares', () => {
    const document = build();
    applyGuardSecurity(document, CONTROLLERS);
    expect(document.paths['/mixed/own']?.post?.security).toEqual([{ bearer: [] }]);
  });

  it('leaves a skipped controller exactly as it was', () => {
    const document = build();
    applyGuardSecurity(document, CONTROLLERS, new Set(['LegacyController']));
    expect(document.paths['/legacy/x']?.get?.security).toBeUndefined();
    expect(document.paths['/mixed/closed']?.get?.security).toBeDefined();
  });

  it('refuses an operation it cannot attribute to a controller method', () => {
    const document = build();
    expect(() => applyGuardSecurity(document, [MixedController])).toThrow(/matches no controller method/);
  });

  it('reads @Public the way the guard does: the handler first, then the controller', () => {
    expect(isPublicRoute(MixedController.prototype.open, MixedController)).toBe(true);
    expect(isPublicRoute(MixedController.prototype.closed, MixedController)).toBe(false);
    expect(isPublicRoute(AnonymousController.prototype.a, AnonymousController)).toBe(true);
  });
});
