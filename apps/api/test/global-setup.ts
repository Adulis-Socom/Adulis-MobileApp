import { assertDisposable } from './db-target';

// Runs once, before any suite: an unmarked database stops the run before a single row is written.
export default async function globalSetup(): Promise<void> {
  const t = await assertDisposable();
  process.stdout.write(
    `\n[db-target] ${t.host}:${t.port}/${t.database} is marked disposable: running the suites against it.\n`,
  );
}
