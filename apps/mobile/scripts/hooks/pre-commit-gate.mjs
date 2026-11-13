#!/usr/bin/env node
/**
 * PreToolUse hook on the shell tools (Bash AND PowerShell -- on Windows the
 * PowerShell tool is the primary one, and a matcher of "Bash" alone gated
 * nothing typed through it): when the command is a `git commit`, run what CI
 * would run for this workstream -- typecheck, unit tests, the fifteen grep
 * gates and a secret scan -- and BLOCK the commit if any of them fails (exit 2;
 * the reason goes to stderr, which the harness shows to the agent).
 *
 * THE SECRET SCAN LOOKS AT WHAT THE COMMIT COULD CARRY, not at the index as it
 * stands: a hook runs BEFORE the command, so for `git add -A && git commit` or
 * `git commit -a` the index is still empty at that moment. The scan therefore
 * covers staged, modified and untracked files together (`--pending`).
 *
 * Why a hook and not a git pre-commit hook: the agent commits through a shell
 * tool, and a Claude Code hook is deterministic, versioned in this directory,
 * and proven by breaking a gate on purpose (WO-0b's configuration gate).
 * `pnpm --filter @adulis/mobile precommit` runs the same checks by hand
 * (`--check`), which is how the proof is done without committing anything.
 *
 * This is the WORKSTREAM's gate, not the repository's: `pnpm ci:local` runs
 * the whole list and takes a database. This runs the part a mobile commit can
 * break in under two minutes.
 */
import path from 'node:path';

import { REPO_ROOT, SHELL_TOOLS, isMain, readHookInput, run, tail } from './lib.mjs';

const GATES_RUNNER = path.join(REPO_ROOT, 'apps', 'mobile', 'scripts', 'gates', 'run.mjs');
const SECRET_SCAN = path.join(REPO_ROOT, 'apps', 'mobile', 'scripts', 'hooks', 'secret-scan.mjs');

/**
 * Is this shell command a git commit? Handles `git commit`, `git -c k=v commit`,
 * `git -C dir commit`, a full path or `git.exe`, and a commit that is one step
 * of a chain (`&&`, `||`, `;`, `|`, a newline). A `git commit` inside a quoted
 * string is not a commit; that false negative is accepted -- the hook is the
 * inner ring, CI is the outer one.
 */
export function isGitCommit(command) {
  if (typeof command !== 'string') return false;
  const segments = command.split(/&&|\|\||;|\||\r?\n/);
  return segments.some((seg) =>
    /(^|\s|[\\/])git(\.exe)?(\s+-[A-Za-z]\S*(\s+\S+)?|\s+--\S+)*\s+commit(\s|$)/.test(seg.trim()),
  );
}

export const STEPS = [
  { id: 'typecheck', cmd: ['pnpm', '--filter', '@adulis/mobile', 'typecheck'] },
  { id: 'test', cmd: ['pnpm', '--filter', '@adulis/mobile', 'test'] },
  { id: 'mobile-gates', cmd: ['node', GATES_RUNNER, '--self-test'] },
  { id: 'secret-scan', cmd: ['node', SECRET_SCAN, '--pending'] },
];

/** Run every step; return the failures with their output tails. */
export function runChecks(steps = STEPS) {
  const failures = [];
  for (const step of steps) {
    const r = run(step.cmd[0], step.cmd.slice(1));
    if (r.status !== 0) failures.push({ id: step.id, output: tail(`${r.stdout}\n${r.stderr}`) });
  }
  return failures;
}

function report(failures) {
  const lines = [
    `pre-commit gate BLOCKED the commit: ${failures.map((f) => f.id).join(', ')} failed.`,
  ];
  for (const f of failures) lines.push(`\n--- ${f.id} ---\n${f.output}`);
  lines.push(
    '\nFix it, or run `pnpm --filter @adulis/mobile precommit` to see the whole picture. Red on any; there is no skip label.',
  );
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const failures = runChecks();
    if (failures.length) {
      console.error(report(failures));
      process.exit(1);
    }
    console.log('pre-commit gate: typecheck, test, mobile-gates and secret-scan all green.');
    process.exit(0);
  }

  const input = await readHookInput();
  if (!input || !SHELL_TOOLS.has(input.tool_name) || !isGitCommit(input.tool_input?.command))
    process.exit(0);

  const failures = runChecks();
  if (failures.length) {
    console.error(report(failures));
    process.exit(2);
  }
  process.exit(0);
}
