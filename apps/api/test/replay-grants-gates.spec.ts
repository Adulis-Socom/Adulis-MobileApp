import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';
import { scanGates } from './gate-support';

/**
 * A stored response is replayed only to a caller whose current role still holds every permission the route declares
 * with @ReplayGrant, so a declaration weaker than what the handler asserts would serve a response the handler itself
 * would refuse. The reviewed table in src/common/idempotency/replay-grant.spec.ts is kept by hand. This spec holds each
 * declaration to a second reading that shares nothing with that table: the permission codes the contract gate scan
 * derives from the route's own code (the handler, the methods it calls, the database functions it names).
 *
 * Read from the source; needs no database and no running API. The scan follows core.* functions only, so a route that
 * asserts its permission inside a function of another schema is listed in READ_BY_HAND with where it is asserted.
 */

const MODULES = join(__dirname, '..', 'src', 'modules');
const MIGRATIONS = join(__dirname, '..', '..', '..', 'db', 'migrations');

/** Declared routes whose permission is asserted in a database function the scan does not follow. */
const READ_BY_HAND = new Map([
  ['BillingController.purchaseIntent', 'billing.fn_open_purchase_intent asserts seller.subscription:update'],
]);

/**
 * Routes that run through runIdempotent and can check a seller permission, but on which a store's request never
 * succeeds (the store side answers not found): only the Buyer's request is served there, so they declare nothing.
 */
const BUYER_ONLY = new Map([
  ['ChatController.escalate', 'the store side of a conversation answers not found'],
  ['ClaimsController.export', 'the store side of a claim answers not found'],
]);

const controllers = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? controllers(join(dir, e.name)) : e.name.endsWith('.controller.ts') ? [join(dir, e.name)] : [],
  );

interface Declared {
  readonly key: string;
  readonly codes: readonly string[];
}

/** Every controller method that carries @ReplayGrant, as `Class.method`, with the codes it declares. */
function declarations(): Declared[] {
  const out: Declared[] = [];
  for (const file of controllers(MODULES)) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    source.forEachChild((node) => {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const calls = (ts.getDecorators(member) ?? []).flatMap((d) => (ts.isCallExpression(d.expression) ? [d.expression] : []));
        const grant = calls.find((c) => c.expression.getText() === 'ReplayGrant');
        if (grant) {
          out.push({ key: `${node.name.text}.${member.name.getText()}`, codes: grant.arguments.filter(ts.isStringLiteral).map((a) => a.text) });
        }
      }
    });
  }
  return out;
}

describe('the replay declarations hold every permission the route code checks', () => {
  const gates = scanGates();
  const declared = declarations();

  it('reads the declarations it is meant to hold', () => {
    expect(declared).toHaveLength(33);
  });

  it('no permission the scan derives from a route is left out of its declaration', () => {
    const problems = declared
      .filter((d) => !READ_BY_HAND.has(d.key))
      .flatMap((d) => {
        const derived = gates.get(d.key)?.permissions;
        if (derived === undefined) return [`${d.key}: no gate entry`];
        return derived.filter((c) => !d.codes.includes(c)).map((c) => `${d.key}: ${c} is checked by the route but not declared`);
      });
    expect(problems).toEqual([]);
  });

  // A scan that finds nothing agrees with any declaration, so an empty result is a failure of the scan, not a pass.
  it('the scan finds at least one permission for every route not read by hand', () => {
    const blind = declared
      .filter((d) => !READ_BY_HAND.has(d.key) && (gates.get(d.key)?.permissions ?? []).length === 0)
      .map((d) => d.key);
    expect(blind).toEqual([]);
  });

  // The path-based default-deny covers seller-context paths only. A store-side route anywhere else is found here instead,
  // from what its own code checks, so a new one cannot be added (or a declaration dropped) without the build noticing.
  it('every route that runs through runIdempotent and can check a seller permission declares its grants', () => {
    const declaredKeys = new Set(declared.map((d) => d.key));
    const missing = [...gates.entries()]
      .filter(([key, g]) => g.keyed && g.permissions.length > 0 && !declaredKeys.has(key) && !BUYER_ONLY.has(key))
      .map(([key, g]) => `${key}: checks ${g.permissions.join(', ')} and runs through runIdempotent, but declares no @ReplayGrant`);
    expect(missing).toEqual([]);
  });

  it('every route listed as buyer-only still runs through runIdempotent, checks a seller permission and declares nothing', () => {
    const declaredKeys = new Set(declared.map((d) => d.key));
    const stale = [...BUYER_ONLY.keys()].filter((key) => {
      const g = gates.get(key);
      return g === undefined || !g.keyed || g.permissions.length === 0 || declaredKeys.has(key);
    });
    expect(stale).toEqual([]);
  });

  it('every route listed as read by hand is still a declared route', () => {
    const keys = new Set(declared.map((d) => d.key));
    expect([...READ_BY_HAND.keys()].filter((k) => !keys.has(k))).toEqual([]);
  });

  it('every route listed as read by hand still asserts the permission it declares, in the function it names', () => {
    const defined = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .flatMap((f) => [
        ...readFileSync(join(MIGRATIONS, f), 'utf8').matchAll(
          /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z_]+\.[a-z0-9_]+)\s*\([\s\S]*?\bAS\s+\$(\w*)\$([\s\S]*?)\$\2\$/gi,
        ),
      ]);
    const problems = declared
      .filter((d) => READ_BY_HAND.has(d.key))
      .flatMap((d) => {
        const named = /^(\w+\.\w+) asserts /.exec(READ_BY_HAND.get(d.key) as string)?.[1];
        if (named === undefined) return [`${d.key}: the reason does not name a function`];
        // The last definition wins, as in the database: a later migration may replace the function.
        const body = defined.filter((m) => (m[1] as string).toLowerCase() === named).pop()?.[3] ?? '';
        return d.codes.filter((c) => !body.includes(`'${c}'`)).map((c) => `${d.key}: ${named} no longer names ${c}`);
      });
    expect(problems).toEqual([]);
  });
});
