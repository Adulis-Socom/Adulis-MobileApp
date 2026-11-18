#!/usr/bin/env node
// The native test harness: an isolated PostgreSQL and MinIO per run, an API built from a verified
// checkout, synthetic fixtures, and cleanup that proves ownership before it deletes. See README.md.
//
//   node ops/native/harness.mjs <command> [--run R] [--checkout PATH] [--sha SHA] [--serial S] [--set NAME]
//
// ONE exit-code scheme and ONE status vocabulary for every command (README.md lists both):
//   0  OK          the command did what it says. Only `up` and a full `verify` print READY, and READY
//                  names what was verified; every other command prints `HARNESS OK - <command>`.
//   1  REFUSED     a rule was evaluated and the operation does not satisfy it (an identity check, the
//                  checkout, a port in use, a process that is not the recorded one).
//   2  COULD NOT CHECK or USAGE   a check could not be made, the input is wrong, or an unexpected
//                  error happened before anything was changed (fail closed).
//   3  INCOMPLETE  something WAS changed (a resource, a process, a device, a directory) and the
//                  command did not finish; the line says what and how to continue.
//   4  BLOCKED     a precondition of `up` is not met; nothing was started.
// "NO RESOURCE WAS CHANGED" is printed only when no mutating call of this command went out.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statfsSync } from 'node:fs';
import { freemem, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startApi, stopApi, provenanceProblems } from './lib/api.mjs';
import { appendOp, executeDown, planDown, purge, purgeGateProblems } from './lib/cleanup.mjs';
import { deviceProblems, observeDevice, prepareDevice, restoreDevice } from './lib/device.mjs';
import { CHECKS, observe, psqlArgs, verify } from './lib/identity.mjs';
import { assertTarget, Refusal, Refused } from './lib/guard.mjs';
import { realIo } from './lib/io.mjs';
import { newRun, RUN_RE, readManifest, runDir, writeManifest } from './lib/manifest.mjs';
import { dockerSteps, minioImage, PG_IMAGE, up } from './lib/stack.mjs';
import { canaryDeviceId, loadSet, SETS } from './fixtures/index.mjs';

export const EXIT = { OK: 0, REFUSED: 1, COULD_NOT_CHECK: 2, INCOMPLETE: 3, BLOCKED: 4 };
export const STATUS = {
  READY_STACK: 'HARNESS READY - STACK VERIFIED - NATIVE EXECUTION NOT PERFORMED',
  READY_API: 'HARNESS READY - STACK AND API VERIFIED - NATIVE EXECUTION NOT PERFORMED',
};
const GB = 1024 ** 3;
// Free memory a run needs. The containers live in the Docker VM; the host side is the API build
// (the largest step) and the API. A device session adds an emulator and needs far more.
export const MIN_FREE = { stack: 1.0 * GB, device: 6 * GB };
const MIN_DISK = 5 * GB;

class Blocked extends Error {}
class Usage extends Error {}

/* ---- tracking what a command changed, so a status line never claims more than is proven ---- */

const READ_ONLY_DOCKER = new Set(['info', 'ps', 'inspect', 'context']);
/** Every docker call is a change unless it is one of these reads (an exec without stdin is a read). */
export function isMutatingDocker(args, opts = {}) {
  const [a, b] = args;
  if (READ_ONLY_DOCKER.has(a)) return false;
  if ((a === 'volume' || a === 'network') && (b === 'ls' || b === 'inspect')) return false;
  if (a === 'exec' && opts.input === undefined) return false;
  return true;
}
export const isMutatingAdb = (args) => args.includes('reverse') && !args.includes('--list');
// `docker run` can create a container and fail to start it, and `docker rm -f` can stop one and fail
// to remove it: a non-zero exit does not prove either changed nothing.
const CHANGED_WHATEVER_THE_EXIT = new Set(['run', 'rm']);
/** An HTTP request that makes the API write: any method but GET or HEAD, or one that carries a device id. */
export function isMutatingRequest(opts = {}) {
  const method = `${opts.method ?? 'GET'}`.toUpperCase();
  const headers = Object.keys(opts.headers ?? {}).map((k) => k.toLowerCase());
  return (method !== 'GET' && method !== 'HEAD') || headers.includes('x-adulis-device');
}

/** Wraps the effects: `mark(what)` runs when a call that changes something went out. */
export function trackIo(io, mark) {
  return {
    ...io,
    docker: async (args, opts) => {
      const r = await io.docker(args, opts);
      // A command that definitively failed (non-zero exit) changed nothing; a success or an
      // unknown outcome (timeout, killed) may have. Assumption: an `exec` with stdin that exits
      // non-zero changed nothing. That holds for the fixture load (one transaction); the stamp,
      // role and MinIO setup scripts of `up` could apply partly, but `up` has already marked the
      // containers it runs them in.
      if (
        isMutatingDocker(args, opts) &&
        (r.error || r.status === 0 || CHANGED_WHATEVER_THE_EXIT.has(args[0]))
      )
        mark(`docker ${args.slice(0, args[0] === 'exec' ? 1 : 2).join(' ')}`);
      return r;
    },
    // The mark comes BEFORE the request: the API may have written even if the answer never arrives.
    fetch: (url, opts) => {
      if (isMutatingRequest(opts)) mark('API request');
      return io.fetch(url, opts);
    },
    adb: async (args) => {
      const r = await io.adb(args);
      if (isMutatingAdb(args) && (r.error || r.status === 0)) mark('adb reverse');
      return r;
    },
    proc: {
      ...io.proc,
      kill: (pid) => {
        mark('process stop');
        return io.proc.kill(pid);
      },
    },
    spawnApi: (o) => {
      mark('API process');
      return io.spawnApi(o);
    },
    build: (c) => {
      mark('API build');
      return io.build(c);
    },
    run: (...a) => {
      mark('node child process');
      return io.run(...a);
    },
  };
}

/** Read-only: why a run cannot start now. An empty list means it may. */
export async function preflightProblems(
  io,
  { root, profile = 'stack', freeBytes = freemem(), diskBytes } = {},
) {
  const p = [];
  if (freeBytes < MIN_FREE[profile])
    p.push(
      `free memory ${(freeBytes / GB).toFixed(2)} GB is below the ${(MIN_FREE[profile] / GB).toFixed(1)} GB the ${profile} profile needs`,
    );
  for (const dir of [root, tmpdir()]) {
    let free;
    try {
      free =
        diskBytes ??
        (() => {
          const s = statfsSync(dir);
          return s.bavail * s.bsize;
        })();
    } catch {
      p.push(`could not read the free space of ${dir}`);
      continue;
    }
    if (free < MIN_DISK) p.push(`free space under ${dir} is below ${MIN_DISK / GB} GB`);
  }
  const ps = await io.docker(['ps', '-a', '--format', '{{.Names}}']);
  if (ps.error || ps.status !== 0) p.push('docker is not reachable');
  else {
    const others = ps.stdout.split(/\s+/).filter((n) => /^adulis-(test|native)-/.test(n));
    if (others.length)
      p.push(`other test containers exist (${others.join(', ')}): one Docker-heavy job at a time`);
  }
  const runs = join(root, 'runs');
  if (existsSync(runs))
    for (const r of readdirSync(runs)) {
      try {
        const st = readManifest(join(runs, r)).state;
        if (st !== 'cleaned') p.push(`run ${r} is '${st}': run \`down --run ${r}\` first`);
      } catch {
        p.push(`run directory ${r} has no readable manifest: it is left alone; resolve it by hand`);
      }
    }
  return p;
}

const need = (v, name) => {
  if (!v) throw new Usage(`${name} is required`);
  return v;
};

/** A drive letter or UNC path on Windows (a drive-relative path is not enough), any absolute path elsewhere. */
export const rootProblem = (root, platform = process.platform) => {
  if (!root) return 'ADULIS_NATIVE_ROOT is not set';
  const ok =
    platform === 'win32'
      ? /^([A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/.test(root)
      : isAbsolute(root);
  return ok
    ? null
    : 'ADULIS_NATIVE_ROOT must be an absolute directory (a drive letter or UNC path on Windows)';
};

function load(root, run) {
  if (!RUN_RE.test(`${run}`)) throw new Usage('--run must be a native run id');
  const dir = runDir(root, run);
  let m;
  try {
    m = readManifest(dir);
  } catch (e) {
    throw new Usage(`no readable manifest for ${run}: ${e.message}`);
  }
  if (m?.run !== run)
    throw new Refused(`the manifest in ${dir} belongs to run ${m?.run}, not ${run}`);
  return { m, dir };
}

const RECOVERY = {
  up: 'run `down --run <run>` to remove what was created',
  fixtures: 'run `down --run <run>` (the run is in an unknown state)',
  api: 'run `api stop` and `down --run <run>`',
  device: 'run `device restore` and check `adb reverse --list`',
  down: 'run `down --run <run>` again',
  purge: 'inspect the run directory by hand',
};

export async function main(
  argv,
  {
    io: realOrFake = realIo(),
    env = process.env,
    out = (s) => process.stdout.write(`${s}\n`),
    preflight = preflightProblems,
    rm,
  } = {},
) {
  let status = null;
  let code = EXIT.OK;
  let runId;
  let cmd;
  const mutations = [];
  const io = trackIo(realOrFake, (what) => mutations.push(what));
  try {
    let parsed;
    try {
      parsed = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
          run: { type: 'string' },
          checkout: { type: 'string' },
          sha: { type: 'string' },
          serial: { type: 'string' },
          set: { type: 'string' },
        },
      });
    } catch (e) {
      throw new Usage(e.message);
    }
    const { values: a, positionals } = parsed;
    let sub;
    [cmd, sub] = positionals;
    runId = a.run;
    const root = env.ADULIS_NATIVE_ROOT;
    if (cmd !== 'selftest' && cmd !== undefined) {
      const bad = rootProblem(root);
      if (bad) throw new Usage(bad);
    }
    const say = out;
    status = `HARNESS OK - ${cmd}`;

    switch (cmd) {
      case 'selftest': {
        const dir = join(dirname(fileURLToPath(import.meta.url)), 'test');
        const files = readdirSync(dir)
          .filter((f) => f.endsWith('.test.mjs'))
          .map((f) => join(dir, f));
        const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
        code = r.status === 0 ? EXIT.OK : EXIT.COULD_NOT_CHECK;
        if (code !== EXIT.OK) status = 'HARNESS SELFTEST FAILED';
        break;
      }
      case 'plan': {
        const checkout = resolve(need(a.checkout, '--checkout'));
        const m = { ...newRun(), ports: { pg: 57101, s3: 57102, api: 57103 } };
        say(`run ${m.run} (the ports shown are examples: \`up\` picks free ones)`);
        for (const [k, args] of Object.entries(
          dockerSteps(m, { pg: PG_IMAGE, minio: minioImage(checkout) }),
        ))
          say(
            `docker ${k}: ${args.map((x) => (/^(POSTGRES_PASSWORD|MINIO_ROOT_(USER|PASSWORD))=/.test(x) ? x.replace(/=.*/, '=<random>') : x)).join(' ')}`,
          );
        say(
          `checks: ${Object.entries(CHECKS)
            .map(([k, v]) => `${k} ${v}`)
            .join('; ')}`,
        );
        break;
      }
      case 'preflight': {
        const p = await preflight(io, { root, profile: sub === 'device' ? 'device' : 'stack' });
        if (p.length) throw new Blocked(p.join('; '));
        say('preflight: nothing blocks a run');
        break;
      }
      case 'up': {
        const checkout = resolve(need(a.checkout, '--checkout'));
        const prov = await provenanceProblems(checkout, a.sha, (x) => io.git(x, checkout));
        if (prov.length) throw new Refused(`refused: ${prov.join('; ')}`);
        const p = await preflight(io, { root });
        if (p.length) throw new Blocked(p.join('; '));
        const r = await up(io, {
          root,
          repo: checkout,
          log: (s) => say(`up: ${s}`),
          onRun: (x) => {
            runId = x;
            // The run directory exists from here on, whatever happens next.
            mutations.push('run directory');
          },
        });
        for (const x of r.results) say(`  ${x.verdict}  ${x.id} ${CHECKS[x.id]}`);
        say(
          `run ${r.m.run} is ready (ADULIS_NATIVE_RUN=${r.m.run}); API port ${r.m.ports.api}, PostgreSQL ${r.m.ports.pg}, MinIO ${r.m.ports.s3}`,
        );
        status = STATUS.READY_STACK;
        break;
      }
      case 'verify': {
        const { m, dir } = load(root, a.run);
        const results = await assertTarget(m, m.api ? 'API-WRITE' : 'STACK', io, {
          dir,
          states: ['ready'],
        });
        for (const x of results) say(`  ${x.verdict}  ${x.id} ${CHECKS[x.id]}`);
        status = m.api ? STATUS.READY_API : STATUS.READY_STACK;
        break;
      }
      case 'reverify': {
        // After a PostgreSQL restart only: records the new start time if EVERYTHING else is unchanged
        // (manifest, engine, mounts, ports, labels, server, database, marker).
        const { m, dir } = load(root, a.run);
        const need0 = ['ID-00', 'ID-01', 'ID-02', 'ID-03', 'ID-08', 'ID-09', 'ID-10'];
        const first = await verify(m, io, ['ID-00'], { states: ['ready'] });
        if (first.some((x) => x.verdict !== 'PASS')) throw new Refusal('reverify', first);
        const seen = (await observe(m, io, ['ID-01'])).pg?.inside;
        if (!seen || seen.error) throw new Usage(`could not read PostgreSQL: ${seen?.error}`);
        const next = { ...m, db: { ...m.db, postmasterStart: seen.startTime } };
        const results = await verify(next, io, need0, { states: ['ready'] });
        if (results.some((x) => x.verdict !== 'PASS')) throw new Refusal('reverify', results);
        writeManifest(dir, {
          ...next,
          restarts: [
            ...(m.restarts ?? []),
            { at: new Date().toISOString(), from: m.db.postmasterStart, to: seen.startTime },
          ],
        });
        say(`recorded the new PostgreSQL start time ${seen.startTime}; no operation was run`);
        break;
      }
      case 'fixtures': {
        const { m, dir } = load(root, a.run);
        const name = need(a.set, '--set');
        if (!Object.hasOwn(SETS, name))
          throw new Usage(`unknown fixture set '${name}' (known: ${Object.keys(SETS).join(', ')})`);
        await loadSet(m, io, name, { dir });
        say(`fixture set ${name} loaded into ${m.run}`);
        break;
      }
      case 'api': {
        if (!['start', 'stop', 'canary'].includes(sub))
          throw new Usage('usage: api start|stop|canary');
        const { m, dir } = load(root, a.run);
        if (sub === 'start') {
          const r = await startApi(m, io, {
            checkout: resolve(need(a.checkout, '--checkout')),
            sha: need(a.sha, '--sha'),
            dir,
          });
          say(`API pid ${r.api.pid} on port ${r.ports.api}, boot marker verified`);
        } else if (sub === 'stop') {
          const r = await stopApi(m, io, dir);
          say(r.stopped ? 'API stopped' : `API not stopped: ${r.why}`);
        } else {
          // An API-mediated write read back from THIS database by a run-unique value.
          await assertTarget(m, 'API-WRITE', io, { dir, states: ['ready'] });
          const id = canaryDeviceId(m);
          const res = await io.fetch(`http://127.0.0.1:${m.ports.api}/v1/bootstrap`, {
            signal: AbortSignal.timeout(8000),
            headers: { 'X-Adulis-Client': 'android/0.0.0', 'X-Adulis-Device': id },
          });
          if (!res.ok) throw new Error(`bootstrap answered ${res.status}`);
          const q = await io.docker(
            psqlArgs(m, m.containers.postgres.id, [
              '-c',
              `SELECT market_id IS NOT NULL FROM core.device WHERE id = '${id}'`,
            ]),
          );
          if (q.stdout.trim() !== 't')
            throw new Refusal('api canary', [
              {
                id: 'ID-04',
                verdict: 'FAIL',
                detail: "the API write was not found in this run's database",
              },
            ]);
          say('canary: the API wrote the run-unique device into this database');
        }
        break;
      }
      case 'device': {
        if (!['check', 'prepare', 'restore'].includes(sub))
          throw new Usage('usage: device check|prepare|restore');
        const { m, dir } = load(root, a.run);
        const serial = a.serial ?? env.ANDROID_SERIAL;
        const adb = (x) => io.adb(x);
        const facts = serial ? await observeDevice(adb, serial) : {};
        const p = deviceProblems(m, serial, facts);
        if (p.length)
          throw new Refusal(
            'device',
            p.map((detail) => ({ id: 'ID-11', verdict: 'FAIL', detail })),
          );
        if (sub === 'prepare') {
          await assertTarget(m, 'API-WRITE', io, { dir, states: ['ready'] });
          await prepareDevice(m, adb, serial);
          say(`reverse ports set on ${serial}`);
        } else if (sub === 'restore') {
          await restoreDevice(m, adb, serial);
          say(`reverse ports removed from ${serial}`);
        } else say(`device ${serial} passes the device checks`);
        break;
      }
      case 'env': {
        const { m } = load(root, a.run);
        say(`export ADULIS_NATIVE_RUN='${m.run}'`);
        say(`export EXPO_PUBLIC_API_BASE_URL='http://localhost:${m.ports.api}'`);
        if (a.serial) say(`export ANDROID_SERIAL='${a.serial.replaceAll("'", '')}'`);
        break;
      }
      case 'status': {
        const { m } = load(root, a.run);
        say(
          `run ${m.run}: ${m.state}; fixtures [${m.fixtures.join(', ')}]; API ${m.api ? `pid ${m.api.pid}` : 'not started'}; nothing was verified by this command`,
        );
        break;
      }
      case 'down':
      case 'recover': {
        const { m, dir } = load(root, a.run);
        if (m.state === 'cleaned') {
          say('already cleaned');
          break;
        }
        const plan = await planDown(m, io);
        if (plan.problems.length || plan.unknowns.length)
          throw new Refused(
            `refused down: ${[...plan.problems, ...plan.unknowns].join('; ')}`,
            plan.problems.length ? 1 : 2,
          );
        const left = [];
        if (m.api) {
          try {
            await stopApi(m, io, dir);
          } catch (e) {
            // A refusal means the recorded pid is no longer the API (it is not running as ours);
            // anything else (the process lookup failed) means it may still run.
            if (e instanceof Refused) say(`warning: ${e.message}`);
            else left.push(`API process ${m.api.pid} may still run: ${e.message}`);
          }
        }
        writeManifest(dir, { ...m, state: 'cleanup' });
        const done = await executeDown(m, plan.steps, io, (e) => appendOp(dir, e));
        left.push(...done.left);
        for (const s of done.removed) say(`removed ${s.kind} ${s.name ?? s.id}`);
        if (left.length) {
          writeManifest(dir, { ...m, state: 'cleanup-incomplete', left });
          code = EXIT.INCOMPLETE;
          status = `HARNESS CLEANUP INCOMPLETE - ${left.length} RESOURCES LEFT, REGISTERED`;
          for (const l of left) say(`left: ${l}`);
        } else {
          writeManifest(dir, {
            ...m,
            state: 'cleaned',
            api: null,
            cleanup: {
              at: new Date().toISOString(),
              engineId: m.engine.id,
              removed: done.removed.length,
            },
          });
          if (!done.removed.length)
            say(
              `nothing of this run was found in Docker engine ${m.engine.id.slice(0, 12)}, the engine it was created in: recorded as cleaned`,
            );
          for (const l of m.left ?? []) say(`previously recorded, still to check by hand: ${l}`);
          status = `HARNESS OK - ${cmd} (${done.removed.length} removed)`;
        }
        break;
      }
      case 'purge': {
        const run = need(a.run, '--run');
        const { m } = load(root, run);
        const gate = await purgeGateProblems(m, io);
        if (gate.problems.length || gate.unknowns.length)
          throw new Refused(
            `refused purge: ${[...gate.problems, ...gate.unknowns].join('; ')}`,
            gate.problems.length ? 1 : 2,
          );
        const p = purge(root, run, { onRemove: () => mutations.push('run directory'), rm });
        if (p.length) throw new Refused(`refused purge: ${p.join('; ')}`);
        say(`purged ${runDir(root, run)}`);
        break;
      }
      default:
        throw new Usage(
          'usage: harness.mjs plan|preflight|up|verify|reverify|fixtures|api|device|env|status|down|recover|purge|selftest',
        );
    }
  } catch (e) {
    const changed = mutations.length
      ? ` after ${mutations.length} change(s) (${[...new Set(mutations)].join(', ')})`
      : '';
    const how = (RECOVERY[cmd] ?? 'check the state by hand').replace('<run>', runId ?? '<run>');
    if (e instanceof Blocked) {
      code = EXIT.BLOCKED;
      status = `HARNESS BLOCKED - ${e.message} - NOTHING STARTED`;
    } else if (mutations.length) {
      // Something was changed: never say otherwise, whatever stopped the command.
      code = EXIT.INCOMPLETE;
      const why =
        e instanceof Refusal && e.firstId ? `${e.firstId} ${CHECKS[e.firstId]} refused` : e.message;
      if (e instanceof Refused) out(e.message);
      status = `HARNESS INCOMPLETE - ${why}${changed}; ${how}`;
    } else if (e instanceof Refused) {
      code = e.code;
      const first = e.firstId ? `${e.firstId} ${CHECKS[e.firstId]}` : e.message;
      status = `HARNESS REFUSED - ${first}${code === EXIT.COULD_NOT_CHECK ? ' (could not be checked)' : ''} - NO RESOURCE WAS CHANGED`;
      out(e.message);
    } else if (e instanceof Usage) {
      code = EXIT.COULD_NOT_CHECK;
      status = `HARNESS USAGE - ${e.message}`;
    } else {
      code = EXIT.COULD_NOT_CHECK;
      status = `HARNESS ERROR - ${e.message} - NO RESOURCE WAS CHANGED`;
    }
  }
  out(status);
  return code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
