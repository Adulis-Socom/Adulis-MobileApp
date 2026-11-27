import { en } from '@adulis/locale';
import { apiEnvSchema, loadEnv, workerEnvSchema } from '../config/env';
import { assertTargetUrl, TargetRefused } from '../db/target-guard';
import { actorSchema, eventEnvelopeSchema, jobEnvelopeSchema } from '../events/envelope';
import { EventRegistry, PRODUCTION_CONSUMERS, PRODUCTION_EVENTS, type ConsumerDefinition, type EventDefinition } from '../events/registry';
import { repeat } from '../worker';
import { allowListed, createLogger, errorFields } from './logging';
import { ERROR_CATALOGUE, messageKeyFor, type ErrorCode } from './problem';
import { RebuildableCache } from './valkey';
import { z } from 'zod';

const apiBase = { NODE_ENV: 'test', DATABASE_URL: 'postgres://u:pw-secret@127.0.0.1:55440/adulis_rebuild', CACHE_VALKEY_URL: 'redis://127.0.0.1:56380', CONSOLE_ORIGIN: 'https://console.adulis.test' };

describe('environment validation', () => {
  it('accepts a complete API environment and applies safe defaults', () => {
    const env = loadEnv(apiEnvSchema, apiBase);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.TRUST_GATEWAY_REQUEST_ID).toBe(false);
  });

  it('refuses invalid values and never echoes them', () => {
    expect(() => loadEnv(apiEnvSchema, { ...apiBase, DATABASE_URL: 'mysql://u:pw-secret@h/db' })).toThrow(/DATABASE_URL/);
    try {
      loadEnv(apiEnvSchema, { ...apiBase, DATABASE_URL: 'mysql://u:pw-secret@h/db' });
    } catch (err) {
      expect((err as Error).message).not.toContain('pw-secret');
    }
    expect(() => loadEnv(apiEnvSchema, { ...apiBase, CONSOLE_ORIGIN: 'https://console.adulis.test/path' })).toThrow(/CONSOLE_ORIGIN/);
    expect(() => loadEnv(apiEnvSchema, { ...apiBase, OPERATOR_ORIGIN: apiBase.CONSOLE_ORIGIN })).toThrow(/OPERATOR_ORIGIN/);
    expect(() => loadEnv(apiEnvSchema, { ...apiBase, NODE_ENV: 'production', CONSOLE_ORIGIN: 'http://console.adulis.test' })).toThrow(/https/);
    expect(() => loadEnv(apiEnvSchema, { ...apiBase, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('the worker needs the QUEUE Valkey, not the cache', () => {
    expect(() => loadEnv(workerEnvSchema, { NODE_ENV: 'test', DATABASE_URL: apiBase.DATABASE_URL })).toThrow(/QUEUE_VALKEY_URL/);
  });
});

describe('database target URL guard', () => {
  it.each([
    ['legacy adulis-postgres port', 'postgres://u:p@127.0.0.1:5434/adulis_rebuild'],
    ['repository default port on loopback', 'postgres://u:p@localhost/adulis_rebuild'],
    ['legacy database name', 'postgres://u:p@127.0.0.1:55440/adulis'],
    ['unrelated database name', 'postgres://u:p@127.0.0.1:55440/postgres'],
    ['unparseable URL', 'not a url'],
  ])('refuses %s', (_label, url) => {
    expect(() => assertTargetUrl(url)).toThrow(TargetRefused);
  });

  it('accepts the replacement target and its disposable copies', () => {
    expect(assertTargetUrl('postgres://u:p@127.0.0.1:55440/adulis_rebuild')).toBe('adulis_rebuild');
    expect(assertTargetUrl('postgres://u:p@127.0.0.1:55440/adulis_rebuild_det_a')).toBe('adulis_rebuild_det_a');
  });
});

describe('logging redaction', () => {
  it('keeps only allow-listed fields', () => {
    expect(allowListed({ msg: 'm', requestId: 'r', phone: '0911', authorization: 'Bearer x', anything: 1 })).toEqual({ msg: 'm', requestId: 'r' });
  });

  it('never logs an error message, and a stack only outside production', () => {
    const err = Object.assign(new Error('duplicate key (phone)=(0911000000)'), { code: '23505' });
    expect(errorFields(err, true)).toEqual({ errorName: 'Error', sqlstate: '23505' });
    expect(JSON.stringify(errorFields(err, false))).toContain('stack');
  });

  it('removes NEVER_LOG paths even if a caller bypasses the allow-list', () => {
    const lines: string[] = [];
    const log = createLogger({ service: 's', level: 'info', release: 'r', destination: { write: (s: string) => void lines.push(s) } });
    log.info({ requestId: 'req_1', token: 'secret', body: { name: 'x' } }, 'hello');
    expect(lines.join('')).toContain('req_1');
    expect(lines.join('')).not.toContain('secret');
  });
});

describe('error catalogue', () => {
  it('every code has its English message key in @adulis/locale', () => {
    for (const code of Object.keys(ERROR_CATALOGUE) as ErrorCode[]) expect(Object.keys(en)).toContain(messageKeyFor(code));
  });
});

describe('event and job envelopes', () => {
  const event = {
    event_id: '00000000-0000-4000-8000-000000000001',
    event_type: 'test.synthetic_happened',
    event_version: 1,
    scope: 'GLOBAL',
    occurred_at: '2026-11-25T00:00:00Z',
    aggregate_type: 'synthetic',
    aggregate_id: 'a1',
    aggregate_revision: 0,
    logical_effect_id: 'e1',
    actor: { actor_type: 'SYSTEM', trusted_service_ref: 'test' },
    correlation_id: 'corr-0001',
    payload: {},
  };

  it('accepts a valid envelope and rejects unexpected fields', () => {
    expect(eventEnvelopeSchema.safeParse(event).success).toBe(true);
    expect(eventEnvelopeSchema.safeParse({ ...event, phone: '0911' }).success).toBe(false);
  });

  it('MARKET facts need a market; GLOBAL facts never fabricate one', () => {
    expect(eventEnvelopeSchema.safeParse({ ...event, scope: 'MARKET' }).success).toBe(false);
    expect(eventEnvelopeSchema.safeParse({ ...event, market_id: '00000000-0000-4000-8000-000000000002' }).success).toBe(false);
  });

  it('anonymous input is never SYSTEM and identities never overload', () => {
    expect(actorSchema.safeParse({ actor_type: 'SYSTEM', anonymous_ref: 'a' }).success).toBe(false);
    expect(actorSchema.safeParse({ actor_type: 'ANONYMOUS_PUBLIC', anonymous_ref: 'a', ordinary_account_id: event.event_id }).success).toBe(false);
  });

  it('a job envelope carries the event reference, not its payload', () => {
    expect(jobEnvelopeSchema.shape).toHaveProperty('source_event_id');
    expect(jobEnvelopeSchema.shape).not.toHaveProperty('event');
  });
});

describe('event registry', () => {
  const def: EventDefinition = { type: 'test.synthetic_happened', version: 1, scopes: ['GLOBAL'], payload: z.record(z.string(), z.unknown()) };
  const consumer = (over: Partial<ConsumerDefinition> = {}): ConsumerDefinition => ({
    name: 'test.recorder', eventType: def.type, eventVersion: 1, jobVersion: 1, priorityClass: 'P2', criticality: 'IMPORTANT', attempts: 3, handle: async () => 'SUCCEEDED', ...over,
  });

  it('refuses duplicates and consumers of unregistered events', () => {
    expect(() => new EventRegistry([def, def], [])).toThrow(/twice/);
    expect(() => new EventRegistry([def], [consumer(), consumer()])).toThrow(/twice/);
    expect(() => new EventRegistry([def], [consumer({ eventVersion: 2 })])).toThrow(/unregistered/);
    expect(() => new EventRegistry([def], [consumer({ attempts: 0 })])).toThrow(/attempts/);
  });

  it('the production registry activates nothing at foundation', () => {
    expect(PRODUCTION_EVENTS).toHaveLength(0);
    expect(PRODUCTION_CONSUMERS).toHaveLength(0);
  });
});

describe('rebuildable cache', () => {
  it('without a connection it is a permanent miss, never an error', async () => {
    const cache = new RebuildableCache(null, createLogger({ service: 's', level: 'fatal', release: 'r' }));
    await cache.init();
    await cache.set('k', 'v', 10);
    expect(await cache.get('k')).toBeNull();
  });

  it('an unreachable cache does not stop startup and reads miss', async () => {
    const cache = RebuildableCache.connect('redis://127.0.0.1:1', createLogger({ service: 's', level: 'fatal', release: 'r' }));
    await cache.init();
    expect(await cache.get('k')).toBeNull();
    await cache.close();
  });
});

describe('repeat()', () => {
  it('never overlaps itself and stop() waits for the running pass', async () => {
    let running = 0;
    let maxRunning = 0;
    let passes = 0;
    const loop = repeat(async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 20));
      passes += 1;
      running -= 1;
    }, 1);
    await new Promise((r) => setTimeout(r, 120));
    await loop.stop();
    const after = passes;
    await new Promise((r) => setTimeout(r, 50));
    expect(maxRunning).toBe(1);
    expect(passes).toBe(after);
    expect(running).toBe(0);
  });
});
