// English-first. The app takes strings from @adulis/locale/mobile ONLY (check-locale-imports.mjs and ESLint hold it).
// Amharic exists in the package but is gated: it is not enabled here until human review releases it.
// Keys the shared catalogue does not carry yet are PROVISIONAL (./provisional.ts, request SR-L2M01-LOC-01): the shared
// text always wins once a key exists there.
import { en, type MobileMessageKey } from '@adulis/locale/mobile';

import { provisionalEn, type ProvisionalKey } from './provisional';

export type { MobileMessageKey, ProvisionalKey };
export type UiMessageKey = MobileMessageKey | ProvisionalKey;

export function hasKey(key: string): key is UiMessageKey {
  return Object.hasOwn(en, key) || Object.hasOwn(provisionalEn, key);
}

export function t(key: UiMessageKey, slots?: Readonly<Record<string, string | number>>): string {
  const template: string = Object.hasOwn(en, key) ? en[key as MobileMessageKey] : provisionalEn[key as ProvisionalKey];
  if (!slots) return template;
  // An unknown {slot} stays visible rather than guessed (the shared format() rule).
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (whole, name: string) => (Object.hasOwn(slots, name) ? String(slots[name]) : whole));
}

/** A server-supplied message is a catalogue KEY plus slots. An unknown key never shows raw: the fallback does. */
export function serverText(message: { readonly key: string; readonly slots?: Readonly<Record<string, string | number>> } | null, fallback: UiMessageKey): string {
  return message && hasKey(message.key) ? t(message.key, message.slots) : t(fallback);
}
