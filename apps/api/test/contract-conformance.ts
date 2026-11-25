import { loadContract, responseErrors } from './contract-check';

/**
 * Jest `setupFilesAfterEnv`: every real response any suite receives through supertest is checked against
 * the response schema contracts/openapi.json declares for it. A 2xx JSON response whose operation declares a
 * schema for that status must conform (the same check as expectConforms: undeclared property, missing required
 * one, wrong type, null where none is allowed); a test that makes such a request fails if it does not.
 *
 * It is how a response schema is held to the wire: the schema is proved by every real response in the suite, not
 * by the few assertions someone remembered to write, and a handler that changes its answer without the contract
 * breaks the suite that exercises it. The legacy commerce operations keep the metadata they declare today and are
 * left out. Observation only: the response is untouched.
 *
 * It imports only contract-check.ts (node and nothing else): it runs in every suite, including the pure unit specs.
 *
 * WHAT IT DOES NOT CHECK, on purpose (it is not widened here):
 *  - a 2xx status the contract does not declare for the operation is skipped; status drift is the business of
 *    the scanRoutes specs and expectConforms, not of this hook;
 *  - non-2xx answers: the problem envelope and the error codes are not checked against ProblemDto;
 *  - 2xx answers without a JSON schema in the contract (204, and the four operations whose wire shape is not
 *    settled), and non-JSON answers;
 *  - requests that do not go through supertest;
 *  - requests a suite makes in its own afterAll: jest-circus runs after-hooks in definition order, so they happen
 *    after this file's afterAll has flushed and are not reported;
 *  - the contract path is matched by the most literal template without looking at the method; there is no pair of
 *    overlapping templates today, and the specs would show one.
 * An operation is exempt when its tag is a legacy commerce controller's (a tag is the controller class name without
 * `Controller`; contract-conformance.spec.ts holds this list to LEGACY_COMMERCE_CONTROLLERS).
 */

export const LEGACY_COMMERCE_TAGS: ReadonlySet<string> = new Set([
  'Billing',
  'Couriers',
  'Obligations',
  'Orders',
  'Reviews',
]);

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
      const operation = t?.item[this.method.toLowerCase()];
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

/** For the spec that proves the hook is armed: the violations recorded so far in this suite, which are then discarded. */
export function takeViolations(): string[] {
  return violations.splice(0);
}

function flush(): void {
  if (violations.length === 0) return;
  const found = violations.splice(0);
  throw new Error(`a real response does not conform to the schema contracts/openapi.json declares:\n  ${[...new Set(found)].join('\n  ')}`);
}

afterEach(flush);
afterAll(flush);
