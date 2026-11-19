// The restoration journal: a durable, append-only record in the run directory of every device change,
// written BEFORE the change is made. Each line carries a hash of the line before it, so a line that was
// cut short by a kill is recognised (and skipped: its change was never made, because the change is sent
// only after the write returned) while a line that was removed or altered breaks the chain and makes the
// journal unusable. An unusable journal is never guessed at: restoring stops and says so.
//
// Lines: begin {run, serial, device}, intend {id, setting, original, target},
//        applied {id}, not-applied {id}, restored {id, how}, restore-failed {id, why}, end {outcome}.
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';

export const JOURNAL_FILE = 'device-journal.ndjson';
export const journalPath = (dir) => join(dir, JOURNAL_FILE);
const hash = (line) => createHash('sha256').update(line).digest('hex').slice(0, 16);

/** Reads the journal: the valid entries, how many torn lines were skipped, and whether the chain is broken. */
export function readJournal(dir) {
  const out = {
    exists: false,
    entries: [],
    torn: 0,
    corrupt: null,
    endsClean: true,
    lastHash: '0',
  };
  const path = journalPath(dir);
  if (!existsSync(path)) return out;
  out.exists = true;
  const raw = readFileSync(path, 'utf8');
  out.endsClean = raw === '' || raw.endsWith('\n');
  let last = '0';
  for (const [i, line] of raw.split('\n').entries()) {
    if (line === '') continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      out.torn += 1;
      continue;
    }
    if (e?.prev !== last) {
      out.corrupt = `line ${i + 1} does not follow the line before it: the journal was altered or cut`;
      break;
    }
    out.entries.push(e);
    last = hash(line);
  }
  out.lastHash = last;
  return out;
}

/**
 * Appends one line and does not return before ALL of it is on disk: a write that took fewer bytes than the
 * line is an error (the change that was to follow must not be made). `write` is the writer (tests give a
 * short one). Returns the line's sequence number.
 */
export function appendEntry(dir, entry, now = () => new Date().toISOString(), write = writeSync) {
  mkdirSync(dir, { recursive: true });
  const j = readJournal(dir);
  if (j.corrupt) throw new Error(`the device journal is unusable: ${j.corrupt}`);
  const seq = (j.entries.at(-1)?.seq ?? 0) + 1;
  const line = JSON.stringify({ v: 1, seq, at: now(), prev: j.lastHash, ...entry });
  const fd = openSync(journalPath(dir), 'a');
  try {
    // A cut-short last line is closed off first, so the new line starts on a line of its own.
    const bytes = Buffer.from(`${j.endsClean ? '' : '\n'}${line}\n`);
    const n = write(fd, bytes);
    if (n !== bytes.length)
      throw new Error(`the journal took ${n} of ${bytes.length} bytes: nothing was changed`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return seq;
}

/**
 * The journal as the changes it records: { changes: [{ id, setting, original, target, state, seq }] in
 * the order they were made, begin: the last `begin`, ... }. A change is open when it was intended and not
 * restored: `intended` (the outcome is unknown, so it is treated as possibly made), `applied`, or
 * `restore-failed`.
 */
export function summarize(dir) {
  const j = readJournal(dir);
  const byId = new Map();
  let begin = null;
  for (const e of j.entries) {
    if (e.op === 'begin') begin = e;
    else if (e.op === 'intend')
      byId.set(e.id, {
        id: e.id,
        setting: e.setting,
        original: e.original,
        target: e.target,
        state: 'intended',
        seq: e.seq,
      });
    else if (byId.has(e.id)) {
      const c = byId.get(e.id);
      if (e.op === 'applied') c.state = 'applied';
      else if (e.op === 'not-applied') c.state = 'not-applied';
      else if (e.op === 'restored') c.state = 'restored';
      else if (e.op === 'restore-failed') {
        c.state = 'restore-failed';
        c.why = e.why;
      }
    }
  }
  const changes = [...byId.values()];
  return {
    exists: j.exists,
    torn: j.torn,
    corrupt: j.corrupt,
    begin,
    changes,
    open: changes.filter((c) => ['intended', 'applied', 'restore-failed'].includes(c.state)),
  };
}

export const nextChangeId = (dir) => `c${summarize(dir).changes.length + 1}`;
