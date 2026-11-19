// Running a flow with Maestro: the command line is built from a fixed list, the child sees almost none of
// the operator's environment, every attempt leaves evidence, and the retry policy is bounded: only an
// infrastructure error is retried, once, after the device and API proved themselves again.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { makeAdb } from '../lib/adb.mjs';
import { flowHash } from '../lib/flows.mjs';
import {
  classifyAttempt,
  crashLines,
  executeFlow,
  FlowRefused,
  locateMaestro,
  MaestroUnrecorded,
  maestroArgv,
  maestroEnv,
  parseJunit,
  RETRY,
  runAttempt,
  verdictOf,
} from '../lib/maestro.mjs';
import { fakeDevice, fakeMaestro, junit, SERIAL } from './fake-device.mjs';

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

test('Maestro and its JVM are located without starting either; every missing piece is named', () => {
  const have = new Set(
    ['C:\\maestro\\lib', 'C:\\jdk\\bin\\java.exe'].map((p) => p.replaceAll('\\', '/')),
  );
  const exists = (p) => have.has(`${p}`.replaceAll('\\', '/'));
  const list = () => ['maestro-ai.jar', 'maestro-cli-2.10.0.jar', 'maestro-client.jar'];
  const env = { MAESTRO_HOME: 'C:\\maestro', JAVA_HOME: 'C:\\jdk' };
  const ok = locateMaestro({ env, exists, list });
  assert.deepEqual(
    [ok.problems, ok.version, ok.home, ok.java],
    [[], '2.10.0', 'C:\\maestro', join('C:\\jdk', 'bin', 'java.exe')],
  );
  assert.match(
    locateMaestro({ env: { JAVA_HOME: 'C:\\jdk' }, exists, list }).problems.join(),
    /Maestro was not found/,
  );
  assert.match(
    locateMaestro({ env: { MAESTRO_HOME: 'C:\\maestro' }, exists, list }).problems.join(),
    /JAVA_HOME is not set/,
  );
  assert.match(
    locateMaestro({ env: { ...env, JAVA_HOME: 'C:\\nojdk' }, exists, list }).problems.join(),
    /does not exist/,
  );
  assert.match(
    locateMaestro({ env: { ...env, MAESTRO_HOME: 'D:\\nothing' }, exists, list }).problems.join(),
    /not a Maestro installation/,
  );
  assert.match(
    locateMaestro({ env, exists, list: () => ['x.jar'] }).problems.join(),
    /CLI jar was not found/,
  );
  const found = [];
  const viaPath = locateMaestro({
    env: { JAVA_HOME: 'C:\\jdk' },
    exists: () => true,
    list,
    onPath: (n) => (found.push(n), 'C:\\maestro\\bin\\maestro.bat'),
  });
  assert.deepEqual([viaPath.problems, found], [[], ['maestro']]);
});

test('the command line is the JVM running the Maestro CLI with this serial, this flow and a fixed set of options', () => {
  const argv = maestroArgv({
    home: 'C:\\maestro',
    serial: SERIAL,
    flow: 'C:\\f\\a.yaml',
    out: 'C:\\o',
  });
  assert.deepEqual(argv, [
    '--enable-native-access=ALL-UNNAMED',
    '-classpath',
    join('C:\\maestro', 'lib', '*'),
    'maestro.cli.AppKt',
    '--device',
    SERIAL,
    'test',
    '--format',
    'junit',
    '--output',
    join('C:\\o', 'report.xml'),
    '--debug-output',
    join('C:\\o', 'debug'),
    '--test-output-dir',
    join('C:\\o', 'output'),
    'C:\\f\\a.yaml',
  ]);
  // --device is a global option and comes before the subcommand
  assert.ok(argv.indexOf('--device') < argv.indexOf('test'));
  // nothing that sends data to a cloud service, nothing that starts a continuous or sharded run
  for (const never of [
    '--analyze',
    '--api-key',
    '--api-url',
    '--continuous',
    '--shards',
    '--shard-all',
    '--shard-split',
    '--headless',
    '--apple-team-id',
  ])
    assert.ok(!argv.includes(never), never);
});

test('flow variables are passed as -e pairs with plain names; a name or value that could break out is refused', () => {
  const argv = maestroArgv({
    home: 'H',
    serial: SERIAL,
    flow: 'f',
    out: 'o',
    vars: { PHONE: '+251900000901' },
  });
  assert.deepEqual(argv.slice(argv.indexOf('test') + 1, argv.indexOf('test') + 3), [
    '-e',
    'PHONE=+251900000901',
  ]);
  for (const bad of [{ 'a b': '1' }, { lower: '1' }, { '--x': '1' }, { OK: 'a\nb' }])
    assert.throws(
      () => maestroArgv({ home: 'H', serial: SERIAL, flow: 'f', out: 'o', vars: bad }),
      /not acceptable/,
    );
});

test('the Maestro child sees a few host variables and no tokens, no adb redirection, no analytics', () => {
  const host = {
    SystemRoot: 'C:\\Windows',
    PATH: 'C:\\bin',
    TEMP: 'T',
    TMP: 'T',
    USERPROFILE: 'U',
    JAVA_HOME: 'J',
    ANDROID_HOME: 'A',
    EXPO_TOKEN: 'secret',
    GITHUB_TOKEN: 'secret',
    DATABASE_URL: 'postgres://x',
    ADB_SERVER_SOCKET: 'tcp:evil:5037',
    ANDROID_ADB_SERVER_ADDRESS: 'evil',
    MAESTRO_CLOUD_API_KEY: 'secret',
    ANDROID_SERIAL: 'R58M1',
  };
  const env = maestroEnv(host);
  assert.deepEqual(Object.keys(env).sort(), [
    'ANDROID_HOME',
    'JAVA_HOME',
    'MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED',
    'MAESTRO_CLI_NO_ANALYTICS',
    'PATH',
    'SystemRoot',
    'TEMP',
    'TMP',
    'USERPROFILE',
  ]);
  assert.equal(env.MAESTRO_CLI_NO_ANALYTICS, '1');
  assert.ok(!JSON.stringify(env).includes('secret'));
});

test('a JUnit report is read for its numbers and its cases; anything else is not a report', () => {
  const pass = parseJunit(junit({ name: 'A' }));
  assert.deepEqual(
    [pass.tests, pass.failures, pass.errors, pass.cases],
    [1, 0, 0, [{ name: 'A', status: 'SUCCESS', failed: false }]],
  );
  const fail = parseJunit(junit({ failures: 1, name: 'A' }));
  assert.deepEqual([fail.failures, fail.cases[0].failed, fail.cases[0].status], [1, true, 'ERROR']);
  assert.equal(parseJunit('<html>not a report</html>'), null);
  assert.equal(parseJunit(''), null);
});

test("the app's own crash after the start marker is found; another app's crash and an earlier one are not", () => {
  const log = [
    '11-19 09:00:00.000 1 1 E AndroidRuntime: FATAL EXCEPTION: main',
    '11-19 09:00:00.001 1 1 E AndroidRuntime: Process: com.adulis.app, PID: 1',
    '11-19 10:00:00.000 1 1 I ADULIS_NATIVE: start:f:1',
    '11-19 10:00:01.000 1 1 E AndroidRuntime: FATAL EXCEPTION: main',
    '11-19 10:00:01.001 1 1 E AndroidRuntime: Process: com.other.app, PID: 2',
    '11-19 10:00:02.000 1 1 E ActivityManager: ANR in com.adulis.app (com.adulis.app/.MainActivity)',
    '11-19 10:00:03.000 1 1 F libc: Fatal signal 11 (SIGSEGV), code 1 in tid 5 (com.adulis.app)',
    '11-19 10:00:04.000 1 1 E AndroidRuntime: FATAL EXCEPTION: main',
    '11-19 10:00:04.001 1 1 E AndroidRuntime: Process: com.adulis.app, PID: 3',
  ].join('\n');
  const hits = crashLines(log, 'start:f:1');
  assert.equal(hits.length, 3);
  assert.ok(hits.some((l) => /ANR in/.test(l)) && hits.some((l) => /Fatal signal/.test(l)));
  assert.deepEqual(
    crashLines(log.split('\n').slice(0, 5).join('\n'), 'start:f:1'),
    [],
    "another app's crash is not this app's",
  );
  assert.deepEqual(
    crashLines(log.split('\n').slice(0, 3).join('\n'), 'start:f:1'),
    [],
    'a crash before the marker is not this run',
  );
});

const J = {
  tests: 1,
  failures: 0,
  errors: 0,
  cases: [{ name: 'a', status: 'SUCCESS', failed: false }],
};
test('an attempt is classified: pass, assertion, crash, infrastructure, cancelled, unknown', () => {
  const res = (o = {}) => ({ status: 0, error: null, timedOut: false, aborted: false, ...o });
  const row = (a) => classifyAttempt({ res: res(), junit: null, log: '', crashes: [], ...a });
  assert.equal(row({ junit: J }), 'pass');
  assert.equal(
    row({
      res: res({ status: 1 }),
      junit: { ...J, failures: 1, cases: [{ name: 'a', status: 'ERROR', failed: true }] },
    }),
    'assertion',
  );
  assert.equal(row({ junit: J, crashes: ['FATAL'] }), 'crash', 'a crash outranks a passing report');
  assert.equal(row({ res: res({ status: 1 }), log: 'Device is offline' }), 'infrastructure');
  assert.equal(
    row({ res: res({ status: 1 }), log: 'io.grpc.StatusRuntimeException: UNAVAILABLE' }),
    'infrastructure',
  );
  assert.equal(
    row({ res: res({ status: null, error: new Error('spawn failed') }) }),
    'infrastructure',
  );
  assert.equal(row({ res: res({ aborted: true }) }), 'cancelled');
  assert.equal(
    row({ res: res({ timedOut: true, status: null }), junit: null, log: 'device offline' }),
    'unknown',
    'a timeout is never read as an infrastructure error',
  );
  assert.equal(row({ res: res({ status: 1 }), log: 'something unexpected' }), 'unknown');
  assert.equal(
    row({ res: res({ status: 1 }), junit: J, log: 'device offline' }),
    'unknown',
    'a report that passed but a non-zero exit is not retried',
  );
  assert.equal(
    row({ res: res({ status: 1 }), junit: { ...J, failures: 1 }, log: 'device offline' }),
    'assertion',
    'an infrastructure phrase never turns a failed assertion into a retry',
  );
});

test('a verdict is PASS, FAIL (it ran and did not hold) or NOT EXECUTED (it did not run)', () => {
  assert.deepEqual(
    ['pass', 'assertion', 'crash', 'unknown', 'infrastructure', 'cancelled'].map(verdictOf),
    ['PASS', 'FAIL', 'FAIL', 'FAIL', 'NOT EXECUTED', 'NOT EXECUTED'],
  );
});

/* ---- attempts with evidence, and the bounded retry ---- */

const FLOW_TEXT =
  'appId: com.adulis.app\nname: foundation-smoke\n---\n- launchApp:\n    clearState: true\n';

function rig(
  script,
  { budget = RETRY.infraRetriesPerBattery, recheck = async () => [], signal } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), 'native-m-'));
  dirs.push(dir);
  // the approved flow as a file, with the pin of its content
  const flowDir = join(dir, 'flows-src');
  mkdirSync(flowDir, { recursive: true });
  const file = join(flowDir, 'foundation-smoke.yaml');
  writeFileSync(file, FLOW_TEXT);
  const flow = {
    name: 'foundation-smoke',
    file,
    decl: { sha256: flowHash(Buffer.from(FLOW_TEXT)) },
  };
  const dev = fakeDevice();
  const adb = makeAdb(dev.io, SERIAL);
  const m = fakeMaestro((n, o) => script(n, o, dev));
  const slept = [];
  const started = [];
  const ended = [];
  const ctx = {
    io: { maestro: m.maestro },
    adb,
    serial: SERIAL,
    maestro: { home: 'C:\\maestro', java: 'C:\\jdk\\bin\\java.exe' },
    dir,
    flowDir,
    hostEnv: { PATH: 'p', EXPO_TOKEN: 'secret' },
    signal,
    vars: {},
    budget: { infra: budget },
    sleep: async (ms) => slept.push(ms),
    recheck,
    maestroStarted: (pid) => started.push(pid),
    maestroEnded: () => ended.push(1),
  };
  return { ctx, m, dev, dir, slept, flow, flowDir, file, started, ended };
}

test('a passing attempt leaves the report, the log, the device log and a result file, and no failure screenshot', async () => {
  const r = rig(async () => ({ status: 0, junit: junit(), log: 'Flow passed' }));
  const res = await executeFlow(r.ctx, r.flow);
  assert.deepEqual([res.verdict, res.kind, res.attempts.length], ['PASS', 'pass', 1]);
  const out = join(r.dir, 'foundation-smoke', 'attempt-1');
  for (const f of ['report.xml', 'maestro.log', 'logcat.txt', 'attempt.json'])
    assert.ok(existsSync(join(out, f)), f);
  assert.ok(!existsSync(join(out, 'failure.png')));
  assert.match(
    readFileSync(join(out, 'logcat.txt'), 'utf8'),
    /ADULIS_NATIVE: start:foundation-smoke:1/,
  );
  const call = r.m.calls[0];
  assert.equal(call.file, 'C:\\jdk\\bin\\java.exe');
  assert.equal(call.cwd, r.flowDir);
  assert.ok(
    !JSON.stringify(call.env).includes('secret'),
    "the operator's token never reaches the child",
  );
});

test('an assertion failure is a FAIL with a screenshot and the device log, and it is never retried', async () => {
  const r = rig(async () => ({
    status: 1,
    junit: junit({ failures: 1 }),
    log: 'Assertion is false',
  }));
  const res = await executeFlow(r.ctx, r.flow);
  assert.deepEqual([res.verdict, res.kind, res.attempts.length], ['FAIL', 'assertion', 1]);
  assert.equal(r.m.calls.length, 1, 'Maestro ran once');
  assert.ok(existsSync(join(r.dir, 'foundation-smoke', 'attempt-1', 'failure.png')));
  assert.equal(r.ctx.budget.infra, RETRY.infraRetriesPerBattery, 'no retry budget was spent');
});

test('an app crash is a FAIL even if the flow reported success, and it is never retried', async () => {
  const r = rig(async (_n, _o, dev) => {
    dev.st.logcat.push(
      '11-19 10:00:01.000 1 1 E AndroidRuntime: FATAL EXCEPTION: main',
      '11-19 10:00:01.001 1 1 E AndroidRuntime: Process: com.adulis.app, PID: 9',
    );
    return { status: 0, junit: junit() };
  });
  const res = await executeFlow(r.ctx, r.flow);
  assert.deepEqual([res.verdict, res.kind, r.m.calls.length], ['FAIL', 'crash', 1]);
  assert.equal(res.attempts[0].crashes.length, 1);
  assert.ok(existsSync(join(r.dir, 'foundation-smoke', 'attempt-1', 'failure.png')));
});

test('an infrastructure error is retried ONCE, after the checks passed again, and a pass on the retry is a PASS', async () => {
  let rechecks = 0;
  const r = rig(
    async (n) =>
      n === 0
        ? { status: 1, log: 'java.lang.IllegalStateException: Device is offline' }
        : { status: 0, junit: junit() },
    { recheck: async () => ((rechecks += 1), []) },
  );
  const res = await executeFlow(r.ctx, r.flow);
  assert.deepEqual(
    [res.verdict, res.attempts.map((a) => a.kind), r.m.calls.length, rechecks],
    ['PASS', ['infrastructure', 'pass'], 2, 1],
  );
  assert.equal(r.ctx.budget.infra, 0);
  assert.deepEqual(r.slept, [5000]);
});

test('infrastructure errors never loop: two attempts at most, then NOT EXECUTED', async () => {
  const r = rig(async () => ({ status: 1, log: 'adb server is out of date' }));
  const res = await executeFlow(r.ctx, r.flow);
  assert.deepEqual(
    [res.verdict, res.attempts.length, r.m.calls.length],
    ['NOT EXECUTED', RETRY.maxAttempts, RETRY.maxAttempts],
  );
  assert.equal(RETRY.maxAttempts, 2);
});

test('the retry budget of the battery is shared: a second flow with an infrastructure error is not retried', async () => {
  const r = rig(async () => ({ status: 1, log: 'device offline' }), { budget: 1 });
  await executeFlow(r.ctx, r.flow);
  assert.equal(r.ctx.budget.infra, 0);
  const n = r.m.calls.length;
  const second = await executeFlow(r.ctx, { ...r.flow, name: 'buyer-shell' });
  assert.equal(r.m.calls.length - n, 1, 'one attempt, no retry');
  assert.equal(second.verdict, 'NOT EXECUTED');
});

test('no retry when the device or the API no longer pass their checks', async () => {
  const r = rig(async () => ({ status: 1, log: 'device offline' }), {
    recheck: async () => ['NC-01 no device is attached'],
  });
  const res = await executeFlow(r.ctx, r.flow);
  assert.equal(r.m.calls.length, 1);
  assert.equal(res.verdict, 'NOT EXECUTED');
  assert.match(res.attempts[0].noRetry, /not retried: NC-01/);
  assert.equal(r.ctx.budget.infra, 1, 'the budget is spent only on a retry that happens');
});

test('a timeout is a FAIL that is never retried (it is not known to be infrastructure)', async () => {
  const r = rig(async () => ({ status: null, timedOut: true, log: 'device offline' }));
  const res = await executeFlow(r.ctx, r.flow);
  assert.deepEqual([res.verdict, res.kind, r.m.calls.length], ['FAIL', 'unknown', 1]);
});

test('a cancellation stops the flow, starts nothing more, and is NOT EXECUTED', async () => {
  const ac = new AbortController();
  const r = rig(
    async () => {
      ac.abort();
      return { aborted: true, status: null };
    },
    { signal: ac.signal },
  );
  const res = await executeFlow(r.ctx, r.flow);
  assert.deepEqual([res.verdict, res.kind, r.m.calls.length], ['NOT EXECUTED', 'cancelled', 1]);
  const again = await executeFlow(r.ctx, { ...r.flow, name: 'buyer-shell' });
  assert.deepEqual(
    [again.verdict, r.m.calls.length],
    ['NOT EXECUTED', 1],
    'an aborted session starts no further flow',
  );
});

test('a failed log capture is written down as a failure, not left empty', async () => {
  const r = rig(async (_n, _o, dev) => {
    dev.st.failOn = ['logcat'];
    return { status: 0, junit: junit() };
  });
  await runAttempt(r.ctx, r.flow, 1);
  assert.match(
    readFileSync(join(r.dir, 'foundation-smoke', 'attempt-1', 'logcat.txt'), 'utf8'),
    /logcat failed/,
  );
});

/* ---- the flow gate: only the pinned bytes run, and only a copy of exactly those bytes ---- */

test('a flow whose content is not the pinned one is refused before Maestro starts: nothing is run, nothing is logged', async () => {
  const r = rig(async () => ({ status: 0, junit: junit() }));
  writeFileSync(r.file, `${FLOW_TEXT}- tapOn: Home\n`);
  await assert.rejects(
    () => executeFlow(r.ctx, r.flow),
    (e) => e instanceof FlowRefused && /the flow file changed: its content hash is/.test(e.message),
  );
  assert.equal(r.m.calls.length, 0, 'Maestro was never started');
  assert.deepEqual(r.started, []);
  assert.deepEqual(
    r.dev.st.log.filter((c) => c.includes('ADULIS_NATIVE')),
    [],
    'no marker was logged',
  );
  // a flow that has no pin is refused the same way, and so is one that vanished
  const noPin = rig(async () => ({ status: 0, junit: junit() }));
  await assert.rejects(
    () => runAttempt(noPin.ctx, { ...noPin.flow, decl: {} }, 1),
    /has no content pin/,
  );
  rmSync(noPin.file);
  await assert.rejects(() => runAttempt(noPin.ctx, noPin.flow, 1), /cannot be read/);
  assert.equal(noPin.m.calls.length, 0);
});

test('the flow is checked again before every attempt, so a change made between the two attempts is caught', async () => {
  const r = rig(
    async (n, _o) => {
      if (n === 0) writeFileSync(r.file, `${FLOW_TEXT}- tapOn: Home\n`); // changed while the first attempt ran
      return { status: 1, log: 'device offline' };
    },
    { recheck: async () => [] },
  );
  await assert.rejects(() => executeFlow(r.ctx, r.flow), FlowRefused);
  assert.equal(r.m.calls.length, 1, 'the second attempt never started');
});

test('Maestro runs a copy of the verified bytes: a change to the original after the check does not reach it', async () => {
  let seen = null;
  const r = rig(async (_n, o) => {
    const given = o.args.at(-1);
    writeFileSync(r.file, 'appId: com.other.app\n---\n- clearKeychain\n'); // the original is replaced during the run
    seen = [given, readFileSync(given, 'utf8')];
    return { status: 0, junit: junit() };
  });
  const res = await executeFlow(r.ctx, r.flow);
  assert.equal(res.verdict, 'PASS');
  assert.equal(seen[1], FLOW_TEXT);
  assert.notEqual(seen[0], r.file, 'Maestro was not given the original file');
  assert.ok(seen[0].startsWith(join(r.dir, 'foundation-smoke', 'attempt-1')), seen[0]);
  assert.equal(res.attempts[0].flowSha256, flowHash(Buffer.from(FLOW_TEXT)));
});

test('the session is told when Maestro starts and when it has ended, with the pid it ran as', async () => {
  const r = rig(async () => ({ status: 0, junit: junit() }));
  await executeFlow(r.ctx, r.flow);
  assert.deepEqual([r.started, r.ended.length], [[4321], 1]);
  assert.equal(r.ctx.maestroStarted !== undefined, true);
});

test('a Maestro process that would not stop stays recorded, is never retried and nothing is started over it', async () => {
  const r = rig(async () => ({ status: null, stuck: true, error: new Error('did not stop') }), {
    budget: 3,
  });
  const res = await executeFlow(r.ctx, r.flow);
  assert.equal(r.m.calls.length, 1, 'no retry although the error looks like infrastructure');
  assert.equal(r.ended.length, 0, 'the record of the process is kept for the next restore');
  assert.equal(res.attempts[0].stuck, true);
  assert.equal(r.ctx.budget.infra, 3, 'no budget was spent');
});

test('a Maestro process that could not be recorded in the lock stops the flow before any result is read, and is said', async () => {
  const r = rig(async () => ({ status: 0, junit: junit() }));
  r.ctx.maestroStarted = async () => {
    throw new Error('the lock is gone');
  };
  await assert.rejects(
    () => executeFlow(r.ctx, r.flow),
    (e) =>
      e instanceof MaestroUnrecorded &&
      /the Maestro process 4321 could not be recorded in the session lock \(the lock is gone\); it was stopped/.test(
        e.message,
      ),
  );
  assert.equal(r.m.calls.length, 1, 'no retry');
  assert.equal(r.ended.length, 0);
  assert.ok(
    !existsSync(join(r.dir, 'foundation-smoke', 'attempt-1', 'attempt.json')),
    'no result was written',
  );
});
