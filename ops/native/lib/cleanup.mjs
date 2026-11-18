// Removing a run's Docker resources. A container, volume or network is removed only with full
// ownership proof: the run label equals this run's id, the name carries this run's prefix, and the
// object is not in the protected set. Everything is identified first (by full id for containers
// and networks); if ANY resource cannot be positively identified, NOTHING is removed. A failed
// listing is never read as "absent", and a removal is confirmed by a successful empty listing.
import {
  appendFileSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { containerProblems, ROLES, networkProblems, volumeProblems } from './identity.mjs';
import { LABEL } from './protected.mjs';

const ok = (r) => !r.error && r.status === 0;
const tail = (r) => `${r.stderr || r.stdout || r.error?.message || ''}`.trim().slice(-300);
const ids = (r) => r.stdout.split(/\s+/).filter(Boolean);

async function inspect(io, args) {
  const r = await io.docker(args);
  if (!ok(r)) return { error: tail(r), absent: /no such/i.test(tail(r)) };
  try {
    return JSON.parse(r.stdout)[0] ?? { error: 'docker returned nothing' };
  } catch {
    return { error: 'docker returned no readable description' };
  }
}

/** Absent only on a SUCCESSFUL, empty listing by id/name: a docker error is never "absent". */
async function confirmedAbsent(io, args) {
  const r = await io.docker(args);
  return ok(r) && ids(r).length === 0;
}

/**
 * Phase 1. Returns { steps, problems, unknowns }: `steps` is the ordered removal list and is empty
 * unless every resource of the run was positively identified.
 */
export async function planDown(m, io) {
  const problems = [];
  const unknowns = [];
  const steps = [];
  const info = await io.docker(['info', '--format', '{{.ServerVersion}}']);
  if (!ok(info)) return { steps, problems, unknowns: [`docker is not reachable: ${tail(info)}`] };

  const filter = `label=${LABEL.run}=${m.run}`;
  const lists = {};
  for (const [kind, args] of [
    ['containers', ['ps', '-a', '--no-trunc', '-q', '--filter', filter]],
    ['volumes', ['volume', 'ls', '-q', '--filter', filter]],
    ['networks', ['network', 'ls', '--no-trunc', '-q', '--filter', filter]],
  ]) {
    const r = await io.docker(args);
    if (ok(r)) lists[kind] = ids(r);
    else unknowns.push(`could not list ${kind} of this run (${tail(r)}): not treated as absent`);
  }

  // Containers: every id the manifest records plus every id carrying the run label.
  const cids = new Set([
    ...Object.values(m.containers ?? {}).map((c) => c.id),
    ...(lists.containers ?? []),
  ]);
  for (const id of [...cids].filter(Boolean)) {
    const c = await inspect(io, ['inspect', '--type', 'container', id]);
    if (c.absent) {
      if (!(await confirmedAbsent(io, ['ps', '-a', '--no-trunc', '-q', '--filter', `id=${id}`])))
        unknowns.push(`container ${id} could not be confirmed absent`);
      continue;
    }
    if (c.error) {
      unknowns.push(`container ${id} could not be inspected: ${c.error}`);
      continue;
    }
    const name = `${c.Name}`.replace(/^\//, '');
    const role =
      Object.keys(ROLES).find((r) => m.containers?.[r]?.id === id) ??
      Object.keys(ROLES).find((r) => m.names[ROLES[r].name] === name);
    if (!role) {
      problems.push(
        `container ${name} (${id}) carries this run's label or id but is not one of its containers`,
      );
      continue;
    }
    // A container created just before a crash has no recorded id yet: adopt it only under its planned name.
    const mm = m.containers?.[role]?.id
      ? m
      : { ...m, containers: { ...m.containers, [role]: { id } } };
    const p = containerProblems(mm, role, c);
    if (p.length) problems.push(...p.map((x) => x.msg));
    else steps.push({ kind: 'container', id, name });
  }

  // Volumes: the planned names plus every volume carrying the run label.
  const vnames = new Set([m.names.pgVolume, m.names.minioVolume, ...(lists.volumes ?? [])]);
  for (const name of vnames) {
    const v = await inspect(io, ['volume', 'inspect', name]);
    if (v.absent) {
      if (!(await confirmedAbsent(io, ['volume', 'ls', '-q', '--filter', `name=^${name}$`])))
        unknowns.push(`volume ${name} could not be confirmed absent`);
      continue;
    }
    if (v.error) {
      unknowns.push(`volume ${name} could not be inspected: ${v.error}`);
      continue;
    }
    const key = Object.keys(ROLES).find((r) => m.names[ROLES[r].volume] === name);
    if (!key) {
      problems.push(`volume ${name} carries this run's label but is not one of its volumes`);
      continue;
    }
    const p = volumeProblems(m, key, v);
    if (p.length) problems.push(...p.map((x) => x.msg));
    else steps.push({ kind: 'volume', name });
  }

  // Network: the recorded id plus every network carrying the run label.
  const nids = new Set([m.network?.id, ...(lists.networks ?? [])].filter(Boolean));
  for (const id of nids) {
    const n = await inspect(io, ['network', 'inspect', id]);
    if (n.absent) {
      if (
        !(await confirmedAbsent(io, ['network', 'ls', '--no-trunc', '-q', '--filter', `id=${id}`]))
      )
        unknowns.push(`network ${id} could not be confirmed absent`);
      continue;
    }
    if (n.error) {
      unknowns.push(`network ${id} could not be inspected: ${n.error}`);
      continue;
    }
    const mm = m.network?.id ? m : { ...m, network: { id } };
    const p = networkProblems(mm, n);
    if (p.length) problems.push(...p.map((x) => x.msg));
    else steps.push({ kind: 'network', id, name: n.Name });
  }

  const order = { container: 0, volume: 1, network: 2 };
  steps.sort((a, b) => order[a.kind] - order[b.kind]);
  return problems.length || unknowns.length
    ? { steps: [], problems, unknowns }
    : { steps, problems, unknowns };
}

/**
 * Phase 2. Removes by full id (containers, networks) or by the verified name (volumes), re-reading
 * ownership immediately before each volume and network removal, and confirms each absence.
 * Returns { removed, left } where `left` lists what is still there or could not be confirmed.
 */
export async function executeDown(m, steps, io, log = () => {}) {
  const removed = [];
  const left = [];
  for (const s of steps) {
    let args;
    let confirm;
    if (s.kind === 'container') {
      args = ['rm', '-f', s.id]; // no -v: a named volume is removed only after its own proof
      confirm = ['ps', '-a', '--no-trunc', '-q', '--filter', `id=${s.id}`];
    } else if (s.kind === 'volume') {
      const key = Object.keys(ROLES).find((r) => m.names[ROLES[r].volume] === s.name);
      const v = await inspect(io, ['volume', 'inspect', s.name]);
      const holders = await io.docker([
        'ps',
        '-a',
        '--no-trunc',
        '-q',
        '--filter',
        `volume=${s.name}`,
      ]);
      if (
        v.error ||
        !key ||
        volumeProblems(m, key, v).length ||
        !ok(holders) ||
        ids(holders).length
      ) {
        left.push(`volume ${s.name}: ownership or detachment could not be re-proven`);
        continue;
      }
      args = ['volume', 'rm', s.name];
      confirm = ['volume', 'ls', '-q', '--filter', `name=^${s.name}$`];
    } else {
      const n = await inspect(io, ['network', 'inspect', s.id]);
      if (n.error || networkProblems(m, n).length || Object.keys(n.Containers ?? {}).length) {
        left.push(`network ${s.name}: ownership or detachment could not be re-proven`);
        continue;
      }
      args = ['network', 'rm', s.id];
      confirm = ['network', 'ls', '--no-trunc', '-q', '--filter', `id=${s.id}`];
    }
    const r = await io.docker(args);
    log({ op: 'remove', kind: s.kind, id: s.id ?? s.name, name: s.name, exit: r.status });
    if (await confirmedAbsent(io, confirm)) removed.push(s);
    else left.push(`${s.kind} ${s.name ?? s.id}: ${ok(r) ? 'still present' : tail(r)}`);
  }
  return { removed, left };
}

export const appendOp = (dir, entry) =>
  appendFileSync(
    join(dir, 'ops.ndjson'),
    `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
  );

/**
 * Removes the run directory only when it is exactly <root>/runs/<run>, holds the run's own marker
 * file, and contains no link or junction that could lead out of it. Returns a list of problems.
 */
export function purgeProblems(root, run) {
  const runs = join(resolve(root), 'runs');
  const dir = join(runs, run);
  const p = [];
  let real;
  try {
    real = realpathSync(dir);
    if (real !== join(realpathSync(runs), run))
      p.push(`${dir} resolves to ${real}, outside ${runs}`);
  } catch (e) {
    return [`${dir} cannot be resolved: ${e.message}`];
  }
  try {
    if (readFileSync(join(real, 'run.marker'), 'utf8').trim() !== run)
      p.push('run.marker does not name this run');
  } catch {
    p.push('run.marker is missing');
  }
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const f = join(d, e);
      const st = lstatSync(f);
      if (st.isSymbolicLink()) p.push(`${f} is a link or junction`);
      else if (st.isDirectory()) walk(f);
    }
  };
  if (!p.length) walk(real);
  return p;
}

export function purge(root, run) {
  const p = purgeProblems(root, run);
  if (p.length) return p;
  rmSync(realpathSync(join(resolve(root), 'runs', run)), { recursive: true });
  return [];
}
