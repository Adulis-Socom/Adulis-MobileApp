import type { AmEntry } from './entry';
import type { enConsole } from './en.console';

/** CONSOLE-ONLY Amharic catalogue: key for key with en.console.ts (compile error otherwise). */
export const amConsole: { readonly [K in keyof typeof enConsole]: AmEntry } = {};
