#!/usr/bin/env node
/**
 * PreToolUse hook on Edit and Write: a CONFIRMATION gate -- never a silent
 * allow -- on writes to environment files, signing configuration and
 * credential files (ADU-MOB-WO-01 v1.2 S0b.2; ADU-MOB-06 T2, S3.2; root
 * CLAUDE.md "no secrets in code"). It answers `ask`, so the person decides,
 * and it says which rule made it ask.
 *
 * Every rule is case-insensitive: the filesystems this runs on (NTFS, APFS)
 * are, so `EAS.json` and `.ENV` are the same files. `.env.example` is exempt:
 * it carries fake values only and is the one environment file that is tracked.
 */
import { isMain, readHookInput, toPosix } from './lib.mjs';

export const SENSITIVE = [
  {
    re: /(^|\/)\.env(\.[^/]+)?$/i,
    why: 'an environment file; .env.example is the only tracked one and carries fake values (root CLAUDE.md)',
  },
  {
    re: /(^|\/)credentials\.json$/i,
    why: 'EAS local credentials (ADU-MOB-06 T2: production secrets, CI only)',
  },
  {
    re: /\.(jks|keystore|p8|p12|pem|mobileprovision)$/i,
    why: 'a signing identity or key (ADU-MOB-07 O1: keys live off the machine and out of git)',
  },
  {
    re: /(^|\/)(google-services\.json|GoogleService-Info\.plist|keystore\.properties)$/i,
    why: 'a platform service or signing configuration',
  },
  { re: /(^|\/)eas\.json$/i, why: 'the EAS build and submit profiles (ADU-MOB-01 S19.1)' },
  {
    re: /(^|\/)app\.config\.(ts|js)$/i,
    why: 'the app configuration, including the privacy manifest and the plugins (ADU-MOB-05 S4.3)',
  },
  {
    re: /(^|\/)\.claude\/settings\.json$/i,
    why: 'the workstream boundary itself -- deny rules and hooks (ADU-REPO-01 S8)',
  },
];

/** The matching rule for a path, or null. */
export function sensitiveRule(filePath) {
  if (typeof filePath !== 'string' || !filePath) return null;
  const p = toPosix(filePath);
  if (/(^|\/)\.env\.example$/i.test(p)) return null;
  return SENSITIVE.find((s) => s.re.test(p)) ?? null;
}

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  const filePath = input?.tool_input?.file_path;
  const rule = sensitiveRule(filePath);
  if (!rule) process.exit(0);
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `Writing ${filePath}: ${rule.why}. Confirm this is intended.`,
    },
  };
  console.log(JSON.stringify(out));
  process.exit(0);
}
