#!/usr/bin/env node
/**
 * A secret scan with no third party in it. .github/workflows/ci.yml has carried
 * the secret-scan stage as a commented gap since T5 -- "left commented rather
 * than implemented with an unreviewed third-party action, since that action
 * would run with repository credentials on every push". This is the local
 * half the pre-commit gate runs: file names that must never be committed, and
 * content shapes that are credentials.
 *
 * `--pending` scans everything a commit could carry -- staged, modified and
 * untracked (not ignored) files -- because the hook runs BEFORE `git add -A`
 * or `git commit -a` has touched the index. `--staged` scans the index alone.
 *
 * It is a shape check, not an adversary model. A determined person can hide a
 * key; this catches the helpful accident -- the .env that got `git add .`-ed,
 * the .p8 saved beside eas.json, the token pasted into a config.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT, isMain, run, toPosix } from './lib.mjs';

/** Files that are secrets by NAME, whatever they contain. */
export const FORBIDDEN_FILES = [
  { re: /(^|\/)\.env(\.[^/]+)?$/i, exempt: /(^|\/)\.env\.example$/i, why: 'an environment file' },
  { re: /\.(jks|keystore|p8|p12|pem|mobileprovision)$/i, why: 'a signing identity or private key' },
  { re: /(^|\/)credentials\.json$/i, why: 'EAS local credentials' },
  { re: /(^|\/)\.dev-sms\.log$/i, why: 'live OTP codes and phone numbers (ADU-RUL-03 S1.1)' },
  {
    re: /(^|\/)(google-services\.json|GoogleService-Info\.plist|keystore\.properties)$/i,
    why: 'a platform service or signing configuration',
  },
];

/** Content shapes that are credentials. */
export const PATTERNS = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: 'a PEM private key' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, why: 'an AWS access key id' },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, why: 'a Google API key' },
  { re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/, why: 'a Slack token' },
  { re: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/, why: 'a GitHub token' },
  { re: /\bsk_(live|test)_[0-9A-Za-z]{16,}\b/, why: 'a Stripe secret key' },
  {
    re: /\bEXPO_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{20,}/,
    why: 'an Expo access token -- the OTA publishing credential (ADU-MOB-06 T1)',
  },
  {
    re: /\b(?:secret|password|passwd|api[_-]?key|access[_-]?token|private[_-]?key|store_?password|key_?password)\s*[:=]\s*['"]?[^'"\s]{16,}['"]?/i,
    why: 'a credential-shaped assignment',
    placeholder: /fake|example|changeme|placeholder|dummy|<|\{\{|ci-|\$\{|process\.env/i,
  },
];

const TEXT_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.txt',
  '.env',
  '.example',
  '.sh',
  '.ps1',
  '.toml',
  '.ini',
  '.cfg',
  '.xml',
  '.plist',
  '.gradle',
  '.properties',
]);

export function forbiddenFile(rel) {
  const p = toPosix(rel);
  return FORBIDDEN_FILES.find((f) => f.re.test(p) && !(f.exempt && f.exempt.test(p))) ?? null;
}

/** Findings in one file's content: [{ line, why }]. */
export function scanContent(content) {
  const findings = [];
  content.split(/\r?\n/).forEach((line, i) => {
    for (const p of PATTERNS) {
      const m = p.re.exec(line);
      if (!m) continue;
      if (p.placeholder && p.placeholder.test(m[0])) continue;
      findings.push({ line: i + 1, why: p.why });
    }
  });
  return findings;
}

const gitList = (args) => {
  const r = run('git', args);
  return r.status === 0 ? r.stdout.split('\0').filter(Boolean).map(toPosix) : [];
};

/** The staged files, repository-relative posix paths. */
export function stagedFiles() {
  return gitList(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']);
}

/** Everything a commit could carry: staged, modified, and untracked-not-ignored. */
export function pendingFiles() {
  return [
    ...new Set([
      ...stagedFiles(),
      ...gitList(['diff', '--name-only', '-z', '--diff-filter=ACMR']),
      ...gitList(['ls-files', '--others', '--exclude-standard', '-z']),
    ]),
  ];
}

/** Scan a set of repository-relative files; return findings. */
export function scanFiles(files, root = REPO_ROOT) {
  const findings = [];
  for (const rel of files) {
    const banned = forbiddenFile(rel);
    if (banned) {
      findings.push({ file: rel, line: 0, why: `${banned.why} -- never committed` });
      continue;
    }
    const ext = path.extname(rel).toLowerCase();
    if (!TEXT_EXTS.has(ext) && ext !== '') continue;
    const abs = path.join(root, rel);
    let content;
    try {
      if (statSync(abs).size > 2 * 1024 * 1024) continue;
      content = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    for (const f of scanContent(content)) findings.push({ file: rel, line: f.line, why: f.why });
  }
  return findings;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const files = args.includes('--pending')
    ? pendingFiles()
    : args.includes('--staged')
      ? stagedFiles()
      : args
          .filter((a) => !a.startsWith('--'))
          .map((a) => toPosix(path.relative(REPO_ROOT, path.resolve(a))));
  const findings = scanFiles(files);
  if (findings.length) {
    console.error(`secret-scan: ${findings.length} finding(s) in ${files.length} file(s):`);
    for (const f of findings) console.error(`  ${f.file}${f.line ? `:${f.line}` : ''}  ${f.why}`);
    process.exit(1);
  }
  console.log(`secret-scan: ${files.length} file(s) clean.`);
  process.exit(0);
}
