import { amCommon } from './am';
import { amConsole } from './am.console';
import { enCommon } from './en';
import { enConsole } from './en.console';

/**
 * The FULL catalogue: the shared part (en.ts / am.ts) plus the console part
 * (en.console.ts / am.console.ts). The root `@adulis/locale` export serves it; the mobile
 * app never imports it (mobile.ts). `en` defines the key union and `am` is
 * `Record<MessageKey, string>`, so a missing Amharic string is a COMPILE ERROR.
 */
export const en = { ...enCommon, ...enConsole } as const;

/** The key union. Every other locale must satisfy exactly this set. */
export type MessageKey = keyof typeof en;

export type Catalogue = Record<MessageKey, string>;

export const am: Catalogue = { ...amCommon, ...amConsole };
