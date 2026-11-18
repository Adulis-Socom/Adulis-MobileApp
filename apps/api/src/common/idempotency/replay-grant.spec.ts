import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import * as ts from 'typescript';
import { requiresSellerContext } from '../auth/auth.guard';

/**
 * SEC-003 -- the replay re-check cannot be skipped by omission.
 *
 * The idempotency lookup serves a stored response only while the caller's
 * CURRENT role still holds the route's @ReplayGrant code(s) on the presenting
 * surface. A route that declares nothing keeps the older standing-only
 * check, so the declarations are this control's only input.
 *
 * LEXICAL, like no-nested-pool-acquisition.spec.ts: it reads sources, never
 * builds the app, and needs no database. What it GUARANTEES:
 *
 *  1. Every controller method, under any HTTP verb, whose body calls
 *     runIdempotent on a seller-acting route (a section 4.2 seller-context
 *     path, as the guard's own requiresSellerContext decides, or one of the
 *     listed routes that act as the store from X-Adulis-Seller elsewhere)
 *     carries @ReplayGrant with at least one code -- and no other method
 *     carries one.
 *  2. Every call to IdempotencyService.check() is either runIdempotent's,
 *     which passes the route's grants and the session audience, or one of
 *     the allow-listed manual sites, each on a route that is not seller-acting.
 *  3. Every declared code is a seeded permission, and is REACHED from that
 *     route: it appears in the route method, in a module method that route
 *     calls (followed three calls deep through this.x(...) / this.y.x(...)),
 *     or in a database function one of those bodies names.
 *  4. The declared set of EVERY seller-acting route is exactly the reviewed one
 *     (EXPECTED_REPLAY_GRANTS): a code added to a handler without being declared
 *     here, a code dropped from a declaration, or a route added or removed,
 *     fails until the table is edited on purpose. Item 3 alone only proves a
 *     declared code is reachable, not that every code a handler asserts is
 *     declared, and a declaration weaker than its handler would let a demoted
 *     caller be served.
 *
 * What it does NOT guarantee: that a code is asserted rather than merely
 * mentioned on that path; that a table entry equals what its handler asserts
 * (reviewed by hand, and by the behavioural suite on four real routes); routes on paths it cannot read (non-literal
 * decorator arguments, aliased decorator imports, files not named
 * *.controller.ts under src/modules); or a new store-side route outside
 * /v1/seller that is missing from STORE_SIDE_ROUTES. The e2e suite
 * (test/wo-sec-003-replay-authorization.e2e.spec.ts) proves the behaviour.
 */

const SRC = join(__dirname, '..', '..');
const REPO = join(SRC, '..', '..', '..');
const SEED_SQL = join(REPO, 'docs', 'amendments', 'ADU-AUTH-01_v2_4_permission_seed.sql');
const MIGRATIONS = join(REPO, 'db', 'migrations');

/** Seller-side writes outside /v1/seller: the side is chosen by X-Adulis-Seller. */
const STORE_SIDE_ROUTES = new Set(['POST /v1/conversations/:id/messages', 'POST /v1/claims/:id/evidence']);

/**
 * Every seller-acting idempotent route and the exact permission codes its handler asserts, as declared
 * with @ReplayGrant, reviewed route by route. Edit it on purpose, in the change that
 * edits the route: it is the one place where a declaration weaker than its handler would be noticed.
 */
const EXPECTED_REPLAY_GRANTS: Readonly<Record<string, readonly string[]>> = {
  'POST /v1/billing/mark-transferred': ['seller.subscription:update'],
  'POST /v1/billing/purchase-intent': ['seller.subscription:update'],
  'POST /v1/claims/:id/evidence': ['seller.claims:read'],
  'POST /v1/conversations/:id/messages': ['seller.messages:read', 'seller.messages:send'],
  'POST /v1/seller/claims/:id/remedy': ['seller.claims:respond'],
  'POST /v1/seller/closure': ['seller.store:write'],
  'POST /v1/seller/couriers': ['seller.couriers:manage'],
  'POST /v1/seller/deletion': ['seller.account:delete'],
  'POST /v1/seller/orders/:id/courier-assignment': ['seller.couriers:manage'],
  'POST /v1/seller/orders/:id/custody-transfer': ['seller.handoff:custody_transfer'],
  'POST /v1/seller/orders/:id/payment/confirm': ['seller.payment:confirm'],
  'POST /v1/seller/orders/:id/payment/reject': ['seller.payment:confirm'],
  'POST /v1/seller/orders/:id/ready': ['seller.order_ready:update'],
  'POST /v1/seller/orders/:id/refunds': ['seller.refunds:report'],
  'POST /v1/seller/orders/:id/reissue-instructions': ['seller.orders:reissue_instructions'],
  'POST /v1/seller/orders/:id/reservations/:rid/cancel': ['seller.orders:respond'],
  'POST /v1/seller/ownership-transfer': ['seller.ownership:transfer'],
  'POST /v1/seller/payout': ['seller.payout:update'],
  'POST /v1/seller/products': ['seller.products:write'],
  'POST /v1/seller/products/:id/images': ['seller.media:write'],
  'POST /v1/seller/products/:id/publish': ['seller.products:publish'],
  'POST /v1/seller/products/:id/social-posts': ['seller.products:write'],
  'POST /v1/seller/products/:id/unpublish': ['seller.products:publish'],
  'POST /v1/seller/products/:id/variants': ['seller.products:write'],
  'POST /v1/seller/products/:id/video': ['seller.media:write'],
  'POST /v1/seller/scene-posts': ['seller.broadcasts:send', 'seller.media:write'],
  'POST /v1/seller/scene-posts/:id/image-uploads': ['seller.broadcasts:send', 'seller.media:write'],
  'POST /v1/seller/scene-posts/:id/publish': ['seller.broadcasts:send', 'seller.media:write'],
  'POST /v1/seller/social-accounts': ['seller.store:write'],
  'POST /v1/seller/social-accounts/:id/verify': ['seller.store:write'],
  'POST /v1/seller/team': ['seller.staff:admin'],
  'POST /v1/seller/variants/:id/confirm-stock': ['seller.stock:write'],
  'POST /v1/seller/variants/:id/stock': ['seller.stock:write'],
};

/** check() callers outside runIdempotent, each on a route that never acts as a store. */
const MANUAL_CHECK_SITES = new Map([
  ['auth.controller.ts', 'POST /v1/auth/otp/verify'],
  ['deletion.controller.ts', 'POST /v1/deletion/confirm'],
  ['handoff.controller.ts', 'POST /v1/handoffs/sync'],
]);

const VERBS = new Map([
  ['Get', 'GET'],
  ['Post', 'POST'],
  ['Put', 'PUT'],
  ['Patch', 'PATCH'],
  ['Delete', 'DELETE'],
  ['All', 'ALL'],
]);

export interface Route {
  readonly route: string;
  readonly method: string;
  readonly path: string;
  readonly grants: readonly string[] | null;
  readonly idempotent: boolean;
  readonly body: string;
}

const decoratorCall = (d: ts.Decorator): { name: string; args: string[] } | null => {
  if (!ts.isCallExpression(d.expression) || !ts.isIdentifier(d.expression.expression)) return null;
  return {
    name: d.expression.expression.text,
    args: d.expression.arguments.filter(ts.isStringLiteral).map((a) => a.text),
  };
};

/** The route a controller method serves, or null when it has no HTTP-verb decorator. */
function routeOf(member: ts.MethodDeclaration): Route | null {
  const cls = member.parent;
  const prefix = ts.isClassDeclaration(cls)
    ? ((ts.getDecorators(cls) ?? []).map(decoratorCall).find((c) => c?.name === 'Controller')?.args[0] ?? '')
    : '';
  const decos = (ts.getDecorators(member) ?? []).map(decoratorCall);
  const verb = decos.find((c) => c !== null && VERBS.has(c.name));
  if (!verb) return null;
  const method = VERBS.get(verb.name) as string;
  const path = '/v1/' + [prefix, verb.args[0] ?? ''].filter((p) => p !== '').join('/');
  const grant = decos.find((c) => c?.name === 'ReplayGrant');
  const body = member.body?.getText() ?? '';
  return {
    route: `${method} ${path}`,
    method,
    path,
    grants: grant ? grant.args : null,
    idempotent: /\.runIdempotent\s*\(/.test(body),
    body,
  };
}

/** Every routed method in one controller source. */
export function routes(fileName: string, text: string): Route[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const out: Route[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isMethodDeclaration(node)) {
      const r = routeOf(node);
      if (r) out.push(r);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export const sellerActing = (r: Pick<Route, 'route' | 'method' | 'path'>): boolean =>
  STORE_SIDE_ROUTES.has(r.route) || requiresSellerContext(r.path, r.method);

export const mustDeclare = (r: Route): boolean => r.idempotent && sellerActing(r);

/** Every method body in a set of sources, by method name (collisions keep every body). */
export function methodIndex(sources: ReadonlyArray<[string, string]>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [name, text] of sources) {
    const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node) && node.body && ts.isIdentifier(node.name)) {
        index.set(node.name.text, [...(index.get(node.name.text) ?? []), node.body.getText()]);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return index;
}

/** Database function bodies by qualified name; a later migration's definition wins. */
export function functionBodies(sqlFiles: readonly string[]): Map<string, string> {
  const bodies = new Map<string, string>();
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z_]+\.[a-z0-9_]+)\s*\([\s\S]*?\bAS\s+\$(\w*)\$([\s\S]*?)\$\2\$/gi;
  for (const text of sqlFiles) {
    for (const m of text.matchAll(re)) bodies.set((m[1] as string).toLowerCase(), m[3] as string);
  }
  return bodies;
}

/** The text a route reaches: its body, module methods it calls (3 deep), and database functions named there. */
export function reachedText(route: Route, index: Map<string, string[]>, fns: Map<string, string>): string {
  const seen = new Set<string>([route.body]);
  let frontier = [route.body];
  for (let depth = 0; depth < 3; depth += 1) {
    const next: string[] = [];
    for (const text of frontier) {
      for (const m of text.matchAll(/this\.(?:[A-Za-z_$][\w$]*\.)?([A-Za-z_$][\w$]*)\s*\(/g)) {
        for (const body of index.get(m[1] as string) ?? []) {
          if (!seen.has(body)) {
            seen.add(body);
            next.push(body);
          }
        }
      }
    }
    frontier = next;
  }
  const code = [...seen].join('\n');
  const named = [...code.matchAll(/\b((?:core|billing|financial|verification)\.fn_[a-z0-9_]+)\s*\(/gi)].map((m) =>
    (m[1] as string).toLowerCase(),
  );
  return [code, ...named.map((n) => fns.get(n) ?? '')].join('\n');
}

function files(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p, keep);
    return keep(e.name) ? [p] : [];
  });
}

function seededCodes(): Set<string> {
  const sql = readFileSync(SEED_SQL, 'utf8');
  const block = sql.split('INSERT INTO core.permission')[1]?.split(';')[0] ?? '';
  const codes = new Set([...block.matchAll(/\('([a-z_.]+:[a-z_]+)',\s*ARRAY\[/g)].map((m) => m[1] as string));
  if (codes.size !== 42) throw new Error(`parsed ${codes.size} permissions from ${SEED_SQL}, expected 42`);
  return codes;
}

interface CheckCall {
  readonly file: string;
  readonly args: string[];
  readonly route: string | null;
}

/** Every IdempotencyService.check(...) call in one source, with the route of its enclosing method. */
export function checkCalls(fileName: string, text: string): CheckCall[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const out: CheckCall[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      /(^|\.)idempotency\.check$/.test(node.expression.getText().replace(/\s+/g, ''))
    ) {
      let m: ts.Node | undefined = node.parent;
      while (m && !ts.isMethodDeclaration(m)) m = m.parent;
      out.push({
        file: basename(fileName),
        args: node.arguments.map((a) => a.getText()),
        route: m ? (routeOf(m as ts.MethodDeclaration)?.route ?? null) : null,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe('the replay re-check cannot be skipped by omission (SEC-003)', () => {
  const controllerFiles = files(join(SRC, 'modules'), (n) => n.endsWith('.controller.ts'));
  const all = controllerFiles.flatMap((f) =>
    routes(f, readFileSync(f, 'utf8')).map((r) => ({ ...r, file: f })),
  );

  it('finds the controllers and routes it is meant to read', () => {
    expect(controllerFiles.length).toBeGreaterThan(20);
    expect(all.some((r) => r.route === 'POST /v1/seller/payout' && r.idempotent)).toBe(true);
    expect(all.some((r) => r.method === 'DELETE')).toBe(true);
  });

  it('no idempotent seller-acting route, under any verb, is missing its declaration', () => {
    const missing = all
      .filter((r) => mustDeclare(r) && (r.grants === null || r.grants.length === 0))
      .map((r) => `${relative(SRC, r.file)}: ${r.route}`);
    expect(missing).toEqual([]);
  });

  it('covers the 31 seller-context routes and the 2 store-side routes outside /v1/seller', () => {
    const declared = all.filter(mustDeclare).map((r) => r.route);
    expect(declared).toHaveLength(33);
    expect(new Set(declared).size).toBe(33);
    for (const r of STORE_SIDE_ROUTES) expect(declared).toContain(r);
  });

  it('the declared set of every seller-acting route is exactly the reviewed one, in both directions', () => {
    const actual = Object.fromEntries(
      all
        .filter(mustDeclare)
        .map((r) => [r.route, [...(r.grants ?? [])].sort()] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    const expected = Object.fromEntries(
      Object.entries(EXPECTED_REPLAY_GRANTS)
        .map(([route, codes]) => [route, [...codes].sort()] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    expect(actual).toEqual(expected);
    expect(Object.keys(EXPECTED_REPLAY_GRANTS)).toHaveLength(33);
  });

  it('declarations sit only where the lookup evaluates them', () => {
    const route = (r: string) => all.find((x) => x.route === r);
    expect(route('POST /v1/seller')?.grants).toBeNull();
    expect(route('POST /v1/seller/identity-verification')?.grants).toBeNull();
    expect(route('POST /v1/orders')?.grants).toBeNull();
    const stray = all.filter((r) => r.grants !== null && !mustDeclare(r)).map((r) => r.route);
    expect(stray).toEqual([]);
  });

  it('every check() call passes the route grants, or is an allow-listed manual site off the seller routes', () => {
    const calls = files(SRC, (n) => n.endsWith('.ts') && !n.endsWith('.spec.ts')).flatMap((f) =>
      checkCalls(f, readFileSync(f, 'utf8')),
    );
    const viaRunIdempotent = calls.filter((c) => c.file === 'handler-transaction.ts');
    expect(viaRunIdempotent).toHaveLength(1);
    expect(viaRunIdempotent[0]?.args.join(' ')).toMatch(/replayGrants[\s\S]*audience/);
    const manual = calls.filter((c) => c.file !== 'handler-transaction.ts');
    expect(manual.map((c) => `${c.file} ${c.route}`).sort()).toEqual(
      [...MANUAL_CHECK_SITES].map(([f, r]) => `${f} ${r}`).sort(),
    );
    for (const c of manual) {
      const [method, path] = (c.route as string).split(' ') as [string, string];
      expect(sellerActing({ route: c.route as string, method, path })).toBe(false);
    }
  });

  it('every declared code is seeded and reached from its own route', () => {
    const seeded = seededCodes();
    const fns = functionBodies(
      readdirSync(MIGRATIONS)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8')),
    );
    const indexes = new Map<string, Map<string, string[]>>();
    const problems: string[] = [];
    for (const r of all.filter((x) => x.grants !== null)) {
      const dir = join(r.file, '..');
      if (!indexes.has(dir)) {
        indexes.set(
          dir,
          methodIndex(
            readdirSync(dir)
              .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
              .map((f): [string, string] => [f, readFileSync(join(dir, f), 'utf8')]),
          ),
        );
      }
      const reached = reachedText(r, indexes.get(dir) as Map<string, string[]>, fns);
      for (const code of r.grants ?? []) {
        if (!seeded.has(code)) problems.push(`${r.route}: '${code}' is not a seeded permission`);
        else if (!reached.includes(`'${code}'`)) problems.push(`${r.route}: '${code}' is not reached from the route`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('the readers: verbs, prefixes, idempotency, call chains and check() callers', () => {
    const src = `
      @Controller()
      class A {
        @Post('seller/thing')
        async a() { return this.tx.runIdempotent(req, res, 201, (trx) => this.svc.doThing(trx)); }
        @Delete('seller/thing/:id')
        @ReplayGrant('seller.store:write', 'seller.media:write')
        async b() { return this.tx.runIdempotent(req, res, 200, (trx) => this.svc.other(trx)); }
        @Get('seller/read')
        async c() { return this.tx.run(req, (trx) => this.svc.doThing(trx)); }
      }
      @Controller('bootstrap')
      class B {
        @Post('x')
        async d() { await this.idempotency.check(k, a, e, h); }
      }
      class Svc {
        async doThing(trx) { await this.inner(trx); }
        async inner(trx) { await sql\`SELECT core.fn_do_thing(\${x})\`; }
        async other(trx) { await assertPermission(trx, req, 'seller.store:write'); }
      }`;
    const rs = routes('fixture.ts', src);
    expect(rs.map((r) => [r.route, r.grants, r.idempotent])).toEqual([
      ['POST /v1/seller/thing', null, true],
      ['DELETE /v1/seller/thing/:id', ['seller.store:write', 'seller.media:write'], true],
      ['GET /v1/seller/read', null, false],
      ['POST /v1/bootstrap/x', null, false],
    ]);
    expect(rs.filter(mustDeclare).map((r) => r.route)).toEqual(['POST /v1/seller/thing', 'DELETE /v1/seller/thing/:id']);

    const index = methodIndex([['fixture.ts', src]]);
    const fns = functionBodies([
      `CREATE FUNCTION core.fn_do_thing(p uuid) RETURNS void LANGUAGE plpgsql AS $fn$
         BEGIN PERFORM core.fn_has_permission(a, s, 'seller.products:write', 'CONSOLE'); END $fn$;`,
    ]);
    const thing = rs[0] as Route;
    const del = rs[1] as Route;
    // Reached through a module method two calls deep, then the database function it names.
    expect(reachedText(thing, index, fns)).toContain(`'seller.products:write'`);
    expect(reachedText(del, index, fns)).toContain(`'seller.store:write'`);
    // A valid code that the route never reaches is caught.
    expect(reachedText(del, index, fns)).not.toContain(`'seller.media:write'`);

    expect(checkCalls('x.controller.ts', src)).toEqual([
      { file: 'x.controller.ts', args: ['k', 'a', 'e', 'h'], route: 'POST /v1/bootstrap/x' },
    ]);
  });
});
