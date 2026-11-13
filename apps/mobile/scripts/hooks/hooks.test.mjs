/**
 * The hooks' decision logic, tested on Node's runner. The wiring through
 * apps/mobile/.claude/settings.json is proven by a session started in that
 * directory (DEFERRED-GATES.md); this proves the scripts decide correctly --
 * including the negative cases, which is where a guard usually lies.
 *
 * The credential fixtures are ASSEMBLED at test time so that this file is not
 * itself a credential on disk: the scan runs over pending files before a
 * commit, and it would otherwise block the commit that adds its own tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { sensitiveRule } from './guard-sensitive-writes.mjs';
import { SHELL_TOOLS } from './lib.mjs';
import { plan } from './post-edit-format.mjs';
import { isGitCommit } from './pre-commit-gate.mjs';
import { forbiddenFile, scanContent } from './secret-scan.mjs';

const join = (...parts) => parts.join('');

test('isGitCommit recognises the shapes an agent actually types, in Bash and in PowerShell', () => {
  for (const cmd of [
    'git commit -m "x"',
    'git add -A && git commit -m "x"',
    'git -c user.name=x commit -m "y"',
    'git -C apps/mobile commit --amend --no-edit',
    'pnpm test; git commit -am "z"',
    'git commit',
    'git.exe commit -m x',
    '/usr/bin/git commit -m x',
    'C:\\Program Files\\Git\\cmd\\git.exe commit -m x',
    "Set-Location apps/mobile; git commit -m 'ps'",
    'git add -A\ngit commit -m "two lines"',
  ]) {
    assert.ok(isGitCommit(cmd), `should match: ${cmd}`);
  }
});

test('isGitCommit ignores what is not a commit', () => {
  for (const cmd of [
    'git status',
    'git log --oneline -5',
    'git commit-tree abc',
    'echo "git commit"',
    'pnpm --filter @adulis/mobile precommit',
    '',
    undefined,
  ]) {
    assert.ok(!isGitCommit(cmd), `should not match: ${cmd}`);
  }
});

test('both shell tools are gated', () => {
  assert.ok(SHELL_TOOLS.has('Bash'));
  assert.ok(SHELL_TOOLS.has('PowerShell'));
  assert.ok(!SHELL_TOOLS.has('Edit'));
});

test('the sensitive-write guard asks on env, signing and credential files in any case, and stays quiet elsewhere', () => {
  for (const p of [
    '.env',
    'apps/mobile/.env.local',
    'C:\\repo\\apps\\mobile\\credentials.json',
    'keys/upload.jks',
    'certs/AuthKey_ABC.p8',
    'apps/mobile/eas.json',
    'apps/mobile/EAS.json',
    '.ENV',
    'apps/mobile/App.config.ts',
    'apps/mobile/.claude/settings.json',
    'android/app/google-services.json',
    'android/keystore.properties',
  ]) {
    assert.ok(sensitiveRule(p), `should ask: ${p}`);
  }
  for (const p of [
    '.env.example',
    '.ENV.EXAMPLE',
    'apps/mobile/app/index.tsx',
    'apps/mobile/src/components/Text.tsx',
    'packages/tokens/src/native/color.ts',
    'docs/x.md',
    '',
    undefined,
  ]) {
    assert.equal(sensitiveRule(p), null, `should not ask: ${p}`);
  }
});

test('the formatter plan covers this workstream and the token package, and nothing else', () => {
  const ours = plan('apps/mobile/app/index.tsx');
  assert.ok(ours && ours.format && ours.lint);
  const tokens = plan('packages/tokens/src/native/color.ts');
  assert.ok(tokens && tokens.lint);
  const json = plan('apps/mobile/eas.json');
  assert.ok(json && json.format && !json.lint);
  assert.equal(plan('apps/api/src/main.ts'), null, 'the backend is not ours to format');
  assert.equal(plan('apps/mobile/assets/fonts/Inter-Regular.ttf'), null);
  assert.equal(plan('apps/mobile/src/store/.gitkeep'), null);
  assert.equal(plan(undefined), null);
  assert.ok(
    plan('apps/mobile/app/(seller)/[id].tsx'),
    'router paths with parens and brackets are ours',
  );
  assert.equal(
    plan('apps/mobile/app/x; echo owned.tsx'),
    null,
    'a path a shell would interpret is not passed to one',
  );
  assert.equal(plan('apps/mobile/app/a b.tsx'), null);
});

test('secret-scan bans the files that are secrets by name and exempts .env.example', () => {
  for (const f of [
    '.env',
    'apps/mobile/.env.production',
    'x/upload-key.jks',
    'AuthKey.p8',
    'apps/mobile/credentials.json',
    '.dev-sms.log',
    'android/keystore.properties',
  ]) {
    assert.ok(forbiddenFile(f), `should be banned: ${f}`);
  }
  assert.equal(forbiddenFile('.env.example'), null);
  assert.equal(forbiddenFile('apps/mobile/app.config.ts'), null);
});

test('secret-scan catches credential shapes, quoted or not, and skips declared placeholders', () => {
  assert.ok(scanContent(join('-----BEGIN RSA ', 'PRIVATE KEY-----', '\nabc')).length > 0);
  assert.ok(scanContent(join('const k = "AKIA', 'ABCDEFGHIJKLMNOP', '";')).length > 0);
  assert.ok(scanContent(join('EXPO_TOKEN=', 'abcdefghijklmnopqrstuvwxyz1234')).length > 0);
  assert.ok(scanContent(join("password: '", 'correct-horse-battery-staple-9', "'")).length > 0);
  assert.ok(
    scanContent(join('storePassword=', 'Xk92mNq7pLw3vRt8bZ')).length > 0,
    'keystore.properties values are unquoted',
  );
  assert.equal(
    scanContent("password: 'ci-fake-evidence-key-value'").length,
    0,
    'a declared fake is not a finding',
  );
  assert.equal(scanContent("api_key: '<your-key-here-placeholder>'").length, 0);
  assert.equal(
    scanContent('password: ${DB_PASSWORD_FROM_ENVIRONMENT}').length,
    0,
    'an environment reference is not a value',
  );
  assert.equal(scanContent('const short = "abc";').length, 0);
});

test('the negative case: this test file itself is clean, so the scan can gate the commit that adds it', () => {
  const self = readFileSync(new URL(import.meta.url), 'utf8');
  assert.deepEqual(scanContent(self), []);
});
