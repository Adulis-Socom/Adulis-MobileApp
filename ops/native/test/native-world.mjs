// One complete fake world for a native session: the run's stack and API (fakes.mjs), a fake device, a
// checkout holding the approved flow files, a minimal APK, a Metro the run started, and the doubles for
// Maestro and git. A test breaks ONE thing and asserts the refusal and what was (not) changed.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDeclaration } from '../lib/flows.mjs';
import { metroArgs } from '../lib/metro.mjs';
import { runDir, writeManifest } from '../lib/manifest.mjs';
import { fakeDevice, fakeGit, fakeMaestro, junit, makeApk, SERIAL } from './fake-device.mjs';
import { makeIo, world } from './fakes.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const SHA = 'a'.repeat(40);
export const BUILT_AT = 'b'.repeat(40);
export const GB = 1024 ** 3;
const NODE = 'C:\\Program Files\\nodejs\\node.exe';
const METRO_PID = 5151;
const DEPS = { expo: '~58.0.24', react: '19.3.0' };

/**
 * `opts`: { maestro: script(call, opts), deviceState, git: fakeGit options, fixtures, noMetro, apkAbis }.
 * Returns everything a test needs; `done()` removes the temporary directory.
 */
export function nativeWorld(opts = {}) {
  const w = world({ api: true });
  w.pg.canary = '0';
  w.m.fixtures = opts.fixtures ?? ['baseline'];
  const tmp = mkdtempSync(join(tmpdir(), 'native-dev-'));
  const root = join(tmp, 'root');
  const dir = runDir(root, w.m.run);
  mkdirSync(dir, { recursive: true });
  const checkout = join(tmp, 'checkout');
  const flows = join(checkout, 'apps', 'mobile', '.maestro');
  mkdirSync(flows, { recursive: true });
  for (const f of ['foundation-smoke.yaml', 'buyer-shell.yaml'])
    copyFileSync(join(repo, 'apps', 'mobile', '.maestro', f), join(flows, f));
  writeFileSync(
    join(checkout, 'apps', 'mobile', 'app.json'),
    JSON.stringify({ expo: { android: { package: 'com.adulis.app' } } }),
  );
  const apkPath = join(tmp, 'app-debug.apk');
  const dev = fakeDevice({ state: opts.deviceState, file: opts.deviceFile });
  dev.st.pkg.apkSha = makeApk(apkPath, { abis: opts.apkAbis ?? ['x86_64'] });

  const cli = join(checkout, 'apps', 'mobile', 'node_modules', 'expo', 'bin', 'cli');
  if (!opts.noMetro) {
    w.m.metro = {
      pid: METRO_PID,
      createdAt: '2026-11-18T10:02:00.0000000Z',
      node: NODE,
      cli,
      checkout,
      sha: SHA,
      port: 8081,
      apiUrl: `http://localhost:${w.m.ports.api}`,
    };
    w.proc.byPid[METRO_PID] = {
      createdAt: w.m.metro.createdAt,
      commandLine: `"${NODE}" ${metroArgs(cli).join(' ')}`,
    };
  }
  w.proc.byPid[process.pid] = { createdAt: 'test-process-created', commandLine: 'node test' };
  writeManifest(dir, w.m);

  const base = makeIo(w);
  const kills = [];
  const maestro = fakeMaestro(
    opts.maestro ??
      (async (_n, o) => {
        // a passing flow: the app registers a device with this run's API
        w.pg.canary = String(Number(w.pg.canary) + 1);
        return { status: 0, junit: junit({ name: o.args.at(-1) }) };
      }),
  );
  const io = {
    ...base,
    ...dev.io,
    git: opts.git ?? fakeGit({ builtAt: BUILT_AT, head: SHA, builtAtDeps: DEPS, headDeps: DEPS }),
    maestro: maestro.maestro,
    node: NODE,
    connects: async () => false,
    commitFree: async () => 40 * GB,
    proc: {
      ...base.proc,
      listeners: async (port) =>
        port === 8081 ? (w.m.metro ? [METRO_PID] : []) : w.proc.listeners,
      killTree: async (pid) => {
        kills.push(pid);
      },
    },
    fetch: async (url, o) =>
      url === 'http://127.0.0.1:8081/status'
        ? { status: 200, ok: true, text: async () => w.metroStatus ?? 'packager-status:running' }
        : base.fetch(url, o),
  };
  const deps = {
    env: {
      PATH: 'C:\\bin',
      JAVA_HOME: 'C:\\jdk',
      ANDROID_HOME: 'G:\\Android\\SDK',
      USERPROFILE: 'C:\\Users\\x',
      TEMP: 'C:\\t',
      TMP: 'C:\\t',
    },
    root,
    tmp,
    allowList: [],
    freeBytes: () => 16 * GB,
    commitBytes: async () => 40 * GB,
    diskFree: async () => 200 * GB,
    maestro: {
      home: 'C:\\maestro',
      java: 'C:\\jdk\\bin\\java.exe',
      version: '2.10.0',
      problems: [],
    },
    decl: loadDeclaration(join(repo, 'ops', 'native', 'flows.json')),
    sleep: async () => {},
    log: () => {},
  };
  const args = () => ({
    m: w.m,
    io,
    dir,
    serial: SERIAL,
    batteryName: 'smoke',
    checkout,
    sha: SHA,
    apkPath,
    builtAt: BUILT_AT,
    deps,
  });
  return {
    w,
    dev,
    io,
    deps,
    args,
    maestro,
    kills,
    root,
    dir,
    checkout,
    apkPath,
    tmp,
    cli,
    done: () => rmSync(tmp, { recursive: true, force: true }),
  };
}
