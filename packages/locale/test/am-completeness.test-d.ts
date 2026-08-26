import type { Catalogue, MessageKey } from '../src/en';
import { en } from '../src/en';
import { am } from '../src/am';

/**
 * TYPE-LEVEL TEST — ADU-CON-02 v3.0 section 9.
 *
 * There is no test runner here on purpose. The assertion IS `tsc --noEmit`:
 * `pnpm --filter @adulis/locale test` type-checks this file, and a missing
 * Amharic key makes the compile fail. A runtime test could be skipped; a
 * compile error cannot.
 */

/** 1. am satisfies the full key union. Missing a key fails here. */
const _complete: Catalogue = am;

/** 2. en and am agree on the key set in both directions. */
type EnKeys = keyof typeof en;
type AmKeys = keyof typeof am;
type Assert<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _KeysMatch = Assert<Equal<EnKeys, AmKeys>>;

/** 3. Every key is a MessageKey — no stray keys smuggled into am. */
const _keys: readonly MessageKey[] = Object.keys(am) as MessageKey[];

/**
 * 4. THE NEGATIVE CASE — proof the gate actually bites.
 *
 * ADU-CON-02 section 14.4 asks for negative-case tests, not just happy paths.
 * @ts-expect-error is itself an assertion: TypeScript errors if the next line
 * does NOT error. So if the completeness gate ever stopped working, this file
 * would fail to compile — the check cannot rot silently.
 */
// @ts-expect-error - a catalogue missing 'common.signOut' must not satisfy Catalogue
const _incomplete: Catalogue = {
  'app.title': 'x',
  'health.ok': 'x',
  'health.degraded': 'x',
  'common.retry': 'x',
};

// Reference the bindings so noUnusedLocals stays satisfied without weakening it.
export type __LocaleTypeTests = [
  typeof _complete,
  _KeysMatch,
  typeof _keys,
  typeof _incomplete,
];
