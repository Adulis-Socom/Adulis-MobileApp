// Identity of a deployment artifact's migration set. Additive: nothing here applies, authorises or starts a migration.
//
// A hosted build may carry no .git, so the guard's source check (HEAD equals the approved commit, clean tree) cannot be
// satisfied there. This is the first half of an answer. At build time `write` records which commit the build says it is
// and the sha256 of the migration manifest (which lists every migration file's hash); later `verify` recomputes the
// manifest hash and checks every migration file against the manifest, and compares the record with the commit the
// pipeline expects (and with git HEAD, when the checkout has git metadata of its own).
//
// WHAT IT PROVES: the migration files in this artifact are the ones the record describes, and the record names the commit
// the pipeline expects. WHAT IT DOES NOT PROVE: that anyone approved that commit. An unsigned record can be rewritten by
// whoever can rewrite the artifact. Nothing in `pnpm db:migrate`, `db:migrate:guarded` or the guard's `up` reads a record,
// so a record can never authorise a migration.
//
//   node ops/scripts/release-artifact.mjs write  --commit <40-hex sha> --out <file>      (the file must not exist yet)
//   node ops/scripts/release-artifact.mjs verify --info <file> --expect-commit <40-hex sha>
//
// Refusals go to stderr and exit 1; a usage error exits 2.
import {
  closeSync,
  existsSync,
  fstatSync,
  openSync,
  readFileSync,
  readSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import {
  checkDirectory,
  checkManifest,
  checkSource,
  DEFAULT_DIR,
  DEFAULT_MANIFEST,
  entryKind,
  readCheckoutHead,
  REPO_ROOT,
  sha256,
} from './migration-guard.mjs';

export const ARTIFACT_SCHEMA = 1;
/** A record is three short fields; anything bigger is not one. */
export const MAX_RECORD_BYTES = 2048;
const FULL_SHA = /^[0-9a-f]{40}$/;
const KEYS = ['commit', 'manifestSha256', 'schema'];

const readManifest = (manifestPath) => {
  const bytes = readFileSync(manifestPath);
  return { bytes, manifest: JSON.parse(bytes.toString('utf8')) };
};

/** { record } for this tree, or { problems }: a tree whose files are not its pinned set is never described. */
export function describeArtifact({ commit, dir = DEFAULT_DIR, manifestPath = DEFAULT_MANIFEST }) {
  if (typeof commit !== 'string' || !FULL_SHA.test(commit.toLowerCase()))
    return { problems: ['--commit must be the full 40-character commit sha'] };
  let read;
  try {
    read = readManifest(manifestPath);
  } catch (e) {
    return { problems: [`the manifest cannot be read (${e.code ?? e.message})`] };
  }
  const problems = checkManifest(read.manifest);
  if (problems.length === 0) problems.push(...checkDirectory(dir, read.manifest));
  if (problems.length) return { problems };
  return {
    record: {
      schema: ARTIFACT_SCHEMA,
      commit: commit.toLowerCase(),
      manifestSha256: sha256(read.bytes),
    },
  };
}

/**
 * { record } read from a file, or { problems }: a regular file, read with a size limit (never unbounded, whatever the path
 * names), JSON, a plain object with exactly the three keys.
 */
export function readRecordFile(file) {
  let text;
  let fd;
  try {
    fd = openSync(file, 'r');
    if (!fstatSync(fd).isFile()) return { problems: ['the record is not a regular file'] };
    const buffer = Buffer.alloc(MAX_RECORD_BYTES + 1);
    const n = readSync(fd, buffer, 0, buffer.length, 0);
    if (n > MAX_RECORD_BYTES)
      return { problems: [`the record is larger than ${MAX_RECORD_BYTES} bytes`] };
    text = buffer.subarray(0, n).toString('utf8');
  } catch (e) {
    return { problems: [`the record cannot be read (${e.code ?? e.message})`] };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    return { problems: ['the record is not JSON'] };
  }
  if (record === null || typeof record !== 'object' || Array.isArray(record))
    return { problems: ['the record is not a JSON object'] };
  if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(KEYS))
    return { problems: [`the record must have exactly the keys ${KEYS.join(', ')}`] };
  return { record };
}

/**
 * The record against this tree and the commit the pipeline expects. Returns the problems (none: it matches). `headCommit`
 * is the checkout's own git HEAD when it has git metadata (null: judged by its files and the expected commit alone).
 */
export function verifyArtifact({
  record,
  expectedCommit,
  headCommit = null,
  dir = DEFAULT_DIR,
  manifestPath = DEFAULT_MANIFEST,
}) {
  const problems = [];
  if (record?.schema !== ARTIFACT_SCHEMA)
    problems.push(`the record's schema is not ${ARTIFACT_SCHEMA}`);
  if (!FULL_SHA.test(`${record?.commit}`))
    problems.push('the record names no full 40-character commit');
  if (!/^[0-9a-f]{64}$/.test(`${record?.manifestSha256}`))
    problems.push('the record names no manifest sha256');
  if (!FULL_SHA.test(`${expectedCommit}`.toLowerCase()))
    problems.push('--expect-commit must be the full 40-character commit sha');
  if (problems.length) return problems;
  if (record.commit !== expectedCommit.toLowerCase())
    problems.push(
      `the record is for commit ${record.commit.slice(0, 12)}, the pipeline expects ${expectedCommit.slice(0, 12).toLowerCase()}`,
    );
  if (headCommit !== null && headCommit.toLowerCase() !== record.commit)
    problems.push(
      `git HEAD is ${headCommit.slice(0, 12)}, the record is for ${record.commit.slice(0, 12)}`,
    );
  let read;
  try {
    read = readManifest(manifestPath);
  } catch (e) {
    return [...problems, `the manifest cannot be read (${e.code ?? e.message})`];
  }
  if (sha256(read.bytes) !== record.manifestSha256)
    problems.push('the migration manifest is not the one the record describes');
  const files = checkManifest(read.manifest);
  if (files.length === 0) files.push(...checkDirectory(dir, read.manifest));
  return [...problems, ...files];
}

/** The checkout's own HEAD, or null when it has no .git of its own; a .git that git cannot read is a problem, never "none". */
function ownHead(root) {
  if (!existsSync(path.join(root, '.git'))) return { head: null };
  const h = readCheckoutHead(root);
  return h.head ? h : { problem: h.problem };
}

/**
 * With git metadata, the commit is also a promise about the files: db/migrations and the manifest must be exactly as committed
 * (no changed or untracked file there), the same source check the guard runs for --expect-commit. Called only once HEAD is
 * known to be the commit; returns the problems.
 */
const asCommitted = (root, commit) => checkSource({ root, expectedCommit: commit });

/** Flags: every one takes a value, none repeats, none is unknown. */
function parseFlags(argv, allowed) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    const a = argv[i];
    if (!allowed.includes(a)) return { error: `unknown argument ${JSON.stringify(a)}` };
    if (a in flags) return { error: `${a} is given twice` };
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) return { error: `${a} needs a value` };
    flags[a] = v;
  }
  const missing = allowed.filter((a) => !(a in flags));
  return missing.length ? { error: `${missing.join(', ')} needed` } : { flags };
}

const USAGE =
  'usage: release-artifact.mjs write --commit <40-hex sha> --out <file> | verify --info <file> --expect-commit <40-hex sha>';

export function main(argv, { log = console.log, err = console.error, root = REPO_ROOT } = {}) {
  const [cmd, ...rest] = argv;
  const spec = { write: ['--commit', '--out'], verify: ['--info', '--expect-commit'] }[cmd];
  const parsed = spec
    ? parseFlags(rest, spec)
    : { error: `unknown command ${JSON.stringify(cmd ?? null)}` };
  if (parsed.error) {
    err(`REFUSED: ${parsed.error}; nothing was written`);
    err(USAGE);
    return 2;
  }
  const { flags } = parsed;
  if (cmd === 'write') {
    const d = describeArtifact({ commit: flags['--commit'] });
    if (d.problems) {
      err('REFUSED: this tree is not described:');
      for (const p of d.problems) err(`  - ${p}`);
      return 1;
    }
    const head = ownHead(root);
    if (head.problem) {
      err(`REFUSED: ${head.problem}; nothing was written`);
      return 1;
    }
    if (head.head && head.head.toLowerCase() !== d.record.commit) {
      err(
        `REFUSED: git HEAD is ${head.head.slice(0, 12)}, not --commit ${d.record.commit.slice(0, 12)}; nothing was written`,
      );
      return 1;
    }
    const dirty = head.head ? asCommitted(root, d.record.commit) : [];
    if (dirty.length) {
      err('REFUSED: the files are not the commit they would be recorded for; nothing was written');
      for (const p of dirty) err(`  - ${p}`);
      return 1;
    }
    try {
      writeFileSync(flags['--out'], `${JSON.stringify(d.record, null, 2)}\n`, { flag: 'wx' });
    } catch (e) {
      err(
        `REFUSED: ${flags['--out']} cannot be created (${e.code ?? e.message}); nothing was written`,
      );
      return 1;
    }
    log(
      `wrote the record for commit ${d.record.commit.slice(0, 12)} (manifest ${d.record.manifestSha256.slice(0, 12)})`,
    );
    return 0;
  }
  const r = readRecordFile(flags['--info']);
  if (r.problems) {
    err(`REFUSED: ${r.problems[0]}`);
    return 1;
  }
  const head = ownHead(root);
  if (head.problem) {
    err(`REFUSED: ${head.problem}`);
    return 1;
  }
  const problems = verifyArtifact({
    record: r.record,
    expectedCommit: flags['--expect-commit'],
    headCommit: head.head,
  });
  if (head.head && head.head.toLowerCase() === r.record.commit)
    problems.push(...asCommitted(root, r.record.commit));
  if (problems.length) {
    err('REFUSED: this artifact is not the one the record describes:');
    for (const p of problems) err(`  - ${p}`);
    return 1;
  }
  log(`OK: the migration files are the ones recorded for commit ${r.record.commit.slice(0, 12)}`);
  log(
    head.head
      ? 'git HEAD: equal to the recorded commit; db/migrations and the manifest are as committed'
      : 'git metadata: none (judged by its files and the expected commit)',
  );
  log(
    'this does not authorise a migration: the record is not signed and nothing reads it when applying',
  );
  return 0;
}

const entry = entryKind(import.meta.url);
if (entry === 'run') process.exitCode = main(process.argv.slice(2));
else if (entry === 'unresolved') {
  console.error(
    'REFUSED: the script could not recognise itself as the script being run; nothing was checked',
  );
  process.exitCode = 2;
}
