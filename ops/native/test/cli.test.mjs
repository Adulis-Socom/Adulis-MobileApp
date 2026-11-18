// The command line's contract: ONE exit-code scheme and ONE status vocabulary, READY only from the
// commands that verified something (and saying what), and a status line that never claims "no
// resource was changed" after a change, nor "ready" after nothing was checked.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXIT,
  isMutatingAdb,
  isMutatingDocker,
  main,
  rootProblem,
  STATUS,
  trackIo,
} from '../harness.mjs';
import { readManifest, runDir, writeManifest } from '../lib/manifest.mjs';
import { engineWorld } from './engine-fake.mjs';
import { makeIo, world } from './fakes.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHA = 'c'.repeat(40);
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '', error: null });

const gitFake =
  (head = SHA) =>
  async (args) => {
    if (args[0] === 'rev-parse') return ok(`${head}\n`);
    if (args[0] === 'status') return ok('');
    return ok();
  };

/** An adb double for one emulator; `failNth` makes that `reverse` call fail. */
function adbFake({ failNth = 0 } = {}) {
  const calls = [];
  let reverses = 0;
  const adb = async (args) => {
    const s = args.join(' ');
    calls.push(s);
    if (s === 'devices') return ok('List of devices attached\nemulator-5554\tdevice\n');
    if (s.includes('getprop ro.kernel.qemu')) return ok('1\n');
    if (s.includes('dumpsys package'))
      return ok('Package [com.adulis.app] (x):\n  pkgFlags=[ DEBUGGABLE ]\n');
    if (s.includes('reverse --list')) return ok('');
    if (args.includes('reverse')) {
      reverses += 1;
      return reverses === failNth ? { status: 1, stdout: '', stderr: 'error', error: null } : ok();
    }
    return ok();
  };
  return { adb, calls };
}

function cli(w = world(), { extra = {}, preflight = async () => [], rm } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'native-cli-'));
  writeManifest(runDir(root, w.m.run), w.m);
  const io = { ...makeIo(w), git: gitFake(), ...extra };
  const lines = [];
  const run = (...argv) =>
    main(argv, { io, env: { ADULIS_NATIVE_ROOT: root }, out: (s) => lines.push(s), preflight, rm });
  return {
    root,
    w,
    io,
    lines,
    run,
    last: () => lines.at(-1),
    done: () => rmSync(root, { recursive: true, force: true }),
  };
}

/* ---- READY means verified, and says what ---- */

test('only up and verify print READY, and READY names the scope that was verified', async () => {
  const stack = cli();
  const api = cli(world({ api: true }));
  try {
    assert.equal(await stack.run('verify', '--run', stack.w.m.run), EXIT.OK);
    assert.equal(stack.last(), STATUS.READY_STACK);
    assert.equal(await api.run('verify', '--run', api.w.m.run), EXIT.OK);
    assert.equal(api.last(), STATUS.READY_API);
    assert.notEqual(STATUS.READY_STACK, STATUS.READY_API);
  } finally {
    stack.done();
    api.done();
  }
});

test('commands that verify nothing never print READY', async () => {
  const c = cli();
  const run = c.w.m.run;
  try {
    for (const argv of [
      ['status', '--run', run],
      ['env', '--run', run],
      ['plan', '--checkout', repo],
      ['preflight'],
    ]) {
      assert.equal(await c.run(...argv), EXIT.OK, argv.join(' '));
      assert.match(c.last(), /^HARNESS OK - /, argv.join(' '));
      assert.doesNotMatch(c.last(), /READY/, argv.join(' '));
    }
    assert.equal(await c.run('down', '--run', run), EXIT.OK);
    assert.match(c.last(), /^HARNESS OK - down \(5 removed\)$/);
    assert.equal(await c.run('down', '--run', run), EXIT.OK);
    assert.match(c.last(), /^HARNESS OK - down$/);
  } finally {
    c.done();
  }
});

test('up ends READY - STACK VERIFIED, and a stack that does not pass is not READY', async () => {
  const e = engineWorld();
  const root = mkdtempSync(join(tmpdir(), 'native-cli-'));
  const lines = [];
  try {
    const io = { ...e.io, git: gitFake() };
    const argv = ['up', '--checkout', repo, '--sha', SHA];
    const env = { ADULIS_NATIVE_ROOT: root };
    const code = await main(argv, {
      io,
      env,
      out: (s) => lines.push(s),
      preflight: async () => [],
    });
    assert.equal(code, EXIT.OK, lines.join('\n'));
    assert.equal(lines.at(-1), STATUS.READY_STACK);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an unknown device sub-command is a usage error, not "may be used"', async () => {
  const c = cli(world({ api: true }));
  try {
    for (const argv of [
      ['device', '--run', c.w.m.run],
      ['device', 'frobnicate', '--run', c.w.m.run],
    ]) {
      assert.equal(await c.run(...argv), EXIT.COULD_NOT_CHECK);
      assert.match(c.last(), /^HARNESS USAGE - /);
    }
  } finally {
    c.done();
  }
});

/* ---- the exit-code scheme: every code, with its status line ---- */

test('exit 0 OK, 1 REFUSED, 2 COULD NOT CHECK or USAGE, 3 INCOMPLETE, 4 BLOCKED: each with its own line', async () => {
  const table = [];
  const add = async (code, re, setup, ...argv) => {
    const w = world(setup.api ? { api: true } : undefined);
    setup.edit?.(w);
    const c = cli(w, setup.opts);
    try {
      const got = await c.run(...argv.map((a) => (a === '<run>' ? w.m.run : a)));
      table.push([argv[0], got, c.last()]);
      assert.equal(got, code, `${argv.join(' ')}: ${c.last()}`);
      assert.match(c.last(), re, argv.join(' '));
    } finally {
      c.done();
    }
  };
  await add(0, /^HARNESS OK - status/, {}, 'status', '--run', '<run>');
  await add(
    1,
    /^HARNESS REFUSED - ID-01 .* - NO RESOURCE WAS CHANGED$/,
    { edit: (w) => (w.pg.tcp = w.pg.tcp.replace(w.m.db.systemId, '1')) },
    'verify',
    '--run',
    '<run>',
  );
  await add(
    1,
    /^HARNESS REFUSED - .*not the API this run started.* - NO RESOURCE WAS CHANGED$/,
    { api: true, edit: (w) => (w.proc.byPid[4242].createdAt = '2026-11-18T13:00:00.0000000Z') },
    'api',
    'stop',
    '--run',
    '<run>',
  );
  await add(
    1,
    /^HARNESS REFUSED - .*not the expected commit/,
    { opts: { extra: { git: gitFake('d'.repeat(40)), connects: async () => false } } },
    'api',
    'start',
    '--run',
    '<run>',
    '--checkout',
    repo,
    '--sha',
    SHA,
  );
  await add(
    1,
    /^HARNESS REFUSED - .*already listens on the API port/,
    { opts: { extra: { connects: async () => true } } },
    'api',
    'start',
    '--run',
    '<run>',
    '--checkout',
    repo,
    '--sha',
    SHA,
  );
  await add(
    2,
    /^HARNESS REFUSED - ID-01 .*\(could not be checked\) - NO RESOURCE WAS CHANGED$/,
    { edit: (w) => (w.pg.tcpFails = true) },
    'verify',
    '--run',
    '<run>',
  );
  await add(2, /^HARNESS USAGE - /, {}, 'verify');
  await add(2, /^HARNESS USAGE - /, {}, 'frobnicate');
  await add(
    3,
    /^HARNESS CLEANUP INCOMPLETE - \d+ RESOURCES LEFT, REGISTERED$/,
    { edit: (w) => (w.d.rmFails = true) },
    'down',
    '--run',
    '<run>',
  );
  await add(
    4,
    /^HARNESS BLOCKED - .* - NOTHING STARTED$/,
    { opts: { preflight: async () => ['free memory is low'] } },
    'up',
    '--checkout',
    repo,
    '--sha',
    SHA,
  );
  assert.equal(new Set(table.map((t) => t[1])).size, 5, 'all five codes were exercised');
});

test('the exit codes are the documented constants', () => {
  assert.deepEqual(EXIT, { OK: 0, REFUSED: 1, COULD_NOT_CHECK: 2, INCOMPLETE: 3, BLOCKED: 4 });
});

/* ---- a status line never says more than is proven (what was changed) ---- */

test('a refusal inside up after resources exist is INCOMPLETE and says how to continue', async () => {
  const e = engineWorld({ secondVolume: true });
  const root = mkdtempSync(join(tmpdir(), 'native-cli-'));
  const lines = [];
  try {
    const io = { ...e.io, git: gitFake() };
    const code = await main(['up', '--checkout', repo, '--sha', SHA], {
      io,
      env: { ADULIS_NATIVE_ROOT: root },
      out: (s) => lines.push(s),
      preflight: async () => [],
    });
    assert.equal(code, EXIT.INCOMPLETE);
    const last = lines.at(-1);
    assert.match(
      last,
      /^HARNESS INCOMPLETE - ID-08 mounts and volumes refused after \d+ change\(s\)/,
    );
    assert.match(last, /run `down --run native-\d{8}-[0-9a-f]{8}`/);
    assert.doesNotMatch(last, /NO RESOURCE WAS CHANGED|NOTHING DESTRUCTIVE/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('purge that fails halfway is INCOMPLETE, not "nothing was changed"', async () => {
  const c = cli(undefined, {
    rm: () => {
      throw new Error('EBUSY: resource busy or locked');
    },
  });
  try {
    for (const m of [readManifest(runDir(c.root, c.w.m.run))]) {
      // a cleaned run in its own engine with nothing left
      c.w.d.containers = {};
      c.w.d.volumes = {};
      c.w.d.networks = {};
      writeManifest(runDir(c.root, m.run), {
        ...m,
        state: 'cleaned',
        cleanup: { at: 'x', engineId: m.engine.id, removed: 0 },
      });
      writeFileSync(join(runDir(c.root, m.run), 'run.marker'), `${m.run}\n`);
    }
    assert.equal(await c.run('purge', '--run', c.w.m.run), EXIT.INCOMPLETE);
    assert.match(
      c.last(),
      /^HARNESS INCOMPLETE - EBUSY.* after 1 change\(s\) \(run directory\); inspect the run directory by hand$/,
    );
    assert.ok(existsSync(runDir(c.root, c.w.m.run)));
  } finally {
    c.done();
  }
});

test('a second reverse that fails after the first succeeded is INCOMPLETE and names the device restore', async () => {
  const w = world({ api: true });
  const { adb, calls } = adbFake({ failNth: 2 });
  const c = cli(w, { extra: { adb } });
  try {
    assert.equal(
      await c.run('device', 'prepare', '--run', w.m.run, '--serial', 'emulator-5554'),
      EXIT.INCOMPLETE,
    );
    assert.match(
      c.last(),
      /^HARNESS INCOMPLETE - adb reverse .* failed after 1 change\(s\) \(adb reverse\); run `device restore`/,
    );
    assert.equal(calls.filter((x) => x.includes('reverse') && !x.includes('--list')).length, 2);
  } finally {
    c.done();
  }
});

test('a fixture load that committed but could not record itself is INCOMPLETE', async () => {
  const w = world();
  const c = cli(w);
  try {
    const dir = runDir(c.root, w.m.run);
    const inner = c.io.docker;
    c.io.docker = async (args, opts) => {
      const r = await inner(args, opts);
      if (args[0] === 'exec' && opts?.input !== undefined) {
        // the manifest can no longer be replaced: its place is taken by a directory
        rmSync(join(dir, 'manifest.json'));
        mkdirSync(join(dir, 'manifest.json'));
      }
      return r;
    };
    assert.equal(await c.run('fixtures', '--run', w.m.run, '--set', 'baseline'), EXIT.INCOMPLETE);
    assert.match(
      c.last(),
      /^HARNESS INCOMPLETE - .* after 1 change\(s\) \(docker exec\); run `down --run /,
    );
    assert.equal(w.pg.committed.length, 1);
  } finally {
    c.done();
  }
});

test('down whose own log fails midway is INCOMPLETE, and the removals made so far are counted', async () => {
  const c = cli();
  try {
    mkdirSync(join(runDir(c.root, c.w.m.run), 'ops.ndjson')); // the evidence file cannot be appended to
    assert.equal(await c.run('down', '--run', c.w.m.run), EXIT.INCOMPLETE);
    assert.match(
      c.last(),
      /^HARNESS INCOMPLETE - .* after 1 change\(s\) \(docker rm -f\); run `down --run /,
    );
  } finally {
    c.done();
  }
});

test('a refusal with no mutating call still says so, and a mutating call changes what the line says', async () => {
  const mutations = [];
  const io = trackIo(
    {
      docker: async () => ok(),
      adb: async () => ok(),
      proc: { kill: () => {} },
      spawnApi: () => ({ pid: 1 }),
      build: async () => {},
      run: async () => ok(),
    },
    (what) => mutations.push(what),
  );
  await io.docker(['ps', '-a']);
  await io.docker(['exec', 'x', 'psql', '-c', 'select 1']);
  await io.docker(['volume', 'ls']);
  await io.adb(['reverse', '--list']);
  assert.deepEqual(mutations, [], 'reads are not changes');
  await io.docker(['rm', '-f', 'x']);
  await io.docker(['exec', '-i', 'x', 'psql'], { input: 'select 1' });
  await io.adb(['-s', 'e', 'reverse', 'tcp:1', 'tcp:1']);
  io.proc.kill(1);
  io.spawnApi({});
  await io.build('x');
  await io.run('node', []);
  assert.equal(mutations.length, 7);
});

test('a docker call that definitively failed changed nothing; an unknown outcome may have', async () => {
  const mutations = [];
  const fails = trackIo(
    { docker: async () => ({ status: 1, stdout: '', stderr: 'x', error: null }) },
    (w) => mutations.push(w),
  );
  await fails.docker(['rm', '-f', 'x']);
  assert.deepEqual(mutations, []);
  const unknown = trackIo(
    { docker: async () => ({ status: null, stdout: '', stderr: '', error: new Error('timeout') }) },
    (w) => mutations.push(w),
  );
  await unknown.docker(['rm', '-f', 'x']);
  assert.equal(mutations.length, 1);
});

test('every docker command that is not a known read counts as a change', () => {
  for (const a of [
    ['run'],
    ['rm'],
    ['volume', 'create'],
    ['volume', 'rm'],
    ['network', 'create'],
    ['network', 'rm'],
    ['frobnicate'],
  ])
    assert.equal(isMutatingDocker(a), true, a.join(' '));
  for (const a of [
    ['info'],
    ['ps'],
    ['inspect'],
    ['context', 'show'],
    ['volume', 'ls'],
    ['network', 'inspect'],
    ['exec', 'x', 'psql'],
  ])
    assert.equal(isMutatingDocker(a), false, a.join(' '));
  assert.equal(isMutatingDocker(['exec', 'x', 'sh'], { input: 'x' }), true);
  assert.equal(isMutatingAdb(['-s', 'e', 'reverse', '--remove', 'tcp:1']), true);
  assert.equal(isMutatingAdb(['reverse', '--list']), false);
});

/* ---- the Docker engine: down and purge never read "absent" in the wrong engine ---- */

test('down in another Docker engine refuses, removes nothing and leaves the run uncleaned', async () => {
  const w = world();
  const c = cli(w);
  try {
    w.d.engine.id = 'engine-other';
    assert.equal(await c.run('down', '--run', w.m.run), EXIT.REFUSED);
    assert.match(
      c.last(),
      /^HARNESS REFUSED - .*not the one the run was created in.* - NO RESOURCE WAS CHANGED$/,
    );
    assert.equal(readManifest(runDir(c.root, w.m.run)).state, 'ready');
    assert.deepEqual(w.d.mutations, []);
  } finally {
    c.done();
  }
});

test('down in the right engine that finds nothing says so, and records the engine it looked in', async () => {
  const w = world();
  w.d.containers = {};
  w.d.volumes = {};
  w.d.networks = {};
  const c = cli(w);
  try {
    assert.equal(await c.run('down', '--run', w.m.run), EXIT.OK);
    assert.ok(
      c.lines.some((l) => /nothing of this run was found in Docker engine engine-0001/.test(l)),
      c.lines.join('\n'),
    );
    const m = readManifest(runDir(c.root, w.m.run));
    assert.equal(m.state, 'cleaned');
    assert.deepEqual([m.cleanup.engineId, m.cleanup.removed], ['engine-0001', 0]);
  } finally {
    c.done();
  }
});

test('purge deletes the record of a cleaned run only in its own engine and only when nothing of the run is left', async () => {
  const mk = (edit) => {
    const w = world();
    w.d.containers = {};
    w.d.volumes = {};
    w.d.networks = {};
    edit?.(w);
    const c = cli(w);
    const dir = runDir(c.root, w.m.run);
    writeManifest(dir, {
      ...w.m,
      state: 'cleaned',
      cleanup: { at: 'x', engineId: w.m.engine.id, removed: 5, ...(w.cleanup ?? {}) },
    });
    writeFileSync(join(dir, 'run.marker'), `${w.m.run}\n`);
    return { w, c, dir };
  };
  // the control: its own engine, nothing left -> purged
  const good = mk();
  try {
    assert.equal(await good.c.run('purge', '--run', good.w.m.run), EXIT.OK);
    assert.ok(!existsSync(good.dir));
  } finally {
    good.c.done();
  }
  const cases = [
    [
      'another engine',
      (w) => (w.d.engine.id = 'engine-other'),
      /not the one the run was created in/,
    ],
    ['another context', (w) => (w.d.engine.context = 'elsewhere'), /context/],
    [
      'a resource of the run still exists',
      (w) =>
        (w.d.volumes.leftover = {
          Name: 'leftover',
          Labels: { 'adulis.native-harness.run': w.m.run },
        }),
      /still exist/,
    ],
  ];
  for (const [what, edit, re] of cases) {
    const x = mk(edit);
    try {
      const code = await x.c.run('purge', '--run', x.w.m.run);
      assert.equal(code, EXIT.REFUSED, what);
      assert.match(x.c.lines.join('\n'), re, what);
      assert.ok(existsSync(x.dir), `${what}: the record was deleted`);
    } finally {
      x.c.done();
    }
  }
  // a listing that fails is not "nothing left"
  const unknown = mk((w) => (w.d.listFails.containers = true));
  try {
    assert.equal(await unknown.c.run('purge', '--run', unknown.w.m.run), EXIT.COULD_NOT_CHECK);
    assert.ok(existsSync(unknown.dir));
  } finally {
    unknown.c.done();
  }
});

test('purge refuses a run that was not cleaned in its own engine (no cleanup record)', async () => {
  const w = world();
  w.d.containers = {};
  w.d.volumes = {};
  w.d.networks = {};
  const c = cli(w);
  try {
    const dir = runDir(c.root, w.m.run);
    writeManifest(dir, { ...w.m, state: 'cleaned' });
    writeFileSync(join(dir, 'run.marker'), `${w.m.run}\n`);
    assert.equal(await c.run('purge', '--run', w.m.run), EXIT.REFUSED);
    assert.match(c.lines.join('\n'), /not recorded as made in the run's own Docker engine/);
    assert.ok(existsSync(dir));
    writeManifest(dir, { ...w.m, state: 'ready' });
    assert.equal(await c.run('purge', '--run', w.m.run), EXIT.REFUSED);
    assert.match(c.lines.join('\n'), /not cleaned/);
  } finally {
    c.done();
  }
});

test('down cannot reach the engine: exit 2, nothing removed', async () => {
  const w = world();
  w.d.engineDead = true;
  const c = cli(w);
  try {
    assert.equal(await c.run('down', '--run', w.m.run), EXIT.COULD_NOT_CHECK);
    assert.deepEqual(w.d.mutations, []);
  } finally {
    c.done();
  }
});

/* ---- the manifest and the command line ---- */

test('a manifest that belongs to another run than --run is refused', async () => {
  const w = world();
  const c = cli(w);
  try {
    const other = 'native-20200101-0badf00d';
    mkdirSync(runDir(c.root, other), { recursive: true });
    writeManifest(runDir(c.root, other), w.m);
    assert.equal(await c.run('status', '--run', other), EXIT.REFUSED);
    assert.match(c.lines.join('\n'), /belongs to run/);
  } finally {
    c.done();
  }
});

test('down checks the manifest like every other command: a tampered one is refused before docker is asked', async () => {
  const w = world();
  [w.m.ports.pg] = [5432];
  const c = cli(w);
  try {
    assert.equal(await c.run('down', '--run', w.m.run), EXIT.REFUSED);
    assert.deepEqual(c.io.calls, []);
  } finally {
    c.done();
  }
});

test('an unknown fixture set, including a prototype key, is a usage error', async () => {
  const c = cli();
  try {
    for (const name of ['nope', 'constructor', '__proto__', 'toString']) {
      assert.equal(
        await c.run('fixtures', '--run', c.w.m.run, '--set', name),
        EXIT.COULD_NOT_CHECK,
        name,
      );
      assert.match(c.last(), /^HARNESS USAGE - unknown fixture set/);
    }
  } finally {
    c.done();
  }
});

test('the native root must be absolute with a drive or UNC prefix on Windows', () => {
  assert.equal(rootProblem('C:\\native', 'win32'), null);
  assert.equal(rootProblem('C:/native', 'win32'), null);
  assert.equal(rootProblem('\\\\server\\share\\native', 'win32'), null);
  assert.notEqual(rootProblem('\\native', 'win32'), null, 'a drive-relative path');
  assert.notEqual(rootProblem('native', 'win32'), null);
  assert.notEqual(rootProblem('', 'win32'), null);
  assert.equal(rootProblem('/var/native', 'linux'), null);
  assert.notEqual(rootProblem('native/runs', 'linux'), null);
});

test('env prints quoted assignments for eval, and no secret', async () => {
  const c = cli();
  try {
    assert.equal(await c.run('env', '--run', c.w.m.run, '--serial', "emu'lator"), EXIT.OK);
    const text = c.lines.join('\n');
    assert.match(text, /^export ADULIS_NATIVE_RUN='native-/m);
    assert.match(text, /^export ANDROID_SERIAL='emulator'$/m);
    assert.ok(!text.includes(c.w.m.nonce) && !text.includes(c.w.m.secrets.pg));
    assert.equal(
      readFileSync(join(runDir(c.root, c.w.m.run), 'manifest.json'), 'utf8').includes(
        c.w.m.secrets.pg,
      ),
      true,
    );
  } finally {
    c.done();
  }
});

test('reverify refuses a tampered or wrongly staged run before PostgreSQL is contacted', async () => {
  for (const edit of [(m) => ([m.ports.pg] = [5432]), (m) => (m.state = 'creating')]) {
    const w = world();
    edit(w.m);
    const c = cli(w);
    try {
      assert.equal(await c.run('reverify', '--run', w.m.run), EXIT.REFUSED);
      assert.deepEqual(c.io.calls, [], c.io.calls.join(' | '));
    } finally {
      c.done();
    }
  }
});
