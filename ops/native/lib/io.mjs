// The real effects, injected everywhere else so the tests can replace each one. Nothing here is
// reached by the refusal tests. Windows-only parts (process lookup) go through PowerShell.
import { execFile, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, join } from 'node:path';
import net from 'node:net';
import pg from 'pg';

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

const proc = {
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
    adb: (args) => run('adb', args, { timeout: 30_000 }),
    connects,
    spawnApi,
    build,
    node: process.execPath,
  };
}
