// The session lock of a run: a live session refuses everything that would change the stack or the device,
// a lock that cannot be read is a lock that is held, the lock is created atomically, and a Maestro process
// that outlived its session is found and stopped by its recorded identity, never by its number alone.
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Refused } from '../lib/guard.mjs';
import {
  acquireLock,
  clearMaestro,
  guardSession,
  lockHeld,
  reapOrphan,
  recordMaestro,
  releaseLock,
} from '../lib/lock.mjs';

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const MAESTRO = { pid: 200, createdAt: 'c-200', commandLine: 'java maestro.cli.AppKt' };
function rig() {
  const dir = mkdtempSync(join(tmpdir(), 'native-l-'));
  dirs.push(dir);
  const procs = {
    100: { createdAt: 'c-100', commandLine: 'node harness.mjs' },
    101: { createdAt: 'c-101', commandLine: 'node harness.mjs' },
    200: { createdAt: MAESTRO.createdAt, commandLine: MAESTRO.commandLine },
  };
  const kills = [];
  const world = { stubborn: false, failLookup: new Set() };
  const io = {
    proc: {
      info: async (pid) => {
        if (world.failLookup.has(pid)) throw new Error('lookup failed');
        return procs[pid] ?? { createdAt: null, commandLine: '' };
      },
      kill: (pid) => {
        kills.push(pid);
        if (!world.stubborn) delete procs[pid];
      },
    },
  };
  return { dir, procs, kills, io, world };
}
const file = (dir) => join(dir, 'native.lock');
const put = (dir, rec) =>
  writeFileSync(file(dir), typeof rec === 'string' ? rec : JSON.stringify(rec));
const rejects = (p, re) =>
  assert.rejects(p, (e) => e instanceof Refused && re.test(e.message), `${re}`);

test('no lock is not held; the lock of a live process is held; the lock of a gone or reused process is stale', async () => {
  const r = rig();
  assert.deepEqual(await lockHeld(r.dir, r.io), { held: false });
  put(r.dir, { pid: 100, createdAt: 'c-100' });
  assert.deepEqual(await lockHeld(r.dir, r.io), { held: true, pid: 100 });
  put(r.dir, { pid: 100, createdAt: 'an earlier process with this number' });
  assert.deepEqual(await lockHeld(r.dir, r.io), { held: false, stale: true });
  put(r.dir, { pid: 999, createdAt: 'c-999' });
  assert.deepEqual(await lockHeld(r.dir, r.io), { held: false, stale: true });
});

test('a lock that cannot be read is a lock that is held: acquiring is refused and the file is left alone', async () => {
  for (const [what, make] of [
    ['garbage', (d) => put(d, 'not json at all')],
    ['an empty file', (d) => put(d, '')],
    ['an object without a pid', (d) => put(d, { createdAt: 'c' })],
    ['a pid that is not a number', (d) => put(d, { pid: '100', createdAt: 'c-100' })],
    ['no creation time', (d) => put(d, { pid: 100 })],
    ['an array', (d) => put(d, [100])],
    ['a directory in its place', (d) => mkdirSync(file(d))],
  ]) {
    const r = rig();
    make(r.dir);
    const h = await lockHeld(r.dir, r.io);
    assert.equal(h.held, true, what);
    assert.equal(h.unknown, true, what);
    assert.match(h.why, /lock file/, what);
    await rejects(acquireLock(r.dir, r.io, 101), /an unreadable lock\) holds this run/);
    assert.ok(existsSync(file(r.dir)), `${what}: the lock was not removed`);
    await rejects(guardSession(r.dir, r.io), /lock that cannot be read holds this run/);
  }
});

test('a process lookup that fails is held, not stale', async () => {
  const r = rig();
  put(r.dir, { pid: 100, createdAt: 'c-100' });
  r.world.failLookup.add(100);
  const h = await lockHeld(r.dir, r.io);
  assert.deepEqual([h.held, h.unknown], [true, true]);
  assert.match(h.why, /could not be looked up \(lookup failed\)/);
  r.world.failLookup.clear();
  put(r.dir, { pid: 999, createdAt: 'c', maestro: MAESTRO });
  r.world.failLookup.add(200);
  const m = await lockHeld(r.dir, r.io);
  assert.deepEqual([m.held, m.unknown], [true, true]);
  assert.match(m.why, /Maestro process could not be looked up/);
});

test('the lock is created atomically: of two sessions that start together exactly one gets it', async () => {
  const r = rig();
  const results = await Promise.allSettled([
    acquireLock(r.dir, r.io, 100),
    acquireLock(r.dir, r.io, 101),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), ['fulfilled', 'rejected']);
  const won = results.find((x) => x.status === 'fulfilled').value;
  assert.deepEqual(JSON.parse(readFileSync(file(r.dir), 'utf8')), won);
  assert.deepEqual(Object.keys(won).sort(), ['createdAt', 'pid']);
  const lost = results.find((x) => x.status === 'rejected').reason;
  assert.ok(lost instanceof Refused);
  assert.match(lost.message, /another native session \(pid \d+\) holds this run/);
});

test('the dead holder of a lock is replaced; release removes the lock and releasing it twice is fine', async () => {
  const r = rig();
  put(r.dir, { pid: 999, createdAt: 'long gone' });
  const me = await acquireLock(r.dir, r.io, 100);
  assert.equal(me.pid, 100);
  await rejects(acquireLock(r.dir, r.io, 101), /another native session \(pid 100\) holds this run/);
  releaseLock(r.dir);
  assert.ok(!existsSync(file(r.dir)));
  releaseLock(r.dir);
  // a process that cannot be identified takes no lock
  await rejects(acquireLock(r.dir, r.io, 555), /could not be identified/);
  assert.ok(!existsSync(file(r.dir)));
});

test('a Maestro process of a dead session is an orphan only while it has the recorded creation time and command line', async () => {
  const r = rig();
  delete r.procs[100]; // the harness died
  put(r.dir, { pid: 100, createdAt: 'c-100', maestro: MAESTRO });
  const h = await lockHeld(r.dir, r.io);
  assert.deepEqual([h.held, h.stale], [false, true]);
  assert.deepEqual(h.orphan, MAESTRO);
  // the number was given to another process
  r.procs[200] = { createdAt: 'a later process', commandLine: MAESTRO.commandLine };
  assert.equal((await lockHeld(r.dir, r.io)).orphan, undefined);
  r.procs[200] = { createdAt: MAESTRO.createdAt, commandLine: 'notepad.exe' };
  assert.equal((await lockHeld(r.dir, r.io)).orphan, undefined);
  delete r.procs[200];
  assert.deepEqual(await lockHeld(r.dir, r.io), { held: false, stale: true });
});

test('a session never starts over an orphan Maestro: it is refused and told how to stop it', async () => {
  const r = rig();
  delete r.procs[100];
  put(r.dir, { pid: 100, createdAt: 'c-100', maestro: MAESTRO });
  await rejects(
    acquireLock(r.dir, r.io, 101),
    /Maestro process \(pid 200\) of an earlier session is still running: run `device restore`/,
  );
  assert.ok(existsSync(file(r.dir)), 'the record of the orphan is kept');
  assert.deepEqual(r.kills, []);
});

test('the Maestro process a session started is recorded in its lock by identity, and the record is cleared when it ended', async () => {
  const r = rig();
  await recordMaestro(r.dir, r.io, 200); // no lock: nothing is written
  assert.ok(!existsSync(file(r.dir)));
  await acquireLock(r.dir, r.io, 100);
  await recordMaestro(r.dir, r.io, 200);
  assert.deepEqual(JSON.parse(readFileSync(file(r.dir), 'utf8')), {
    pid: 100,
    createdAt: 'c-100',
    maestro: MAESTRO,
  });
  await recordMaestro(r.dir, r.io, 4242); // a process that cannot be identified is not recorded
  assert.deepEqual(JSON.parse(readFileSync(file(r.dir), 'utf8')).maestro, MAESTRO);
  clearMaestro(r.dir);
  assert.deepEqual(JSON.parse(readFileSync(file(r.dir), 'utf8')), { pid: 100, createdAt: 'c-100' });
  clearMaestro(r.dir); // nothing to clear
  assert.equal((await lockHeld(r.dir, r.io)).held, true, 'the session still holds its lock');
});

test('an orphan is stopped by its recorded identity, its stop is confirmed, and only then is the dead lock removed', async () => {
  const r = rig();
  assert.deepEqual(await reapOrphan(r.dir, r.io), { stopped: false }, 'no lock, nothing to stop');
  delete r.procs[100];
  put(r.dir, { pid: 100, createdAt: 'c-100', maestro: MAESTRO });
  assert.deepEqual(await reapOrphan(r.dir, r.io, { tries: 3, delayMs: 0 }), {
    stopped: true,
    pid: 200,
  });
  assert.deepEqual(r.kills, [200]);
  assert.ok(!existsSync(file(r.dir)));
});

test('a process that is not the recorded Maestro is never stopped; one that will not stop keeps the lock and is reported', async () => {
  const r = rig();
  delete r.procs[100];
  put(r.dir, { pid: 100, createdAt: 'c-100', maestro: MAESTRO });
  r.procs[200] = { createdAt: 'a later process', commandLine: MAESTRO.commandLine };
  assert.deepEqual(await reapOrphan(r.dir, r.io), { stopped: false });
  assert.deepEqual(r.kills, [], 'a reused pid is left alone');
  r.procs[200] = { createdAt: MAESTRO.createdAt, commandLine: MAESTRO.commandLine };
  r.world.stubborn = true;
  await rejects(
    reapOrphan(r.dir, r.io, { tries: 2, delayMs: 0 }),
    /Maestro process 200 of an earlier session could not be stopped/,
  );
  assert.deepEqual(r.kills, [200]);
  assert.ok(existsSync(file(r.dir)), 'the identity stays in the lock for the next attempt');
});

test('while a session runs nothing else changes the run; an orphan is stopped only by the commands that may', async () => {
  const r = rig();
  assert.deepEqual(
    await guardSession(r.dir, r.io),
    { stopped: false },
    'no lock: nothing in the way',
  );
  put(r.dir, { pid: 100, createdAt: 'c-100' });
  await rejects(
    guardSession(r.dir, r.io, { reap: true }),
    /a native session \(pid 100\) is running on this run: it restores its own changes/,
  );
  await rejects(guardSession(r.dir, r.io, { allowOrphan: true }), /session \(pid 100\) is running/);
  // a dead session whose Maestro still runs
  delete r.procs[100];
  put(r.dir, { pid: 100, createdAt: 'c-100', maestro: MAESTRO });
  await rejects(guardSession(r.dir, r.io), /Maestro process \(pid 200\).*run `device restore`/);
  assert.deepEqual(await guardSession(r.dir, r.io, { allowOrphan: true }), { stopped: false });
  assert.deepEqual(r.kills, [], 'a teardown that allows the orphan does not stop it either');
  assert.deepEqual(await guardSession(r.dir, r.io, { reap: true }), { stopped: true, pid: 200 });
  assert.deepEqual(r.kills, [200]);
  assert.ok(!existsSync(file(r.dir)));
  assert.deepEqual(await guardSession(r.dir, r.io), { stopped: false });
});

test('of two sessions that find the same stale lock exactly one gets the run', async () => {
  const r = rig();
  put(r.dir, { pid: 999, createdAt: 'long gone' }); // its process is not there
  const results = await Promise.allSettled([
    acquireLock(r.dir, r.io, 100),
    acquireLock(r.dir, r.io, 101),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), ['fulfilled', 'rejected']);
  const won = results.find((x) => x.status === 'fulfilled').value;
  assert.deepEqual(JSON.parse(readFileSync(file(r.dir), 'utf8')), won);
  assert.ok(results.find((x) => x.status === 'rejected').reason instanceof Refused);
  assert.deepEqual(
    readdirSync(r.dir).filter((n) => n.includes('stale')),
    [],
    'no stale copy is left behind',
  );
});

test('a lock that another session replaced while the stale one was being judged is put back, and the second session is refused', async () => {
  const r = rig();
  put(r.dir, { pid: 999, createdAt: 'long gone' });
  const fresh = { pid: 101, createdAt: 'c-101' };
  const look = r.io.proc.info;
  r.io.proc.info = async (p) => {
    if (p === 999) put(r.dir, fresh); // a live session takes over while 999 is looked up
    return look(p);
  };
  await rejects(acquireLock(r.dir, r.io, 100), /taken by another session at the same moment/);
  assert.deepEqual(
    JSON.parse(readFileSync(file(r.dir), 'utf8')),
    fresh,
    "the other session's lock stands",
  );
  assert.deepEqual(
    readdirSync(r.dir).filter((n) => n.includes('stale')),
    [],
  );
});

test('a lock that cannot be read names what to do about it, in every refusal that mentions it', async () => {
  const r = rig();
  put(r.dir, '');
  await rejects(acquireLock(r.dir, r.io, 101), /delete .*native\.lock and try again/);
  await rejects(guardSession(r.dir, r.io), /delete .*native\.lock and try again/);
  // a lock of a live session says nothing of the kind
  put(r.dir, { pid: 100, createdAt: 'c-100' });
  await assert.rejects(acquireLock(r.dir, r.io, 101), (e) => !/delete/.test(e.message));
});
