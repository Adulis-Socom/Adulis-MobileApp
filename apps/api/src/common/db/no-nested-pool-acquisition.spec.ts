import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as ts from 'typescript';

/**
 * WO-SEC-001 / OVN-045 -- the static guard against nested pool acquisition.
 *
 * The defect: code running inside an open handler transaction (which holds
 * one pooled connection) asks the pool for a SECOND connection -- a
 * rate-limit count on the default pool, a direct `this.db` write. Ten such
 * requests at once hold all ten app-pool connections while each waits for
 * another, and the API hangs. The explicit concurrency tests
 * (test/wo-sec-001-pool-starvation.e2e.spec.ts) prove the routes we know
 * about; this makes the shape hard to write again anywhere.
 *
 * LEXICAL, AND HONEST ABOUT IT. A function "holds a transaction" when it is
 * the callback of `tx.run` / `tx.runIdempotent` (the handler argument, not
 * the beforeTransaction one) / `withRequestContext` / `.transaction().execute`,
 * or takes a `Transaction<...>` parameter. Inside one, it refuses:
 *   1. `consume(...)` with fewer than four arguments (no transaction passed);
 *   2. `this.db` / `this.financialDb` (every pool injection is named so);
 *   3. a call to a method of the same class that touches a pool directly --
 *      one level of indirection, which is the shape burnAttempt had.
 * A pool reached through ANOTHER class (a service whose method uses its own
 * `this.db`) is not seen; the e2e tests are the guard there. An arrow that is
 * returned or stored (`{ purge: () => ... }`) runs later, so the walk stops
 * at it; an arrow passed as an argument (`rows.map(...)`) runs inline, so the
 * walk continues outward.
 */

const POOL_FIELDS = new Set(['db', 'financialDb']);

type Fn = ts.FunctionLikeDeclaration;

const isFn = (n: ts.Node): n is Fn =>
  ts.isArrowFunction(n) ||
  ts.isFunctionExpression(n) ||
  ts.isFunctionDeclaration(n) ||
  ts.isMethodDeclaration(n);

function isTransactionCallback(fn: Fn): boolean {
  const call = fn.parent;
  if (!ts.isCallExpression(call)) return false;
  const at = call.arguments.indexOf(fn as ts.Expression);
  // Whitespace-free, so a call chain broken across lines still matches.
  const callee = call.expression.getText().replace(/\s+/g, '');
  if (/\.tx\.run$/.test(callee)) return at === 1;
  if (/\.tx\.runIdempotent$/.test(callee)) return at === 3;
  if (/(^|\.)withRequestContext$/.test(callee)) return at === 2;
  if (/\.transaction\(\)(\.\w+\([^)]*\))*\.execute$/.test(callee)) return at === 0;
  if (/\.connection\(\)\.execute$/.test(callee)) return at === 0;
  return false;
}

// A parameter that IS a transaction -- not a callback that will receive one
// (HandlerTransaction.run's own `fn` parameter).
const takesTransaction = (fn: Fn): boolean =>
  fn.parameters.some(
    (p) => !!p.type && ts.isTypeReferenceNode(p.type) && p.type.typeName.getText() === 'Transaction',
  );

/** Does the code at `node` run while a transaction it can see is open? */
function insideTransaction(node: ts.Node): boolean {
  for (let n = node.parent; n; n = n.parent) {
    if (!isFn(n)) continue;
    if (isTransactionCallback(n) || takesTransaction(n)) return true;
    // A named function or method is its own scope; a stored or returned
    // arrow runs later. Only an inline callback inherits the outer state.
    if (!ts.isCallExpression(n.parent)) return false;
  }
  return false;
}

const isThisPool = (n: ts.Node): n is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(n) &&
  n.expression.kind === ts.SyntaxKind.ThisKeyword &&
  POOL_FIELDS.has(n.name.text);

export function findNestedAcquisitions(fileName: string, text: string): string[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const at = (n: ts.Node) => `${fileName}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;

  // Every method (or arrow-function property) of each class, what it touches
  // directly and which same-class methods it calls INLINE (a call inside a
  // stored or returned arrow runs later, so it does not count). A method
  // reaches a pool if it touches one or calls, at any depth, one that does.
  const direct = new Set<string>();
  const calls = new Map<string, Set<string>>();
  const collect = (n: ts.Node): void => {
    const member = ts.isMethodDeclaration(n) || ts.isPropertyDeclaration(n) ? n : undefined;
    const body =
      member && ts.isMethodDeclaration(member)
        ? member.body
        : member && member.initializer && isFn(member.initializer)
          ? member.initializer
          : undefined;
    if (member && body && ts.isIdentifier(member.name)) {
      const name = member.name.text;
      const out = calls.get(name) ?? new Set<string>();
      calls.set(name, out);
      const scan = (m: ts.Node): void => {
        if (m !== body && isFn(m) && !ts.isCallExpression(m.parent)) return;
        if (isThisPool(m)) direct.add(name);
        if (
          ts.isCallExpression(m) &&
          ts.isPropertyAccessExpression(m.expression) &&
          m.expression.expression.kind === ts.SyntaxKind.ThisKeyword
        ) {
          out.add(m.expression.name.text);
        }
        ts.forEachChild(m, scan);
      };
      scan(body);
    }
    ts.forEachChild(n, collect);
  };
  collect(sf);
  const poolMethods = new Set(direct);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [name, callees] of calls) {
      if (!poolMethods.has(name) && [...callees].some((c) => poolMethods.has(c))) {
        poolMethods.add(name);
        grew = true;
      }
    }
  }

  const found: string[] = [];
  const visit = (n: ts.Node): void => {
    if (isThisPool(n) && insideTransaction(n)) {
      found.push(`${at(n)} this.${n.name.text} inside an open transaction`);
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const name = n.expression.name.text;
      if (name === 'consume' && n.arguments.length < 4 && insideTransaction(n)) {
        found.push(`${at(n)} consume() without the transaction, inside an open transaction`);
      }
      if (
        n.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
        poolMethods.has(name) &&
        insideTransaction(n)
      ) {
        found.push(`${at(n)} this.${name}() reaches a pool inside an open transaction`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
}

describe('no nested pool acquisition (WO-SEC-001, OVN-045)', () => {
  it('nothing under apps/api/src asks the pool for a second connection inside a transaction', () => {
    const root = join(__dirname, '..', '..');
    const files = sourceFiles(root);
    expect(files.length).toBeGreaterThan(50);
    const found = files.flatMap((f) =>
      findNestedAcquisitions(relative(root, f), readFileSync(f, 'utf8')),
    );
    expect(found).toEqual([]);
  });

  it('catches every shape OVN-045 found', () => {
    const pre = `
      class C {
        a(req, res) {
          return this.tx.runIdempotent(req, res, 202, async (trx) => {
            await this.rateLimit.consume('PHONE_HASH', 'h', { bucketKey: 'k', windowSeconds: 1, max: 1 });
          });
        }
        b(ctx) {
          return withRequestContext(this.db, ctx, async (trx) => {
            await sql\`SELECT 1\`.execute(this.db);
          });
        }
        async verify(trx: Transaction<Database>) { return this.burn(); }
        private async burn() { await sql\`UPDATE x\`.execute(this.db); }
        c(req) {
          return this.tx.run(req, async (trx) => [1].map(() => this.financialDb));
        }
        async deep(trx: Transaction<Database>) { return this.hop(); }
        private hop() { return this.arrowBurn(); }
        private arrowBurn = async () => sql\`UPDATE y\`.execute(this.db);
        e(req, res) {
          return this
            .tx
            .runIdempotent(req, res, 201, async (trx) => {
              await this.rateLimit.consume('ACCOUNT', 'a', { bucketKey: 'k', windowSeconds: 1, max: 1 });
            });
        }
      }`;
    const found = findNestedAcquisitions('pre.ts', pre).join('\n');
    expect(found.split('\n')).toHaveLength(6);
    expect(found).toMatch(/pre\.ts:5 consume\(\) without the transaction/);
    expect(found).toMatch(/this\.db inside an open transaction/);
    expect(found).toMatch(/this\.burn\(\) reaches a pool/);
    expect(found).toMatch(/this\.financialDb inside an open transaction/);
    // Two hops, through an arrow-function property, and a chain broken across lines.
    expect(found).toMatch(/this\.hop\(\) reaches a pool/);
    expect(found).toMatch(/pre\.ts:25 consume\(\) without the transaction/);
  });

  /**
   * TRIPWIRE. verifyCode / verifyChallengeById count a wrong guess in the
   * caller's transaction and throw RefuseAfterCommit, which only
   * HandlerTransaction settles by committing. A caller outside it would roll
   * the count back and answer 500 to a wrong code against 200 to a right one:
   * a free guess. So the callers are pinned; a new one fails here until it is
   * reviewed and added.
   */
  it('the OTP verifiers have only their reviewed callers', () => {
    const root = join(__dirname, '..', '..');
    const callers: string[] = [];
    for (const f of sourceFiles(root)) {
      const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (n: ts.Node): void => {
        if (
          ts.isCallExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          ['verifyCode', 'verifyChallengeById'].includes(n.expression.name.text)
        ) {
          let m: ts.Node | undefined = n.parent;
          while (m && !ts.isMethodDeclaration(m)) m = m.parent;
          const method = m && ts.isMethodDeclaration(m) ? m.name.getText(sf) : '(none)';
          callers.push(`${relative(root, f).replace(/\\/g, '/')} ${method} -> ${n.expression.name.text}`);
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    expect(callers.sort()).toEqual([
      'modules/auth/auth.service.ts stepUpVerify -> verifyChallengeById',
      'modules/auth/auth.service.ts verifySignIn -> verifyCode',
      'modules/deletion/deletion.controller.ts otpVerify -> verifyCode',
    ]);
  });

  it('accepts the fixed shapes', () => {
    const fixed = `
      class C {
        a(req, res) {
          return this.tx.runIdempotent(req, res, 202, async (trx) => ({}),
            () => this.rateLimit.consume('PHONE_HASH', 'h', { bucketKey: 'k', windowSeconds: 1, max: 1 }));
        }
        b(trx: Transaction<Database>) {
          return this.rateLimit.consume('DEVICE', 'd', { bucketKey: 'k', windowSeconds: 1, max: 1 }, trx);
        }
        c(trx: Transaction<Database>) { return { purge: () => this.purgeNow() }; }
        private async purgeNow() { await sql\`SELECT 1\`.execute(this.financialDb); }
        d(ctx) { return withRequestContext(this.db, ctx, async (trx) => 1); }
      }`;
    expect(findNestedAcquisitions('fixed.ts', fixed)).toEqual([]);
  });
});
