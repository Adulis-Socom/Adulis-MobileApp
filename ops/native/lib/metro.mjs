// The JavaScript bundler the debug app loads from. The device reaches the host's port 8081 through
// `adb reverse`, so whatever listens there decides which code the app runs and which API it calls: the
// harness therefore starts Metro itself, with the run's own API address, records its pid, creation time
// and command line, and proves that identity before a flow runs and before it stops it (by identity, never
// by port). A Metro that someone else started is refused, not adopted.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { METRO_PORT } from './device.mjs';
import { provenanceProblems } from './api.mjs';
import { assertTarget, Refused } from './guard.mjs';
import { tokens } from './identity.mjs';
import { writeManifest } from './manifest.mjs';
import { PROTECTED_PORTS } from './protected.mjs';

/** The API origin baked into the bundle: the run's own API, by the name the device sees it under. */
export const metroApiUrl = (m) => `http://localhost:${m.ports.api}`;

/**
 * Why `url` may not be the API address of the app under test. Only this run's API on the loopback
 * names `localhost` or `127.0.0.1` with this run's port; any other host (a deployed API included), scheme,
 * credentials, path or port is refused.
 */
export function apiUrlProblems(url, m) {
  let u;
  try {
    u = new URL(`${url}`);
  } catch {
    return [`'${url}' is not a URL`];
  }
  const p = [];
  if (u.protocol !== 'http:')
    p.push(`the API address uses ${u.protocol}, not plain http to the loopback`);
  if (!['localhost', '127.0.0.1'].includes(u.hostname))
    p.push(`the API host is ${u.hostname}, not the loopback`);
  if (u.username || u.password) p.push('the API address carries credentials');
  if (u.pathname !== '/' || u.search || u.hash)
    p.push('the API address has a path, query or fragment');
  const port = Number(u.port);
  if (PROTECTED_PORTS.has(port)) p.push(`the API port ${port} is a protected port`);
  if (port !== m.ports?.api)
    p.push(`the API port is ${u.port || 'the scheme default'}, not this run's ${m.ports?.api}`);
  return p;
}

/** The complete environment of the Metro child. Nothing else is inherited. */
export function buildMetroEnv(m, hostEnv) {
  const host = hostEnv ?? process.env;
  const env = {
    EXPO_PUBLIC_API_BASE_URL: metroApiUrl(m),
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_OFFLINE: '1',
    NODE_ENV: 'development',
  };
  for (const k of ['SystemRoot', 'PATH', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA'])
    if (host[k]) env[k] = host[k];
  return env;
}

export const metroCli = (checkout) =>
  join(checkout, 'apps', 'mobile', 'node_modules', 'expo', 'bin', 'cli');
export const metroArgs = (cli) => [cli, 'start', '--port', `${METRO_PORT}`, '--clear'];
const same = (a, b) =>
  `${a}`.replaceAll('\\', '/').toLowerCase() === `${b}`.replaceAll('\\', '/').toLowerCase();

export async function startMetro(m, io, { checkout, sha, dir, tries = 240, delayMs = 500 }) {
  if (m.state !== 'ready') throw new Refused(`the run is '${m.state}', not ready`);
  if (!m.api)
    throw new Refused(
      'refused: the run has no API: Metro is started with the API address of a running API',
    );
  if (m.metro) throw new Refused('this run already started Metro; stop it first (metro stop)');
  const prov = await provenanceProblems(checkout, sha, (a) => io.git(a, checkout));
  if (prov.length) throw new Refused(`refused: ${prov.join('; ')}`);
  const cli = metroCli(checkout);
  if (!existsSync(cli))
    throw new Refused(
      `refused: ${cli} does not exist (the checkout has no installed dependencies)`,
    );
  const listeners = await io.proc.listeners(METRO_PORT);
  if (listeners.length || (await io.connects(METRO_PORT)))
    throw new Refused(
      `refused: something already listens on port ${METRO_PORT}: it is not this run's Metro`,
    );
  await assertTarget(m, 'API-WRITE', io, { dir, states: ['ready'] });
  const env = buildMetroEnv(m);
  const bad = apiUrlProblems(env.EXPO_PUBLIC_API_BASE_URL, m);
  if (bad.length) throw new Refused(`refused: ${bad.join('; ')}`);
  const args = metroArgs(cli);
  const child = io.spawnMetro({
    node: io.node,
    args,
    cwd: join(checkout, 'apps', 'mobile'),
    env,
    log: join(dir, 'metro.log'),
  });
  const info = await io.proc.info(child.pid);
  const next = {
    ...m,
    metro: {
      pid: child.pid,
      createdAt: info.createdAt,
      node: io.node,
      cli,
      checkout,
      sha,
      port: METRO_PORT,
      apiUrl: env.EXPO_PUBLIC_API_BASE_URL,
    },
  };
  writeManifest(dir, next);
  try {
    for (let i = 0; i < tries; i += 1) {
      const t = await io
        .fetch(`http://127.0.0.1:${METRO_PORT}/status`, { signal: AbortSignal.timeout(5000) })
        .then((r) => r.text())
        .catch(() => '');
      if (t.trim() === 'packager-status:running') break;
      if (i === tries - 1)
        throw new Error(
          `Metro did not report packager-status:running within ${(tries * delayMs) / 1000} s`,
        );
      await new Promise((r) => setTimeout(r, delayMs));
    }
    const verified = { ...next, metro: { ...next.metro, commandLine: info.commandLine } };
    const problems = await metroProblems(verified, io);
    if (problems.length) throw new Refused(`refused: ${problems.join('; ')}`);
    writeManifest(dir, verified);
    return verified;
  } catch (e) {
    await stopMetro(next, io, dir).catch(() => {});
    throw e;
  }
}

/** Why the Metro on port 8081 is not the one this run started. Empty means it is. */
export async function metroProblems(m, io) {
  const rec = m.metro;
  if (!rec) return ['this run started no Metro'];
  const p = [];
  p.push(...apiUrlProblems(rec.apiUrl, m));
  let listeners;
  let info;
  let status;
  try {
    listeners = await io.proc.listeners(METRO_PORT);
    info = await io.proc.info(rec.pid);
    status = await io
      .fetch(`http://127.0.0.1:${METRO_PORT}/status`, { signal: AbortSignal.timeout(5000) })
      .then((r) => r.text());
  } catch (e) {
    return [...p, `Metro could not be checked: ${e.message}`];
  }
  if (listeners.length !== 1 || listeners[0] !== rec.pid)
    p.push(
      `the listener(s) on port ${METRO_PORT} are [${listeners.join(', ')}], not the recorded pid ${rec.pid}`,
    );
  if (info.createdAt !== rec.createdAt)
    p.push(
      `process ${rec.pid} was created at ${info.createdAt}, not the recorded ${rec.createdAt}`,
    );
  const t = tokens(info.commandLine);
  const want = metroArgs(rec.cli);
  if (
    t.length !== 1 + want.length ||
    !same(t[0], rec.node) ||
    want.some((w, i) => !same(t[i + 1], w))
  )
    p.push(`process ${rec.pid} runs '${info.commandLine}', not the recorded Metro command`);
  if (status.trim() !== 'packager-status:running')
    p.push(`Metro reports '${status.trim().slice(0, 40)}'`);
  return p;
}

/** Stops Metro and its workers, only if the recorded pid still has the recorded creation time and command line. */
export async function stopMetro(m, io, dir) {
  const rec = m.metro;
  if (!rec) return { stopped: false, why: 'no Metro was started by this run' };
  const info = await io.proc.info(rec.pid);
  if (!info?.createdAt) {
    writeManifest(dir, { ...m, metro: null });
    return { stopped: false, why: `process ${rec.pid} is not running` };
  }
  const t = tokens(info.commandLine);
  const want = metroArgs(rec.cli);
  if (
    info.createdAt !== rec.createdAt ||
    t.length !== 1 + want.length ||
    !same(t[0], rec.node) ||
    want.some((w, i) => !same(t[i + 1], w))
  )
    throw new Refused(
      `refused: process ${rec.pid} is not the Metro this run started (creation time or command line differ); it was not stopped`,
    );
  await io.proc.killTree(rec.pid);
  writeManifest(dir, { ...m, metro: null });
  return { stopped: true };
}
