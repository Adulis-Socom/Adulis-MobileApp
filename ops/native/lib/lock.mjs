// The session lock of a run: <run>/native.lock holds the pid and creation time of the harness process that
// runs a native session and, while a flow runs, the pid, creation time and command line of the Maestro
// process it started. A lock whose harness process is gone is stale, but a Maestro process that is still
// alive with the recorded identity is an ORPHAN: it can still drive the device, so nothing restores, tears
// down or starts over it; `device restore` and `down` stop it by that identity. A lock that cannot be read
// is a lock that is held: nothing is assumed about who wrote it.
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Refused } from './guard.mjs';

const LOCK = 'native.lock';

function readLock(dir) {
  let text;
  try {
    text = readFileSync(join(dir, LOCK), 'utf8');
  } catch (e) {
    return e.code === 'ENOENT'
      ? { state: 'none' }
      : { state: 'unreadable', why: `the lock file cannot be read (${e.code ?? e.message})` };
  }
  try {
    const rec = JSON.parse(text);
    if (!Number.isInteger(rec?.pid) || typeof rec?.createdAt !== 'string')
      throw new Error('no pid and creation time');
    return { state: 'ok', rec };
  } catch (e) {
    return { state: 'unreadable', why: `the lock file is not a lock record (${e.message})` };
  }
}

const sameProcess = (info, rec) =>
  !!info?.createdAt &&
  info.createdAt === rec.createdAt &&
  (rec.commandLine === undefined || info.commandLine === rec.commandLine);

/** Is the run held by a live session? { held, pid?, why?, orphan? }; an orphan is a live recorded Maestro. */
export async function lockHeld(dir, io) {
  const l = readLock(dir);
  if (l.state === 'none') return { held: false };
  if (l.state === 'unreadable') return { held: true, unknown: true, why: l.why };
  const { rec } = l;
  const look = async (p) => {
    try {
      return { info: await io.proc.info(p) };
    } catch (e) {
      return { error: e.message };
    }
  };
  const mine = await look(rec.pid);
  if (mine.error)
    return {
      held: true,
      pid: rec.pid,
      unknown: true,
      why: `its process could not be looked up (${mine.error})`,
    };
  if (sameProcess(mine.info, { createdAt: rec.createdAt })) return { held: true, pid: rec.pid };
  const mc = rec.maestro;
  if (mc && Number.isInteger(mc.pid)) {
    const theirs = await look(mc.pid);
    if (theirs.error)
      return {
        held: true,
        pid: rec.pid,
        unknown: true,
        why: `its Maestro process could not be looked up (${theirs.error})`,
      };
    if (sameProcess(theirs.info, mc))
      return {
        held: false,
        stale: true,
        orphan: { pid: mc.pid, createdAt: mc.createdAt, commandLine: mc.commandLine },
      };
  }
  return { held: false, stale: true };
}

/** Takes the lock, or refuses: a live session, an unreadable lock and an orphan Maestro all refuse. */
export async function acquireLock(dir, io, pid = process.pid) {
  const me = { pid, createdAt: (await io.proc.info(pid)).createdAt };
  if (!me.createdAt)
    throw new Refused('refused: this process could not be identified for the session lock', 2);
  for (let i = 0; i < 2; i += 1) {
    try {
      writeFileSync(join(dir, LOCK), JSON.stringify(me), { flag: 'wx' });
      const back = readLock(dir);
      if (back.state === 'ok' && back.rec.pid === pid) return me;
      throw new Refused(
        'refused: the session lock was taken by another session at the same moment',
      );
    } catch (e) {
      if (e instanceof Refused) throw e;
      if (e.code !== 'EEXIST') throw e;
      const h = await lockHeld(dir, io);
      if (h.held)
        throw new Refused(
          `refused: another native session (${h.pid ? `pid ${h.pid}` : 'an unreadable lock'}) holds this run`,
        );
      if (h.orphan)
        throw new Refused(
          `refused: a Maestro process (pid ${h.orphan.pid}) of an earlier session is still running: run \`device restore\``,
        );
      unlinkSync(join(dir, LOCK));
    }
  }
  throw new Refused('refused: the session lock could not be taken');
}

export function releaseLock(dir) {
  try {
    unlinkSync(join(dir, LOCK));
  } catch {
    // already gone
  }
}

function writeLock(dir, rec) {
  const tmp = join(dir, `${LOCK}.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(rec));
  renameSync(tmp, join(dir, LOCK));
}

/** Records the Maestro process this session started, by identity, in the lock it holds. */
export async function recordMaestro(dir, io, pid) {
  const l = readLock(dir);
  if (l.state !== 'ok') return;
  const info = await io.proc.info(pid);
  if (!info?.createdAt) return;
  writeLock(dir, {
    ...l.rec,
    maestro: { pid, createdAt: info.createdAt, commandLine: info.commandLine },
  });
}

export function clearMaestro(dir) {
  const l = readLock(dir);
  if (l.state !== 'ok' || !l.rec.maestro) return;
  const { maestro: _gone, ...rest } = l.rec;
  writeLock(dir, rest);
}

/**
 * Stops an orphan Maestro by the identity the lock recorded (the pid still has its creation time and its
 * command line), confirms it is gone, and removes the dead session's lock. Resolves { stopped, pid } or
 * { stopped: false } when there is none; throws Refused when it cannot be stopped.
 */
export async function reapOrphan(dir, io, { tries = 20, delayMs = 250 } = {}) {
  const h = await lockHeld(dir, io);
  if (!h.orphan) return { stopped: false };
  const o = h.orphan;
  const now = await io.proc.info(o.pid);
  if (!sameProcess(now, o)) return { stopped: false };
  const { pid } = o;
  io.proc.kill(pid);
  for (let i = 0; i < tries; i += 1) {
    if (!sameProcess(await io.proc.info(pid), o)) {
      releaseLock(dir);
      return { stopped: true, pid };
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Refused(
    `refused: the Maestro process ${pid} of an earlier session could not be stopped`,
  );
}

/**
 * The commands that change the stack or the device while no session runs. A live session (or a lock that
 * cannot be read) refuses them; an orphan Maestro refuses them unless `reap` (it is stopped first) or
 * `allowOrphan` (a teardown that does not touch the device).
 */
export async function guardSession(dir, io, { reap = false, allowOrphan = false } = {}) {
  const h = await lockHeld(dir, io);
  if (h.held)
    throw new Refused(
      h.pid
        ? `refused: a native session (pid ${h.pid}) is running on this run: it restores its own changes`
        : `refused: a native session lock that cannot be read holds this run (${h.why})`,
    );
  if (!h.orphan) return { stopped: false };
  if (reap) return reapOrphan(dir, io);
  if (allowOrphan) return { stopped: false };
  throw new Refused(
    `refused: a Maestro process (pid ${h.orphan.pid}) of an earlier session is still running: run \`device restore\``,
  );
}
