import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import { LEGACY_COMMERCE_CONTROLLERS } from '../src/common/http/openapi-security';
import { LEGACY_COMMERCE_TAGS, takeViolations } from './contract-conformance';
import { loadContract } from './contract-support';

/**
 * The conformance hook (test/contract-conformance.ts, loaded into every suite) only protects the contract if it is
 * armed: that it reports a body the contract does not describe, stays quiet for one it does, and exempts exactly the
 * legacy commerce operations. A supertest release that moved the method the hook wraps would otherwise leave every
 * suite green and validate nothing.
 */

const contract = loadContract();

const serve = (status: number, body: unknown, contentType = 'application/json'): Server =>
  createServer((_req, res) => {
    res.statusCode = status;
    res.setHeader('content-type', contentType);
    res.end(JSON.stringify(body));
  });

describe('the response conformance hook', () => {
  it('reports a 2xx body the contract does not describe, once, naming the operation', async () => {
    takeViolations();
    await request(serve(200, { data: 'not an array', unexpected: 1 })).get('/v1/seller/list').expect(200);
    const found = takeViolations();
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('GET /v1/seller/list 200');
  });

  it('is quiet for a body the contract describes', async () => {
    takeViolations();
    await request(serve(200, { data: [] })).get('/v1/seller/list').expect(200);
    expect(takeViolations()).toEqual([]);
  });

  it('does not look at an error answer, an undeclared status or a non-JSON answer (the documented blind spots)', async () => {
    takeViolations();
    await request(serve(404, { nonsense: true })).get('/v1/seller/list').expect(404);
    await request(serve(202, { nonsense: true })).get('/v1/seller/list').expect(202);
    await request(serve(200, { nonsense: true }, 'text/plain')).get('/v1/seller/list').expect(200);
    expect(takeViolations()).toEqual([]);
  });

  it('exempts the legacy commerce operations, which today declare no JSON success schema, so the exemption skips nothing it could check', () => {
    // If one of them gains a schema the hook would silently skip it: this fails so that someone decides whether to
    // check it (remove the tag from the exemption) or to keep it out until its contract is corrected.
    const withSchema = Object.entries(contract.paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([, o]) => (o.tags ?? []).some((t) => LEGACY_COMMERCE_TAGS.has(t)))
        .filter(([, o]) => Object.entries(o.responses).some(([status, r]) => /^2\d\d$/.test(status) && r.content?.['application/json']?.schema))
        .map(([method]) => `${method} ${path}`),
    );
    expect(withSchema).toEqual([]);
  });
});

describe('the hook stays cheap', () => {
  it('imports nothing but the node-only contract checker, because it is loaded into every suite', () => {
    const source = readFileSync(`${__dirname}/contract-conformance.ts`, 'utf8');
    const imports = [...source.matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1]);
    expect(imports).toEqual(['./contract-check']);
    const checker = readFileSync(`${__dirname}/contract-check.ts`, 'utf8');
    expect([...checker.matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1])).toEqual(['node:fs', 'node:path']);
  });
});

describe('the hook and the generator agree on what is legacy', () => {
  it('names the tag of every legacy commerce controller, and of no other operation', () => {
    const derived = new Set([...LEGACY_COMMERCE_CONTROLLERS].map((name) => name.replace(/Controller$/, '')));
    expect([...LEGACY_COMMERCE_TAGS].sort()).toEqual([...derived].sort());
  });

  it('tags every operation with its controller class name without Controller, which the hook relies on', () => {
    const wrong = Object.entries(contract.paths).flatMap(([path, item]) =>
      Object.entries(item).flatMap(([method, o]) => {
        const controller = (o.operationId ?? '').split('_')[0]?.replace(/Controller$/, '');
        return (o.tags ?? [])[0] === controller && (o.tags ?? []).length === 1 ? [] : [`${method} ${path}: tags ${JSON.stringify(o.tags)}, controller ${controller}`];
      }),
    );
    expect(wrong).toEqual([]);
  });
});
