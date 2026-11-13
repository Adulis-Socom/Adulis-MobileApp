#!/usr/bin/env node
/**
 * PostToolUse hook on Edit and Write: format, then lint --fix, the file that
 * was just written, when it is one of this workstream's or the token
 * package's. Deterministic (Prettier and ESLint with the repository's own
 * configuration), never blocking: a formatting failure is printed and the
 * edit stands. What it does not do is run the type checker -- that is the
 * pre-commit gate's job, once, rather than on every keystroke.
 */
import path from 'node:path';

import { REPO_ROOT, isMain, readHookInput, run, toPosix } from './lib.mjs';

const FORMAT_EXTS = new Set([
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
]);
const LINT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const OURS = /^(apps\/mobile|packages\/tokens)\//;

/** Which tools should run on this path: { format, lint } or null when it is not ours. */
export function plan(filePath) {
  if (typeof filePath !== 'string' || !filePath) return null;
  const abs = path.isAbsolute(filePath) ? filePath : path.join(REPO_ROOT, filePath);
  const rel = toPosix(path.relative(REPO_ROOT, abs));
  if (rel.startsWith('..') || !OURS.test(rel)) return null;
  if (/(^|\/)node_modules\//.test(rel) || /(^|\/)(dist|android|ios|\.expo)\//.test(rel))
    return null;
  if (/\.gitkeep$/.test(rel)) return null;
  const ext = path.extname(rel);
  if (!FORMAT_EXTS.has(ext)) return null;
  // The tools are spawned through a shell on Windows (pnpm is a .cmd), so a path
  // is passed on only when it is made of characters no shell interprets. Every
  // path in this repository is; one that is not is simply not formatted.
  if (!SAFE_PATH.test(rel)) return null;
  return { rel, format: true, lint: LINT_EXTS.has(ext) };
}

export const SAFE_PATH = /^[A-Za-z0-9_./()@[\]-]+$/;

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  const p = plan(input?.tool_input?.file_path);
  if (!p) process.exit(0);
  const notes = [];
  const fmt = run('pnpm', ['exec', 'prettier', '--write', '--log-level', 'warn', p.rel]);
  if (fmt.status !== 0)
    notes.push(`prettier: ${(fmt.stderr || fmt.stdout).trim().split(/\r?\n/).slice(-3).join(' ')}`);
  if (p.lint) {
    const lint = run('pnpm', ['exec', 'eslint', '--fix', '--no-warn-ignored', p.rel]);
    if (lint.status !== 0)
      notes.push(
        `eslint: ${(lint.stdout || lint.stderr).trim().split(/\r?\n/).slice(-6).join(' | ')}`,
      );
  }
  if (notes.length) console.log(`post-edit (${p.rel}): ${notes.join(' ; ')}`);
  process.exit(0);
}
