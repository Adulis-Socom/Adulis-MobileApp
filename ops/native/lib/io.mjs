// The real effects, injected everywhere else so the tests can replace each one. Nothing here is
// reached by the refusal tests. Windows-only parts (process lookup) go through PowerShell.
import { execFile, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, join } from 'node:path';
import net from 'node:net';
import pg from 'pg';
import { descendants } from './proc-tree.mjs';

/** Runs an executable with an argument array (no shell). Never rejects: { status, stdout, stderr, error }. */
export const run = (file, args, { input, timeout = 60_000, cwd, env } = {}) =>
  new Promise((resolve) => {
    const child = execFile(
      file,
      args,
      { timeout, cwd, env, maxBuffer: 32 * 1024 * 1024, windowsHide: true, encoding: 'utf8' },
      (error, stdout, stderr) =>
        resolve({
          status: error ? (typeof error.code === 'number' ? error.code : null) : 0,
          stdout,
          stderr,
          // A spawn failure, a timeout or a kill is an error; a non-zero exit is a status.
          error: error && typeof error.code !== 'number' ? error : null,
        }),
    );
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });

const powershell = async (script) => {
  const r = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    timeout: 20_000,
  });
  if (r.error || r.status !== 0)
    throw new Error(`powershell failed: ${`${r.stderr || r.error?.message}`.trim().slice(-200)}`);
  return r.stdout.trim();
};

export const proc = {
  async info(pid) {
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('pid must be a positive integer');
    const out = await powershell(
      `$p = Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'; if ($p) { @{ createdAt = $p.CreationDate.ToUniversalTime().ToString('o'); commandLine = $p.CommandLine } | ConvertTo-Json -Compress }`,
    );
    return out ? JSON.parse(out) : { createdAt: null, commandLine: '' };
  },
  async listeners(port) {
    const out = await powershell(
      `@(Get-NetTCPConnection -State Listen -LocalPort ${Number(port)} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique) | ConvertTo-Json -Compress`,
    );
    return out ? [].concat(JSON.parse(out)) : [];
  },
  kill: (pid) => process.kill(pid),
  /** One snapshot of the host's processes: [{ ProcessId, ParentProcessId, c }] (c = creation time, ISO). */
  async table() {
    const out = await powershell(
      "@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,@{ n = 'c'; e = { $_.CreationDate.ToUniversalTime().ToString('o') } }) | ConvertTo-Json -Compress",
    );
    return [].concat(JSON.parse(out || '[]'));
  },
  // Metro starts worker processes: the verified pid and the processes it started, each stopped by its
  // own pid, deepest first. Only called after the pid's creation time and command line matched the record.
  // A process is stopped only if a second snapshot, taken just before, still shows the creation time the
  // first one did (a number given to another process in between is left alone). A process that is already
  // gone is not a failure; any other failure, the root's included, is thrown after the rest was tried.
  async killTree(root, expectedCreatedAt) {
    if (!Number.isInteger(root) || root <= 0) throw new Error('pid must be a positive integer');
    const first = await this.table();
    const created = new Map(first.map((x) => [x.ProcessId, x.c]));
    // Only processes seen in the first snapshot are stopped, and the root only if it is the process the
    // caller verified (its creation time): a root that is gone, or whose number belongs to another process
    // by now, is left alone.
    if (
      !created.has(root) ||
      (expectedCreatedAt !== undefined && created.get(root) !== expectedCreatedAt)
    )
      return;
    const order = [...descendants(first, root).reverse(), root];
    const now = new Map((await this.table()).map((x) => [x.ProcessId, x.c]));
    const failures = [];
    for (const pid of order) {
      if (now.get(pid) !== created.get(pid)) continue; // gone, or the number now belongs to another process
      try {
        process.kill(pid);
      } catch (e) {
        if (e.code !== 'ESRCH') failures.push(`${pid}: ${e.code ?? e.message}`);
      }
    }
    if (failures.length) throw new Error(`could not stop process(es) ${failures.join(', ')}`);
  },
};

/** True when something accepts a TCP connection on the loopback port. */
const connects = (port) =>
  new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port }, () => (s.destroy(), resolve(true)));
    s.setTimeout(2000, () => (s.destroy(), resolve(false)));
    s.on('error', () => resolve(false));
  });

/** Spawns the API detached with stdout and stderr in a log file; returns { pid }. */
const spawnApi = ({ node, main, cwd, env, log }) => {
  mkdirSync(dirname(log), { recursive: true });
  const fd = openSync(log, 'a');
  const child = spawn(node, [main], {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', fd, fd],
    windowsHide: true,
  });
  closeSync(fd);
  child.unref();
  return { pid: child.pid };
};

/** Spawns Metro detached with stdout and stderr in a log file; returns { pid }. */
export const spawnMetro = ({ node, args, cwd, env, log }) => {
  mkdirSync(dirname(log), { recursive: true });
  const fd = openSync(log, 'a');
  const child = spawn(node, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', fd, fd],
    windowsHide: true,
  });
  closeSync(fd);
  child.unref();
  return { pid: child.pid };
};

/**
 * Runs Maestro's JVM, output to a log file. Resolves { status, error, pid, timedOut, aborted, stuck }; the
 * signal and the timeout stop the process this call started (by its pid, while it is running), nothing
 * else, and the promise ALWAYS resolves: a process that is still there `hardMs` after it was stopped
 * resolves it with `stuck: true` and an error (the caller records the orphan). `onSpawn(pid)` runs right
 * after the process started and is waited for; if it fails, the process is stopped and `recordError` is set.
 */
export const maestro = ({ file, args, cwd, env, timeout, signal, log, onSpawn, hardMs = 15_000 }) =>
  new Promise((resolve) => {
    mkdirSync(dirname(log), { recursive: true });
    const fd = openSync(log, 'a');
    const child = spawn(file, args, { cwd, env, stdio: ['ignore', fd, fd], windowsHide: true });
    closeSync(fd);
    let timedOut = false;
    let aborted = false;
    let recordError = null;
    let closed = false;
    let settled = false;
    let hard = null;
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeout);
    const finish = (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(hard);
      signal?.removeEventListener('abort', onAbort);
      resolve({ pid: child.pid, timedOut, aborted, recordError, ...r });
    };
    function stop() {
      const { pid } = child; // the pid of a process this call started, and only while it has not ended
      if (closed || !pid || child.exitCode !== null || child.signalCode !== null) return;
      try {
        process.kill(pid);
      } catch {
        // already gone: the close event follows
      }
      hard ??= setTimeout(
        () =>
          finish({
            status: null,
            error: new Error(`process ${pid} was still running ${hardMs} ms after it was stopped`),
            stuck: true,
          }),
        hardMs,
      );
    }
    function onAbort() {
      aborted = true;
      stop();
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    child.on('error', (error) => {
      closed = true;
      finish({ status: null, error });
    });
    // The caller records the process (its identity goes into the session lock) and the run does not end before
    // that finished. A record that fails stops the process and is reported as `recordError`: a Maestro that
    // nothing recorded is never left running unnoticed.
    const recorded = child.pid
      ? Promise.resolve()
          .then(() => onSpawn?.(child.pid))
          .then(
            () => null,
            (e) => e ?? new Error('the process could not be recorded'),
          )
      : Promise.resolve(null);
    recorded.then((e) => {
      if (!e) return;
      recordError = e;
      stop();
    });
    child.on('close', async (status) => {
      closed = true;
      await recorded;
      finish({ status, error: null });
    });
  });

/** Like `run`, with stdout as a Buffer (a screenshot). */
export const runBytes = (file, args, { timeout = 30_000, env } = {}) =>
  new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout, env, maxBuffer: 64 * 1024 * 1024, windowsHide: true, encoding: 'buffer' },
      (error, stdout, stderr) =>
        resolve({
          status: error ? (typeof error.code === 'number' ? error.code : null) : 0,
          stdout,
          stderr: `${stderr}`,
          error: error && typeof error.code !== 'number' ? error : null,
        }),
    );
  });

/** Bytes of commit charge still available (the page file counts): FreeVirtualMemory is in kilobytes. */
export const commitFree = async () =>
  Number(await powershell('(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory')) * 1024;

const build = async (checkout) => {
  const nest = join(checkout, 'apps', 'api', 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
  const r = await run(process.execPath, [nest, 'build'], {
    cwd: join(checkout, 'apps', 'api'),
    timeout: 600_000,
    env: childEnv(),
  });
  if (r.error || r.status !== 0)
    throw new Error(
      `the API build failed: ${`${r.stderr || r.stdout || r.error?.message}`.trim().slice(-400)}`,
    );
};

/**
 * The few variables adb needs to find its keys and its tools. No server redirection (ADB_SERVER_SOCKET,
 * ANDROID_ADB_SERVER_ADDRESS, ANDROID_ADB_SERVER_PORT) and nothing else is passed on.
 */
export const adbChildEnv = (host) => {
  const from = host ?? process.env;
  const env = {};
  for (const k of [
    'SystemRoot',
    'PATH',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'HOME',
    'APPDATA',
    'LOCALAPPDATA',
    'ANDROID_HOME',
    'ANDROID_USER_HOME',
  ])
    if (from[k]) env[k] = from[k];
  return env;
};

/** The few variables a node child needs; nothing else is inherited. */
export const childEnv = (extra = {}) => {
  const env = {};
  for (const k of ['SystemRoot', 'PATH', 'TEMP', 'TMP'])
    if (process.env[k]) env[k] = process.env[k];
  return { ...env, ...extra };
};

export function realIo() {
  return {
    run,
    docker: (args, opts) => run('docker', args, opts),
    Client: pg.Client,
    fetch: (url, opts) => fetch(url, opts),
    proc,
    git: (args, cwd) => run('git', ['-C', cwd, ...args], { timeout: 30_000 }),
    adb: (args) => run('adb', args, { timeout: 30_000, env: adbChildEnv() }),
    adbBytes: (args) => runBytes('adb', args, { env: adbChildEnv() }),
    connects,
    spawnApi,
    spawnMetro,
    maestro,
    commitFree,
    build,
    node: process.execPath,
  };
}
