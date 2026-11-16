import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { teardownVerdict } from './fk-teardown-verdict';

/**
 * After the last suite, no foreign key may be broken beyond the known test leaks (WO-INFRA-012).
 * Here, inside the `test` gate, rather than as a later gate: `console-e2e` runs `pnpm db:reset`,
 * so every gate after it sees a fresh database and would pass whatever the suites left behind.
 * The audit is read-only; the ratchet (known test leaks: none since INF-03) is in
 * ops/scripts/fk-audit.mjs. It judges only the rows added since the baseline global-setup.ts took.
 *
 * Status 0 alone is not a pass (WO-INFRA-015B, PR105-F11): the audit's own PASS line must be in its
 * output, and a status 1 without its banner is a crash, not orphans. The decision is the pure
 * teardownVerdict() (INF-03), tested in ops/scripts/fk-teardown-verdict.test.mjs.
 */
export default function globalTeardown(): void {
  const audit = resolve(__dirname, '../../../ops/scripts/fk-audit.mjs');
  const baseline = process.env['ADULIS_FK_BASELINE'];
  const args = [audit, '--known-test-leaks', ...(baseline ? ['--baseline', baseline] : [])];
  const r = spawnSync(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    env: process.env,
  });
  if (baseline) rmSync(baseline, { force: true });
  const out = r.stdout ?? '';
  process.stdout.write(out);
  const verdict = teardownVerdict({
    status: r.status,
    signal: r.signal,
    error: r.error,
    stdout: out,
  });
  if (!verdict.ok) throw new Error(verdict.message);
}
