import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { loadContract } from '../../../test/contract-support';
import {
  REPORT_DETAIL_MAX,
  REPORT_REASON_MAX,
  REPORT_SUBJECT_KINDS,
  reportRequestBody,
} from './reports.dto';

/**
 * BUY-25-CONTRACT-01. POST /v1/reports parsed a body that the generated contract did not declare (`requestBody` was
 * absent, so a typed client could not type it). These specs hold the DECLARED body to the RUNTIME validation, and to the
 * shipped enum, so that neither can drift from the other: the committed contract (kept current by the
 * `contract-current` gate) is compared with the zod schema the controller really parses with.
 *
 * Pure: no database, no HTTP; the only I/O is reading the committed contract and one migration.
 */

type Schema = Record<string, unknown> & {
  type?: string;
  format?: string;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  properties?: Record<string, Schema>;
  required?: string[];
  $ref?: string;
};

const contract = loadContract() as unknown as {
  paths: Record<string, Record<string, { requestBody?: { required?: boolean; content?: Record<string, { schema?: Schema }> } }>>;
  components: { schemas: Record<string, Schema> };
};

function declaredBody(): Schema {
  const op = contract.paths['/v1/reports']?.['post'];
  const schema = op?.requestBody?.content?.['application/json']?.schema;
  if (!schema?.$ref) throw new Error('POST /v1/reports declares no JSON request body in contracts/openapi.json');
  const name = schema.$ref.replace('#/components/schemas/', '');
  const resolved = contract.components.schemas[name];
  if (!resolved) throw new Error(`the contract has no schema ${name}`);
  return resolved;
}

describe('POST /v1/reports declares its request body', () => {
  it('declares a required JSON body with exactly the four fields the controller parses', () => {
    const op = contract.paths['/v1/reports']?.['post'];
    expect(op?.requestBody?.required).toBe(true);
    const body = declaredBody();
    expect(Object.keys(body.properties ?? {}).sort()).toEqual(['detail', 'reason', 'subject_id', 'subject_kind']);
    expect([...(body.required ?? [])].sort()).toEqual(['reason', 'subject_id', 'subject_kind']);
  });

  it('declares each field with the constraints the runtime enforces', () => {
    const p = declaredBody().properties!;
    expect(p['subject_kind']).toMatchObject({ type: 'string', enum: [...REPORT_SUBJECT_KINDS] });
    expect(p['subject_id']).toMatchObject({ type: 'string', format: 'uuid' });
    expect(p['reason']).toMatchObject({ type: 'string', minLength: 1, maxLength: REPORT_REASON_MAX });
    expect(p['detail']).toMatchObject({ type: 'string', maxLength: REPORT_DETAIL_MAX });
  });

  it('keeps the documented limits at the values the work order and design name (80 and 2000)', () => {
    expect(REPORT_REASON_MAX).toBe(80);
    expect(REPORT_DETAIL_MAX).toBe(2000);
  });

  it('agrees with the zod schema the controller parses with: same fields, same enum, same bounds, same required set', () => {
    const runtime = z.toJSONSchema(reportRequestBody) as Schema;
    const declared = declaredBody();
    expect(Object.keys(runtime.properties ?? {}).sort()).toEqual(Object.keys(declared.properties ?? {}).sort());
    expect([...(runtime.required ?? [])].sort()).toEqual([...(declared.required ?? [])].sort());
    const rp = runtime.properties!;
    const dp = declared.properties!;
    expect(dp['subject_kind']!.enum).toEqual(rp['subject_kind']!.enum);
    expect(dp['reason']!.minLength).toBe(rp['reason']!.minLength);
    expect(dp['reason']!.maxLength).toBe(rp['reason']!.maxLength);
    expect(dp['detail']!.maxLength).toBe(rp['detail']!.maxLength);
    expect(dp['subject_id']!.format).toBe(rp['subject_id']!.format);
  });
});

describe('the request body the runtime accepts and refuses', () => {
  const id = '0b6f1a3e-1111-4111-8111-111111111111';
  const valid = { subject_kind: 'PRODUCT', subject_id: id, reason: 'COUNTERFEIT' };

  it('accepts each of the five shipped subject kinds, with and without detail', () => {
    for (const subject_kind of REPORT_SUBJECT_KINDS) {
      expect(reportRequestBody.safeParse({ ...valid, subject_kind }).success).toBe(true);
    }
    expect(reportRequestBody.safeParse({ ...valid, detail: 'x'.repeat(REPORT_DETAIL_MAX) }).success).toBe(true);
  });

  it.each(['SCENE', 'SCENE_POST', 'STORE', 'ACCOUNT', 'PRODUCT_POST', 'SELLER_PROFILE', 'product', ''])(
    'refuses the subject kind %j: there is no such target (no Scene target, and the withdrawn v1.6 spellings stay gone)',
    (subject_kind) => {
      expect(reportRequestBody.safeParse({ ...valid, subject_kind }).success).toBe(false);
    },
  );

  it('refuses a bad id, an empty or over-long reason, an over-long detail, and a missing required field', () => {
    expect(reportRequestBody.safeParse({ ...valid, subject_id: 'not-a-uuid' }).success).toBe(false);
    expect(reportRequestBody.safeParse({ ...valid, reason: '' }).success).toBe(false);
    expect(reportRequestBody.safeParse({ ...valid, reason: 'x'.repeat(REPORT_REASON_MAX + 1) }).success).toBe(false);
    expect(reportRequestBody.safeParse({ ...valid, detail: 'x'.repeat(REPORT_DETAIL_MAX + 1) }).success).toBe(false);
    for (const key of ['subject_kind', 'subject_id', 'reason']) {
      const { [key]: _omitted, ...rest } = valid as Record<string, string>;
      expect(reportRequestBody.safeParse(rest).success).toBe(false);
    }
  });
});

describe('the subject kinds are the shipped enum', () => {
  it('equals core.report_target_kind in the foundation migration, value for value', () => {
    const sql = readFileSync(resolve(__dirname, '../../../../../db/migrations/0001_foundation.sql'), 'utf8');
    const m = /CREATE TYPE core\.report_target_kind AS ENUM\s*\(([^)]*)\)/i.exec(sql);
    expect(m).not.toBeNull();
    const values = [...m![1]!.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
    expect([...values].sort()).toEqual([...REPORT_SUBJECT_KINDS].sort());
  });

  it('has no Scene target and no Block operation anywhere in the contract', () => {
    expect([...REPORT_SUBJECT_KINDS].some((k) => /SCENE/.test(k))).toBe(false);
    const paths = Object.keys(contract.paths).filter((p) => /block|unblock/i.test(p) && !/deletion/.test(p));
    expect(paths).toEqual([]);
  });
});
