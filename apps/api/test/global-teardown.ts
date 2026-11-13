import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * After the last suite, no foreign key may be broken beyond the known test leaks (WO-INFRA-012).
 * Here, inside the `test` gate, rather than as a later gate: `console-e2e` runs `pnpm db:reset`,
 * so every gate after it sees a fresh database and would pass whatever the suites left behind.
 * The audit is read-only; the ratchet (the five named and counted leaks) is in
 * ops/scripts/fk-audit.mjs.
 *
 * Status 0 alone is not a pass (WO-INFRA-015B, PR105-F11): the audit's own PASS line must be in its
 * output, and a status 1 without its banner is a crash, not orphans.
 */
export default function globalTeardown(): void {
  const audit = resolve(__dirname, '../../../ops/scripts/fk-audit.mjs');
  const r = spawnSync(process.execPath, [audit, '--known-test-leaks'], {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    env: process.env,
  });
  const out = r.stdout ?? '';
  process.stdout.write(out);
  const audited = out.includes('Foreign-key audit -- ');
  if (r.status === 1 && audited)
    throw new Error(
      '[fk-audit] the suites left orphaned rows beyond the known test leaks, or more rows on a known leak than it may leave (listed above)',
    );
  if (r.status !== 0 || !audited)
    throw new Error(
      `[fk-audit] the foreign-key audit did not run to its verdict (status ${r.status}, signal ${r.signal}, ${r.error?.message ?? 'see above'})`,
    );
  if (!/^PASS {2}all \d+ foreign keys hold/m.test(out))
    throw new Error('[fk-audit] the foreign-key audit exited 0 without its PASS line');
}
