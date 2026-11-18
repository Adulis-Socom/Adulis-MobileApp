import { LEGACY_COMMERCE_CONTROLLERS } from '../src/common/http/openapi-security';
import { guardDemandsSeller, loadContract, responseErrors, scanRoutes, type Route } from './contract-support';
import { deriveGate } from './gate-support';

/**
 * contracts/openapi.json against the controllers it is generated from: the
 * metadata a client reads (success status, optional parameters, the
 * Idempotency-Key header, security, response schemas) must say what the code
 * does. Read from the source, so it needs no database and no running API.
 *
 * The legacy commerce modules keep the metadata they declare today and are
 * left out of every comparison below.
 */

const COMMERCE_MODULES = new Set(['billing', 'claims', 'couriers', 'financial', 'handoff', 'obligations', 'orders', 'reviews']);

const contract = loadContract();
const routes = scanRoutes();
const inScope = routes.filter((r) => !COMMERCE_MODULES.has(r.module));
const op = (r: Route) => {
  const o = contract.paths[r.path]?.[r.http];
  if (!o) throw new Error(`${r.http.toUpperCase()} ${r.path} is not in the contract`);
  return o;
};
const label = (r: Route) => `${r.http.toUpperCase()} ${r.path}`;

/** The guard accepts a session cookie (console) or a bearer token (mobile): either one authenticates. Written out, not imported, so the test cannot agree with a changed constant. */
const EITHER_CREDENTIAL = [{ cookie: [] }, { bearer: [] }];
/** The session cookie alone: where every gate on the route admits only a Console session (openapi-gates.spec.ts holds this to the gates). */
const COOKIE_ONLY = [{ cookie: [] }];
/** A public route honours a credential when one is presented and refuses a dead one, so it accepts either or none. */
const OPTIONAL_CREDENTIAL = [{}, { cookie: [] }, { bearer: [] }];
/** Operations that declare their own security, kept as authored: Collections (bearer) and the seller scene posts (cookie). */
const OWN_SECURITY: ReadonlyArray<readonly [RegExp, object[]]> = [
  [/^\w+ \/v1\/collections(\/|:|$)/, [{ bearer: [] }]],
  [/^\w+ \/v1\/seller\/scene-posts(\/|$)/, [{ cookie: [] }]],
];

describe('contracts/openapi.json against the controllers', () => {
  it('lists exactly the controller routes', () => {
    const declared = Object.entries(contract.paths).flatMap(([p, item]) => Object.keys(item).map((m) => `${m} ${p}`));
    expect(routes.map((r) => `${r.http} ${r.path}`).sort()).toEqual(declared.sort());
  });

  it('leaves exactly the commerce controllers to the derivation skip list', () => {
    const commerce = new Set(routes.filter((r) => COMMERCE_MODULES.has(r.module)).map((r) => r.controller));
    expect([...LEGACY_COMMERCE_CONTROLLERS].sort()).toEqual([...commerce].sort());
  });

  it('declares the success status each handler answers with', () => {
    const wrong = inScope.flatMap((r) => {
      const declared = Object.keys(op(r).responses).filter((c) => /^2\d\d$/.test(c)).map(Number).sort();
      return JSON.stringify(declared) === JSON.stringify(r.statuses) ? [] : [`${label(r)}: handler ${r.statuses}, contract ${declared}`];
    });
    expect(wrong).toEqual([]);
  });

  it('declares the Idempotency-Key header on exactly the routes that demand one', () => {
    const wrong = inScope.flatMap((r) => {
      const header = (op(r).parameters ?? []).find((p) => p.in === 'header' && p.name.toLowerCase() === 'idempotency-key');
      if (r.keyed) return header?.required === true ? [] : [`${label(r)} demands a key and does not declare it`];
      return header ? [`${label(r)} declares a key it does not demand`] : [];
    });
    expect(wrong).toEqual([]);
  });

  it('declares security on every route: the credentials a protected route can complete with, the optional ones a public route honours', () => {
    const wrong = inScope.flatMap((r) => {
      const security = op(r).security;
      const protectedShape = deriveGate(r).admits.includes('MOBILE') ? EITHER_CREDENTIAL : COOKIE_ONLY;
      const expected = OWN_SECURITY.find(([re]) => re.test(label(r)))?.[1] ?? (r.isPublic ? OPTIONAL_CREDENTIAL : protectedShape);
      return JSON.stringify(security) === JSON.stringify(expected) ? [] : [`${label(r)} declares ${JSON.stringify(security)}, expected ${JSON.stringify(expected)}`];
    });
    expect(wrong).toEqual([]);
  });

  it('pins the exact security shapes: 25 operations accept either credential, 9 only a bearer token, 50 only the session cookie, 23 take an optional credential', () => {
    const shapes = new Map<string, number>();
    for (const [, item] of Object.entries(contract.paths)) {
      for (const o of Object.values(item)) {
        if (o.security) shapes.set(JSON.stringify(o.security), (shapes.get(JSON.stringify(o.security)) ?? 0) + 1);
      }
    }
    expect(Object.fromEntries(shapes)).toEqual({
      [JSON.stringify(EITHER_CREDENTIAL)]: 25,
      [JSON.stringify([{ bearer: [] }])]: 9,
      [JSON.stringify(COOKIE_ONLY)]: 50,
      [JSON.stringify(OPTIONAL_CREDENTIAL)]: 23,
    });
  });

  it('declares X-Adulis-Seller (required) on exactly the routes where the AuthGuard demands it', async () => {
    const wrong: string[] = [];
    for (const r of inScope) {
      const header = (op(r).parameters ?? []).find((p) => p.in === 'header' && p.name.toLowerCase() === 'x-adulis-seller');
      const demanded = await guardDemandsSeller(r);
      if (demanded && header?.required !== true) wrong.push(`${label(r)} demands the seller context and does not declare it as required`);
      if (!demanded && header?.required === true) wrong.push(`${label(r)} declares a required seller header the guard does not demand`);
    }
    expect(wrong).toEqual([]);
  });

  it('gives every in-scope operation a problem response for the failures the contract does not list', () => {
    const wrong = inScope
      .filter((r) => JSON.stringify(op(r).responses['default']?.content?.['application/problem+json']?.schema) !== JSON.stringify({ $ref: '#/components/schemas/ProblemDto' }))
      .map(label);
    expect(wrong).toEqual([]);
  });

  it('keeps a query parameter required only where the handler refuses its absence', () => {
    const required = inScope
      .flatMap((r) => (op(r).parameters ?? []).filter((p) => p.in === 'query' && p.required).map((p) => `${label(r)} ${p.name}`))
      .sort();
    expect(required).toEqual(
      [
        'GET /v1/conversations as',
        'GET /v1/notifications as',
        'GET /v1/search q',
        'GET /v1/sellers/lookup q',
        'GET /v1/storefronts/{handle}/search q',
      ].sort(),
    );
  });

  it('describes the response of the non-commerce operations the Buyer app calls', () => {
    const calls: [string, string, number][] = [
      ['post', '/v1/conversations', 201],
      ['get', '/v1/conversations', 200],
      ['get', '/v1/conversations/{id}/messages', 200],
      ['post', '/v1/conversations/{id}/messages', 201],
      ['post', '/v1/conversations/{id}/escalate', 200],
      ['get', '/v1/notifications', 200],
      ['post', '/v1/notifications/{id}/read', 200],
      ['post', '/v1/deletion/otp/request', 202],
      ['post', '/v1/deletion/otp/verify', 200],
      ['get', '/v1/deletion/preview', 200],
      ['post', '/v1/deletion/confirm', 200],
    ];
    const missing = calls.filter(([m, p, s]) => !contract.paths[p]?.[m]?.responses[String(s)]?.content?.['application/json']?.schema);
    expect(missing).toEqual([]);
  });
});

describe('responseErrors (the check the e2e suites use)', () => {
  const page = '/v1/conversations';
  const buyer = { id: 'a0000000-0000-4000-8000-000000000001', seller_id: 'a0000000-0000-4000-8000-000000000002', store_name: 'S', handle: 'h', started_at: '2026-01-01T00:00:00.000Z', last_message_at: '2026-01-01T00:00:00.000Z' };

  it('accepts a conforming body', () => {
    expect(responseErrors({ data: [buyer], next_cursor: null }, 'get', page, 200)).toEqual([]);
  });

  it.each([
    ['an undeclared property', { data: [{ ...buyer, extra: 1 }], next_cursor: null }],
    ['a missing required property', { data: [{ ...buyer, handle: undefined }], next_cursor: null }],
    ['a value of the wrong type', { data: [{ ...buyer, started_at: 5 }], next_cursor: null }],
    ['a malformed uuid', { data: [{ ...buyer, id: 'nope' }], next_cursor: null }],
    ['a null where none is allowed', { data: [{ ...buyer, store_name: null }], next_cursor: null }],
    ['a missing page cursor', { data: [buyer] }],
  ])('rejects %s', (_name, body) => {
    expect(responseErrors(JSON.parse(JSON.stringify(body)), 'get', page, 200)).not.toEqual([]);
  });

  it('reports an operation that declares no schema', () => {
    expect(responseErrors({}, 'get', '/v1/seller/list', 200)).not.toEqual([]);
  });
});
