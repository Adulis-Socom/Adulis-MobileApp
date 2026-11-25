import helmet from '@fastify/helmet';
import { Inject, Module, type DynamicModule, type OnApplicationShutdown, type Type } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { LogController } from 'fastify';
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import type { ApiEnv } from './config/env';
import { HealthController, PG_POOL } from './health.controller';
import { AccessGuard, AUTHENTICATOR, BROWSER_ORIGINS, NoSessionsAuthenticator, type Authenticator } from './platform/auth';
import { makeGenReqId, REQUEST_ID_HEADER, requestIdsHook, type BrowserAudience } from './platform/http';
import { NestPinoLogger } from './platform/logging';
import { IS_PRODUCTION, LOGGER, ProblemFilter } from './platform/problem';
import { RebuildableCache } from './platform/valkey';

/** Media never transits the API; requests are small (carried legacy limit). */
export const BODY_LIMIT_BYTES = 256 * 1024;

export interface AppDeps {
  readonly env: ApiEnv;
  readonly logger: Logger;
  readonly pool: Pool;
  readonly cache: RebuildableCache;
  /** Replaced only by the AUTH-02 work order (and by tests). Defaults to "nobody is authenticated". */
  readonly authenticator?: Authenticator;
  /** Test seam: extra controllers mounted under the same guard, filter and prefix. */
  readonly controllers?: readonly Type[];
}

class ResourceCloser implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(RebuildableCache) private readonly cache: RebuildableCache,
  ) {}
  async onApplicationShutdown(): Promise<void> {
    await this.cache.close();
    await this.pool.end();
  }
}

@Module({})
class AppModule {
  static register(deps: AppDeps, origins: ReadonlyMap<string, BrowserAudience>): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, ...(deps.controllers ?? [])],
      providers: [
        { provide: LOGGER, useValue: deps.logger },
        { provide: IS_PRODUCTION, useValue: deps.env.NODE_ENV === 'production' },
        { provide: PG_POOL, useValue: deps.pool },
        { provide: RebuildableCache, useValue: deps.cache },
        deps.authenticator ? { provide: AUTHENTICATOR, useValue: deps.authenticator } : { provide: AUTHENTICATOR, useClass: NoSessionsAuthenticator },
        { provide: BROWSER_ORIGINS, useValue: origins },
        { provide: APP_GUARD, useClass: AccessGuard },
        { provide: APP_FILTER, useClass: ProblemFilter },
        ResourceCloser,
      ],
    };
  }
}

/**
 * Builds the API process (ARC-BE-02): NestJS on Fastify, strict origins, one problem envelope, redacted
 * structured logs, /v1 for every business route, unprefixed /livez and /healthz. Used by main.ts, the
 * OpenAPI generator and the HTTP tests, so all three exercise the same application.
 */
export async function createApp(deps: AppDeps): Promise<NestFastifyApplication> {
  const origins = new Map<string, BrowserAudience>([[deps.env.CONSOLE_ORIGIN, 'CONSOLE']]);
  if (deps.env.OPERATOR_ORIGIN !== undefined) origins.set(deps.env.OPERATOR_ORIGIN, 'OPERATOR');

  const adapter = new FastifyAdapter({
    loggerInstance: deps.logger,
    logController: new LogController({ disableRequestLogging: true }), // Fastify would log raw URLs with query strings (OBS-01 S11)
    genReqId: makeGenReqId(deps.env.TRUST_GATEWAY_REQUEST_ID),
    requestIdHeader: false,
    bodyLimit: BODY_LIMIT_BYTES,
    return503OnClosing: true,
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.register(deps, origins), adapter, { bufferLogs: true });
  app.useLogger(new NestPinoLogger(deps.logger));
  app.setGlobalPrefix('v1', { exclude: ['livez', 'healthz'] });
  app.enableCors({ origin: [...origins.keys()], credentials: true, exposedHeaders: [REQUEST_ID_HEADER], maxAge: 600 });
  await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', requestIdsHook);
  fastify.addHook('onResponse', async (req, reply) => {
    deps.logger.info(
      { requestId: req.id, correlationId: req.correlationId, method: req.method, route: req.routeOptions.url ?? '(unrouted)', statusCode: reply.statusCode, durationMs: Math.round(reply.elapsedTime) },
      'request completed',
    );
  });
  // Fastify-level errors (body limit, malformed JSON, content type) reach the global ProblemFilter through Nest's
  // own Fastify error handler, which Nest installs at init: app.spec.ts proves the envelope for both.

  // SIGTERM is owned by main.ts (drain, close, exit 0); Nest's own hook would re-raise the signal.
  return app;
}
