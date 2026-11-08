import type { CommonMessageKey } from '../src/en.common';
import type { ConsoleMessageKey } from '../src/en.console';
import type { MessageKey } from '../src/en';
import { am, en, type MobileMessageKey } from '../src/mobile';

/**
 * TYPE-LEVEL TEST for `@adulis/locale/mobile` (WO-001A, founder decision D2). Like
 * am-completeness.test-d.ts, the assertion is `tsc --noEmit`.
 */
type Assert<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** 1. English and Amharic expose the same mobile key set, both directions. */
type _Parity = Assert<Equal<keyof typeof en, keyof typeof am>>;
const _amComplete: Record<MobileMessageKey, string> = am;

/** 2. No console-namespace key is a mobile key. */
type _NoConsoleNamespace = Assert<Equal<Extract<MobileMessageKey, `console.${string}`>, never>>;

/** 3. The software-subscription copy found OUTSIDE console.* stays out, as does the console title. */
type _NoSubscriptionCopy = Assert<
  Equal<
    Extract<
      MobileMessageKey,
      | 'error.seller.tier_limit_reached'
      | 'sms.otp.step_up.subscription_change'
      | 'deletion.blocker.subscription_past_due'
      | 'app.title'
    >,
    never
  >
>;

/** 4. The shared strings a mobile client needs are present. */
type Needed =
  'common.retry' | 'error.auth.session_expired' | 'error.request.client_upgrade_required';
type _Shared = Assert<Equal<Extract<MobileMessageKey, Needed>, Needed>>;

/** 5. The parts are disjoint and together are the whole catalogue, so no spread overrides a key. */
type _Disjoint = Assert<Equal<Extract<CommonMessageKey, ConsoleMessageKey>, never>>;
type _Whole = Assert<Equal<CommonMessageKey | ConsoleMessageKey, MessageKey>>;

/** 6. The negative case: a mobile Amharic catalogue missing a key does not compile. */
// @ts-expect-error - a mobile catalogue missing every key but one must not satisfy the type
const _incomplete: Record<MobileMessageKey, string> = { 'common.retry': 'x' };

export type __MobileLocaleTypeTests = [
  _Parity,
  typeof _amComplete,
  _NoConsoleNamespace,
  _NoSubscriptionCopy,
  _Shared,
  _Disjoint,
  _Whole,
  typeof _incomplete,
];
