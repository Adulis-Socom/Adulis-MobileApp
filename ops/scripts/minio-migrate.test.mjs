// The fail-closed checks of ops/scripts/minio-migrate.mjs (WO-INFRA-007). The docker-driven parts
// are rehearsed end to end on disposable copies (docs/infrastructure/WO-INFRA-007-MIGRATION-VALIDATION.md);
// these tests pin the decisions that must refuse.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BACKUP_MUST_HOLD,
  Refusal,
  checkTarget,
  compareObjects,
  guard,
  insideRepo,
  parseInventory,
  recordedSha,
  ruleSet,
  tarEntries,
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
