/**
 * CONSOLE-ONLY English catalogue. Reaches the root `@adulis/locale` export, never `@adulis/locale/mobile`,
 * so console subscription and billing copy cannot reach a mobile bundle by import.
 *
 * Empty at foundation: the clean Seller Console adds its keys from SC-FE-01 onward.
 */
export const enConsole = {} as const;
