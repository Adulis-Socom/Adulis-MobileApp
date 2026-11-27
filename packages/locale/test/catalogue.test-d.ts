import { am, en, format, type MessageKey } from '../src/catalogue';
import { am as mobileAm, en as mobileEn } from '../src/mobile';

/** TYPE-LEVEL TEST: the assertion is `tsc --noEmit`. A missing Amharic key or a wrong slot fails the compile. */
type Assert<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _KeysMatch = Assert<Equal<keyof typeof en, keyof typeof am>>;
type _MobileKeysMatch = Assert<Equal<keyof typeof mobileEn, keyof typeof mobileAm>>;
const _keys: readonly MessageKey[] = Object.keys(am) as MessageKey[];

// A key with no slots takes no slot argument.
const _plain: string = format('error.request.internal');
// @ts-expect-error -- a slot-free message refuses a slot object.
format('error.request.internal', { anything: 1 });
// @ts-expect-error -- an unknown key is a compile error, not a runtime fallback.
format('error.not_a_key');

// THE NEGATIVE CASE: an Amharic catalogue missing a key does not compile.
const { 'error.request.internal': _dropped, ...withoutOne } = am;
// @ts-expect-error -- 'error.request.internal' is missing.
const _incomplete: typeof am = withoutOne;

export type { _KeysMatch, _MobileKeysMatch };
export { _keys, _plain, _incomplete };
