// Metro decides which code the app runs and which API it calls: the harness starts it with the run's
// own API address, proves it is that process before a flow runs, and stops it only by identity. An API
// address that is not this run's API on the loopback (a deployed host, a protected port, a trick in the
// URL) is refused.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  apiUrlProblems,
  buildMetroEnv,
  metroApiUrl,
  metroArgs,
  metroCli,
  metroProblems,
  startMetro,
  stopMetro,
} from '../lib/metro.mjs';
import { readManifest } from '../lib/manifest.mjs';
import { descendants } from '../lib/proc-tree.mjs';
import { PROTECTED_PORTS } from '../lib/protected.mjs';
import { world } from './fakes.mjs';
import { nativeWorld, SHA } from './native-world.mjs';

const worlds = [];
const nw = (o) => {
  const x = nativeWorld(o);
  worlds.push(x);
  return x;
};
after(() => worlds.forEach((x) => x.done()));

test("the API address is this run's API on the loopback and nothing else", () => {
  const m = world().m;
  const url = metroApiUrl(m);
  assert.equal(url, `http://localhost:${m.ports.api}`);
  assert.deepEqual(apiUrlProblems(url, m), []);
  assert.deepEqual(apiUrlProblems(`http://127.0.0.1:${m.ports.api}`, m), []);
  const cases = [
    ['a deployed API', 'https://api.example.test', /uses https|API host is api\.example\.test/],
    [
      'a deployed API over http',
      `http://api.example.test:${m.ports.api}`,
      /API host is api\.example\.test/,
    ],
    [
      'a host that only starts with localhost',
      `http://localhost.example.test:${m.ports.api}`,
      /API host is localhost\.example\.test/,
    ],
    [
      'credentials that move the real host',
      `http://localhost:${m.ports.api}@evil.example.test`,
      /carries credentials|API host/,
    ],
    ['another port on the loopback', 'http://localhost:3000', /protected port|not this run's/],
    ["the run's database port", `http://localhost:${m.ports.pg}`, /not this run's/],
    ['no port', 'http://localhost', /not this run's/],
    ['a path', `http://localhost:${m.ports.api}/v1`, /path, query or fragment/],
    ['a query', `http://localhost:${m.ports.api}/?x=1`, /path, query or fragment/],
    ['a non-URL', 'not a url', /not a URL/],
    ['an empty string', '', /not a URL/],
    ['an IPv6 host', `http://[::1]:${m.ports.api}`, /API host is/],
  ];
  for (const [what, u, re] of cases) assert.match(apiUrlProblems(u, m).join(), re, what);
  for (const p of PROTECTED_PORTS)
    assert.ok(apiUrlProblems(`http://localhost:${p}`, m).length, `protected port ${p}`);
});

test("the Metro child gets this run's API address, CI mode and a handful of host variables, nothing else", () => {
  const m = world().m;
  const env = buildMetroEnv(m, {
    SystemRoot: 'S',
    PATH: 'P',
    TEMP: 'T',
    TMP: 'T',
    USERPROFILE: 'U',
    APPDATA: 'A',
    EXPO_TOKEN: 'secret',
    DATABASE_URL: 'postgres://x',
    GITHUB_TOKEN: 'secret',
    EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test',
  });
  assert.equal(
    env.EXPO_PUBLIC_API_BASE_URL,
    `http://localhost:${m.ports.api}`,
    "the operator's own value never wins",
  );
  assert.deepEqual(Object.keys(env).sort(), [
    'APPDATA',
    'CI',
    'EXPO_NO_TELEMETRY',
    'EXPO_OFFLINE',
    'EXPO_PUBLIC_API_BASE_URL',
    'NODE_ENV',
    'PATH',
    'SystemRoot',
    'TEMP',
    'TMP',
    'USERPROFILE',
  ]);
  assert.ok(!JSON.stringify(env).includes('secret'));
  assert.deepEqual(metroArgs('/c/cli'), ['/c/cli', 'start', '--port', '8081', '--clear']);
});

test('a Metro that is the recorded process, listening alone on 8081 and running, passes', async () => {
  const x = nw();
  assert.deepEqual(await metroProblems(x.w.m, x.io), []);
});

test('each way the Metro on 8081 is not the one this run started is a problem', async () => {
  const cases = [
    ['no Metro was started', (x) => delete x.w.m.metro, /started no Metro/],
    [
      'another listener',
      (x) => (x.io.proc.listeners = async () => [9999]),
      /not the recorded pid 5151/,
    ],
    [
      'two listeners',
      (x) => (x.io.proc.listeners = async () => [5151, 9999]),
      /not the recorded pid/,
    ],
    [
      'a reused pid',
      (x) => (x.w.proc.byPid[5151] = { ...x.w.proc.byPid[5151], createdAt: 'later' }),
      /was created at later/,
    ],
    [
      'another command line',
      (x) => (x.w.proc.byPid[5151] = { ...x.w.proc.byPid[5151], commandLine: '"node" other.js' }),
      /not the recorded Metro command/,
    ],
    [
      'a Metro with the options changed',
      (x) =>
        (x.w.proc.byPid[5151] = {
          ...x.w.proc.byPid[5151],
          commandLine: x.w.proc.byPid[5151].commandLine.replace('--clear', '--tunnel'),
        }),
      /not the recorded Metro command/,
    ],
    [
      'a Metro that is not running',
      (x) => (x.w.metroStatus = 'packager-status:stopped'),
      /Metro reports/,
    ],
    [
      "an API address that is not this run's",
      (x) => (x.w.m.metro.apiUrl = 'https://api.example.test'),
      /API host is api\.example\.test/,
    ],
  ];
  for (const [what, mutate, re] of cases) {
    const x = nw();
    mutate(x);
    assert.match((await metroProblems(x.w.m, x.io)).join(' | '), re, what);
  }
});

test('a Metro that cannot be checked is a problem, not a pass', async () => {
  const x = nw();
  x.io.proc.info = async () => {
    throw new Error('powershell failed');
  };
  assert.match(
    (await metroProblems(x.w.m, x.io)).join(),
    /could not be checked: powershell failed/,
  );
});

/* ---- start and stop ---- */

const gitAt = (head) => async (a) => ({
  status: 0,
  stdout: a[0] === 'rev-parse' ? `${head}\n` : '',
  stderr: '',
  error: null,
});
/** A world with no Metro yet, a checkout that has the Expo CLI, and a spawn that is recorded. */
const beforeStart = ({ cli = true } = {}) => {
  const x = nw({ noMetro: true });
  if (cli) {
    mkdirSync(join(x.cli, '..'), { recursive: true });
    writeFileSync(x.cli, '');
  }
  x.io.git = gitAt(SHA);
  x.spawned = [];
  x.up = false;
  x.io.spawnMetro = (o) => {
    x.spawned.push(o);
    x.up = true;
    return { pid: 5151 };
  };
  x.w.proc.byPid[5151] = {
    createdAt: '2026-11-18T10:02:00.0000000Z',
    commandLine: `"${x.io.node}" ${metroArgs(x.cli).join(' ')}`,
  };
  x.io.proc.listeners = async (p) => (p === 8081 ? (x.up ? [5151] : []) : x.w.proc.listeners);
  return x;
};
const start = (x, o = {}) =>
  startMetro(x.w.m, x.io, { checkout: x.checkout, sha: SHA, dir: x.dir, ...o });

test("start spawns Metro with the run's own API address, records its identity, and proves it before it returns", async () => {
  const x = beforeStart();
  const r = await start(x);
  assert.equal(x.spawned.length, 1);
  assert.equal(x.spawned[0].env.EXPO_PUBLIC_API_BASE_URL, `http://localhost:${x.w.m.ports.api}`);
  assert.deepEqual(x.spawned[0].args, metroArgs(x.cli));
  assert.equal(x.spawned[0].cwd, join(x.checkout, 'apps', 'mobile'));
  assert.equal(r.metro.pid, 5151);
  assert.equal(readManifest(x.dir).metro.apiUrl, `http://localhost:${x.w.m.ports.api}`);
  assert.equal(metroCli(x.checkout), x.cli);
});

test('start is refused, and nothing is spawned, when something holds 8081, there is no API, the run is not ready, or the checkout is wrong', async () => {
  const cases = [
    [
      'a foreign listener on 8081',
      (x) => (x.io.proc.listeners = async (p) => (p === 8081 ? [777] : [])),
      /something already listens on port 8081/,
    ],
    [
      'a connectable port',
      (x) => (x.io.connects = async () => true),
      /something already listens on port 8081/,
    ],
    ['no API in the run', (x) => delete x.w.m.api, /the run has no API/],
    ['a run that is not ready', (x) => (x.w.m.state = 'cleanup'), /not ready/],
    ['a Metro already recorded', (x) => (x.w.m.metro = { pid: 1 }), /already started Metro/],
    [
      'a checkout at another commit',
      (x) => (x.io.git = gitAt('c'.repeat(40))),
      /not the expected commit/,
    ],
    [
      'an API that no longer passes its checks',
      (x) => (x.w.api.health.boot_marker = 'someone-else'),
      /ID-04/,
    ],
  ];
  for (const [what, mutate, re] of cases) {
    const x = beforeStart();
    mutate(x);
    await assert.rejects(start(x), re, what);
    assert.equal(x.spawned.length, 0, `${what}: nothing was spawned`);
  }
  const noCli = beforeStart({ cli: false });
  await assert.rejects(start(noCli), /does not exist/);
  assert.equal(noCli.spawned.length, 0);
});

test('a Metro that never reports itself running is stopped again by its recorded identity and the start fails', async () => {
  const x = beforeStart();
  x.w.metroStatus = 'packager-status:starting';
  await assert.rejects(
    start(x, { tries: 3, delayMs: 0 }),
    /did not report packager-status:running/,
  );
  assert.deepEqual(x.kills, [5151]);
});

test('stop kills the whole tree of the recorded pid only after its creation time and command line match', async () => {
  const x = nw();
  const r = await stopMetro(x.w.m, x.io, x.dir);
  assert.deepEqual([r.stopped, x.kills], [true, [5151]]);
  assert.equal(readManifest(x.dir).metro, null);
});

test('stop refuses a process that is not the recorded Metro, and says nothing is running when it is gone', async () => {
  for (const patch of [{ createdAt: 'other' }, { commandLine: '"node" something-else.js' }]) {
    const x = nw();
    x.w.proc.byPid[5151] = { ...x.w.proc.byPid[5151], ...patch };
    await assert.rejects(stopMetro(x.w.m, x.io, x.dir), /is not the Metro this run started/);
    assert.deepEqual(x.kills, []);
  }
  const gone = nw();
  delete gone.w.proc.byPid[5151];
  assert.deepEqual(await stopMetro(gone.w.m, gone.io, gone.dir), {
    stopped: false,
    why: 'process 5151 is not running',
  });
  assert.deepEqual(gone.kills, []);
  const none = nw({ noMetro: true });
  assert.deepEqual(await stopMetro(none.w.m, none.io, none.dir), {
    stopped: false,
    why: 'no Metro was started by this run',
  });
});

test('there is no stop by port in the Metro module', () => {
  const src = readFileSync(new URL('../lib/metro.mjs', import.meta.url), 'utf8');
  assert.ok(
    !/Stop-Process|taskkill|killPort|listeners\([^)]*\)\s*\.\s*(forEach|map)/.test(src),
    'it stops by the recorded pid through io.proc.killTree only',
  );
  assert.ok(/io\.proc\.killTree\(rec\.pid\)/.test(src));
});

test('the tree of a verified pid is its children and theirs, never an unrelated process or a stale parent id', () => {
  const at = (n) => `2026-11-18T10:00:0${n}.0000000Z`;
  const p = (ProcessId, ParentProcessId, n) => ({ ProcessId, ParentProcessId, c: at(n) });
  const all = [
    p(100, 1, 1), // Metro
    p(101, 100, 2), // a worker
    p(102, 101, 3), // a worker's child
    p(103, 100, 2), // another worker
    p(200, 1, 2), // unrelated
    p(201, 200, 3), // unrelated child
    p(104, 100, 0), // names Metro as parent but is OLDER than it: the parent id was reused
  ];
  assert.deepEqual(descendants(all, 100).sort(), [101, 102, 103]);
  assert.deepEqual(descendants(all, 999), [], 'a root that is not running has no tree');
  assert.deepEqual(descendants(all, 102), []);
});
