/**
 * Shared plumbing for the Claude Code hooks of apps/mobile/.claude/settings.json
 * (Adulis Mobile AI-Assisted Engineering Manual S22, as quoted by ADU-MOB-WO-01
 * v1.2 S0b.2: "deterministic only"). A hook reads one JSON object on stdin, does
 * something a script can decide without judgement, and either says nothing
 * (exit 0) or blocks with a reason (exit 2, reason on stderr).
 *
 * WHERE A HOOK RUNS. Claude Code runs a hook command in the CURRENT working
 * directory, which moves with every `cd` the shell tool makes; settings.json
 * therefore addresses these scripts through `$CLAUDE_PROJECT_DIR`, which the
 * harness sets to the directory the session started in. These scripts also
 * resolve the repository root from their own location, never from cwd.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
);
export const MOBILE_ROOT = path.join(REPO_ROOT, 'apps', 'mobile');

/** The two shell tools Claude Code exposes on this platform; both carry tool_input.command. */
export const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

/** The hook input, or null when stdin is empty or not JSON (a manual run). */
export async function readHookInput() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Quote an argument for cmd.exe when a shell is in the way and the argument has a space. */
const quoteForShell = (a) =>
  process.platform === 'win32' && /\s/.test(a) && !/^".*"$/.test(a) ? `"${a}"` : a;

/** Run a command from the repository root; capture output. */
export function run(cmd, args, { cwd = REPO_ROOT, env } = {}) {
  const shell = process.platform === 'win32';
  const r = spawnSync(cmd, shell ? args.map(quoteForShell) : args, {
    cwd,
    encoding: 'utf8',
    shell,
    env: env ? { ...process.env, ...env } : process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Print the last lines of a failed step so the reason travels with the block. */
export function tail(text, lines = 25) {
  return text.trim().split(/\r?\n/).slice(-lines).join('\n');
}

export const toPosix = (p) => p.split(path.sep).join('/');

export function isMain(metaUrl) {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}
