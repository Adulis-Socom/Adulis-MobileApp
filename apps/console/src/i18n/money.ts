/**
 * Money at the edge. The API carries integer minor units plus an ISO currency the SERVER chose (CATINV S44); the Console only
 * converts for display and entry. The number of minor digits comes from Intl, never from a hard-coded table.
 */
export function minorDigits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function formatMoney(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(minor / 10 ** digits);
}

/** The editable text for an amount, without a currency symbol: 200000 ETB minor becomes "2000.00". */
export function minorToInput(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}

/** Entered major units to integer minor units, or null when the text is not an amount. Exact: no floating-point rounding. */
export function inputToMinor(text: string, currency: string): number | null {
  const digits = minorDigits(currency);
  const clean = text.trim().replace(/[\s,]/g, '');
  const match = /^(\d+)(?:\.(\d*))?$/.exec(clean);
  if (!match) return null;
  const fraction = match[2] ?? '';
  if (fraction.length > digits) return null;
  const minor = Number(`${match[1]}${fraction.padEnd(digits, '0')}`);
  return Number.isSafeInteger(minor) ? minor : null;
}
