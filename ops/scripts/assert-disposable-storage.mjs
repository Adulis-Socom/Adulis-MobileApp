#!/usr/bin/env node
// Exit 0 only if the object store the R2_* values name is disposable test storage, or none is
// configured (WO-INFRA-015B). The API suites' Jest setup runs it before any suite; --required (the
// console e2e gate, whose media arms need a real store) refuses "none configured" as well.
// Exit 1: refused. The rules live in ./lib/disposable-storage.mjs.
import { checkDisposableStorage } from './lib/disposable-storage.mjs';

const r = await checkDisposableStorage(process.env, {
  required: process.argv.includes('--required'),
});
for (const line of r.out) console.log(line);
for (const line of r.err) console.error(line);
process.exitCode = r.code;
