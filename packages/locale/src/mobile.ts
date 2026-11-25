/**
 * `@adulis/locale/mobile` - the only catalogue the mobile app may import. Built from the SHARED parts alone;
 * it never imports catalogue.ts or a console part, so console-only copy cannot reach a mobile bundle by import.
 * Held by test/catalogue.test.mjs.
 */
export { enCommon as en, type CommonMessageKey as MobileMessageKey } from './en';
export { amCommon as am } from './am';
export type { AmEntry } from './entry';
