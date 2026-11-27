// Formatting only, never arithmetic: money arrives as minor units and a currency code from the server, hotspots as normalised
// fractions. Nothing here derives a discount, a "was" price, a stock claim or a sort order.
import type { Money, ProductTile, TrustLevel } from '../contracts/gap-mob-discovery';
import { t, type UiMessageKey } from '../i18n/messages';

export function formatMoney(money: Money): string {
  try {
    const format = new Intl.NumberFormat('en', { style: 'currency', currency: money.currency });
    // The exponent comes from the currency (two for most, zero for some), not from a guess.
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
    return format.format(money.minor / 10 ** digits);
  } catch {
    return `${money.currency} ${(money.minor / 100).toFixed(2)}`;
  }
}

export function formatPriceRange(min: Money, max: Money): string {
  return min.minor === max.minor && min.currency === max.currency ? formatMoney(min) : t('mobile.price.range', { min: formatMoney(min), max: formatMoney(max) });
}

export const priceOf = (product: Pick<ProductTile, 'priceMin' | 'priceMax'>): string => formatPriceRange(product.priceMin, product.priceMax);

/** Availability in words from the server's flag. There is no stock number to show and none is derived. */
export const availabilityText = (available: boolean): string => t(available ? 'mobile.product.available' : 'mobile.product.unavailable');

const TRUST: Record<TrustLevel, UiMessageKey> = {
  NEW: 'mobile.trust.new',
  REBUILDING: 'mobile.trust.rebuilding',
  ESTABLISHED: 'mobile.trust.established',
  TRUSTED: 'mobile.trust.trusted',
};
export const trustText = (level: TrustLevel | null): string | null => (level === null ? null : t(TRUST[level]));
