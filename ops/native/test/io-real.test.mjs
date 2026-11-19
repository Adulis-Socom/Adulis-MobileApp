// The real process effects, against harmless node children (a process that only keeps itself alive): the
// tree kill, the Maestro runner (normal end, non-zero exit, abort, timeout, spawn failure, a process that
// will not stop) and the detached Metro spawn. The doubles used everywhere else cannot show that a
// process is really gone, that a promise really settles, or that a child really gets only the environment
// it was given. Nothing here touches Docker, a database, a device or a port.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { adbChildEnv, childEnv, maestro, proc, spawnMetro } from '../lib/io.mjs';

// the process table is read through PowerShell: the tree kill is exercised where the harness runs
const winOnly =
  process.platform === 'win32'
    ? {}
    : { skip: 'the process table is read through PowerShell (Windows only)' };

const HOLD = 'setInterval(() => {}, 1000)';
// a parent that starts one child of its own and prints the child's pid
const PARENT = `const { spawn } = require('node:child_process'); const c = spawn(process.execPath, ['-e', ${JSON.stringify(HOLD)}], { stdio: 'ignore' }); console.log(c.pid); ${HOLD}`;

const pids = new Set();
const dirs = [];
const realKill = process.kill;
after(() => {
  process.kill = realKill;
  for (const p of pids)
    try {
      realKill(p);
    } catch {
      // already gone
    }
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'native-io-'));
  dirs.push(d);
  return d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => {
  try {
    realKill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const until = async (fn, ms = 10_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(50);
  }
  return false;
};
const hold = () => {
  const c = spawn(process.execPath, ['-e', HOLD], { stdio: 'ignore', windowsHide: true });
  pids.add(c.pid);
  return c;
};
/** A parent and its child, both running: { parent, child } pids. */
const family = async () => {
  const p = spawn(process.execPath, ['-e', PARENT], {
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  });
  pids.add(p.pid);
  const child = await new Promise((resolve, reject) => {
    p.stdout.once('data', (b) => resolve(Number(`${b}`.trim())));
    p.once('error', reject);
  });
  pids.add(child);
  return { parent: p.pid, child };
};

test(
  'killTree stops the process and the children it started, and leaves an unrelated process alone',
  winOnly,
  async () => {
    const { parent, child } = await family();
    const other = hold();
    assert.ok(alive(parent) && alive(child) && alive(other.pid));
    await proc.killTree(parent);
    assert.ok(await until(() => !alive(parent) && !alive(child)), 'the tree is gone');
    assert.ok(alive(other.pid), 'a process that is not in the tree is still running');
    realKill(other.pid);
  },
);

test('killTree of a process that is already gone is not a failure', winOnly, async () => {
  const c = spawn(process.execPath, ['-e', ''], { stdio: 'ignore', windowsHide: true });
  await new Promise((r) => c.once('close', r));
  await proc.killTree(c.pid);
  await assert.rejects(proc.killTree(0), /positive integer/);
  await assert.rejects(proc.killTree('12'), /positive integer/);
});

test(
  "killTree does not swallow the root's failure, and still stops what it can reach",
  winOnly,
  async () => {
    const { parent, child } = await family();
    process.kill = (pid, sig) => {
      if (pid === parent && sig !== 0)
        throw Object.assign(new Error('not permitted'), { code: 'EPERM' });
      return realKill(pid, sig);
    };
    try {
      await assert.rejects(
        proc.killTree(parent),
        new RegExp(`could not stop process\\(es\\) ${parent}: EPERM`),
      );
    } finally {
      process.kill = realKill;
    }
    assert.ok(await until(() => !alive(child)), 'the child was still stopped');
    assert.ok(alive(parent), 'the root that could not be stopped is reported, not hidden');
    realKill(parent);
  },
);

/* ---- the Maestro runner ---- */

const mrun = (over = {}) => {
  const dir = tmp();
  const spawned = [];
  const p = maestro({
    file: process.execPath,
    args: ['-e', "console.log('ran')"],
    cwd: dir,
    env: childEnv(),
    timeout: 20_000,
    log: join(dir, 'out', 'maestro.log'),
    onSpawn: (pid) => {
      spawned.push(pid);
      pids.add(pid);
    },
    ...over,
  });
  return { p, dir, spawned, log: join(dir, 'out', 'maestro.log') };
};

test('a Maestro process that ends is reported with its status, its output goes to the log, and onSpawn saw its pid', async () => {
  const ok = mrun();
  const r = await ok.p;
  assert.deepEqual(
    [r.status, r.error, r.timedOut, r.aborted, !!r.stuck],
    [0, null, false, false, false],
  );
  assert.deepEqual(ok.spawned, [r.pid]);
  assert.match(readFileSync(ok.log, 'utf8'), /ran/);
  const bad = await mrun({ args: ['-e', 'process.exit(3)'] }).p;
  assert.equal(bad.status, 3);
  assert.equal(bad.error, null);
});

test('a Maestro process that cannot be started resolves with the error, it does not throw', async () => {
  const r = await mrun({ file: join(tmp(), 'no-such-program.exe') }).p;
  assert.equal(r.status, null);
  assert.ok(r.error);
  assert.equal(!!r.stuck, false);
});

test('an abort stops the process this call started, and the promise resolves', async () => {
  const ac = new AbortController();
  const m = mrun({ args: ['-e', HOLD], signal: ac.signal });
  await until(() => m.spawned.length === 1);
  const pid = m.spawned[0];
  assert.ok(alive(pid));
  ac.abort();
  const r = await m.p;
  assert.deepEqual([r.aborted, r.timedOut, !!r.stuck], [true, false, false]);
  assert.ok(await until(() => !alive(pid)), 'the process is gone');
});

test('a signal that is aborted before the start still stops the process and resolves', async () => {
  const ac = new AbortController();
  ac.abort();
  const m = mrun({ args: ['-e', HOLD], signal: ac.signal });
  const r = await m.p;
  assert.equal(r.aborted, true);
  assert.ok(await until(() => !alive(m.spawned[0])));
});

test('a timeout stops the process, is reported as a timeout, and the promise resolves', async () => {
  const m = mrun({ args: ['-e', HOLD], timeout: 400 });
  const r = await m.p;
  assert.deepEqual([r.timedOut, r.aborted, !!r.stuck], [true, false, false]);
  assert.ok(await until(() => !alive(m.spawned[0])), 'the process is gone');
});

test('a process that is still there after it was stopped resolves as stuck, with its pid, and the promise still settles', async () => {
  const ac = new AbortController();
  let target = null;
  const m = mrun({
    args: ['-e', HOLD],
    signal: ac.signal,
    hardMs: 300,
    onSpawn: (pid) => {
      target = pid;
      pids.add(pid);
    },
  });
  await until(() => target !== null);
  // the stop does not take effect (as with a process the host will not let go of)
  process.kill = (pid, sig) => (pid === target && sig !== 0 ? true : realKill(pid, sig));
  try {
    ac.abort();
    const r = await m.p;
    assert.equal(r.stuck, true);
    assert.equal(r.pid, target);
    assert.match(
      r.error.message,
      new RegExp(`process ${target} was still running 300 ms after it was stopped`),
    );
    assert.ok(alive(target), 'it really is still running');
  } finally {
    process.kill = realKill;
  }
  realKill(target);
  assert.ok(await until(() => !alive(target)));
});

test('onSpawn that fails does not break the run', async () => {
  const r = await mrun({
    onSpawn: async () => {
      throw new Error('record failed');
    },
  }).p;
  assert.equal(r.status, 0);
});

/* ---- the Metro spawn ---- */

test('the Metro spawn returns the pid of a detached process that keeps running, writes to its log, and sees only the environment it was given', async () => {
  const dir = tmp();
  process.env.NATIVE_TEST_SECRET = 'must-not-reach-the-child';
  try {
    const log = join(dir, 'logs', 'metro.log');
    const { pid } = spawnMetro({
      node: process.execPath,
      args: [
        '-e',
        `console.log('secret=' + (process.env.NATIVE_TEST_SECRET ?? 'none') + ' api=' + process.env.EXPO_PUBLIC_API_BASE_URL); ${HOLD}`,
      ],
      cwd: dir,
      env: childEnv({ EXPO_PUBLIC_API_BASE_URL: 'http://localhost:57500' }),
      log,
    });
    pids.add(pid);
    assert.ok(Number.isInteger(pid) && pid > 0);
    assert.ok(await until(() => existsSync(log) && /api=/.test(readFileSync(log, 'utf8'))));
    assert.match(readFileSync(log, 'utf8'), /secret=none api=http:\/\/localhost:57500/);
    assert.ok(alive(pid), 'the process keeps running after the spawn returned');
    realKill(pid);
    assert.ok(await until(() => !alive(pid)));
  } finally {
    delete process.env.NATIVE_TEST_SECRET;
  }
});

test('every adb child sees only the variables adb needs to find its keys and tools, and never a server selection', () => {
  const host = {
    SystemRoot: 'WIN',
    PATH: 'BIN',
    TEMP: 'T',
    TMP: 'T',
    USERPROFILE: 'U',
    HOME: 'H',
    APPDATA: 'A',
    LOCALAPPDATA: 'L',
    ANDROID_HOME: 'SDK',
    ANDROID_USER_HOME: 'AU',
    ADB_SERVER_SOCKET: 'tcp:evil:5037',
    ANDROID_ADB_SERVER_ADDRESS: 'evil',
    ANDROID_ADB_SERVER_PORT: '5038',
    ANDROID_SERIAL: 'R58M1',
    ADB_TRACE: 'all',
    EXPO_TOKEN: 'secret',
    DATABASE_URL: 'postgres://x',
  };
  const env = adbChildEnv(host);
  assert.deepEqual(Object.keys(env).sort(), [
    'ANDROID_HOME',
    'ANDROID_USER_HOME',
    'APPDATA',
    'HOME',
    'LOCALAPPDATA',
    'PATH',
    'SystemRoot',
    'TEMP',
    'TMP',
    'USERPROFILE',
  ]);
  assert.ok(!JSON.stringify(env).includes('evil') && !JSON.stringify(env).includes('secret'));
  assert.deepEqual(adbChildEnv({}), {});
  // the real effects hand exactly this environment to adb, for text and for bytes
  const src = readFileSync(new URL('../lib/io.mjs', import.meta.url), 'utf8');
  assert.equal(src.match(/env: adbChildEnv\(\)/g)?.length, 2);
});

/* ---- the tree kill driven by snapshots of the process table (the same on every platform) ---- */

const at = (n) => `2026-11-18T10:00:0${n}.0000000Z`;
const table = (rows) =>
  rows.map(([ProcessId, ParentProcessId, n]) => ({ ProcessId, ParentProcessId, c: at(n) }));
const TREE = table([
  [100, 1, 1], // the root
  [101, 100, 2], // a child
  [102, 101, 3], // a grandchild
  [103, 100, 2], // another child
  [200, 1, 2], // unrelated
]);

/** Runs killTree over the given snapshots (the last one repeats); `fail` maps a pid to an error code. */
async function killWith(tables, { root = 100, fail = {} } = {}) {
  const kills = [];
  let i = 0;
  const snapshots = { table: async () => tables[Math.min(i++, tables.length - 1)] };
  process.kill = (pid) => {
    kills.push(pid);
    if (fail[pid]) throw Object.assign(new Error(fail[pid]), { code: fail[pid] });
    return true;
  };
  try {
    await proc.killTree.call(snapshots, root);
    return { kills, error: null };
  } catch (error) {
    return { kills, error };
  } finally {
    process.kill = realKill;
  }
}

test('killTree stops every descendant before the root, deepest first, and nothing outside the tree', async () => {
  const { kills, error } = await killWith([TREE]);
  assert.equal(error, null);
  assert.deepEqual([...kills].sort(), [100, 101, 102, 103]);
  assert.equal(kills.at(-1), 100, 'the root is last');
  assert.ok(kills.indexOf(102) < kills.indexOf(101), 'a grandchild before its parent');
  assert.ok(!kills.includes(200), 'an unrelated process is never stopped');
});

test('a number that belongs to another process by the second snapshot is not stopped, and a process that is gone is skipped', async () => {
  const reused = TREE.map((r) => (r.ProcessId === 101 ? { ...r, c: at(9) } : r));
  const a = await killWith([TREE, reused]);
  assert.equal(a.error, null);
  assert.ok(!a.kills.includes(101), 'the reused number is left alone');
  assert.ok(a.kills.includes(102) && a.kills.includes(103) && a.kills.includes(100));
  const gone = TREE.filter((r) => r.ProcessId !== 102);
  const b = await killWith([TREE, gone]);
  assert.ok(!b.kills.includes(102), 'a process that has already ended is not signalled');
});

test('a process that has already ended is not a failure; any other failure is thrown after the rest were tried', async () => {
  const empty = await killWith([[]], { fail: { 100: 'ESRCH' } });
  assert.equal(empty.error, null, 'the root is gone: nothing to do');
  const child = await killWith([TREE], { fail: { 102: 'ESRCH' } });
  assert.equal(child.error, null);
  const root = await killWith([TREE], { fail: { 100: 'EPERM' } });
  assert.match(root.error.message, /^could not stop process\(es\) 100: EPERM$/);
  assert.deepEqual([...root.kills].sort(), [100, 101, 102, 103], 'the children were still stopped');
  const kid = await killWith([TREE], { fail: { 101: 'EPERM', 103: 'EACCES' } });
  assert.match(
    kid.error.message,
    /could not stop process\(es\) 101: EPERM, 103: EACCES|103: EACCES, 101: EPERM/,
  );
  assert.ok(kid.kills.includes(100), 'the root was still tried');
});
