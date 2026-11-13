import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * After the last suite, no foreign key may be broken beyond the known test leaks (WO-INFRA-012).
 * Here, inside the `test` gate, rather than as a later gate: `console-e2e` runs `pnpm db:reset`,
 * so every gate after it sees a fresh database and would pass whatever the suites left behind.
 * The audit is read-only; the ratchet (the five named leaks) is in ops/scripts/fk-audit.mjs.
 */
export default function globalTeardown(): void {
  const audit = resolve(__dirname, '../../../ops/scripts/fk-audit.mjs');
  const r = spawnSync(process.execPath, [audit, '--known-test-leaks'], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0)
    throw new Error(
      `[fk-audit] the suites left orphaned rows beyond the known test leaks (exit ${r.status ?? r.error?.message})`,
    );
}
