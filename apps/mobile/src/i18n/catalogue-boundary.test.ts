import { am, en, type MobileMessageKey } from '@adulis/locale/mobile';
import { renderHook } from '@testing-library/react-native';

import { allSources } from '../testing/source-scan';
import { useUiStore } from '../state/ui-store';
import { useT } from './i18n';

/**
 * The mobile bundle's strings: only the shared catalogue, never a console part, and the same
 * keys and slots in both languages. (scripts/check-locale-imports.mjs guards the same import
 * rule inside `pnpm test`; this keeps it, and the catalogue content, in the Jest run too.)
 */

const keys = Object.keys(en) as MobileMessageKey[];
const slotsOf = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort();

// The forbidden specifiers are assembled so this file does not itself contain one.
const PKG = ['@adulis', 'locale'].join('/');
const FORBIDDEN: readonly RegExp[] = [
  new RegExp(`['"\`]${PKG}(?!/mobile['"\`])[^'"\`\\n]*['"\`]`),
  /['"`][^'"`\n]*packages[\\/]locale[^'"`\n]*['"`]/,
  // A relative or package module whose name ends in .console (a string like a message key does not).
  /['"`](?:\.{1,2}[\\/]|@)[^'"`\n]*\.console(?:\.[tj]sx?)?['"`]/,
];
const forbidden = (text: string) => FORBIDDEN.some((pattern) => pattern.test(text));

describe('no console copy reaches the mobile app by import', () => {
  it('bites on the forms it exists to catch, and allows the mobile entry', () => {
    const samples: [string, boolean][] = [
      [`from '${PKG}'`, true],
      [`from "${PKG}/console"`, true],
      [`from '${PKG}/src/en.console'`, true],
      [`import(\`${PKG}\`)`, true],
      [`require('${PKG}/console')`, true],
      [`from '${['..', '..', 'packages', 'locale', 'src', 'en'].join('/')}'`, true],
      [`from './en.console'`, true],
      [`from "../strings.console.ts"`, true],
      [`from '${PKG}/mobile'`, false],
      [`console.log('done')`, false],
    ];
    for (const [sample, expected] of samples) expect({ sample, hit: forbidden(sample) }).toEqual({ sample, hit: expected });
  });

  it('no file under src, tests included, imports a locale module other than the mobile entry', () => {
    const files = allSources().filter(({ file }) => file !== 'i18n/catalogue-boundary.test.ts');
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter(({ text }) => forbidden(text)).map(({ file }) => file)).toEqual([]);
  });

  it('the one locale import in production code is the mobile entry', () => {
    const importers = allSources()
      .filter(({ file, text }) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx') && text.includes(`${PKG}/mobile`))
      .map(({ file }) => file);
    expect(importers).toEqual(expect.arrayContaining(['i18n/i18n.ts', 'api/messages.ts']));
  });
});

describe('no software-subscription or billing copy in the mobile catalogue', () => {
  // The vocabulary the locale package's own boundary check uses; marketplace words (price, order, store) stay legal.
  const SUBSCRIPTION = /\b(subscri\w*|plans?|tiers?|billing|upgrades?)\b/i;

  it('no key is in the console namespace or names a subscription, billing, plan, tier or entitlement string', () => {
    // 'buyer.you.session.surface.console' names a session's surface, not console copy: only the namespace is barred.
    const named = keys.filter(
      (key) =>
        key.startsWith('console.') ||
        key.split(/[._]/).some((part) => /^(subscription|billing|plans?|tiers?|entitlement\w*)$/.test(part)),
    );
    expect(named).toEqual([]);
  });

  it('no English string uses subscription vocabulary', () => {
    expect(keys.filter((key) => SUBSCRIPTION.test(en[key]))).toEqual([]);
  });

  it('no Amharic string carries subscription vocabulary in Latin letters', () => {
    expect(keys.filter((key) => SUBSCRIPTION.test(am[key]))).toEqual([]);
  });
});

describe('English and Amharic carry the same keys and the same slots', () => {
  it('have the same key set', () => {
    expect(Object.keys(am).sort()).toEqual([...keys].sort());
    expect(keys.length).toBeGreaterThan(300);
  });

  it('give every key a non-empty string in both languages', () => {
    expect(keys.filter((key) => typeof en[key] !== 'string' || en[key].trim() === '')).toEqual([]);
    expect(keys.filter((key) => typeof am[key] !== 'string' || am[key].trim() === '')).toEqual([]);
  });

  it('fill the same named slots in both languages, so no template loses or gains a value', () => {
    const differing = keys.filter((key) => slotsOf(en[key]).join() !== slotsOf(am[key]).join());
    expect(differing).toEqual([]);
    // The check is not vacuous: real templates with slots exist.
    expect(keys.filter((key) => slotsOf(en[key]).length > 0).length).toBeGreaterThan(40);
  });

  it('leave no placeholder brace unclosed in either language', () => {
    for (const catalogue of [en, am]) {
      expect(keys.filter((key) => (catalogue[key].match(/\{/g) ?? []).length !== (catalogue[key].match(/\}/g) ?? []).length)).toEqual([]);
    }
  });
});

describe('Amharic stays a development language', () => {
  const devGlobal = globalThis as unknown as { __DEV__: boolean };

  /** Renders every key under the given build type and stored language, then restores both. */
  async function renderedKeys(isDev: boolean, locale: 'en' | 'am') {
    const dev = devGlobal.__DEV__;
    devGlobal.__DEV__ = isDev;
    useUiStore.setState({ locale });
    const view = await renderHook(() => useT());
    try {
      return Object.fromEntries(keys.map((key) => [key, view.result.current(key)])) as Record<MobileMessageKey, string>;
    } finally {
      await view.unmount();
      devGlobal.__DEV__ = dev;
      useUiStore.setState({ locale: 'en' });
    }
  }

  it('a release build renders every key in English whatever the store holds', async () => {
    const rendered = await renderedKeys(false, 'am');
    expect(keys.filter((key) => rendered[key] !== en[key])).toEqual([]);
  });

  it('a development build renders every key in the selected language', async () => {
    const rendered = await renderedKeys(true, 'am');
    expect(keys.filter((key) => rendered[key] !== am[key])).toEqual([]);
  });
});
