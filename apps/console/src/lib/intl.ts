/**
 * lib/intl.ts -- the client formats EVERYTHING with Intl, against the
 * market timezone from /v1/bootstrap (ADU-CON-03 S4.4). The server never
 * formats a number, a date or a currency (S7's envelope invariant), and
 * the console never concatenates translated fragments (S4.5): whole
 * sentences with named slots only.
 */

export interface MarketContext {
  readonly timezone: string;
  readonly currency: string;
  readonly locale: 'en' | 'am';
}

export function timeFormatter(m: MarketContext): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(m.locale, {
    timeZone: m.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function moneyFormatter(m: MarketContext): Intl.NumberFormat {
  return new Intl.NumberFormat(m.locale, { style: 'currency', currency: m.currency });
}

/** Minor units in, formatted major units out -- the wire carries integers. */
export function formatMinor(m: MarketContext, amountMinor: number): string {
  return moneyFormatter(m).format(amountMinor / 100);
}

/**
 * Fill a whole-sentence template's named slots: "{code} expires at {time}".
 * The TEMPLATE is the unit of translation; word order belongs to the
 * translator, never to code (S4.5, S23.1).
 */
export function fillTemplate(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => slots[name] ?? `{${name}}`);
}
