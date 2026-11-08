#!/usr/bin/env node
/**
 * The app takes strings from `@adulis/locale/mobile` ONLY (WO-001A, founder decision D2):
 * the package root and its console parts carry software-subscription copy that must never
 * be bundled. Fails on any other '@adulis/locale' specifier anywhere in the app's source -
 * deep paths included, which Metro resolves even when the exports map does not list them -
 * and on any path into packages/locale, which bypasses the package name altogether.
 * Runs as part of `pnpm --filter @adulis/mobile test`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UNSAFE = [
  /['"`]@adulis\/locale(?!\/mobile['"`])[^'"`]*['"`]/,
  /['"`][^'"`\n]*packages\/locale[^'"`\n]*['"`]/,
];
const isUnsafe = (text) => UNSAFE.some((pattern) => pattern.test(text));

// The patterns must bite: the forms they exist to catch, and the one form they must allow.
for (const [sample, unsafe] of [
  [`from '@adulis/locale'`, true],
  [`from "@adulis/locale/src/en.console"`, true],
  ['import(`@adulis/locale`)', true],
  [`require('@adulis/locale/console')`, true],
  [`from '../../packages/locale/src/en'`, true],
  [`from '@adulis/locale/mobile'`, false],
]) {
  if (isUnsafe(sample) !== unsafe) throw new Error(`self-check failed on: ${sample}`);
}

const app = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Generated or third-party trees, and this script (whose samples are deliberately unsafe).
const SKIP = new Set(['node_modules', 'android', 'ios', 'dist', '.expo', 'scripts']);

function sourceFiles(dir) {
  return readdirSync(path.join(app, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIP.has(entry.name) ? [] : sourceFiles(rel);
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [rel] : [];
  });
}
const offenders = sourceFiles('').filter((file) =>
  isUnsafe(readFileSync(path.join(app, file), 'utf8')),
);
if (offenders.length > 0) {
  console.error(`  FAIL  import the mobile-safe catalogue only (@adulis/locale/mobile):`);
  for (const file of offenders) console.error(`        ${file}`);
  process.exit(1);
}
console.log('  PASS  the app takes strings from @adulis/locale/mobile only');
