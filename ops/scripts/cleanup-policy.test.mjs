// The cleanup policy document and the tools that apply it must describe the same labels and commands, so that
// a label added to the native harness without a policy row (or a policy row for a command that no longer
// exists) fails here. Nothing is run and no Docker resource is read.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LABEL, OWNER } from '../native/lib/protected.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const POLICY = read('docs/infrastructure/DISPOSABLE-RESOURCE-CLEANUP-POLICY.md');

test('every label the native harness sets has a row in the policy, with the owner value it really uses', () => {
  for (const label of Object.values(LABEL))
    assert.ok(POLICY.includes(`\`${label}`), `the policy names ${label}`);
  assert.ok(
    POLICY.includes(`\`adulis.native-harness.owner=${OWNER}\``),
    'the owner value is stated',
  );
  assert.match(POLICY, /### Run-scoped resources: the native test harness/);
});

test('the policy states who may remove a run-labelled named volume, and on what proof', () => {
  const section =
    POLICY.split('### Run-scoped resources: the native test harness')[1]?.split('\n## ')[0] ?? '';
  assert.match(section, /Named volumes of the run/);
  assert.match(section, /no driver options/);
  assert.match(section, /no container of any kind, running or stopped, holds the volume/);
  assert.match(section, /A label alone is never proof/);
  assert.match(section, /never by hand and never by a generic cleanup/);
  // the generic rules must point at this section, so a reader of rule 3 is not told the harness breaks it
  assert.match(POLICY, /Run-scoped resources of the native harness are the one exception/);
});

test('the commands the policy names exist in the harness, and the harness refuses to remove without the ownership proof it describes', () => {
  const harness = read('ops/native/harness.mjs');
  for (const cmd of ['down', 'recover', 'purge'])
    assert.match(harness, new RegExp(`case '${cmd}'`), cmd);
  const identity = read('ops/native/lib/identity.mjs');
  assert.match(identity, /driver options/, 'the harness refuses a volume with driver options');
  const cleanup = read('ops/native/lib/cleanup.mjs');
  assert.match(cleanup, /\['rm', '-f', s\.id\]/, 'containers are removed by full id');
  assert.doesNotMatch(cleanup, /'rm', '-f', '-v'|'-fv'/, 'never with -v');
  assert.match(
    cleanup,
    /`volume=\$\{s\.name\}`/,
    'a volume is re-checked for holders before removal',
  );
});

test('the post-crash report lists native-harness leftovers and removes nothing', () => {
  const script = read('ops/scripts/postcrash-health.sh');
  const line = script.split('\n').find((l) => l.startsWith('left=$('));
  assert.ok(line, 'the leftovers line exists');
  assert.ok(line.includes(`label=${LABEL.owner}`), 'it lists the native harness label');
  for (const kind of ['docker ps -a', 'docker volume ls', 'docker network ls'])
    assert.match(line, new RegExp(`${kind}[^;]*label=${LABEL.owner.replaceAll('.', '\\.')}`), kind);
  assert.doesNotMatch(
    script,
    /docker (rm|volume rm|network rm|system prune|volume prune)/,
    'the report removes nothing',
  );
});
