/**
 * The gate scanner's own tests, on Node's built-in runner (part of
 * `pnpm --filter @adulis/mobile test`). Proven here: every gate fires on every
 * planted violation and is silent on its allowed placement; the helpers behave
 * on the shapes the WO-0b review found them wrong on; and the real tree is
 * clean. The self-test is also run by `pnpm gates` and the `mobile-gates`
 * gate; here it is a test so it cannot be forgotten.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import {
  GATE_11_UNANALYSABLE,
  GATES,
  QUEUE_EXEMPTIONS,
  REPO_ROOT,
  SQLITE_IMPORT,
  backgroundModule,
  bodyLiteralAfter,
  codeOnly,
  forbiddenTerm,
  grep,
  queueIdentifier,
  runAll,
  selfTest,
  verifyBodyLiteral,
} from './run.mjs';

test('there are fifteen gates, numbered 1 to 15, each with a fixture that fires and one that is silent', () => {
  assert.equal(GATES.length, 15);
  assert.deepEqual(
    GATES.map((g) => g.num),
    Array.from({ length: 15 }, (_, i) => i + 1),
  );
  for (const g of GATES) {
    assert.ok(Object.keys(g.fires).length > 0, `${g.id} has no firing fixture`);
    assert.ok(Object.keys(g.silent).length > 0, `${g.id} has no silent fixture`);
    assert.ok(g.ruling.length > 0, `${g.id} cites no ruling`);
  }
});

test('every gate fires on every planted violation and is silent on the allowed placement', () => {
  const { ok, results } = selfTest();
  const bad = results
    .filter((r) => !r.ok)
    .map((r) => `${r.gate.id}: fired=${r.fired.length} silent=${r.silent.length}`);
  assert.ok(ok, `gates that did not behave: ${bad.join('; ')}`);
});

test('codeOnly drops comments and keeps code, including a // inside a string and a generator method', () => {
  assert.equal(codeOnly("const a = 1; // fetch('x')"), 'const a = 1; ');
  assert.equal(codeOnly(' * no fetch( outside src/api'), '');
  assert.equal(codeOnly('/* the start of a block comment naming fetch('), '');
  assert.equal(codeOnly(' */'), '');
  assert.equal(codeOnly('/* queue */ const b = 2;'), ' const b = 2;');
  assert.equal(codeOnly("const c = fetch('y'); /* not a queue */"), "const c = fetch('y'); ");
  assert.equal(codeOnly("const c = fetch('y');"), "const c = fetch('y');");
  assert.equal(
    codeOnly("const u = 'https://x.test/a'; fetch(u);"),
    "const u = 'https://x.test/a'; fetch(u);",
    'a // inside a string is not a comment',
  );
  assert.equal(
    codeOnly('  *drain() { yield 1; }'),
    '  *drain() { yield 1; }',
    'a generator method is code, not a comment line',
  );
});

test('gate 10c matches queue identifiers as substrings in any case, and queueMicrotask is not a queue', () => {
  const queues = [
    'const scanQueue = [];',
    'export const handoffOutbox = new Map();',
    'function enqueueScan() {}',
    'async function drainPending() {}',
    'const pending_queue = [];',
    // v1.3 D-365: pending-sync joins the 10c set in all three spellings.
    'const pendingSync = [];',
    'const pending_sync = [];',
    'const pendingsync = [];',
  ];
  for (const line of queues)
    assert.ok(queueIdentifier(line), `should be a queue identifier: ${line}`);
  for (const line of [
    'export const later = (f) => queueMicrotask(f);',
    'const query = useQuery();',
    'const drawer = 1;',
    // v1.3 D-365: the background modules are 10b's job, not 10c's.
    "import * as BackgroundFetch from 'expo-background-fetch';",
  ]) {
    assert.ok(!queueIdentifier(line), `should not be a queue identifier: ${line}`);
  }
});

test('gate 10b matches the background modules AND their bare identifiers (v1.3)', () => {
  for (const line of [
    "import * as BackgroundFetch from 'expo-background-fetch';",
    "import * as TaskManager from 'expo-task-manager';",
    '    "expo-background-fetch": "1.0.0",',
    // v1.3: the symbols, used without the import beside them.
    'TaskManager.defineTask(NAME, handler);',
    'const r = BackgroundFetchResult.NewData;',
    'defineTask(SCAN_TASK, () => {});',
    'await registerTaskAsync(SCAN_TASK);',
    'return BackgroundFetch.BackgroundFetchResult.NoData;',
  ]) {
    assert.ok(backgroundModule(line), `should be a background module: ${line}`);
  }
  for (const line of [
    'const backgroundColor = tokens.bg;',
    'function taskDone() {}',
    'const tasks = [];',
  ]) {
    assert.ok(!backgroundModule(line), `should not be a background module: ${line}`);
  }
});

test('gate 10c exemptions are a named list, and every entry carries a reason (v1.3)', () => {
  assert.ok(Array.isArray(QUEUE_EXEMPTIONS) && QUEUE_EXEMPTIONS.length > 0);
  for (const e of QUEUE_EXEMPTIONS) {
    assert.equal(typeof e.token, 'string', 'an exemption needs a token');
    assert.ok(
      typeof e.why === 'string' && e.why.length > 20,
      `exemption ${e.token} needs a real reason, not a placeholder`,
    );
    // The exemption must actually be exercised by the predicate.
    assert.ok(!queueIdentifier(`const x = ${e.token}(fn);`), `${e.token} should be exempt`);
  }
});

test('gate 10a matches an expo-sqlite IMPORT, not a declaration of the dependency', () => {
  for (const line of [
    "import * as SQLite from 'expo-sqlite';",
    "const SQLite = require('expo-sqlite');",
    "const SQLite = await import('expo-sqlite');",
    "import 'expo-sqlite';",
  ]) {
    assert.ok(SQLITE_IMPORT.test(line), `should be an expo-sqlite import: ${line}`);
  }
  for (const line of ['    "expo-sqlite": "57.0.2",', "    'expo-sqlite',"]) {
    assert.ok(!SQLITE_IMPORT.test(line), `should NOT be an import: ${line}`);
  }
});

test('gate 11 reads the verify body literal: audience on the challenge is required, on verify it fails', () => {
  const challenge =
    "export const challenge = (p) =>\n  post('/v1/auth/otp/request', { phone: p, purpose: 'SIGN_IN', audience: 'MOBILE' });\n";
  const clean = `${challenge}export const verify = (id) =>\n  post('/v1/auth/otp/verify', { challenge_id: id, code: '', device_id: '' });\n`;
  const dirty = `${challenge}export const verify = (id) =>\n  post('/v1/auth/otp/verify', { challenge_id: id, code: '', audience: 'MOBILE' });\n`;

  const verifyBody = (src) =>
    bodyLiteralAfter(src, src.indexOf('/v1/auth/otp/verify') + '/v1/auth/otp/verify'.length);

  assert.ok(!/\baudience\b/.test(verifyBody(clean)), 'clean verify body must not carry audience');
  assert.ok(/\baudience\b/.test(verifyBody(dirty)), 'dirty verify body must carry audience');
  // The challenge literal is untouched by the gate in both files.
  assert.ok(/\baudience\b/.test(clean), 'the challenge keeps audience -- S4.3 requires it');
});

test('gate 11 FAILS LOUDLY rather than going silent when the body is not an object literal (v1.3)', () => {
  const challenge =
    "export const challenge = (p) =>\n  post('/v1/auth/otp/request', { phone: p, audience: 'MOBILE' });\n";

  // Analysable: an object literal sits at the call site.
  const literal = `${challenge}export const verify = (id) =>\n  post('/v1/auth/otp/verify', { challenge_id: id, code: '' });\n`;
  assert.notEqual(verifyBodyLiteral(literal).literal, null, 'an inline literal is analysable');

  // Not analysable, three shapes -- each must yield literal === null, which the
  // gate reports as a failure rather than a pass.
  const byName = `${challenge}export const verify = () => post('/v1/auth/otp/verify', body);\n`;
  const spread = `${challenge}export const verify = () => post('/v1/auth/otp/verify', ...args);\n`;
  const inConst = `${challenge}const VERIFY = '/v1/auth/otp/verify';\nexport const verify = () => post(VERIFY, body);\n`;
  for (const [name, src] of [
    ['body passed by name', byName],
    ['spread argument', spread],
    ['path held in a const', inConst],
  ]) {
    assert.equal(verifyBodyLiteral(src).literal, null, `${name} must not be treated as analysable`);
  }

  assert.match(GATE_11_UNANALYSABLE, /cannot check it/);
  assert.match(GATE_11_UNANALYSABLE, /Restructure the call or amend the gate/);
});

test("forbiddenTerm catches tier, subscription and currency language -- Latin and Ge'ez -- but not a product price or the word for store", () => {
  const forbidden = [
    'Upgrade to the Pro tier',
    'Your current plan does not include this.',
    'Available on Verified Pro',
    'Billing is monthly',
    '1,200 ETB per month',
    '$5/month',
    'Br 200',
    '200 \u1265\u122d',
  ];
  for (const v of forbidden) assert.ok(forbiddenTerm(v), `should be forbidden: ${v}`);
  const allowed = [
    'The price has changed.',
    'Pay by 18:40 today to keep your reservation.',
    'Only {available} left.',
    'Scan to complete',
    'a professional courier',
    '\u1218\u12F0\u1265\u122D',
  ];
  for (const v of allowed) assert.ok(!forbiddenTerm(v), `should be allowed: ${v}`);
});

test('grep on a root that does not exist yields no hits and no crash', () => {
  assert.deepEqual(grep(REPO_ROOT, { roots: ['does/not/exist'], pattern: /x/ }), []);
});

test('every fixture path is repository-relative posix, so the self-test plants where the gate looks', () => {
  for (const g of GATES) {
    for (const rel of [...Object.keys(g.fires), ...Object.keys(g.silent)]) {
      assert.ok(!path.isAbsolute(rel) && !rel.includes('\\'), `${g.id}: ${rel}`);
      assert.ok(
        /^(apps\/mobile|packages)\//.test(rel),
        `${g.id}: ${rel} is outside every root a gate scans`,
      );
    }
  }
});

test('the real tree passes all fifteen', () => {
  const { ok, results } = runAll(REPO_ROOT);
  const failing = results
    .filter((r) => !r.ok)
    .map(
      (r) =>
        `${r.gate.id} (${r.hits.length}): ${r.hits
          .slice(0, 3)
          .map((h) => `${h.file}:${h.line}`)
          .join(', ')}`,
    );
  assert.ok(ok, `failing gates: ${failing.join(' | ')}`);
});
