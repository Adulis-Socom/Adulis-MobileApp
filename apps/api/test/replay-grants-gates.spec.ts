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

/** Declared routes whose permission is asserted in a database function the scan does not follow. */
const READ_BY_HAND = new Map([
  ['BillingController.purchaseIntent', 'billing.fn_open_purchase_intent asserts seller.subscription:update'],
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

  it('every route listed as read by hand is still a declared route', () => {
    const keys = new Set(declared.map((d) => d.key));
    expect([...READ_BY_HAND.keys()].filter((k) => !keys.has(k))).toEqual([]);
  });
});
