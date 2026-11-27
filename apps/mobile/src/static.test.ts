// Static guarantees over the app's own source (comments stripped): no Operator surface of any kind, none of the retired or
// prohibited financial and legacy concepts, no web storage, no dark or Amharic switch, no fixture or simulation route, no
// release profile that carries the fixture flag. Fixtures and tests are exempt only where stated: they are the demonstration.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = __dirname;
const ROOT = path.resolve(SRC, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const isProduction = (file: string) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file) && !file.includes(`${path.sep}fixtures${path.sep}`) && !file.includes(`${path.sep}testing${path.sep}`);

const production = walk(SRC).filter(isProduction).map((file) => ({ file: path.relative(SRC, file), code: strip(readFileSync(file, 'utf8')) }));

describe('production source', () => {
  it('has something to scan', () => {
    expect(production.length).toBeGreaterThan(20);
  });

  it('has no Operator member, route, string or credential type (a fixture persona is the only mention, and it is a fixture)', () => {
    const hits = production.filter(({ code }) => /operator/i.test(code)).map(({ file }) => file);
    expect(hits).toEqual([]);
  });

  it.each([
    ['Reservation', /reservation/i],
    ['Handoff', /hand-?off/i],
    ['payout', /payout/i],
    ['paid Order', /paid[-_ ]?order/i],
    ['Review Grant', /review[-_ ]?grant/i],
    ['payment confirmation', /confirm[-_ ]?payment|payment[-_ ]?confirm/i],
    ['background removal', /background[-_ ]?removal|remove[-_ ]?background/i],
  ])('has no %s symbol or string', (_name, pattern) => {
    expect(production.filter(({ code }) => pattern.test(code)).map(({ file }) => file)).toEqual([]);
  });

  it('uses no web storage, and no legacy server stack or retired generated client', () => {
    expect(production.filter(({ code }) => /localStorage|sessionStorage|AsyncStorage/.test(code)).map(({ file }) => file)).toEqual([]);
    expect(production.filter(({ code }) => /from ['"](express|kysely|graphile-worker|node-pg-migrate|pg)['"]/.test(code)).map(({ file }) => file)).toEqual([]);
  });

  it('has no dark-mode switch and does not import the Amharic catalogue', () => {
    expect(production.filter(({ code }) => /useColorScheme|Appearance\./.test(code)).map(({ file }) => file)).toEqual([]);
    expect(production.filter(({ code }) => /import\s*\{[^}]*\bam\b[^}]*\}\s*from\s*['"]@adulis\/locale\/mobile['"]/.test(code)).map(({ file }) => file)).toEqual([]);
  });

  it('uses no animation API, so there is no motion for reduce-motion to disable yet', () => {
    expect(production.filter(({ code }) => /\bAnimated\b|react-native-reanimated|LayoutAnimation/.test(code)).map(({ file }) => file)).toEqual([]);
  });
});

describe('route manifest and release profiles', () => {
  it('has no dev, internal or simulation route file under src/app', () => {
    const routes = walk(path.join(SRC, 'app')).map((file) => path.relative(path.join(SRC, 'app'), file));
    expect(routes.filter((route) => /(^|[\\/(])(dev|internal|simulation|fixtures?|demo)([\\/).]|$)/i.test(route))).toEqual([]);
  });

  it('has no source file under src/app other than routes and layouts (Expo Router bundles the whole directory)', () => {
    const files = walk(path.join(SRC, 'app')).filter((file) => /\.(ts|tsx)$/.test(file));
    expect(files.filter((file) => /\.test\.|fixture/i.test(file))).toEqual([]);
  });

  it('no release profile or app config mentions the fixture flag', () => {
    const candidates = ['eas.json', 'app.json', 'app.config.js', 'app.config.ts'].map((name) => path.join(ROOT, name)).filter(existsSync);
    expect(candidates.length).toBeGreaterThan(0);
    for (const file of candidates) expect(readFileSync(file, 'utf8')).not.toMatch(/ADULIS_FIXTURES/);
  });

  it('keeps the single fixture door: exactly one dynamic import of the fixtures, in select.ts', () => {
    const doors = production.filter(({ code }) => /import\(\s*['"][^'"]*fixtures['"]\s*\)/.test(code)).map(({ file }) => file);
    expect(doors).toEqual([path.join('transport', 'select.ts')]);
  });
});
