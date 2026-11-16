import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
  const scripts = resolve(__dirname, '../../../ops/scripts');
  const r = spawnSync(process.execPath, [join(scripts, 'assert-disposable-storage.mjs')], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0)
    throw new Error(
      `[storage-target] the API suites refuse this object store (status ${r.status}, signal ${r.signal}, ${r.error?.message ?? 'see above'})`,
    );
  // The foreign-key baseline (WO-INFRA-015B review): the orphans already in this database, from an
  // earlier run on the same disposable pair. The teardown judges only the rows THIS run adds, so a
  // rerun is not reported as "a suite now leaks more". Exit 1 = orphans found, which is fine here.
  const baseline = join(tmpdir(), `adulis-fk-baseline-${process.pid}-${Date.now()}.json`);
  const a = spawnSync(process.execPath, [join(scripts, 'fk-audit.mjs'), '--json', baseline], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: process.env,
  });
  if (a.status !== 0 && a.status !== 1)
    throw new Error(
      `[fk-baseline] the foreign-key audit could not take its baseline (status ${a.status}, signal ${a.signal}, ${a.error?.message ?? 'see above'})`,
    );
  const before = (JSON.parse(readFileSync(baseline, 'utf8')) as Array<{ count: number }>).reduce(
    (n, x) => n + x.count,
    0,
  );
  process.env['ADULIS_FK_BASELINE'] = baseline;
  process.stdout.write(
    `[fk-baseline] ${before} orphan row(s) already in this database; the teardown judges only the rows this run adds.\n`,
  );
}
