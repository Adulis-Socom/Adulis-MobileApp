import { openDatabaseSync } from 'expo-sqlite';

/**
 * Foundation probe only (WO-001 S23): proves the native SQLite module is linked.
 * In-memory -- no database file, no tables, no offline policy. Persistence arrives with
 * the domain design that needs it.
 */
export function sqliteVersion(): string {
  const db = openDatabaseSync(':memory:');
  try {
    return db.getFirstSync<{ version: string }>('select sqlite_version() as version')?.version ?? 'unknown';
  } finally {
    db.closeSync();
  }
}
