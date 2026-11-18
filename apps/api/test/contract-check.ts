import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The part of the contract checks that needs nothing but node: the contract's shape, loading it, and the structural
 * check of a real response body against the response schema it declares. Kept apart from contract-support.ts (which
 * parses controller sources and drives the AuthGuard) because the conformance hook in test/contract-conformance.ts
 * runs in every suite and must stay cheap: every suite would otherwise pay for loading the TypeScript compiler,
 * Nest and the database client in order to reach these two functions.
 */

const ROOT = resolve(__dirname, '../../..');

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
  tags?: string[];
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  security?: Record<string, string[]>[];
  responses: Record<string, { description?: string; content?: Record<string, { schema?: Schema }> }>;
}
export interface Contract {
  info?: { description?: string };
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema>; securitySchemes?: Record<string, Record<string, unknown>> };
}

let contract: Contract | undefined;
export const loadContract = (): Contract =>
  (contract ??= JSON.parse(readFileSync(join(ROOT, 'contracts', 'openapi.json'), 'utf8')) as Contract);

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

