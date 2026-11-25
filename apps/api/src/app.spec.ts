import { Body, Controller, Get, HttpException, Post } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { BODY_LIMIT_BYTES, createApp } from './app';
import { apiEnvSchema } from './config/env';
import { Audiences, Public, type Authenticator } from './platform/auth';
import { ZodPipe } from './platform/http';
import { createLogger } from './platform/logging';
import { RebuildableCache } from './platform/valkey';

const CONSOLE = 'https://console.adulis.test';
const OPERATOR = 'https://operator.adulis.test';
const nameSchema = z.strictObject({ name: z.string().min(1) });

@Controller('probe')
class ProbeController {
  @Get('closed')
  closed() {
    return { ok: true };
  }

  @Public()
  @Post('validated')
  validated(@Body(new ZodPipe(nameSchema)) body: z.infer<typeof nameSchema>) {
    return body;
  }

  @Public()
  @Get('client-error')
  clientError(): never {
    throw new HttpException('framework text that must not leak', 429);
  }

  @Audiences('CONSOLE')
  @Get('console')
  console() {
    return { ok: true };
  }

  @Audiences('MOBILE')
  @Get('mobile')
  mobile() {
    return { ok: true };
  }
}

@Public()
@Controller('mixed')
class MixedController {
  @Audiences('CONSOLE')
  @Get('guarded')
  guarded() {
    return { ok: true };
  }
}

function fakePool(query: () => Promise<unknown>): Pool {
  return { query, end: async () => undefined } as unknown as Pool;
}

interface Injected {
  statusCode: number;
  headers: Record<string, string | string[] | number | undefined>;
  body: string;
  json: () => Record<string, unknown>;
}

async function harness(
  opts: { pool?: Pool; authenticator?: Authenticator; trustGateway?: boolean } = {},
): Promise<{ app: NestFastifyApplication; lines: string[]; inject: (o: Record<string, unknown>) => Promise<Injected> }> {
  const lines: string[] = [];
  const logger = createLogger({ service: 'adulis-api', level: 'info', release: 'test', destination: { write: (s: string) => void lines.push(s) } });
  const env = apiEnvSchema.parse({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://api@127.0.0.1:55440/adulis_rebuild',
    CACHE_VALKEY_URL: 'redis://127.0.0.1:1',
    CONSOLE_ORIGIN: CONSOLE,
    OPERATOR_ORIGIN: OPERATOR,
    TRUST_GATEWAY_REQUEST_ID: opts.trustGateway ? 'true' : 'false',
  });
  const app = await createApp({
    env,
    logger,
    pool: opts.pool ?? fakePool(async () => ({ rows: [{ writable: true }] })),
    cache: new RebuildableCache(null, logger),
    controllers: [ProbeController, MixedController],
    ...(opts.authenticator ? { authenticator: opts.authenticator } : {}),
  });
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  return { app, lines, inject: (o) => fastify.inject(o as never) as never };
}

const mobileSession: Authenticator = { authenticate: async () => ({ kind: 'ORDINARY_ACCOUNT', accountId: '00000000-0000-4000-8000-000000000001', audience: 'MOBILE' }) };

describe('API platform (ARC-BE-02)', () => {
  let h: Awaited<ReturnType<typeof harness>>;
  afterEach(async () => h?.app.close());

  it('serves liveness unauthenticated, outside /v1, with a server request id', async () => {
    h = await harness();
    const res = await h.inject({ method: 'GET', url: '/livez' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(String(res.headers['x-adulis-request-id'])).toMatch(/^req_[0-9a-f-]{36}$/);
  });

  it('readiness follows PostgreSQL writability and never leaks detail', async () => {
    h = await harness();
    expect((await h.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    await h.app.close();
    h = await harness({ pool: fakePool(async () => ({ rows: [{ writable: false }] })) });
    const readOnly = await h.inject({ method: 'GET', url: '/healthz' });
    expect(readOnly.statusCode).toBe(503);
    expect(readOnly.json()).toEqual({ status: 'unavailable' });
    await h.app.close();
    h = await harness({ pool: fakePool(async () => Promise.reject(Object.assign(new Error('connect ECONNREFUSED 10.1.2.3:5432'), { code: 'ECONNREFUSED' }))) });
    const down = await h.inject({ method: 'GET', url: '/healthz' });
    expect(down.statusCode).toBe(503);
    expect(down.body).not.toContain('10.1.2.3');
  });

  it('an unknown route is a problem envelope carrying the same request id', async () => {
    h = await harness();
    const res = await h.inject({ method: 'GET', url: '/v1/nothing-here' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json();
    expect(body).toMatchObject({ code: 'NOT_FOUND', status: 404, title_key: 'error.request.not_found', retryable: false });
    expect(body['request_id']).toBe(res.headers['x-adulis-request-id']);
  });

  it('denies every non-public route by default: no session system exists yet', async () => {
    h = await harness();
    const res = await h.inject({ method: 'GET', url: '/v1/probe/closed' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    expect((await h.inject({ method: 'GET', url: '/probe/closed' })).statusCode).toBe(404); // business routes live under /v1 only
  });

  it('refuses an authenticated caller on a route that declares no audience, or the wrong one', async () => {
    h = await harness({ authenticator: mobileSession });
    expect((await h.inject({ method: 'GET', url: '/v1/probe/closed' })).statusCode).toBe(403);
    expect((await h.inject({ method: 'GET', url: '/v1/probe/console' })).statusCode).toBe(403);
    expect((await h.inject({ method: 'GET', url: '/v1/probe/mobile' })).statusCode).toBe(200);
  });

  it('a class-level @Public() never opens a method that declares audiences', async () => {
    h = await harness();
    expect((await h.inject({ method: 'GET', url: '/v1/mixed/guarded' })).statusCode).toBe(401);
  });

  it('enforces the exact origin allow-list and origin/audience agreement', async () => {
    h = await harness({ authenticator: mobileSession });
    const foreign = await h.inject({ method: 'GET', url: '/livez', headers: { origin: 'https://console.adulis.test.evil.example' } });
    expect(foreign.statusCode).toBe(403);
    expect(foreign.json()).toMatchObject({ code: 'PERMISSION_DENIED' });
    const allowed = await h.inject({ method: 'GET', url: '/livez', headers: { origin: CONSOLE } });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(CONSOLE);
    // A MOBILE session presented from the Console origin never crosses audiences.
    expect((await h.inject({ method: 'GET', url: '/v1/probe/mobile', headers: { origin: CONSOLE } })).statusCode).toBe(403);
  });

  it('validates request bodies and reports every failing path', async () => {
    h = await harness();
    const bad = await h.inject({ method: 'POST', url: '/v1/probe/validated', payload: { name: '', extra: 1 } });
    expect(bad.statusCode).toBe(400);
    const body = bad.json() as { code: string; items: { slots: { path: string } }[] };
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    const good = await h.inject({ method: 'POST', url: '/v1/probe/validated', payload: { name: 'a' } });
    expect(good.statusCode).toBe(201);
  });

  it('maps malformed JSON and oversize bodies into the envelope', async () => {
    h = await harness();
    const malformed = await h.inject({ method: 'POST', url: '/v1/probe/validated', headers: { 'content-type': 'application/json' }, payload: '{"name":' });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    const huge = await h.inject({ method: 'POST', url: '/v1/probe/validated', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ name: 'x'.repeat(BODY_LIMIT_BYTES) }) });
    expect(huge.statusCode).toBe(413);
    expect(huge.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('keeps other client errors as client errors in the closed catalogue, without framework text', async () => {
    h = await harness();
    const res = await h.inject({ method: 'GET', url: '/v1/probe/client-error' });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ code: 'VALIDATION_FAILED', status: 429, retryable: true });
    expect(res.body).not.toContain('framework text');
  });

  it('accepts a gateway request id only when trusted and well formed', async () => {
    h = await harness();
    expect((await h.inject({ method: 'GET', url: '/livez', headers: { 'x-request-id': 'gw-0123456789' } })).headers['x-adulis-request-id']).not.toBe('gw-0123456789');
    await h.app.close();
    h = await harness({ trustGateway: true });
    expect((await h.inject({ method: 'GET', url: '/livez', headers: { 'x-request-id': 'gw-0123456789' } })).headers['x-adulis-request-id']).toBe('gw-0123456789');
    expect((await h.inject({ method: 'GET', url: '/livez', headers: { 'x-request-id': 'bad id\nwith newline' } })).headers['x-adulis-request-id']).toMatch(/^req_/);
  });

  it('logs the route template, never the query string, credentials or body', async () => {
    h = await harness();
    await h.inject({ method: 'POST', url: '/v1/probe/validated?phone=0911000000', headers: { authorization: 'Bearer secret-token', cookie: 'sid=secret' }, payload: { name: 'a' } });
    const all = h.lines.join('');
    expect(all).toContain('"route":"/v1/probe/validated"');
    for (const leaked of ['0911000000', 'secret-token', 'sid=secret', '"name":"a"']) expect(all).not.toContain(leaked);
  });

  it('sets security headers for a JSON API', async () => {
    h = await harness();
    const res = await h.inject({ method: 'GET', url: '/livez' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(String(res.headers['content-security-policy'])).toContain("default-src 'none'");
  });
});
