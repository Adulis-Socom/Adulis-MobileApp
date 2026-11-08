import { am, en, type MobileMessageKey } from '@adulis/locale/mobile';

import { useUiStore, type Locale } from '../state/ui-store';

/**
 * Strings come from `@adulis/locale/mobile` ONLY - the mobile-safe catalogue, which cannot
 * carry console subscription or billing copy (WO-001A D2). Never import the package root.
 * Both languages carry every key (a compile gate in the package), so there is no fallback:
 * a missing string is a build failure, never English shown in place of Amharic.
 */
const catalogues: Record<Locale, Record<MobileMessageKey, string>> = { en, am };

export function translate(locale: Locale, key: MobileMessageKey): string {
  return catalogues[locale][key];
}

export function useT(): (key: MobileMessageKey) => string {
  const locale = useUiStore((state) => state.locale);
  return (key) => translate(locale, key);
}
