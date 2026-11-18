import { loadContract, responseErrors } from './contract-support';

/**
 * Jest `setupFilesAfterEnv`: every real response any suite receives through supertest is checked against
 * the response schema contracts/openapi.json declares for it. A 2xx JSON response whose operation declares a
 * schema for that status must conform (the same check as expectConforms: undeclared property, missing required
 * one, wrong type, null where none is allowed); a test that makes such a request fails if it does not.
 *
 * It is how a response schema is held to the wire: the schema is proved by every real response in the suite, not
 * by the few assertions someone remembered to write, and a handler that changes its answer without the contract
 * breaks the suite that exercises it. The legacy commerce operations keep the metadata they declare today and are
 * left out. Observation only: the response is untouched, and an operation without a schema is not checked.
 */

const LEGACY_COMMERCE_TAGS = new Set(['Billing', 'Claims', 'Couriers', 'Financial', 'Handoff', 'Obligations', 'Orders', 'Reviews']);

interface SupertestCall {
  method: string;
  url: string;
  assert: (resError: unknown, res: unknown, fn: unknown) => unknown;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Test = require('supertest/lib/test') as { prototype: SupertestCall };

const contract = loadContract();
const templates = Object.entries(contract.paths).map(([path, item]) => ({
  path,
  item,
  pattern: new RegExp(`^${path.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}$`),
  params: (path.match(/\{/g) ?? []).length,
}));

/** The contract path a request URL belongs to: the most literal template that matches. */
function templateOf(url: string): (typeof templates)[number] | undefined {
  const pathname = new URL(url).pathname;
  return templates.filter((t) => t.pattern.test(pathname)).sort((a, b) => a.params - b.params)[0];
}

const violations: string[] = [];

const original = Test.prototype.assert;
Test.prototype.assert = function (this: SupertestCall, resError: unknown, res: unknown, fn: unknown) {
  try {
    const r = res as { status?: number; body?: unknown; headers?: Record<string, string> } | undefined;
    if (r?.status !== undefined && r.status >= 200 && r.status < 300 && (r.headers?.['content-type'] ?? '').includes('json')) {
      const t = templateOf(this.url);
      const operation = t?.item[this.method.toLowerCase()] as { tags?: string[]; responses: Record<string, { content?: Record<string, { schema?: unknown }> }> } | undefined;
      if (t && operation && !(operation.tags ?? []).some((tag) => LEGACY_COMMERCE_TAGS.has(tag))) {
        if (operation.responses[String(r.status)]?.content?.['application/json']?.schema) {
          const errors = responseErrors(r.body, this.method, t.path, r.status);
          if (errors.length > 0) violations.push(`${this.method.toUpperCase()} ${t.path} ${r.status}: ${errors.slice(0, 5).join('; ')}`);
        }
      }
    }
  } catch (e) {
    violations.push(`the conformance check itself failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return original.call(this, resError, res, fn);
};

function flush(): void {
  if (violations.length === 0) return;
  const found = violations.splice(0);
  throw new Error(`a real response does not conform to the schema contracts/openapi.json declares:\n  ${[...new Set(found)].join('\n  ')}`);
}

afterEach(flush);
afterAll(flush);
