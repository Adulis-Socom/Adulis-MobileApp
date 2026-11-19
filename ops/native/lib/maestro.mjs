// Running one approved flow with Maestro and collecting what it leaves: the JUnit report, its log, its
// screenshots, the device log and, on a failure, a screenshot of the screen. The command line is built
// here from a fixed list of options (nothing from the operator's shell is passed on, and the options
// that would send data to a cloud service are not on the list). Maestro starts from the JVM directly,
// not through its batch file, so the process this driver started is the process it can stop.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { adbOk as ok } from './adb.mjs';
import { APP_ID } from './device.mjs';
import { flowHash, verifyFlowFile } from './flows.mjs';

/** One retry of an infrastructure error in a battery; a flow is never retried for what it asserts. */
export const RETRY = { maxAttempts: 2, infraRetriesPerBattery: 1 };
export const FLOW_TIMEOUT_MS = 900_000;

/** Where Maestro and its JVM are, without starting either. { home, java, version, problems }. */
export function locateMaestro({
  env,
  exists = existsSync,
  list = readdirSync,
  onPath = () => null,
}) {
  const problems = [];
  let home = env.MAESTRO_HOME;
  if (!home) {
    const bin = onPath('maestro');
    if (bin) home = join(bin, '..', '..');
  }
  const javaHome = env.JAVA_HOME;
  const java = javaHome ? join(javaHome, 'bin', 'java.exe') : null;
  if (!home) problems.push('Maestro was not found (set MAESTRO_HOME or put it on PATH)');
  else if (!exists(join(home, 'lib')))
    problems.push(`${home} has no lib directory: it is not a Maestro installation`);
  if (!java) problems.push('JAVA_HOME is not set (Maestro needs a Java 17 or newer)');
  else if (!exists(java)) problems.push(`${java} does not exist`);
  let version = null;
  if (home && !problems.length) {
    const jar = list(join(home, 'lib')).find((f) => /^maestro-cli-.+\.jar$/.test(f));
    version = jar ? jar.slice('maestro-cli-'.length, -'.jar'.length) : null;
    if (!version) problems.push('the Maestro CLI jar was not found in lib');
  }
  return { home, java, version, problems };
}

const VAR_NAME = /^[A-Z][A-Z0-9_]*$/;

/** The JVM command line of `maestro --device <serial> test ... <flow>`. */
export function maestroArgv({ home, serial, flow, out, vars = {} }) {
  for (const [k, v] of Object.entries(vars))
    if (!VAR_NAME.test(k) || /[\r\n]/.test(`${v}`))
      throw new Error(`flow variable ${k} is not acceptable`);
  return [
    '--enable-native-access=ALL-UNNAMED',
    '-classpath',
    join(home, 'lib', '*'),
    'maestro.cli.AppKt',
    '--device',
    serial,
    'test',
    ...Object.entries(vars).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    '--format',
    'junit',
    '--output',
    join(out, 'report.xml'),
    '--debug-output',
    join(out, 'debug'),
    '--test-output-dir',
    join(out, 'output'),
    flow,
  ];
}

/** The environment of the Maestro process: a few host variables and nothing else (no tokens, no adb redirection). */
export function maestroEnv(host) {
  const env = {};
  for (const k of ['SystemRoot', 'PATH', 'TEMP', 'TMP', 'USERPROFILE', 'JAVA_HOME', 'ANDROID_HOME'])
    if (host[k]) env[k] = host[k];
  return {
    ...env,
    MAESTRO_CLI_NO_ANALYTICS: '1',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
  };
}

/** The numbers and cases of a Maestro JUnit report, or null when it is not one. */
export function parseJunit(xml) {
  const suite = /<testsuite\b([^>]*)>/.exec(xml);
  if (!suite) return null;
  const attr = (s, n) => Number(new RegExp(`\\b${n}="(\\d+)"`).exec(s)?.[1] ?? 0);
  const cases = [...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map(
    (m) => ({
      name: /\bname="([^"]*)"/.exec(m[1])?.[1] ?? '',
      status: /\bstatus="([^"]*)"/.exec(m[1])?.[1] ?? '',
      failed: /<(failure|error)\b/.test(m[2] ?? ''),
    }),
  );
  return {
    tests: attr(suite[1], 'tests') || cases.length,
    failures: attr(suite[1], 'failures'),
    errors: attr(suite[1], 'errors'),
    cases,
  };
}

/** The app's own crashes in a device log, after the run's start marker. */
export function crashLines(logcat, marker, appId = APP_ID) {
  const lines = logcat.split(/\r?\n/);
  const from = marker ? lines.findIndex((l) => l.includes(marker)) : 0;
  const body = lines.slice(from < 0 ? 0 : from);
  const esc = appId.replaceAll('.', '\\.');
  const hits = [];
  body.forEach((l, i) => {
    if (
      /FATAL EXCEPTION/.test(l) &&
      body.slice(i, i + 4).some((x) => new RegExp(`Process: ${esc}\\b`).test(x))
    )
      hits.push(l.trim());
    else if (new RegExp(`ANR in ${esc}\\b`).test(l)) hits.push(l.trim());
    else if (new RegExp(`Fatal signal \\d+.*\\(${esc}\\)`).test(l)) hits.push(l.trim());
  });
  return hits;
}

const INFRA = [
  /device (?:is )?offline/i,
  /device .* not found/i,
  /no (?:connected )?devices?(?:\/emulators)? found/i,
  /adb server/i,
  /failed to connect to/i,
  /uiautomation not connected/i,
  /unable to launch (?:the )?maestro driver/i,
  /maestro driver/i,
  /\bUNAVAILABLE\b/,
  /DEADLINE_EXCEEDED/,
  /failed to install/i,
  /io\.grpc\./,
];

/**
 * What a finished attempt was: 'pass', 'assertion' (the flow ran and a step did not hold), 'crash' (the app
 * died), 'infrastructure' (the flow did not run: the device, adb or the Maestro driver failed), 'cancelled',
 * or 'unknown'. Only 'infrastructure' is ever retried.
 */
export function classifyAttempt({ res, junit, log, crashes }) {
  if (res.aborted) return 'cancelled';
  if (crashes.length) return 'crash';
  if (
    junit &&
    (junit.failures > 0 ||
      junit.errors > 0 ||
      junit.cases.some((c) => c.failed || /ERROR|FAIL/i.test(c.status)))
  )
    return 'assertion';
  if (res.timedOut) return 'unknown';
  if (res.status === 0 && junit && junit.tests > 0) return 'pass';
  if (!junit && (res.error || INFRA.some((re) => re.test(log)))) return 'infrastructure';
  return 'unknown';
}

const safeRead = (p) => {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
};

/**
 * One attempt of one flow. `ctx`: { io, adb, serial, maestro: { home, java }, dir, flowDir, hostEnv, signal, vars }.
 * Evidence lands in <dir>/<flow>/attempt-<n>/.
 */
export async function runAttempt(ctx, flow, n) {
  const out = join(ctx.dir, flow.name, `attempt-${n}`);
  mkdirSync(out, { recursive: true });
  // The file is read and checked against its pin NOW, and Maestro runs a copy of exactly those bytes.
  const pinned = verifyFlowFile(flow.file, flow.decl.sha256);
  if (pinned.problem) throw new FlowRefused(`flow '${flow.name}': ${pinned.problem}`);
  const copy = join(out, 'flow', basename(flow.file));
  mkdirSync(join(out, 'flow'), { recursive: true });
  writeFileSync(copy, pinned.buffer);
  const marker = `start:${flow.name}:${n}`;
  await ctx.adb(['shell', 'log', '-t', 'ADULIS_NATIVE', marker]);
  const argv = maestroArgv({
    home: ctx.maestro.home,
    serial: ctx.serial,
    flow: copy,
    out,
    vars: ctx.vars,
  });
  const res = await ctx.io.maestro({
    file: ctx.maestro.java,
    args: argv,
    cwd: ctx.flowDir,
    env: maestroEnv(ctx.hostEnv),
    timeout: flow.decl.timeoutMs ?? FLOW_TIMEOUT_MS,
    signal: ctx.signal,
    log: join(out, 'maestro.log'),
    onSpawn: (pid) => ctx.maestroStarted?.(pid),
  });
  if (!res.stuck) await ctx.maestroEnded?.(); // a process that would not stop stays recorded in the lock
  const logcat = await ctx.adb(['logcat', '-d', '-v', 'threadtime', '-t', '20000']);
  const lc = ok(logcat) ? logcat.stdout : '';
  writeFileSync(
    join(out, 'logcat.txt'),
    ok(logcat) ? lc : `logcat failed: ${logcat.stderr || logcat.error?.message}\n`,
  );
  const xml = safeRead(join(out, 'report.xml'));
  const junit = xml ? parseJunit(xml) : null;
  const log = safeRead(join(out, 'maestro.log'));
  const crashes = crashLines(lc, marker);
  const kind = classifyAttempt({ res, junit, log, crashes });
  let screenshot = null;
  if (kind !== 'pass' && kind !== 'cancelled') {
    const shot = await ctx.adb.bytes(['exec-out', 'screencap', '-p']).catch(() => null);
    if (shot && !shot.error && shot.status === 0 && shot.stdout?.length > 8) {
      writeFileSync(join(out, 'failure.png'), shot.stdout);
      screenshot = 'failure.png';
    }
  }
  const files = readdirSync(out);
  const result = {
    n,
    kind,
    flowSha256: flowHash(pinned.buffer),
    status: res.status,
    timedOut: !!res.timedOut,
    stuck: !!res.stuck,
    maestroPid: res.pid ?? null,
    crashes,
    junit: junit && { tests: junit.tests, failures: junit.failures, errors: junit.errors },
    screenshot,
    files,
  };
  writeFileSync(join(out, 'attempt.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

/** A flow file that is not the pinned one: the session stops, nothing is run, the device is restored. */
export class FlowRefused extends Error {}

/** The verdict a flow gets from its last attempt. */
export const verdictOf = (kind) =>
  kind === 'pass'
    ? 'PASS'
    : kind === 'infrastructure' || kind === 'cancelled'
      ? 'NOT EXECUTED'
      : 'FAIL';

/**
 * Runs a flow with the bounded retry policy: at most RETRY.maxAttempts attempts, a retry only after an
 * infrastructure error, only while the battery's retry budget lasts, and only after the device and the
 * API passed their checks again (`ctx.recheck()` resolves a list of problems). `ctx.budget.infra` counts down.
 */
export async function executeFlow(ctx, flow) {
  const attempts = [];
  for (let n = 1; n <= RETRY.maxAttempts; n += 1) {
    if (ctx.signal?.aborted) {
      attempts.push({ n, kind: 'cancelled' });
      break;
    }
    const r = await runAttempt(ctx, flow, n);
    attempts.push(r);
    if (r.stuck) break; // a process that would not stop: nothing more is started over it
    if (r.kind !== 'infrastructure' || n === RETRY.maxAttempts || ctx.budget.infra <= 0) break;
    const problems = await ctx.recheck();
    if (problems.length) {
      r.noRetry = `not retried: ${problems.join('; ')}`;
      break;
    }
    ctx.budget.infra -= 1;
    await ctx.sleep(5000);
  }
  const last = attempts.at(-1);
  return { flow: flow.name, verdict: verdictOf(last.kind), kind: last.kind, attempts };
}
