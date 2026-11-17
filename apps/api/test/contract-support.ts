import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import * as ts from 'typescript';

/**
 * Two ways to hold contracts/openapi.json to what the API really does, shared
 * by the contract specs and by the e2e suites:
 *
 *  - scanRoutes(): what each controller method declares and returns, read from
 *    the source (decorators and the status it passes to runIdempotent), so the
 *    contract can be compared with the handlers without starting the API;
 *  - responseErrors(): a structural check of a REAL response body against the
 *    response schema the contract declares for it.
 */

const ROOT = resolve(__dirname, '../../..');
const MODULES = resolve(__dirname, '../src/modules');
const VERBS = ['Get', 'Post', 'Put', 'Patch', 'Delete'] as const;

export interface Schema {
  $ref?: string;
  type?: string;
  format?: string;
  nullable?: boolean;
  enum?: unknown[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  items?: Schema;
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  minimum?: number;
}

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
}
interface Operation {
  operationId?: string;
  parameters?: Parameter[];
  security?: Record<string, string[]>[];
  responses: Record<string, { content?: Record<string, { schema?: Schema }> }>;
}
export interface Contract {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
}

let contract: Contract | undefined;
export const loadContract = (): Contract =>
  (contract ??= JSON.parse(readFileSync(join(ROOT, 'contracts', 'openapi.json'), 'utf8')) as Contract);

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function check(value: unknown, schema: Schema, doc: Contract, at: string): string[] {
  if (schema.$ref) {
    const target = doc.components.schemas[schema.$ref.replace('#/components/schemas/', '')];
    return target ? check(value, target, doc, at) : [`${at}: unresolved ${schema.$ref}`];
  }
  if (value === null) return schema.nullable ? [] : [`${at}: null is not allowed`];
  if (schema.allOf) return schema.allOf.flatMap((s) => check(value, s, doc, at));
  if (schema.oneOf) {
    const matching = schema.oneOf.filter((s) => check(value, s, doc, at).length === 0).length;
    return matching === 1 ? [] : [`${at}: matches ${matching} of ${schema.oneOf.length} oneOf alternatives`];
  }
  if (schema.anyOf) {
    return schema.anyOf.some((s) => check(value, s, doc, at).length === 0) ? [] : [`${at}: matches no anyOf alternative`];
  }
  if (schema.enum && !schema.enum.includes(value)) return [`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`];
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') return [`${at}: expected string, got ${typeof value}`];
      if (schema.format === 'uuid' && !UUID.test(value)) return [`${at}: not a uuid`];
      if (schema.format === 'date-time' && !DATE_TIME.test(value)) return [`${at}: not a date-time`];
      return [];
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) return [`${at}: expected integer`];
      return schema.minimum !== undefined && value < schema.minimum ? [`${at}: below ${schema.minimum}`] : [];
    case 'number':
      return typeof value === 'number' ? [] : [`${at}: expected number`];
    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${at}: expected boolean`];
    case 'array':
      if (!Array.isArray(value)) return [`${at}: expected array`];
      return value.flatMap((v, i) => (schema.items ? check(v, schema.items, doc, `${at}[${i}]`) : []));
    case 'object':
    case undefined: {
      if (typeof value !== 'object' || Array.isArray(value)) return [`${at}: expected object`];
      const props = schema.properties ?? {};
      const record = value as Record<string, unknown>;
      const errors = (schema.required ?? []).filter((k) => !(k in record)).map((k) => `${at}.${k}: required but missing`);
      for (const [k, v] of Object.entries(record)) {
        const s = props[k];
        if (s) errors.push(...check(v, s, doc, `${at}.${k}`));
        else if (schema.additionalProperties === undefined || schema.additionalProperties === false) errors.push(`${at}.${k}: not declared`);
      }
      return errors;
    }
    default:
      return [`${at}: unsupported type ${schema.type}`];
  }
}

/**
 * Problems found when `body` is checked against the JSON response schema the contract declares for
 * `method` `path` (as written in `paths`, e.g. '/v1/conversations/{id}/messages') and `status`. Empty
 * means it conforms. A missing operation, status or schema is itself a problem.
 */
export function responseErrors(body: unknown, method: string, path: string, status: number): string[] {
  const doc = loadContract();
  const response = doc.paths[path]?.[method.toLowerCase()]?.responses[String(status)];
  const schema = response?.content?.['application/json']?.schema;
  if (!schema) return [`${method} ${path} declares no ${status} JSON schema`];
  return check(body, schema, doc, '$');
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
