import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as ts from 'typescript';
import { requiresSellerContext } from '../auth/auth.guard';

/**
 * SEC-003 -- every seller-acting idempotent POST declares @ReplayGrant.
 *
 * The idempotency lookup serves a stored response only while the caller's
 * CURRENT role still holds the route's declared permission code(s) on the
 * presenting surface. A route that declares nothing keeps the older,
 * standing-only check, so a forgotten decorator would silently weaken the
 * replay rule for that route. This suite is what makes it not silent.
 *
 * LEXICAL, like no-nested-pool-acquisition.spec.ts: it reads the controller
 * sources, never builds the app, and needs no database.
 *
 *  - Every @Post whose path is a section 4.2 seller-context path (the guard's
 *    own requiresSellerContext decides, exemptions included), plus the routes
 *    that act as the store from X-Adulis-Seller outside /v1/seller, must
 *    carry @ReplayGrant with at least one code.
 *  - Every declared code must be one of the seeded permissions, and must be
 *    named in the route's own module or in a migration (the database
 *    function that asserts it) -- a cheap guard against a valid but foreign
 *    code pasted onto the wrong route.
 */

const SRC = join(__dirname, '..', '..');
const REPO = join(SRC, '..', '..', '..');
const SEED_SQL = join(REPO, 'docs', 'amendments', 'ADU-AUTH-01_v2_4_permission_seed.sql');
const MIGRATIONS = join(REPO, 'db', 'migrations');

/** Seller-side writes outside /v1/seller: the side is chosen by X-Adulis-Seller. */
const SELLER_SIDE_OUTSIDE_SELLER_PATHS = new Set([
  'POST /v1/conversations/:id/messages',
  'POST /v1/claims/:id/evidence',
]);

export interface PostRoute {
  readonly route: string;
  readonly grants: readonly string[] | null;
}

const decoratorCall = (d: ts.Decorator): { name: string; args: string[] } | null => {
  if (!ts.isCallExpression(d.expression) || !ts.isIdentifier(d.expression.expression)) return null;
  return {
    name: d.expression.expression.text,
    args: d.expression.arguments.filter(ts.isStringLiteral).map((a) => a.text),
  };
};

/** Every @Post in one controller source, with its @ReplayGrant codes (null when absent). */
export function postRoutes(fileName: string, text: string): PostRoute[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const out: PostRoute[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node)) {
      const calls = (ts.getDecorators(node) ?? []).map(decoratorCall);
      const prefix = calls.find((c) => c?.name === 'Controller')?.args[0] ?? '';
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const decos = (ts.getDecorators(member) ?? []).map(decoratorCall);
        const post = decos.find((c) => c?.name === 'Post');
        if (!post) continue;
        const grant = decos.find((c) => c?.name === 'ReplayGrant');
        const path = [prefix, post.args[0] ?? ''].filter((p) => p !== '').join('/');
        out.push({ route: `POST /v1/${path}`, grants: grant ? grant.args : null });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const mustDeclare = (route: string): boolean =>
  SELLER_SIDE_OUTSIDE_SELLER_PATHS.has(route) || requiresSellerContext(route.slice('POST '.length), 'POST');

function controllers(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return controllers(p);
    return e.name.endsWith('.controller.ts') ? [p] : [];
  });
}

function seededCodes(): Set<string> {
  const sql = readFileSync(SEED_SQL, 'utf8');
  const block = sql.split('INSERT INTO core.permission')[1]?.split(';')[0] ?? '';
  const codes = new Set([...block.matchAll(/\('([a-z_.]+:[a-z_]+)',\s*ARRAY\[/g)].map((m) => m[1] as string));
  if (codes.size !== 42) throw new Error(`parsed ${codes.size} permissions from ${SEED_SQL}, expected 42`);
  return codes;
}

describe('every seller-acting idempotent POST declares @ReplayGrant (SEC-003)', () => {
  const files = controllers(join(SRC, 'modules'));
  const all = files.flatMap((f) =>
    postRoutes(f, readFileSync(f, 'utf8')).map((r) => ({ ...r, file: f })),
  );

  it('finds the controllers it is meant to read', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(all.some((r) => r.route === 'POST /v1/seller/payout')).toBe(true);
  });

  it('no seller route is missing its declaration', () => {
    const missing = all
      .filter((r) => mustDeclare(r.route) && (r.grants === null || r.grants.length === 0))
      .map((r) => `${relative(SRC, r.file)}: ${r.route}`);
    expect(missing).toEqual([]);
  });

  it('covers the 31 seller-context routes and the 2 store-side routes outside /v1/seller', () => {
    const declared = all.filter((r) => mustDeclare(r.route)).map((r) => r.route);
    expect(declared).toHaveLength(33);
    expect(new Set(declared).size).toBe(33);
    for (const r of SELLER_SIDE_OUTSIDE_SELLER_PATHS) expect(declared).toContain(r);
  });

  it('the exempt seller paths and buyer routes stay undeclared', () => {
    const route = (r: string) => all.find((x) => x.route === r);
    expect(route('POST /v1/seller')?.grants).toBeNull();
    expect(route('POST /v1/seller/identity-verification')?.grants).toBeNull();
    expect(route('POST /v1/orders')?.grants).toBeNull();
    // Declarations sit only where the rule applies.
    const stray = all.filter((r) => r.grants !== null && !mustDeclare(r.route)).map((r) => r.route);
    expect(stray).toEqual([]);
  });

  it('every declared code is seeded and asserted by the route module or a migration', () => {
    const seeded = seededCodes();
    const migrations = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
      .join('\n');
    const problems: string[] = [];
    for (const r of all.filter((x) => x.grants !== null)) {
      const moduleDir = join(r.file, '..');
      const moduleText = readdirSync(moduleDir)
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
        .map((f) => readFileSync(join(moduleDir, f), 'utf8'))
        .join('\n');
      for (const code of r.grants ?? []) {
        if (!seeded.has(code)) problems.push(`${r.route}: '${code}' is not a seeded permission`);
        else if (!moduleText.includes(`'${code}'`) && !migrations.includes(`'${code}'`)) {
          problems.push(`${r.route}: '${code}' is asserted nowhere in its module or the migrations`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('the reader catches a seller route without a declaration, and reads prefixes and multiple codes', () => {
    const src = `
      @Controller()
      class A {
        @Post('seller/thing')
        async a() {}
        @Post('seller/other')
        @ReplayGrant('seller.store:write', 'seller.media:write')
        async b() {}
        @Get('seller/read')
        async c() {}
      }
      @Controller('bootstrap')
      class B {
        @Post('x')
        async d() {}
      }`;
    expect(postRoutes('fixture.ts', src)).toEqual([
      { route: 'POST /v1/seller/thing', grants: null },
      { route: 'POST /v1/seller/other', grants: ['seller.store:write', 'seller.media:write'] },
      { route: 'POST /v1/bootstrap/x', grants: null },
    ]);
    expect(mustDeclare('POST /v1/seller/thing')).toBe(true);
    expect(mustDeclare('POST /v1/bootstrap/x')).toBe(false);
  });
});
