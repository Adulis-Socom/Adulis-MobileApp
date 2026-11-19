// One native session: the conditions, the settings (journaled), the approved flows, the evidence, and
// the restoration that runs whatever happened in between. The session returns a verdict in the exit
// scheme of the harness; it never throws for a device problem after the first change, because the one
// thing that must still happen then is putting the device back.
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { adbOk as ok, listDevices, makeAdb, MAESTRO_DRIVER } from './adb.mjs';
import { appIdentity, apkInfo, buildProblems, nativeDepsCheck, observeBuild } from './build.mjs';
import { decide, evaluateConditions, reverseTableProblems } from './conditions.mjs';
import { assertTarget, Refused } from './guard.mjs';
import { psqlArgs } from './identity.mjs';
import { appendEntry, summarize } from './journal.mjs';
import { executeFlow, RETRY } from './maestro.mjs';
import { metroProblems } from './metro.mjs';
import {
  applySetting,
  beginSession,
  deviceIdentity,
  restoreLine,
  restoreOpen,
} from './restore.mjs';
import { reverseTable, resolveSetting } from './settings.mjs';
import { flowDirOf, resolveBattery } from './flows.mjs';
import { canaryDeviceId, loadSet } from '../fixtures/index.mjs';
import { reversePorts } from './device.mjs';
import { acquireLock, clearMaestro, lockHeld, recordMaestro, releaseLock } from './lock.mjs';

export { acquireLock, lockHeld, releaseLock } from './lock.mjs';

/** The run directory must take a synced write; the probe file is the harness's own and is removed again. */
function writable(dir) {
  const p = join(dir, '.journal-probe');
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(p, 'x');
    unlinkSync(p);
    return { writable: true };
  } catch (e) {
    return { writable: false, writeError: e.message };
  }
}

/** Other runs under the root whose device journal is open (or unusable) for this serial. */
export function otherRunsOpen(root, dir, serial) {
  const runs = join(root, 'runs');
  if (!existsSync(runs)) return [];
  const out = [];
  for (const r of readdirSync(runs)) {
    const d = join(runs, r);
    if (resolve(d) === resolve(dir)) continue;
    let s;
    try {
      s = summarize(d);
    } catch {
      continue;
    }
    if (s.begin?.serial === serial && (s.open.length || s.corrupt))
      out.push({ run: r, open: s.open.length, corrupt: s.corrupt });
  }
  return out;
}

const safe = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    return { error: e.message };
  }
};

/**
 * Everything the conditions need, collected without changing anything. `phase` 'during' skips the
 * conditions a running session makes untrue itself (its own journal entries and lock). `deps`:
 * { freeBytes(), commitBytes(), diskFree(path), env, root, tmp, allowList, maestro, onPath }.
 */
export async function gatherFacts({
  m,
  io,
  dir,
  serial,
  checkout,
  sha,
  apkPath,
  builtAt,
  battery,
  deps,
  phase = 'start',
  prepared = false,
}) {
  const f = { serial, env: deps.env, allowList: deps.allowList };
  f.devices = await safe(() => listDevices(io.adb));
  const attached =
    !f.devices.error &&
    f.devices.devices.length === 1 &&
    f.devices.devices[0].serial === serial &&
    f.devices.devices[0].state === 'device';
  const adb = serial ? makeAdb(io, serial) : null;
  if (attached) {
    f.identity = await safe(() => deviceIdentity(adb));
    f.build = await safe(async () => {
      const [facts, apk, id, deps2] = await Promise.all([
        observeBuild(adb),
        Promise.resolve().then(() => {
          if (phase === 'start' || !deps.apk) deps.apk = apkInfo(apkPath);
          return deps.apk;
        }),
        Promise.resolve().then(() => appIdentity(checkout)),
        nativeDepsCheck({ builtAt, sha, git: (a) => io.git(a, checkout) }),
      ]);
      return {
        facts,
        apk,
        appJsonPackage: id.package,
        problems: [...buildProblems({ facts, apk, id }), ...deps2.problems],
        fingerprint: deps2.fingerprint,
        installedSha: facts.installedSha,
      };
    });
    f.endpoint = await safe(async () => {
      const problems = reverseTableProblems(await reverseTable(adb), m, { prepared });
      // A Metro that was never started is a missing precondition; a Metro that is not this run's is a refusal.
      if (m.metro) problems.push(...(await metroProblems(m, io)));
      return {
        problems,
        blocked: m.metro ? null : 'this run started no Metro (run `metro start`)',
      };
    });
    f.plan = await safe(async () => {
      const problems = [];
      if (phase === 'start')
        for (const [name, target] of Object.entries(battery?.settings ?? {})) {
          const entry = resolveSetting(name);
          const cur = await entry.read(adb).catch((e) => ({ error: e.message }));
          if (cur.error) problems.push(`${name} cannot be read: ${cur.error}`);
          else if (cur.present && !entry.valid(cur.value))
            problems.push(`${name} is '${cur.value}', which cannot be written back`);
          else if (!cur.present && !entry.clear)
            problems.push(`${name} is unset and cannot be put back to unset`);
          if (!entry.valid(`${target}`)) problems.push(`${name} may not be given '${target}'`);
        }
      return { problems };
    });
  }
  f.harness = await (async () => {
    try {
      await assertTarget(m, m.api ? 'API-WRITE' : 'STACK', io, { dir, states: ['ready'] });
      return m.api ? {} : { blocked: 'this run started no API (run `api start`)' };
    } catch (e) {
      if (e instanceof Refused) return { refused: e.message, unknownOnly: e.code === 2 };
      return { error: e.message };
    }
  })();
  f.free = {
    memory: deps.freeBytes(),
    commit: await safe(() => deps.commitBytes()).then((v) => (v?.error ? undefined : v)),
    disks: [
      {
        where: deps.root,
        free: await safe(() => deps.diskFree(deps.root)).then((v) => (v?.error ? undefined : v)),
      },
      {
        where: deps.tmp,
        free: await safe(() => deps.diskFree(deps.tmp)).then((v) => (v?.error ? undefined : v)),
      },
    ],
  };
  const v = await io.adb(['version']).catch(() => null);
  f.toolchain = {
    adb: {
      version:
        v && ok(v) ? (/Android Debug Bridge version (\S+)/.exec(v.stdout)?.[1] ?? null) : null,
    },
    maestro: deps.maestro,
  };
  if (phase === 'start') {
    const j = summarize(dir);
    f.journal = {
      ...writable(dir),
      corrupt: j.corrupt,
      open: j.open,
      others: otherRunsOpen(deps.root, dir, serial),
    };
    f.lock = await lockHeld(dir, io);
  } else {
    f.journal = { writable: true };
    f.lock = { held: false };
  }
  return f;
}

/** Counts the Android devices this run's database knows, other than the fixture's own canary device. */
export async function countAppDevices(m, io) {
  const sql = `SELECT count(*) FROM core.device WHERE platform = 'ANDROID' AND id <> '${canaryDeviceId(m)}'`;
  const r = await io.docker(psqlArgs(m, m.containers.postgres.id, ['-c', sql]));
  const n = Number(`${r.stdout}`.trim());
  if (!ok(r) || !Number.isInteger(n))
    throw new Error('the device count could not be read from the run database');
  return n;
}

const stamp = () => new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
const write = (p, v) =>
  writeFileSync(p, typeof v === 'string' ? v : `${JSON.stringify(v, null, 2)}\n`);

/**
 * Checks (when `onlyConditions`) or runs a native session. Resolves { code, status, ... }. `deps`: see
 * gatherFacts, plus { decl, signal, sleep, log, now }.
 */
export async function runNative(args) {
  const { m: m0, io, dir, serial, batteryName, checkout, sha, deps, onlyConditions = false } = args;
  let m = m0;
  const log = deps.log ?? (() => {});
  const flowDir = flowDirOf(checkout);
  const rb = resolveBattery(deps.decl, batteryName, flowDir);
  if (rb.problems.length)
    return {
      code: 1,
      status: `HARNESS REFUSED - flows: ${rb.problems[0]} - NO RESOURCE WAS CHANGED`,
      problems: rb.problems,
    };
  const gather = (extra = {}) => gatherFacts({ ...args, m, battery: rb.battery, ...extra });
  const results = evaluateConditions(await gather());
  for (const r of results)
    log(`  ${r.verdict}  ${r.id} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
  const verdict = decide(results);
  if (verdict.code) return { code: verdict.code, status: verdict.line, results };
  if (onlyConditions)
    return { code: 0, status: 'NATIVE CONDITIONS MET - DEVICE TESTING NOT EXECUTED', results };

  const session = `s-${stamp()}`;
  const sdir = join(dir, 'native', session);
  mkdirSync(sdir, { recursive: true });
  write(join(sdir, 'conditions.json'), results);
  const adb = makeAdb(io, serial);
  let lock = null;
  let restoration = null;
  let error = null;
  let began = false;
  const flows = [];
  const record = { session, battery: batteryName, serial, sha, builtAt: args.builtAt, flows };
  try {
    lock = await acquireLock(dir, io);
    // The facts the evidence records; this session's own lock and journal are not conditions of itself.
    const facts = await gatherFacts({ ...args, m, battery: rb.battery, phase: 'during' });
    if (facts.identity?.error || facts.build?.error)
      throw new Refused(
        `the device facts could not be read: ${facts.identity?.error ?? facts.build?.error}`,
      );
    const identity = facts.identity;
    record.device = {
      identity,
      sdk: facts.build.facts.sdk,
      release: facts.build.facts.release,
      abilist: facts.build.facts.abilist,
    };
    record.build = {
      apk: {
        sha256: facts.build.apk.sha256,
        size: facts.build.apk.size,
        abis: facts.build.apk.abis,
      },
      installedSha: facts.build.installedSha,
      package: facts.build.facts.package,
      fingerprint: facts.build.fingerprint,
    };
    write(join(sdir, 'build.json'), record.build);
    write(join(sdir, 'device.json'), record.device);
    beginSession(dir, { run: m.run, serial, identity });
    began = true;
    const drivers = async () => {
      const r = await adb(['shell', 'pm', 'list', 'packages', MAESTRO_DRIVER]);
      return ok(r) ? r.stdout.split(/\r?\n/).filter(Boolean).sort() : null;
    };
    record.maestroDriversBefore = await drivers();
    for (const [name, target] of Object.entries(rb.battery.settings ?? {})) {
      const r = await applySetting({ dir, adb, name, target: `${target}` });
      log(
        `setting ${name}: ${r.changed ? `changed (original ${r.original.present ? r.original.value : 'unset'})` : 'already as wanted'}`,
      );
    }
    for (const port of reversePorts(m))
      await applySetting({ dir, adb, name: `reverse:${port}`, target: `tcp:${port}` });
    await adb(['shell', 'input', 'keyevent', '224']);
    const after = evaluateConditions(
      await gatherFacts({ ...args, m, battery: rb.battery, phase: 'during', prepared: true }),
    );
    const again = decide(after);
    if (again.code) throw new Refused(`the prepared device no longer passes: ${again.line}`);
    for (const f of rb.battery.fixtures ?? [])
      if (!m.fixtures.includes(f)) {
        m = await loadSet(m, io, f, { dir });
        log(`fixture set ${f} loaded`);
      }
    let before = await countAppDevices(m, io);
    const budget = { infra: RETRY.infraRetriesPerBattery };
    const ctx = {
      io,
      adb,
      serial,
      maestro: deps.maestro,
      dir: sdir,
      flowDir,
      hostEnv: deps.env,
      signal: deps.signal,
      vars: {},
      budget,
      // the Maestro process is recorded in the lock while it runs: a killed harness leaves it identifiable
      maestroStarted: (pid) => recordMaestro(dir, io, pid),
      maestroEnded: () => clearMaestro(dir),
      sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      recheck: async () =>
        evaluateConditions(
          await gatherFacts({ ...args, m, battery: rb.battery, phase: 'during', prepared: true }),
        )
          .filter((r) => r.verdict !== 'PASS')
          .map((r) => `${r.id} ${r.detail}`),
    };
    let stop = null;
    for (const flow of rb.flows) {
      if (stop || deps.signal?.aborted) {
        flows.push({ flow: flow.name, verdict: 'NOT EXECUTED', why: stop ?? 'cancelled' });
        continue;
      }
      log(`flow ${flow.name}`);
      const r = await executeFlow(ctx, flow);
      flows.push(r);
      if (r.kind === 'infrastructure') stop = 'an earlier flow could not run (infrastructure)';
      if (r.attempts.some((a) => a.stuck)) stop = 'a Maestro process could not be stopped';
      if (flow.name === rb.battery.canary && r.verdict === 'PASS') {
        const n = await countAppDevices(m, io);
        r.canary = { before, after: n };
        if (n <= before) {
          r.verdict = 'FAIL';
          r.kind = 'canary';
          r.why =
            "the flow passed but this run's database gained no device: the app is not talking to this run's API";
          stop = "the canary failed: the app does not talk to this run's API";
        }
        before = n;
      }
    }
    record.maestroDriversAfter = await drivers();
  } catch (e) {
    error = e;
  } finally {
    // Only a session that opened the journal restores: an earlier session's open changes (or a live
    // session's) are never touched by a run that was refused before it began.
    restoration = { restored: [], unchanged: [], failed: [] };
    if (began) {
      try {
        restoration = await restoreOpen({ dir, adb });
      } catch (e) {
        restoration = {
          restored: [],
          unchanged: [],
          failed: [{ id: null, setting: '(restore)', why: e.message }],
        };
      }
      try {
        appendEntry(dir, {
          op: 'end',
          outcome: restoration.failed.length ? 'restore-failed' : 'restored',
        });
      } catch {
        // the restoration result below is what matters
      }
    }
    // A Maestro process that could not be stopped keeps the lock: its identity is in it.
    if (lock && !stuckAttempt(flows)) releaseLock(dir);
  }
  record.restoration = restoration;
  record.error = error?.message ?? null;
  const count = (v) => flows.filter((f) => f.verdict === v).length;
  record.counts = { pass: count('PASS'), fail: count('FAIL'), notExecuted: count('NOT EXECUTED') };
  write(join(sdir, 'result.json'), record);
  // Nothing was changed before the session began (the lock was refused, an earlier session's changes are
  // open, the device facts could not be read): the refusal's own code and words, and no claim of a restore.
  if (!began && error) {
    const refused = error instanceof Refused;
    const code = refused ? error.code : 2;
    const head = refused
      ? `HARNESS REFUSED - ${error.message}${code === 2 ? ' (could not be checked)' : ''}`
      : `HARNESS ERROR - ${error.message}`;
    return { code, status: `${head} - NO RESOURCE WAS CHANGED`, record };
  }
  const tally = `${record.counts.pass} PASS, ${record.counts.fail} FAIL, ${record.counts.notExecuted} NOT EXECUTED`;
  const how = `run \`device restore --run ${m.run} --serial ${serial}\``;
  // "restored" is said only when a restore ran and put something back (or found it already as it was)
  const done =
    restoration.restored.length + restoration.unchanged.length
      ? 'device settings restored'
      : 'no device setting was left changed';
  const stuck = stuckAttempt(flows);
  if (stuck)
    return {
      code: 3,
      status: `HARNESS INCOMPLETE - the Maestro process ${stuck.maestroPid} could not be stopped (its identity stays in the lock: \`device restore\` stops it; ${restoreLine(restoration)})`,
      record,
    };
  if (restoration.failed.length)
    return { code: 3, status: `HARNESS INCOMPLETE - ${restoreLine(restoration)}; ${how}`, record };
  if (deps.signal?.aborted)
    return {
      code: 3,
      status: `HARNESS INCOMPLETE - interrupted (${tally}); ${done}`,
      record,
    };
  if (error)
    return {
      code: 3,
      status: `HARNESS INCOMPLETE - ${error.message} (${tally}); ${done}`,
      record,
    };
  if (record.counts.fail)
    return {
      code: 5,
      status: `HARNESS TEST FAILED - native run (${tally}); ${done}`,
      record,
    };
  if (record.counts.notExecuted)
    return {
      code: 3,
      status: `HARNESS INCOMPLETE - the battery did not finish (${tally}); ${done}`,
      record,
    };
  return {
    code: 0,
    status: `HARNESS OK - native run (${tally}); ${done}`,
    record,
  };
}

/** The attempt whose Maestro process was still running after it was stopped, if any. */
const stuckAttempt = (flows) => flows.flatMap((f) => f.attempts ?? []).find((a) => a.stuck);
