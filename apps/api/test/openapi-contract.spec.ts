import { LEGACY_COMMERCE_CONTROLLERS } from '../src/common/http/openapi-security';
import { guardDemandsSeller, loadContract, responseErrors, scanRoutes, type Route } from './contract-support';
import { PINNED_RESPONSES } from '../src/common/http/openapi-derived';
import { SELLER_SIDE_ONLY, deriveGate, scanGates } from './gate-support';

/**
 * contracts/openapi.json against the controllers it is generated from: the
 * metadata a client reads (success status, optional parameters, the
 * Idempotency-Key header, security, response schemas) must say what the code
 * does. Read from the source, so it needs no database and no running API.
 *
 * The legacy commerce modules keep the metadata they declare today and are
 * left out of every comparison below.
 */

const COMMERCE_MODULES = new Set(['billing', 'couriers', 'obligations', 'orders', 'reviews']);

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
/** Operations that declare their own security, kept as authored: Collections (bearer), the seller scene posts (cookie), the deletion ticket routes. */
const OWN_SECURITY: ReadonlyArray<readonly [RegExp, object[]]> = [
  [/^\w+ \/v1\/collections(\/|:|$)/, [{ bearer: [] }]],
  [/^\w+ \/v1\/seller\/scene-posts(\/|$)/, [{ cookie: [] }]],
  [/^(GET \/v1\/deletion\/preview|POST \/v1\/deletion\/confirm)$/, [{ deletionTicket: [] }]],
];

describe('contracts/openapi.json against the controllers', () => {
  it('lists exactly the controller routes', () => {
    const declared = Object.entries(contract.paths).flatMap(([p, item]) => Object.keys(item).map((m) => `${m} ${p}`));
    expect(routes.map((r) => `${r.http} ${r.path}`).sort()).toEqual(declared.sort());
  });

  it('carries no operation of the model retired by migration 0063', () => {
    // The route table in c3 cannot prove absence for id-carrying paths (an unknown id is 404
    // either way); the generated contract can, because it is derived from the controllers.
    const RETIRED = /^\/v1\/(orders|seller\/orders|courier\/orders|handoffs|claims|seller\/claims|seller\/payout|billing\/purchase-intent|billing\/mark-transferred)(\/|$)/;
    expect(Object.keys(contract.paths).filter((p) => RETIRED.test(p))).toEqual([]);
    expect(JSON.stringify(contract)).not.toMatch(/reservation/i);
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

  it('pins the exact security shapes: 25 operations accept either credential, 9 only a bearer token, 50 only the session cookie, 21 take an optional credential, 2 the deletion ticket', () => {
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
      [JSON.stringify(OPTIONAL_CREDENTIAL)]: 21,
      [JSON.stringify([{ deletionTicket: [] }])]: 2,
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

  it('declares the refusals the pipeline decides: sessions, the seller header, the idempotency key', () => {
    const PROBLEM = JSON.stringify({ $ref: '#/components/schemas/ProblemDto' });
    const wrong = inScope
      .filter((r) => !(r.controller === 'AuthController' && r.handler === 'logout'))
      .flatMap((r) => {
        const o = op(r);
        const header = (name: string) => (o.parameters ?? []).some((p) => p.in === 'header' && p.name.toLowerCase() === name && p.required);
        const ticket = JSON.stringify(o.security) === JSON.stringify([{ deletionTicket: [] }]);
        const expected = ['401'];
        if (!ticket) expected.push('403');
        if ((!r.isPublic && header('x-adulis-seller')) || header('idempotency-key')) expected.push('400');
        if (header('idempotency-key')) expected.push('409');
        const missing = expected.filter((status) => JSON.stringify(o.responses[status]?.content?.['application/problem+json']?.schema) !== PROBLEM);
        return missing.map((status) => `${label(r)} does not declare ${status} as a problem response`);
      });
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
      // The two reads the Seller Companion makes.
      ['get', '/v1/seller/list', 200],
      ['get', '/v1/seller/analytics/overview', 200],
    ];
    const missing = calls.filter(([m, p, s]) => !contract.paths[p]?.[m]?.responses[String(s)]?.content?.['application/json']?.schema);
    expect(missing).toEqual([]);
  });

  it('describes every non-commerce success response except the four whose wire shape is not settled', () => {
    // Each of these returns a database row spread as it is, numbers PostgreSQL sends as strings next to computed
    // numbers, or one of several bodies by request action. Describing one needs a field-by-field proof against
    // real responses first; until then no schema is better than a schema that looks described and is not.
    const unsettled = [
      'get /v1/seller/analytics/full 200',
      'get /v1/seller/products/{id} 200',
      'post /v1/seller/products/{id}/video 200',
      'post /v1/seller/products/{id}/video 201',
      'post /v1/seller/social-accounts/{id}/verify 200',
    ];
    const undescribed = inScope.flatMap((r) =>
      Object.entries(op(r).responses)
        .filter(([status, response]) => /^2\d\d$/.test(status) && status !== '204' && !response.content?.['application/json']?.schema)
        .map(([status]) => `${r.http} ${r.path} ${status}`),
    );
    expect(undescribed.sort()).toEqual(unsettled);
  });
});

describe('the headers and credentials the code reads are declared', () => {
  const gateOf = (r: Route) => {
    const g = scanGates().get(`${r.controller}.${r.handler}`);
    if (!g) throw new Error(`${label(r)}: no controller method found in the source`);
    return g;
  };
  const header = (r: Route, name: string) => (op(r).parameters ?? []).find((p) => p.in === 'header' && p.name.toLowerCase() === name.toLowerCase());

  it('declares X-Adulis-Device and X-Adulis-Client, optional, on every public route that reads the device', () => {
    const wrong = inScope
      .filter((r) => r.isPublic && (gateOf(r).readsDevice || gateOf(r).keyed))
      .flatMap((r) => {
        const problems: string[] = [];
        for (const name of ['X-Adulis-Device', 'X-Adulis-Client']) {
          const h = header(r, name);
          if (!h) problems.push(`${label(r)} reads the device and does not declare ${name}`);
          else if (h.required) problems.push(`${label(r)} declares ${name} as required`);
        }
        return problems;
      });
    expect(wrong).toEqual([]);
  });

  it('declares the device header only where the code reads it, and never on sign-in verification', () => {
    const wrong = inScope
      .filter((r) => header(r, 'X-Adulis-Device'))
      .filter((r) => !(gateOf(r).readsDevice || gateOf(r).keyed))
      .map(label);
    expect(wrong).toEqual([]);
    const verify = inScope.find((r) => label(r) === 'POST /v1/auth/otp/verify') as Route;
    expect((op(verify).parameters ?? []).filter((p) => p.in === 'header').map((p) => p.name)).toEqual(['Idempotency-Key']);
  });

  it('declares the deletion ticket, and no session credential, on exactly the routes that read it', () => {
    const wrong = inScope.flatMap((r) => {
      const reads = gateOf(r).readsTicket;
      const security = JSON.stringify(op(r).security);
      if (reads) return security === JSON.stringify([{ deletionTicket: [] }]) ? [] : [`${label(r)} reads the ticket and declares ${security}`];
      return security?.includes('deletionTicket') ? [`${label(r)} declares the ticket and does not read it`] : [];
    });
    expect(wrong).toEqual([]);
    expect(contract.components.securitySchemes?.['deletionTicket']).toMatchObject({ type: 'apiKey', in: 'header', name: 'Authorization' });
  });

  it('declares X-Adulis-Seller, optional, on the routes where it selects the side the caller acts on', () => {
    const wrong = inScope
      .filter((r) => SELLER_SIDE_ONLY.has(label(r)))
      .flatMap((r) => {
        const h = header(r, 'X-Adulis-Seller');
        return h && h.required === false ? [] : [`${label(r)} does not declare an optional X-Adulis-Seller`];
      });
    expect(wrong).toEqual([]);
  });

  it('says in the 400 text of an anonymous keyed route that the device (or a browser cookie) is needed when nobody is signed in', () => {
    const keyedByDevice = inScope.filter((r) => r.isPublic && header(r, 'Idempotency-Key')?.required && header(r, 'X-Adulis-Device'));
    expect(keyedByDevice.map(label).sort()).toEqual(
      ['POST /v1/auth/otp/request', 'POST /v1/auth/recovery', 'POST /v1/deletion/otp/request', 'POST /v1/devices', 'POST /v1/post-links/resolve'].sort(),
    );
    const wrong = keyedByDevice.filter((r) => !(op(r).responses['400']?.description ?? '').includes('X-Adulis-Device') || header(r, 'X-Adulis-Device')?.required !== false);
    expect(wrong.map(label)).toEqual([]);
  });

  it('says once, in the document description, the headers and the Origin rule no single operation carries', () => {
    const text = contract.info?.description ?? '';
    for (const word of ['X-Adulis-Request-Id', 'Content-Language', 'Accept-Language', 'X-Adulis-Idempotent-Replay', 'Retry-After', 'Origin']) {
      expect(text).toContain(word);
    }
  });
});

describe('what the generator pins or derives from other declarations', () => {
  it('keeps each pinned response exactly as the client type test pins it', () => {
    expect([...PINNED_RESPONSES]).toEqual(['post /auth/logout']);
    for (const key of PINNED_RESPONSES) {
      const [method, path] = key.split(' ') as [string, string];
      const operation = contract.paths[`/v1${path}`]?.[method];
      expect(operation).toBeDefined();
      expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(['204', 'default']);
    }
  });

  it('declares the members of the nested problem classes as required (ApiPropertyOptional would drop a nested required list)', () => {
    const schemas = contract.components.schemas;
    expect(schemas['ProblemSubjectDto']?.required).toEqual(['kind', 'id']);
    expect(schemas['ProblemResolvingActionDto']?.required).toEqual(['kind']);
    expect(schemas['ProblemItemDto']?.required).toEqual(['code', 'message_key']);
    // swagger wraps a described $ref in allOf.
    expect(schemas['ProblemItemDto']?.properties?.['subject']?.allOf?.[0]?.$ref).toBe('#/components/schemas/ProblemSubjectDto');
    expect(schemas['ProblemItemDto']?.properties?.['resolving_action']?.allOf?.[0]?.$ref).toBe('#/components/schemas/ProblemResolvingActionDto');
    // resolving_action is open: some kinds carry further members (REDUCE_QUANTITY carries `to`), with `kind` required.
    expect(schemas['ProblemItemDto']?.properties?.['resolving_action']?.additionalProperties).toBe(true);
    expect(schemas['ProblemItemDto']?.properties?.['subject']?.additionalProperties).toBeUndefined();
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
    expect(responseErrors({}, 'get', '/v1/seller/analytics/full', 200)).not.toEqual([]);
  });
});
