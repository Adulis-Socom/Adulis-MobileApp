#!/usr/bin/env node
// Exit 0 only if EVERY database URL the gates will use reaches a database carrying the disposable mark
// (WO-INFRA-012). gates.mjs runs it before the first gate that writes to the database: locally the root
// .env points at the persistent development database, `migrate` (migrations + seed) runs before `test`,
// and `console-e2e` starts the API with DATABASE_URL, not DATABASE_URL_MIGRATE. The same rules as the
// Jest guard (apps/api/test/db-target.ts): required URLs set and not empty, loopback, an explicit port,
// and the mark read through each URL. Exit 1: refused. Exit 2: could not check.
// The rules live in ./lib/disposable-db.mjs (WO-INFRA-015A), shared with the destructive scripts.
import { checkDisposable } from './lib/disposable-db.mjs';

const r = await checkDisposable(process.env);
for (const line of r.out) console.log(line);
for (const line of r.err) console.error(line);
process.exitCode = r.code;
