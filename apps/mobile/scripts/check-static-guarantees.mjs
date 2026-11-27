#!/usr/bin/env node
/**
 * Static guarantees over the app's own source, comments stripped (MOB-FE-01 acceptance rows on the absence of things):
 * no Operator surface of any kind, none of the retired or prohibited financial and legacy concepts, no web storage, no dark or
 * Amharic switch, no animation API, no dev/internal/simulation route, no release profile carrying the fixture flag, and exactly
 * one dynamic import of the fixtures. Fixtures and tests are exempt: they are the demonstration. A plain script (like
 * check-locale-imports.mjs) because the app carries no Node type declarations. Runs as part of `pnpm --filter @adulis/mobile test`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');

const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name)) : [path.join(dir, name)]));
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const sep = path.sep;
const production = walk(src)
  .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file) && !file.includes(`${sep}fixtures${sep}`) && !file.includes(`${sep}testing${sep}`))
  .map((file) => ({ file: path.relative(src, file), code: strip(readFileSync(file, 'utf8')) }));

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures.push(name);
};
const hits = (pattern) => production.filter(({ code }) => pattern.test(code)).map(({ file }) => file);

check('there is production source to scan', production.length > 20, `(${production.length} files)`);
check('no Operator member, route, string or credential type in production code', hits(/operator/i).length === 0, hits(/operator/i).join(', '));
for (const [name, pattern] of [
  ['Reservation', /reservation/i],
  ['Handoff', /hand-?off/i],
  ['payout', /payout/i],
  ['paid Order', /paid[-_ ]?order/i],
  ['Review Grant', /review[-_ ]?grant/i],
  ['payment confirmation', /confirm[-_ ]?payment|payment[-_ ]?confirm/i],
  ['background removal', /background[-_ ]?removal|remove[-_ ]?background/i],
  ['web storage', /localStorage|sessionStorage|AsyncStorage/],
  ['legacy server stack', /from ['"](express|kysely|graphile-worker|node-pg-migrate|pg)['"]/],
  ['dark-mode switch', /useColorScheme|Appearance\./],
  ['animation API (reduce-motion has nothing to disable yet)', /\bAnimated\b|react-native-reanimated|LayoutAnimation/],
]) {
  check(`no ${name} symbol or string`, hits(pattern).length === 0, hits(pattern).join(', '));
}
check('no import of the Amharic catalogue', hits(/import\s*\{[^}]*\bam\b[^}]*\}\s*from\s*['"]@adulis\/locale\/mobile['"]/).length === 0);

const appDir = path.join(src, 'app');
const routes = walk(appDir).map((file) => path.relative(appDir, file));
const badRoutes = routes.filter((route) => /(^|[\\/(])(dev|internal|simulation|fixtures?|demo)([\\/).]|$)/i.test(route) || /\.test\.|fixture/i.test(route));
check('no dev, internal, simulation, fixture or test file under src/app (Expo Router bundles the whole directory)', badRoutes.length === 0, badRoutes.join(', '));

const profiles = ['eas.json', 'app.json', 'app.config.js', 'app.config.ts'].map((name) => path.join(root, name)).filter(existsSync);
check('app config and release profiles exist to be checked', profiles.length > 0);
check('no release profile or app config mentions the fixture flag', profiles.every((file) => !/ADULIS_FIXTURES/.test(readFileSync(file, 'utf8'))));

const doors = hits(/import\(\s*['"][^'"]*fixtures['"]\s*\)/);
check('exactly one dynamic import of the fixtures, in src/transport/select.ts', doors.length === 1 && doors[0] === path.join('transport', 'select.ts'), doors.join(', '));

if (failures.length > 0) {
  console.error(`\n${failures.length} static guarantee(s) failed`);
  process.exit(1);
}
console.log('\nstatic guarantees hold');
