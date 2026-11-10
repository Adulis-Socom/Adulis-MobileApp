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

/**
 * AMHARIC IS A DEVELOPMENT-ONLY LANGUAGE until the human translation review (November
 * R-19): its strings are machine-translated placeholders (packages/locale/MT-KEYS.md). A
 * release build renders English whatever the store holds, so no path - a leftover setting,
 * a future control - can show a user unreviewed Amharic. Development builds keep it for QA.
 */
export function amharicAvailable(): boolean {
  return __DEV__;
}

/** The language strings and formats render in (English in a release build, above). */
export function useLocale(): Locale {
  const selected = useUiStore((state) => state.locale);
  return amharicAvailable() ? selected : 'en';
}

export function useT(): (key: MobileMessageKey) => string {
  const locale = useLocale();
  return (key) => translate(locale, key);
}

/**
 * Integer minor units (the wire's money) as the currency's own major units, formatted by
 * Intl for the locale. The currency's fraction digits say where the point goes (ETB: 2),
 * so no exponent is assumed; the server never formats money.
 */
export function formatMinor(locale: Locale, amountMinor: number, currency: string): string {
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency });
  return format.format(amountMinor / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2));
}

/**
 * A Product's current price from its Variants' lowest and highest (price lives on the
 * Variant): one amount when they agree, the span when they differ, null when there is no
 * ACTIVE Variant to price. Never the Product's base price, which is a creation seed.
 */
export function formatPriceSpan(
  locale: Locale,
  t: (key: MobileMessageKey) => string,
  span: { min: number | null; max: number | null; currency: string | null },
): string | null {
  const { min, max, currency } = span;
  if (min === null || max === null || currency === null) return null;
  if (min === max) return formatMinor(locale, min, currency);
  return t('buyer.price.range')
    .replace('{min}', formatMinor(locale, min, currency))
    .replace('{max}', formatMinor(locale, max, currency));
}
