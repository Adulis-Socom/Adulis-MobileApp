#!/usr/bin/env node
// The native test harness: an isolated PostgreSQL and MinIO per run, an API built from a verified
// checkout, synthetic fixtures, and cleanup that proves ownership before it deletes. See README.md.
//
//   node ops/native/harness.mjs <command> [--run R] [--checkout PATH] [--sha SHA] [--serial S] [--set NAME]
//
// Exit codes: 0 ok; 1 refused (a check FAILED, nothing destructive was done); 2 could not check or
// usage (fail closed); 3 cleanup incomplete; 4 blocked (a precondition is not met, nothing started).
// The last line of every command is a status line.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statfsSync } from 'node:fs';
import { freemem, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startApi, stopApi, provenanceProblems } from './lib/api.mjs';
import { appendOp, executeDown, planDown, purge } from './lib/cleanup.mjs';
import { deviceProblems, observeDevice, prepareDevice, restoreDevice } from './lib/device.mjs';
import { CHECKS, checkFacts, observe, psqlArgs } from './lib/identity.mjs';
import { assertTarget, Refusal } from './lib/guard.mjs';
import { realIo } from './lib/io.mjs';
import { newRun, RUN_RE, readManifest, runDir, writeManifest } from './lib/manifest.mjs';
import { dockerSteps, minioImage, PG_IMAGE, up } from './lib/stack.mjs';
import { canaryDeviceId, loadSet, SETS } from './fixtures/index.mjs';

export const READY = 'HARNESS READY - NATIVE EXECUTION NOT PERFORMED';
const GB = 1024 ** 3;
// Free memory a run needs. The containers live in the Docker VM; the host side is the API build
// (the largest step) and the API. A device session adds an emulator and needs far more.
export const MIN_FREE = { stack: 1.0 * GB, device: 6 * GB };
const MIN_DISK = 5 * GB;

class Blocked extends Error {}
class Usage extends Error {}

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

function load(root, run, { states } = {}) {
  if (!RUN_RE.test(`${run}`)) throw new Usage('--run must be a native run id');
  const dir = runDir(root, run);
  let m;
  try {
    m = readManifest(dir);
  } catch (e) {
    throw new Usage(`no readable manifest for ${run}: ${e.message}`);
  }
  return { m, dir, states };
}

export async function main(
  argv,
  { io = realIo(), env = process.env, out = (s) => process.stdout.write(`${s}\n`) } = {},
) {
  let status = READY;
  let code = 0;
  let runId;
  try {
    const { values: a, positionals } = parseArgs({
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
    const [cmd, sub] = positionals;
    const root = env.ADULIS_NATIVE_ROOT;
    if (cmd !== 'selftest' && cmd !== undefined && (!root || !isAbsolute(root)))
      throw new Usage('ADULIS_NATIVE_ROOT must be set to an absolute directory');
    const say = out;

    switch (cmd) {
      case 'selftest': {
        const dir = join(dirname(fileURLToPath(import.meta.url)), 'test');
        const files = readdirSync(dir)
          .filter((f) => f.endsWith('.test.mjs'))
          .map((f) => join(dir, f));
        const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
        code = r.status ?? 2;
        if (code !== 0) status = 'HARNESS SELFTEST FAILED';
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
        const p = await preflightProblems(io, {
          root,
          profile: sub === 'device' ? 'device' : 'stack',
        });
        if (p.length) throw new Blocked(p.join('; '));
        say('preflight: nothing blocks a run');
        break;
      }
      case 'up': {
        const checkout = resolve(need(a.checkout, '--checkout'));
        const prov = await provenanceProblems(checkout, a.sha, (x) => io.git(x, checkout));
        if (prov.length) throw new Usage(`refused: ${prov.join('; ')}`);
        const p = await preflightProblems(io, { root });
        if (p.length) throw new Blocked(p.join('; '));
        const r = await up(io, {
          root,
          repo: checkout,
          log: (s) => say(`up: ${s}`),
          onRun: (x) => {
            runId = x;
          },
        });
        for (const x of r.results) say(`  ${x.verdict}  ${x.id} ${CHECKS[x.id]}`);
        say(
          `run ${r.m.run} is ready (ADULIS_NATIVE_RUN=${r.m.run}); API port ${r.m.ports.api}, PostgreSQL ${r.m.ports.pg}, MinIO ${r.m.ports.s3}`,
        );
        break;
      }
      case 'verify': {
        const { m, dir } = load(root, a.run);
        const results = await assertTarget(m, m.api ? 'API-WRITE' : 'STACK', io, {
          dir,
          run: a.run,
          states: ['ready'],
        });
        for (const x of results) say(`  ${x.verdict}  ${x.id} ${CHECKS[x.id]}`);
        break;
      }
      case 'reverify': {
        // After a PostgreSQL restart only: records the new start time if EVERYTHING else is unchanged.
        const { m, dir } = load(root, a.run);
        const f = await observe(m, io, ['ID-01', 'ID-02', 'ID-03']);
        const seen = f.pg?.inside;
        if (!seen || seen.error) throw new Usage(`could not read PostgreSQL: ${seen?.error}`);
        const same = checkFacts({ ...m, db: { ...m.db, postmasterStart: seen.startTime } }, f, [
          'ID-01',
          'ID-02',
          'ID-03',
        ]);
        if (same.some((x) => x.verdict !== 'PASS')) throw new Refusal('reverify', same);
        writeManifest(dir, {
          ...m,
          db: { ...m.db, postmasterStart: seen.startTime },
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
        if (!SETS[name])
          throw new Usage(`unknown fixture set '${name}' (known: ${Object.keys(SETS).join(', ')})`);
        await loadSet(m, io, name, { dir });
        say(`fixture set ${name} loaded into ${m.run}`);
        break;
      }
      case 'api': {
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
        } else if (sub === 'canary') {
          // An API-mediated write read back from THIS database by a run-unique value.
          await assertTarget(m, 'API-WRITE', io, { dir, run: a.run, states: ['ready'] });
          const id = canaryDeviceId(m);
          const res = await io.fetch(`http://127.0.0.1:${m.ports.api}/v1/bootstrap`, {
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
        } else throw new Usage('usage: api start|stop|canary');
        break;
      }
      case 'device': {
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
          await assertTarget(m, 'API-WRITE', io, { dir, run: a.run, states: ['ready'] });
          await prepareDevice(m, adb, serial);
          say(`reverse ports set on ${serial}`);
        } else if (sub === 'restore') {
          await restoreDevice(m, adb, serial);
          say(`reverse ports removed from ${serial}`);
        } else say(`device ${serial} may be used`);
        break;
      }
      case 'env': {
        const { m } = load(root, a.run);
        say(`export ADULIS_NATIVE_RUN=${m.run}`);
        say(`export EXPO_PUBLIC_API_BASE_URL=http://localhost:${m.ports.api}`);
        if (a.serial) say(`export ANDROID_SERIAL=${a.serial}`);
        break;
      }
      case 'status': {
        const { m } = load(root, a.run);
        say(
          `run ${m.run}: ${m.state}; fixtures [${m.fixtures.join(', ')}]; API ${m.api ? `pid ${m.api.pid}` : 'not started'}`,
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
        if (plan.problems.length || plan.unknowns.length) {
          const r = new Error(`refused down: ${[...plan.problems, ...plan.unknowns].join('; ')}`);
          r.code = plan.problems.length ? 1 : 2;
          r.refused = true;
          throw r;
        }
        if (m.api) {
          try {
            await stopApi(m, io, dir);
          } catch (e) {
            say(`warning: ${e.message}`);
          }
        }
        writeManifest(dir, { ...m, state: 'cleanup' });
        const { removed, left } = await executeDown(m, plan.steps, io, (e) => appendOp(dir, e));
        for (const s of removed) say(`removed ${s.kind} ${s.name ?? s.id}`);
        if (left.length) {
          writeManifest(dir, { ...m, state: 'cleanup-incomplete', left });
          code = 3;
          status = `HARNESS CLEANUP INCOMPLETE - ${left.length} RESOURCES LEFT, REGISTERED`;
          for (const l of left) say(`left: ${l}`);
        } else {
          writeManifest(dir, { ...m, state: 'cleaned', api: null });
        }
        break;
      }
      case 'purge': {
        const run = need(a.run, '--run');
        const { m } = load(root, run);
        if (m.state !== 'cleaned')
          throw new Usage(
            `run ${run} is '${m.state}': only a cleaned run's directory may be purged`,
          );
        const p = purge(root, run);
        if (p.length) throw new Usage(`refused purge: ${p.join('; ')}`);
        say(`purged ${runDir(root, run)}`);
        break;
      }
      default:
        throw new Usage(
          'usage: harness.mjs plan|preflight|up|verify|reverify|fixtures|api|device|env|status|down|recover|purge|selftest',
        );
    }
  } catch (e) {
    if (e instanceof Blocked) {
      code = 4;
      status = `HARNESS BLOCKED - ${e.message} - NOTHING STARTED`;
    } else if (e instanceof Refusal || e.refused) {
      code = e.code;
      const first = e.firstId ? `${e.firstId} ${CHECKS[e.firstId]}` : e.message;
      status = `HARNESS REFUSED - ${first}${code === 2 ? ' (could not be checked)' : ''} - NOTHING DESTRUCTIVE WAS DONE`;
      out(e.message);
    } else {
      code = 2;
      status = `HARNESS REFUSED - ${e.message} - NOTHING DESTRUCTIVE WAS DONE`;
      if (runId)
        status = `HARNESS INCOMPLETE - ${e.message}; run \`down --run ${runId}\` to remove what was created`;
    }
  }
  out(status);
  return code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
