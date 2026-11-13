import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { assertDisposable } from './db-target';

// Runs once, before any suite: an unmarked database stops the run before a single row is written.
export default async function globalSetup(): Promise<void> {
  const t = await assertDisposable();
  process.stdout.write(
    `\n[db-target] ${t.host}:${t.port}/${t.database} is marked disposable: running the suites against it.\n`,
  );
  // ...and so does an object store that is not the disposable one (WO-INFRA-015B): with the R2_*
  // values from the root .env the suites would upload into the development MinIO. No R2_* at all
  // is accepted (the in-memory fake). The rules are in ops/scripts/lib/disposable-storage.mjs.
  const check = resolve(__dirname, '../../../ops/scripts/assert-disposable-storage.mjs');
  const r = spawnSync(process.execPath, [check], { stdio: 'inherit', env: process.env });
  if (r.status !== 0)
    throw new Error(
      `[storage-target] the API suites refuse this object store (status ${r.status}, signal ${r.signal}, ${r.error?.message ?? 'see above'})`,
    );
}
