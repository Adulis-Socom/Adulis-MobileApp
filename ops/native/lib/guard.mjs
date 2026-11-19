// The gate in front of every destructive operation: run the checks that operation class needs and
// throw a typed refusal unless every one of them PASSES. There is no override flag.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHECKS, checkLabel, verify } from './identity.mjs';

const ALL = Object.keys(CHECKS);
export const REQUIRED = {
  'DB-WRITE': ['ID-00', 'ID-01', 'ID-02', 'ID-03', 'ID-08', 'ID-09', 'ID-10'],
  'API-WRITE': ALL,
  'OBJECT-WRITE': ['ID-00', 'ID-06', 'ID-07', 'ID-08', 'ID-09', 'ID-10'],
  'DOCKER-REMOVE': ['ID-00', 'ID-08', 'ID-10'],
  // The stack without an API: what a run must satisfy to be `ready`.
  STACK: ['ID-00', 'ID-01', 'ID-02', 'ID-03', 'ID-06', 'ID-07', 'ID-08', 'ID-09', 'ID-10'],
};

/**
 * A rule was evaluated and the operation does not satisfy it (exit 1); `code` 2 is used where the
 * rule could not be evaluated. Everything the CLI reports as REFUSED is one of these.
 */
export class Refused extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

export class Refusal extends Refused {
  /** code 1: a check FAILED (refused); code 2: a check could not be made (fail closed). */
  constructor(op, results) {
    const notPass = results.filter((r) => r.verdict !== 'PASS');
    super(
      `refused ${op}: ${notPass.map((r) => `${r.id} ${checkLabel(r.id)} ${r.verdict}${r.detail ? ` (${r.detail})` : ''}`).join('; ')}`,
    );
    this.op = op;
    this.results = results;
    this.code = notPass.some((r) => r.verdict === 'FAIL') ? 1 : 2;
    this.firstId = notPass[0]?.id;
  }
}

/**
 * Verifies the manifest's resources for one operation class. Resolves to the results when every
 * required check passed (and records the proof in ops.ndjson); otherwise records refusal.json and
 * throws a Refusal. A required check that produced no result counts as UNKNOWN, never as a pass.
 */
export async function assertTarget(m, op, io, { dir, run, states } = {}) {
  const need = REQUIRED[op];
  if (!need) throw new Error(`unknown operation class ${op}`);
  const results = await verify(m, io, need, { run, states });
  const checked = results.filter((r) => need.includes(r.id) || r.verdict !== 'PASS');
  if (checked.every((r) => r.verdict === 'PASS'))
    for (const id of need)
      if (!results.some((r) => r.id === id))
        checked.push({ id, verdict: 'UNKNOWN', detail: 'the check did not run' });
  const at = new Date().toISOString();
  if (checked.some((r) => r.verdict !== 'PASS')) {
    if (dir) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'refusal.json'),
        `${JSON.stringify({ at, op, results: checked }, null, 2)}\n`,
      );
    }
    throw new Refusal(op, checked);
  }
  if (dir) {
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'ops.ndjson'), `${JSON.stringify({ at, op, passed: need })}\n`);
  }
  return results;
}
