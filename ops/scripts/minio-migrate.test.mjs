// The fail-closed checks of ops/scripts/minio-migrate.mjs (WO-INFRA-007). The docker-driven parts
// are rehearsed end to end on disposable copies (docs/infrastructure/WO-INFRA-007-MIGRATION-VALIDATION.md);
// these tests pin the decisions that must refuse.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  BACKUP_MUST_HOLD,
  BUCKETS,
  CLEAR_DELAYS_S,
  INVALIDATED_RECORD,
  MOVE_RECORD,
  PAUSE_POINTS,
  POSTGRES_DIRS,
  ROLLED_BACK_RECORD,
  Refusal,
  checkTarget,
  compareObjects,
  createInterruption,
  faultsOf,
  guard,
  insideRepo,
  parseInventory,
  parseRecord,
  recordedSha,
  recoveryPlan,
  rollbackRerun,
  ruleSet,
  sourceBucketProblems,
  tarEntries,
  undoVerdict,
  verifyBackup,
} from './minio-migrate.mjs';

const refuses = (fn, re) => assert.throws(fn, (e) => e instanceof Refusal && re.test(e.message));

test('the live volume needs the approval; faults never touch it', () => {
  refuses(() => guard('migrate', 'adulis-pgdata', {}), /founder's approval/);
  refuses(() => guard('rollback', 'adulis-pgdata', { MIGRATE_LIVE: 'yes' }), /founder's approval/);
  assert.equal(guard('migrate', 'adulis-pgdata', { MIGRATE_LIVE: 'approved' }), true);
  assert.equal(guard('plan', 'adulis-pgdata', {}), true);
  refuses(
    () =>
      guard('migrate', 'adulis-pgdata', { MIGRATE_LIVE: 'approved', MIGRATE_FAULT: 'drop-object' }),
    /rehearsals only/,
  );
  refuses(
    () => guard('migrate', 'infra-rh-src', { MIGRATE_FAULT: 'typo' }),
    /unknown MIGRATE_FAULT/,
  );
  assert.equal(guard('migrate', 'infra-rh-src', { MIGRATE_FAULT: 'drop-object' }), false);
});

test('backups must live outside the repository, also across drives', () => {
  const repo = process.platform === 'win32' ? 'C:/repo' : '/repo';
  assert.equal(insideRepo(`${repo}/backup`, repo), true);
  assert.equal(insideRepo(repo, repo), true);
  assert.equal(insideRepo(`${repo}/../elsewhere`, repo), false);
  if (process.platform === 'win32') assert.equal(insideRepo('G:/AdulisDevelopment/x', repo), false);
});

// A GNU-format tar, as `tar -cf` writes it, including a long-name entry.
function header(name, size, type) {
  const h = Buffer.alloc(512);
  h.write(name.slice(0, 99), 0);
  h.write('0000644\0', 100);
  h.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
  h.write(type, 156);
  h.write('ustar  \0', 257);
  h.fill(32, 148, 156);
  h.write(
    `${h
      .reduce((s, b) => s + b, 0)
      .toString(8)
      .padStart(6, '0')}\0 `,
    148,
  );
  return h;
}
const pad = (b) => Buffer.concat([b, Buffer.alloc((512 - (b.length % 512)) % 512)]);
function makeTar(entries) {
  const parts = [];
  for (const [name, data = null] of entries) {
    if (name.length > 99)
      parts.push(header('././@LongLink', name.length + 1, 'L'), pad(Buffer.from(`${name}\0`)));
    parts.push(header(name, data ? data.length : 0, data ? '0' : '5'));
    if (data) parts.push(pad(data));
  }
  return Buffer.concat([...parts, Buffer.alloc(1024)]);
}
const reader = (buf) => (off, len) => buf.subarray(off, off + len);
const long = `./adulis-media/media/${'d'.repeat(40)}/${'f'.repeat(40)}.jpg/xl.meta`;
const full = makeTar([
  ['./'],
  ...BACKUP_MUST_HOLD.map((n) => [`./${n}`, n.endsWith('/') ? null : Buffer.from('x')]),
  [long, Buffer.from('meta')],
]);

test('a complete backup lists every entry, long names included', () => {
  const names = tarEntries(reader(full));
  for (const n of BACKUP_MUST_HOLD) assert.ok(names.includes(n), n);
  assert.ok(names.includes(long.slice(2)));
});

test('a cut-short or corrupt backup refuses', () => {
  refuses(() => tarEntries(reader(full.subarray(0, full.length - 1024))), /truncated/);
  refuses(() => tarEntries(reader(full.subarray(0, full.length - 512))), /one end block of two/);
  refuses(() => tarEntries(reader(full.subarray(0, 1536 + 100))), /truncated/);
  const bad = Buffer.from(full);
  bad[512 + 10] ^= 0xff;
  refuses(() => tarEntries(reader(bad)), /corrupt/);
});

const stat = (name, size, etag, meta = { 'Content-Type': 'image/jpeg' }) =>
  `S ${JSON.stringify({ status: 'success', type: 'file', name, size, etag, metadata: meta })}`;
const invText = (extra = []) =>
  [
    'B {"key":"adulis-evidence/"}',
    'B {"key":"adulis-media/"}',
    stat('adulis-media/m/a.jpg', 3, 'e1'),
    'H adulis-media aaa m/a.jpg',
    stat('adulis-evidence/evidence/raw/x', 2, 'e2', { 'Content-Type': 'application/octet-stream' }),
    'H adulis-evidence bbb evidence/raw/x',
    'P adulis-media {"Statement":[{"Action":["s3:GetObject"],"Effect":"Allow"}]}',
    'P adulis-evidence {}',
    'L adulis-media {}',
    'L adulis-evidence {"Rules":[{"ID":"a","Expiration":{"Days":1},"Filter":{"Prefix":"evidence/raw/"},"Status":"Enabled"}]}',
    ...extra,
  ].join('\n');

test('an inventory joins listing and content hashes, and refuses gaps', () => {
  const inv = parseInventory(invText());
  assert.deepEqual(inv.buckets, ['adulis-evidence', 'adulis-media']);
  assert.equal(inv.objects.get('adulis-media/m/a.jpg').sha256, 'aaa');
  refuses(
    () => parseInventory(invText([stat('adulis-media/m/b.jpg', 1, 'e3')])),
    /could not be read back/,
  );
  refuses(() => parseInventory(invText(['H adulis-media ccc m/c.jpg'])), /not listed/);
  refuses(
    () => parseInventory(invText(['S {"status":"error","type":"file","name":"x"}'])),
    /unexpected stat/,
  );
  refuses(() => parseInventory(invText(['mc: <ERROR> something'])), /unexpected line/);
});

test('every kind of difference between source and target is reported', () => {
  const a = parseInventory(invText());
  assert.deepEqual(compareObjects(a, parseInventory(invText())), []);
  const mutate = (fn) => {
    const b = parseInventory(invText());
    fn(b.objects);
    return compareObjects(a, b).join('\n');
  };
  assert.match(
    mutate((o) => o.delete('adulis-media/m/a.jpg')),
    /missing: adulis-media\/m\/a.jpg/,
  );
  assert.match(
    mutate((o) => o.set('adulis-media/new', { size: 1, etag: 'x', sha256: 'y', meta: {} })),
    /unexpected: adulis-media\/new/,
  );
  assert.match(
    mutate((o) => (o.get('adulis-media/m/a.jpg').size = 4)),
    /size differs/,
  );
  assert.match(
    mutate((o) => (o.get('adulis-media/m/a.jpg').etag = 'zz')),
    /etag differs/,
  );
  assert.match(
    mutate((o) => (o.get('adulis-media/m/a.jpg').sha256 = 'zz')),
    /sha256 differs/,
  );
  assert.match(
    mutate((o) => (o.get('adulis-media/m/a.jpg').meta = { 'Content-Type': 'text/plain' })),
    /metadata differs/,
  );
});

test('lifecycle rules compare as a set, IDs and duplicates ignored', () => {
  const r = (id) => ({
    ID: id,
    Expiration: { Days: 1 },
    Filter: { Prefix: 'evidence/raw/' },
    Status: 'Enabled',
  });
  assert.deepEqual(ruleSet({ Rules: [r('a'), r('b'), r('c')] }), [
    'Days=1 Prefix=evidence/raw/ Enabled',
  ]);
  assert.deepEqual(ruleSet({}), []);
});

const goodProbes = (over = {}) => ({
  results: {
    'read-media': 'ALLOWED',
    'list-media': 'DENIED',
    'write-media': 'DENIED',
    'list-evidence': 'DENIED',
    'read-evidence': 'DENIED',
    'write-evidence': 'DENIED',
    ...over,
  },
  mediaKey: 'm/a.jpg',
  mediaSha: 'aaa',
});

test('the target must be exactly the two buckets, private evidence, the expiry rule, and deny by probe', () => {
  const src = parseInventory(invText());
  assert.deepEqual(checkTarget(parseInventory(invText()), src, goodProbes()), []);
  // The media bucket serves single objects only; listing it is an exposure (ISSUE-INFRA-013).
  assert.match(
    checkTarget(parseInventory(invText()), src, goodProbes({ 'list-media': 'ALLOWED' })).join(),
    /list-media: ALLOWED, expected DENIED/,
  );
  const phantom = parseInventory(invText(['B {"key":"pg_wal/"}']));
  assert.match(checkTarget(phantom, src, goodProbes()).join(), /expected exactly/);
  const open = parseInventory(
    invText().replace(
      'P adulis-evidence {}',
      'P adulis-evidence {"Statement":[{"Effect":"Allow"}]}',
    ),
  );
  assert.match(checkTarget(open, src, goodProbes()).join(), /anonymous policy/);
  const noRule = parseInventory(invText().replace(/L adulis-evidence .*/, 'L adulis-evidence {}'));
  assert.match(checkTarget(noRule, src, goodProbes()).join(), /lifecycle differs/);
  assert.match(checkTarget(noRule, src, goodProbes()).join(), /lacks the rule/);
  // A probe that errors (server unreachable) is not a denial.
  assert.match(
    checkTarget(parseInventory(invText()), src, goodProbes({ 'read-evidence': 'ERROR' })).join(),
    /read-evidence: ERROR, expected DENIED/,
  );
  assert.match(
    checkTarget(parseInventory(invText()), src, goodProbes({ 'write-evidence': 'ALLOWED' })).join(),
    /write-evidence/,
  );
  assert.match(
    checkTarget(parseInventory(invText()), src, { ...goodProbes(), mediaSha: 'zzz' }).join(),
    /different bytes/,
  );
});

test('a recorded checksum is read strictly: BOM, blanks, exact name, real hash', () => {
  const h = 'a'.repeat(64);
  assert.equal(recordedSha(`\uFEFF${h} *x.tar\n`, 'x.tar'), h);
  assert.equal(recordedSha(`  ${h}  x.tar\r\n`, 'x.tar'), h);
  assert.equal(recordedSha(`${'b'.repeat(64)} *yx.tar\n${h} *x.tar\n`, 'x.tar'), h);
  refuses(() => recordedSha(`${'b'.repeat(64)} *yx.tar\n`, 'x.tar'), /no well-formed/);
  refuses(() => recordedSha(`xyz *x.tar\n`, 'x.tar'), /no well-formed/);
  refuses(() => recordedSha('', 'x.tar'), /no well-formed/);
});

test('verifying a backup without a recorded hash refuses before reading it', async () => {
  await assert.rejects(
    verifyBackup('does-not-matter.tar', ''),
    (e) => e instanceof Refusal && /no recorded SHA-256/.test(e.message),
  );
});

test('the media bucket may grant anonymous GetObject and nothing else', () => {
  const src = parseInventory(invText());
  const listable = parseInventory(
    invText().replace(
      /P adulis-media .*/,
      'P adulis-media {"Statement":[{"Action":["s3:GetObject","s3:ListBucket"],"Effect":"Allow"}]}',
    ),
  );
  assert.match(checkTarget(listable, src, goodProbes()).join(), /only s3:GetObject is intended/);
});

// ---------- WO-INFRA-015A ----------

test('the live source shape passes: the two buckets plus the 17 PostgreSQL directories (19 on the server)', () => {
  assert.equal(POSTGRES_DIRS.length, 17);
  const live = { buckets: [...BUCKETS, ...POSTGRES_DIRS] };
  assert.equal(live.buckets.length, 19);
  assert.deepEqual(sourceBucketProblems(live), []);
  assert.deepEqual(sourceBucketProblems({ buckets: ['adulis-media'] }), []); // a missing bucket loses nothing
});

test('any other bucket on the source refuses, named, and is never deleted', () => {
  const p = sourceBucketProblems({ buckets: [...BUCKETS, 'base', 'adulis-legacy-uploads', 'tmp'] });
  assert.equal(p.length, 2);
  assert.match(p[0], /unexpected bucket adulis-legacy-uploads .*left behind.*nothing was deleted/);
  assert.match(p[1], /unexpected bucket tmp /);
  // Case and look-alikes are not the PostgreSQL directories.
  assert.equal(sourceBucketProblems({ buckets: ['Base', 'pg_wal2', 'adulis-media-old'] }).length, 3);
});

// ---------- INF-04: the two-phase move record, the undo verdict, recover and rollback reruns ----------

test('recover on the live volume needs the approval too; pauses never reach it (INF-04)', () => {
  refuses(() => guard('recover', 'adulis-pgdata', {}), /founder's approval/);
  assert.equal(guard('recover', 'adulis-pgdata', { MIGRATE_LIVE: 'approved' }), true);
  for (const p of PAUSE_POINTS) {
    assert.equal(guard('migrate', 'infra-rh-src', { MIGRATE_PAUSE: `${p}:30` }), false, p);
    refuses(() => guard('migrate', 'adulis-pgdata', { MIGRATE_LIVE: 'approved', MIGRATE_PAUSE: `${p}:30` }), /rehearsals only/);
  }
  for (const bad of ['before-switch', 'switch:30', 'before-switch:abc', 'before-switch:601', 'before-switch:-1'])
    refuses(() => guard('migrate', 'infra-rh-src', { MIGRATE_PAUSE: bad }), /MIGRATE_PAUSE must be/);
});

test('every INF-04 fault and hard kill is a rehearsal fault, never the live volume', () => {
  const inf04 = ['fail-image-save', 'fail-source-stop', 'fail-backup', 'fail-target-create', 'fail-copy', 'fail-record-write', 'fail-after-switch', 'fail-commit', 'fail-clear-record-1', 'fail-clear-record-2', 'fail-clear-record-all', 'fail-rollback-invalidate', 'fail-rollback-restore', 'kill-before-switch', 'kill-after-switch', 'kill-in-undo', 'kill-after-commit', 'kill-rollback-after-invalidate', 'kill-rollback-after-legacy'];
  for (const f of inf04) {
    assert.equal(guard('migrate', 'infra-rh-src', { MIGRATE_FAULT: f }), false, f);
    for (const cmd of ['migrate', 'rollback', 'recover'])
      refuses(() => guard(cmd, 'adulis-pgdata', { MIGRATE_LIVE: 'approved', MIGRATE_FAULT: f }), /rehearsals only/);
  }
});

test('the move record: only `pending <run>` and `complete <run>` count; anything else is unknown', () => {
  assert.deepEqual(parseRecord('pending 20261116120000-abcd'), { state: 'pending', run: '20261116120000-abcd' });
  assert.deepEqual(parseRecord('complete 20261116120000-abcd\n'), { state: 'complete', run: '20261116120000-abcd' });
  for (const bad of ['', '{}', '{"run":"x"}', 'complete', 'complete x', 'COMPLETE 20261116120000-abcd', 'done 20261116120000-abcd', 'pending 20261116120000-abcd extra', undefined])
    assert.deepEqual(parseRecord(bad), { state: 'unknown', run: null }, String(bad));
  // Distinct names: the guard refuses a volume holding either renamed-aside record beside a record.
  assert.equal(new Set([MOVE_RECORD, INVALIDATED_RECORD, ROLLED_BACK_RECORD]).size, 3);
});

test('record clearing is bounded: a few attempts within seconds, never a loop', () => {
  assert.ok(CLEAR_DELAYS_S.length >= 2 && CLEAR_DELAYS_S.length <= 6);
  assert.ok(CLEAR_DELAYS_S.reduce((a, b) => a + b, 0) <= 30);
});

test('the undo verdict never claims more than was verified (INF-04 B5)', () => {
  const base = { changed: true, failedSteps: [], record: 'ok', answers: true, port: '9100' };
  assert.match(undoVerdict(base).outcome, /^UNDO OK/);
  assert.equal(undoVerdict(base).manualInterventionRequired, false);
  assert.match(undoVerdict({ ...base, changed: false }).outcome, /^NOTHING CHANGED/);
  const stuck = undoVerdict({ ...base, record: 'not-cleared' });
  assert.match(stuck.outcome, /^UNDO PARTIAL/);
  assert.equal(stuck.manualInterventionRequired, true);
  assert.match(stuck.manual.join('\n'), /PENDING move record could not be cleared/);
  const dark = undoVerdict({ ...base, answers: false });
  assert.match(dark.outcome, /^UNDO INCOMPLETE: nothing answers on port 9100/);
  assert.equal(dark.manualInterventionRequired, true);
  // A failure before anything changed, with the source no longer answering, is still incomplete.
  assert.match(undoVerdict({ ...base, changed: false, answers: false }).outcome, /^UNDO INCOMPLETE/);
  const step = undoVerdict({ ...base, failedSteps: ['restore the old MinIO'] });
  assert.match(step.outcome, /^UNDO PARTIAL/);
  assert.match(step.manual.join('\n'), /undo step failed: restore the old MinIO/);
});

test('recover: what it does in each state a killed migrate can leave, never deleting a volume', () => {
  const ids = { legacyId: 'L', srcVolume: 'src', dstVolume: 'dst' };
  const plan = (current, extra = {}) => recoveryPlan({ ...ids, current, recordPresent: false, failedNameTaken: false, ...extra });
  // Killed before the switch: the old container still exists (stopped or running).
  assert.deepEqual(plan({ id: 'L', mount: 'src', running: false }).actions, ['remove-helpers', 'start-legacy']);
  assert.deepEqual(plan({ id: 'L', mount: 'src', running: true }).actions, ['remove-helpers']);
  // Killed in the switch window with the record pending: compose's new container serves the target.
  assert.deepEqual(plan({ id: 'N', mount: 'dst', running: true }, { recordPresent: true }).actions, ['invalidate-record', 'remove-helpers', 'stop-new', 'set-aside-new', 'recreate-legacy']);
  // Killed in the undo after the new one was set aside, before the old one came back.
  assert.deepEqual(plan(null).actions, ['remove-helpers', 'recreate-legacy']);
  // An earlier undo or recover already recreated the old one: repeatable, nothing new.
  assert.deepEqual(plan({ id: 'R', mount: 'src', running: true }).actions, ['remove-helpers']);
  assert.deepEqual(plan({ id: 'R', mount: 'src', running: false }).actions, ['remove-helpers', 'start-legacy']);
  // Unknown shapes are refused, never guessed.
  assert.match(plan({ id: 'X', mount: 'other', running: true }).refuse, /neither the source nor the target/);
  assert.match(plan({ id: 'N', mount: 'dst', running: true }, { failedNameTaken: true }).refuse, /name for setting it aside is taken/);
  for (const r of [plan(null), plan({ id: 'N', mount: 'dst', running: true }, { recordPresent: true })])
    assert.ok(!r.actions.some((a) => /volume|delete|rm/.test(a)), 'recover never deletes a volume');
  // Killed after its verified commit (record complete, the new MinIO serving): migrated, nothing undone.
  assert.deepEqual(plan({ id: 'N', mount: 'dst', running: true }, { recordPresent: true, recordState: 'complete' }), { reconcile: true, actions: [] });
  assert.match(plan({ id: 'N', mount: 'dst', running: false }, { recordPresent: true, recordState: 'complete' }).refuse, /complete but the new MinIO is stopped/);
  // A pending record is never a migration: undone as any other unfinished run.
  assert.ok(plan({ id: 'N', mount: 'dst', running: true }, { recordPresent: true, recordState: 'pending' }).actions.includes('recreate-legacy'));
});

test('MIGRATE_FAULT may combine faults; each must be known, and none reaches the live volume', () => {
  assert.equal(guard('migrate', 'infra-rh-src', { MIGRATE_FAULT: 'fail-before-switch,fail-clear-record-all' }), false);
  assert.equal(guard('migrate', 'infra-rh-src', { MIGRATE_FAULT: ' fail-after-switch , fail-clear-record-2 ' }), false);
  refuses(() => guard('migrate', 'infra-rh-src', { MIGRATE_FAULT: 'fail-before-switch,typo' }), /unknown MIGRATE_FAULT typo/);
  refuses(() => guard('migrate', 'adulis-pgdata', { MIGRATE_LIVE: 'approved', MIGRATE_FAULT: 'fail-before-switch,fail-clear-record-all' }), /rehearsals only/);
  assert.deepEqual(faultsOf({ MIGRATE_FAULT: 'a, b,,c' }), ['a', 'b', 'c']);
  assert.deepEqual(faultsOf({}), []);
});

test('rollback rerun: a rollback killed part-way is finished, an unknown state is refused (INF01-007)', () => {
  const v = { srcVolume: 'src', dstVolume: 'dst' };
  assert.equal(rollbackRerun({ ...v, current: { mount: 'dst' }, record: 'absent', kept: false }), 'proceed');
  assert.equal(rollbackRerun({ ...v, current: { mount: 'dst' }, record: 'complete', kept: false }), 'proceed');
  // Killed after the old MinIO came back but before the record was renamed (the order before INF-04).
  assert.equal(rollbackRerun({ ...v, current: { mount: 'src' }, record: 'complete', kept: true }), 'clear-record');
  assert.equal(rollbackRerun({ ...v, current: { mount: 'src' }, record: 'absent', kept: true }), 'already-rolled-back');
  // Killed after the new one was stopped and renamed, before the old one was recreated.
  assert.equal(rollbackRerun({ ...v, current: null, record: 'absent', kept: true }), 'recreate-legacy');
  assert.equal(rollbackRerun({ ...v, current: null, record: 'absent', kept: false }), 'refuse');
  assert.equal(rollbackRerun({ ...v, current: { mount: 'other' }, record: 'absent', kept: true }), 'refuse');
});

test('the interrupt and partial-rollback rehearsal faults exist and never reach the live volume', () => {
  for (const f of ['interrupt-preflight', 'interrupt-backup', 'interrupt-hash', 'interrupt-copy', 'interrupt-switch', 'fail-rollback', 'fail-before-switch']) {
    assert.equal(guard('migrate', 'infra-rh-src', { MIGRATE_FAULT: f }), false, f);
    refuses(() => guard('migrate', 'adulis-pgdata', { MIGRATE_LIVE: 'approved', MIGRATE_FAULT: f }), /rehearsals only/);
  }
});

test('an interrupt is acted on: every later checkpoint refuses and in-flight streams abort', () => {
  const said = [];
  const i = createInterruption((m) => said.push(m));
  i.checkpoint(); // nothing yet: no refusal
  assert.equal(i.abortSignal.aborted, false);
  i.on('SIGINT');
  assert.equal(i.signal, 'SIGINT');
  assert.equal(i.abortSignal.aborted, true);
  assert.ok(i.abortSignal.reason instanceof Refusal);
  refuses(() => i.checkpoint(), /interrupted by SIGINT: stopped before the next step/);
  refuses(() => i.checkpoint(), /interrupted by SIGINT/); // and keeps refusing
  i.on('SIGTERM'); // a second one is acknowledged, never acted on
  assert.equal(i.signal, 'SIGINT');
  assert.match(said.at(-1), /SIGTERM again: still stopping safely/);
});

test('after the run has finished, an interrupt changes nothing and says so', () => {
  const said = [];
  const i = createInterruption((m) => said.push(m));
  i.finished = true;
  i.on('SIGINT');
  assert.equal(i.signal, null);
  i.checkpoint(); // no refusal
  assert.match(said.at(-1), /after the run had finished: nothing to stop or undo/);
});

test('a real SIGINT during a synchronous step is seen at the next checkpoint, not lost', { skip: process.platform === 'win32' && 'Windows cannot deliver SIGINT to another process', timeout: 30_000 }, async () => {
  const lib = fileURLToPath(new URL('./minio-migrate.mjs', import.meta.url));
  // The step is a spawnSync, as every docker call is: the signal arrives while the loop is blocked.
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const { createInterruption, turnEventLoop } = await import(${JSON.stringify(`file://${lib}`)});
       const { spawnSync } = await import('node:child_process');
       const i = createInterruption(() => {});
       process.on('SIGINT', () => i.on('SIGINT'));
       console.log('ready');
       spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 1500)']);
       const before = i.signal;
       await turnEventLoop();
       try { i.checkpoint(); console.log('NOT REFUSED'); } catch (e) { console.log('REFUSED before=' + before + ' ' + e.message); }`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const killer = setTimeout(() => child.kill('SIGKILL'), 25_000);
  let out = '';
  await new Promise((ok) => child.stdout.on('data', (d) => ((out += d), out.includes('ready') && ok())));
  child.kill('SIGINT');
  const code = await new Promise((ok) => child.on('close', ok));
  clearTimeout(killer);
  assert.equal(code, 0, 'the process survived the signal');
  // Not visible before the loop turned; refused right after.
  assert.match(out, /REFUSED before=null interrupted by SIGINT/);
});
