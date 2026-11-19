// The restoration journal is the only record of what the device looked like before a run: it must be
// durable, it must survive a line cut short by a kill, and it must refuse to be guessed at when a line
// was altered or removed.
import assert from 'node:assert/strict';
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appendEntry, journalPath, nextChangeId, readJournal, summarize } from '../lib/journal.mjs';

const dirs = [];
const rig = () => {
  const d = mkdtempSync(join(tmpdir(), 'native-j-'));
  dirs.push(d);
  return d;
};
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const lines = (dir) => readFileSync(journalPath(dir), 'utf8').split('\n').filter(Boolean);

const intend = (id = 'c1', setting = 'font_scale') => ({
  op: 'intend',
  id,
  setting,
  original: { present: true, value: '1.0' },
  target: { present: true, value: '1.3' },
});

test('every line is on disk when append returns, numbered, timestamped and chained to the one before', () => {
  const d = rig();
  assert.equal(appendEntry(d, { op: 'begin', run: 'r', serial: 's', device: {} }), 1);
  assert.equal(appendEntry(d, intend()), 2);
  const [a, b] = lines(d).map((l) => JSON.parse(l));
  assert.equal(a.prev, '0');
  assert.notEqual(b.prev, '0');
  assert.match(a.at, /^\d{4}-\d\d-\d\dT/);
  assert.equal(readJournal(d).corrupt, null);
});

test('the append writes through to disk: the source flushes before it returns', () => {
  // A unit test cannot observe an fsync, so the source is pinned: the write is followed by a flush and
  // only then is the file closed (the change is sent after append returns).
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'journal.mjs'),
    'utf8',
  );
  assert.match(
    src,
    /write\(fd, bytes\);[\s\S]*?\n\s*fsyncSync\(fd\);\r?\n\s*\} finally \{\r?\n\s*closeSync\(fd\);/,
  );
});

test('a write that took fewer bytes than the line stops the change, and the line it cut short is closed off', () => {
  const d = rig();
  appendEntry(d, { op: 'begin', run: 'r', serial: 's', device: {} });
  const short = (fd, bytes) => writeSync(fd, bytes.subarray(0, bytes.length - 9));
  assert.throws(
    () => appendEntry(d, intend('c1'), undefined, short),
    /the journal took \d+ of \d+ bytes: nothing was changed/,
  );
  // the intent was never fully written: the journal has no open change and still reads as intact
  assert.equal(readJournal(d).corrupt, null);
  assert.deepEqual(summarize(d).open, []);
  // the next line starts on a line of its own and the chain goes on
  assert.equal(appendEntry(d, intend('c2')), 2);
  assert.deepEqual(
    summarize(d).open.map((c) => c.id),
    ['c2'],
  );
  // a writer that took nothing at all is refused the same way
  assert.throws(() => appendEntry(d, { op: 'end' }, undefined, () => 0), /took 0 of/);
});

test('a change is open from its intent until it is restored; a failed write that left nothing is not open', () => {
  const d = rig();
  appendEntry(d, { op: 'begin', run: 'r', serial: 's', device: {} });
  appendEntry(d, intend('c1', 'font_scale'));
  assert.deepEqual(
    summarize(d).open.map((c) => [c.id, c.state]),
    [['c1', 'intended']],
  );
  appendEntry(d, { op: 'applied', id: 'c1' });
  assert.equal(summarize(d).open[0].state, 'applied');
  appendEntry(d, intend('c2', 'density'));
  appendEntry(d, { op: 'not-applied', id: 'c2' });
  assert.deepEqual(
    summarize(d).open.map((c) => c.id),
    ['c1'],
  );
  appendEntry(d, { op: 'restore-failed', id: 'c1', why: 'x' });
  assert.equal(summarize(d).open[0].state, 'restore-failed', 'a failed restore stays open');
  appendEntry(d, { op: 'restored', id: 'c1', how: 'set' });
  assert.deepEqual(summarize(d).open, []);
  assert.equal(nextChangeId(d), 'c3');
});

test('a line cut short by a kill is skipped, the next line starts on its own line, and nothing else is lost', () => {
  const d = rig();
  appendEntry(d, { op: 'begin', run: 'r', serial: 's', device: {} });
  appendEntry(d, intend('c1'));
  appendFileSync(journalPath(d), '{"v":1,"seq":3,"op":"appl'); // a write that never finished
  let j = readJournal(d);
  assert.equal(j.torn, 1);
  assert.equal(j.corrupt, null);
  assert.deepEqual(
    summarize(d).open.map((c) => c.id),
    ['c1'],
    'the intent before the cut is intact',
  );
  appendEntry(d, { op: 'applied', id: 'c1' });
  j = readJournal(d);
  assert.equal(j.corrupt, null, 'a journal that was cut once is still usable');
  assert.equal(j.torn, 1);
  assert.equal(summarize(d).open[0].state, 'applied');
});

test('a removed, altered or reordered line breaks the chain and the journal is unusable', () => {
  const rewrite = (d, fn) => writeFileSync(journalPath(d), `${fn(lines(d)).join('\n')}\n`);
  const build = () => {
    const d = rig();
    appendEntry(d, { op: 'begin', run: 'r', serial: 's', device: {} });
    appendEntry(d, intend('c1'));
    appendEntry(d, { op: 'applied', id: 'c1' });
    appendEntry(d, intend('c2', 'density'));
    return d;
  };
  const removed = build();
  rewrite(removed, (l) => [l[0], l[2], l[3]]);
  assert.match(readJournal(removed).corrupt ?? '', /does not follow/);
  const altered = build();
  rewrite(altered, (l) => [l[0], l[1].replace('"1.3"', '"2.0"'), l[2], l[3]]);
  assert.match(readJournal(altered).corrupt ?? '', /does not follow/);
  const swapped = build();
  rewrite(swapped, (l) => [l[0], l[2], l[1], l[3]]);
  assert.match(readJournal(swapped).corrupt ?? '', /does not follow/);
  const mangled = build();
  rewrite(mangled, (l) => [l[0], 'not json at all', l[2], l[3]]);
  assert.match(
    readJournal(mangled).corrupt ?? '',
    /does not follow/,
    'a mangled middle line is not mistaken for a cut tail',
  );
  for (const d of [removed, altered, swapped, mangled]) {
    assert.throws(() => appendEntry(d, { op: 'end' }), /journal is unusable/);
    assert.ok(summarize(d).corrupt);
  }
});

test('a journal that does not exist is empty, not an error', () => {
  const d = rig();
  assert.deepEqual(summarize(d).open, []);
  assert.equal(readJournal(d).exists, false);
  assert.equal(nextChangeId(d), 'c1');
});
