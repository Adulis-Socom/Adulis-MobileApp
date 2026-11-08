/**
 * `@adulis/locale/mobile` - the only catalogue the mobile app may import (WO-001A D2).
 *
 * Built from the *.common.ts parts ALONE. It never imports en.ts or am.ts, which compose
 * the console part in, so console subscription and billing copy cannot reach a mobile
 * bundle by import - whatever the bundler does or does not tree-shake.
 * Held by test/mobile-boundary.mjs.
 */
export { enCommon as en, type CommonMessageKey as MobileMessageKey } from './en.common';
export { amCommon as am } from './am.common';
