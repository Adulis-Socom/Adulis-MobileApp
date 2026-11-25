import { amCommon } from './am';
import { amConsole } from './am.console';
import { enCommon } from './en';
import { enConsole } from './en.console';
import type { AmEntry } from './entry';

/**
 * The FULL catalogue: shared part plus console part. `en` defines the key union; `am` must carry every key.
 * The mobile app imports `@adulis/locale/mobile` (shared part only) and never this file.
 */
export const en = { ...enCommon, ...enConsole } as const;
export type MessageKey = keyof typeof en;
export type { AmEntry };
export const am: { readonly [K in MessageKey]: AmEntry } = { ...amCommon, ...amConsole };

/** Locales a release may show. Amharic joins only when every entry is REVIEWED (no public Amharic before review). */
export const PUBLIC_LOCALES = ['en'] as const;
export type PublicLocale = (typeof PUBLIC_LOCALES)[number];

/** The {slot} names a template declares, as a type: format() requires exactly these. */
export type SlotNames<S extends string> = S extends `${string}{${infer N}}${infer Rest}` ? N | SlotNames<Rest> : never;
export type SlotsFor<K extends MessageKey> = { readonly [N in SlotNames<(typeof en)[K]>]: string | number };

/**
 * Renders an English message with typed slots. Slot values are already formatted by the caller (Intl);
 * a missing slot is a compile error, and at runtime an unknown {slot} is left visible rather than guessed.
 */
export function format<K extends MessageKey>(key: K, ...args: [SlotNames<(typeof en)[K]>] extends [never] ? [] : [SlotsFor<K>]): string {
  const template: string = en[key];
  const slots = (args[0] ?? {}) as Record<string, string | number>;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (whole, name: string) => (Object.hasOwn(slots, name) ? String(slots[name]) : whole));
}
