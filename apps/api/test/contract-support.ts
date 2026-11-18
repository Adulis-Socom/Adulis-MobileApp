import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import * as ts from 'typescript';
import { AuthGuard, PUBLIC_KEY } from '../src/common/auth/auth.guard';
import type { SessionService } from '../src/common/auth/session.service';
import { AdulisException } from '../src/common/errors/adulis-exception';
import { SESSION_COOKIE } from '../src/common/http/cookies';
import { loadContract, responseErrors } from './contract-check';

/**
 * Two ways to hold contracts/openapi.json to what the API really does, shared
 * by the contract specs and by the e2e suites:
 *
 *  - scanRoutes(): what each controller method declares and returns, read from
 *    the source (decorators and the status it passes to runIdempotent), so the
 *    contract can be compared with the handlers without starting the API;
 *  - responseErrors() (in contract-check.ts, re-exported here): a structural
 *    check of a REAL response body against the response schema the contract
 *    declares for it.
 */

export { loadContract, responseErrors };
export type { Contract, Schema } from './contract-check';

const MODULES = resolve(__dirname, '../src/modules');
const VERBS = ['Get', 'Post', 'Put', 'Patch', 'Delete'] as const;

export interface Route {
  module: string;
  controller: string;
  handler: string;
  http: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** The key in the contract's `paths`. */
  path: string;
  isPublic: boolean;
  /** The route demands an Idempotency-Key (it runs through runIdempotent or reads the key itself). */
  keyed: boolean;
  /** The success statuses the handler can answer with. */
  statuses: number[];
}

const decorators = (n: ts.Node): readonly ts.Decorator[] => (ts.canHaveDecorators(n) ? (ts.getDecorators(n) ?? []) : []);
const nameOf = (d: ts.Decorator): string => {
  const e = d.expression;
  return ts.isCallExpression(e) ? e.expression.getText() : e.getText();
};
const firstArg = (d: ts.Decorator): string => {
  const e = d.expression;
  const a = ts.isCallExpression(e) ? e.arguments[0] : undefined;
  return a && ts.isStringLiteralLike(a) ? a.text : '';
};
const numbers = (e: ts.Expression): number[] => {
  if (ts.isNumericLiteral(e)) return [Number(e.text)];
  if (ts.isConditionalExpression(e)) return [...numbers(e.whenTrue), ...numbers(e.whenFalse)];
  throw new Error(`cannot derive a status from \`${e.getText()}\``);
};

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.controller.ts') ? [join(dir, e.name)] : [],
  );
}

export function scanRoutes(): Route[] {
  const out: Route[] = [];
  for (const file of files(MODULES)) {
    const module = relative(MODULES, file).split(sep)[0] as string;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
    source.forEachChild((cls) => {
      if (!ts.isClassDeclaration(cls) || !cls.name) return;
      const classDecorators = decorators(cls);
      const controller = classDecorators.find((d) => nameOf(d) === 'Controller');
      if (!controller) return;
      for (const m of cls.members) {
        if (!ts.isMethodDeclaration(m)) continue;
        const own = decorators(m);
        const verb = own.find((d) => (VERBS as readonly string[]).includes(nameOf(d)));
        if (!verb) continue;
        const http = nameOf(verb).toLowerCase() as Route['http'];
        const raw = `/${firstArg(controller)}/${firstArg(verb)}`.replace(/\/+/g, '/').replace(/\/$/, '');
        const path = `/v1${raw}`.split('\\').join('').replace(/\/:(\w+)/g, '/{$1}');
        const httpCode = own.find((d) => nameOf(d) === 'HttpCode');
        const calls: ts.CallExpression[] = [];
        const visit = (n: ts.Node): void => {
          if (ts.isCallExpression(n)) calls.push(n);
          ts.forEachChild(n, visit);
        };
        if (m.body) visit(m.body);
        const idempotent = calls.filter((c) => /\.runIdempotent$/.test(c.expression.getText()));
        const manualKey = calls.some((c) => c.expression.getText() === 'idempotencyKey');
        // A handler that answers through runIdempotent sets the status itself, after Nest has applied
        // @HttpCode and before it replies; otherwise @HttpCode, otherwise POST 201 and the rest 200.
        const statuses = idempotent.length
          ? [...new Set(idempotent.flatMap((c) => numbers(c.arguments[2] as ts.Expression)))]
          : httpCode && ts.isCallExpression(httpCode.expression)
            ? numbers(httpCode.expression.arguments[0] as ts.Expression)
            : [http === 'post' ? 201 : 200];
        out.push({
          module,
          controller: cls.name.text,
          handler: m.name.getText(),
          http,
          path,
          isPublic: [...classDecorators, ...own].some((d) => nameOf(d) === 'Public'),
          keyed: idempotent.length > 0 || manualKey,
          statuses: statuses.sort(),
        });
      }
    });
  }
  return out;
}

/**
 * Whether the real AuthGuard demands `X-Adulis-Seller` on this route: the guard is called with a console session
 * and no seller header, and either refuses it with SELLER_CONTEXT_REQUIRED or lets it through. A public route is
 * marked @Public on a stand-in handler, which is all the guard reads of a controller.
 */
export async function guardDemandsSeller(r: Pick<Route, 'http' | 'path' | 'isPublic'>): Promise<boolean> {
  const handler = function standIn(): void {};
  if (r.isPublic) Reflect.defineMetadata(PUBLIC_KEY, true, handler);
  const session = { sessionId: 's', accountId: 'a', audience: 'CONSOLE', deviceId: null, marketId: 'm' };
  const guard = new AuthGuard(new Reflector(), { authenticate: () => Promise.resolve(session) } as unknown as SessionService);
  const context = {
    getHandler: () => handler,
    getClass: () => class StandInController {},
    switchToHttp: () => ({
      getRequest: () => ({ headers: { cookie: `${SESSION_COOKIE}=token` }, path: r.path.replace(/\{[^}]+\}/g, 'x'), method: r.http.toUpperCase() }),
    }),
  } as unknown as ExecutionContext;
  return guard.canActivate(context).then(
    () => false,
    (e: unknown) => {
      if (e instanceof AdulisException && e.code === 'SELLER_CONTEXT_REQUIRED') return true;
      throw e;
    },
  );
}

/**
 * For an e2e suite, on a real response: its status is one the contract declares for the operation and,
 * when `requireSchema` is set, its body conforms to the JSON schema declared for that status.
 */
export function expectConforms(
  res: { status: number; body: unknown },
  method: string,
  path: string,
  requireSchema = false,
): void {
  const declared = loadContract().paths[path]?.[method.toLowerCase()]?.responses ?? {};
  expect(Object.keys(declared)).toContain(String(res.status));
  if (requireSchema || declared[String(res.status)]?.content?.['application/json']?.schema) {
    expect(responseErrors(res.body, method, path, res.status)).toEqual([]);
  }
}
