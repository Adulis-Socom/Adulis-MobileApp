import { am, en } from '@adulis/locale/mobile';
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ApiError } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { MessageBubble } from '../buyer/MessageBubble';
import type { ChatMessage } from '../buyer/chat';
import { useUiStore } from '../state/ui-store';
import { GEEZ_DIGITS, GEEZ_TWELVE, LONG, MIXED, NAME, SENTENCE, STORE_NAME, UNBROKEN, hasEthiopicDigit } from '../testing/ethiopic';
import { formatMinor, formatPriceSpan, translate } from './i18n';

/**
 * How the helpers that exist present money, filled sentences, errors and times, with Latin, Ge'ez,
 * mixed and long text. The ICU in Node is the platform here: a device's own Intl data is a device
 * check, so the amounts are asserted by their digits and separators, not by a currency glyph.
 */

const LOCALES = ['en', 'am'] as const;
const t = (locale: (typeof LOCALES)[number]) => (key: Parameters<typeof translate>[1]) => translate(locale, key);

describe.each(LOCALES)('formatMinor in %s', (locale) => {
  it.each([
    [45050, '450.50'],
    [1, '0.01'],
    [99, '0.99'],
    [100, '1.00'],
    [0, '0.00'],
    [120000, '1,200.00'],
    [123456789012, '1,234,567,890.12'],
  ])('writes %i minor units of ETB as %s, with Latin digits and one currency marker', (minor, amount) => {
    const text = formatMinor(locale, minor, 'ETB');
    expect(text).toContain(amount);
    expect(text.replace(amount, '').trim()).not.toBe('');
    expect(hasEthiopicDigit(text)).toBe(false);
    expect(text).not.toMatch(/\n/);
  });

  it('keeps the sign of a negative amount and reads the currency own exponent', () => {
    expect(formatMinor(locale, -1250, 'ETB')).toContain('12.50');
    expect(formatMinor(locale, -1250, 'ETB')).toContain('-');
    expect(formatMinor(locale, 500, 'JPY')).toContain('500');
    expect(formatMinor(locale, 1500, 'KWD')).toContain('1.500');
  });
});

describe.each(LOCALES)('formatPriceSpan in %s', (locale) => {
  const span = (min: number | null, max: number | null, currency: string | null) => formatPriceSpan(locale, t(locale), { min, max, currency });

  it('is one amount when the Variants agree, with no range wording', () => {
    expect(span(45050, 45050, 'ETB')).toBe(formatMinor(locale, 45050, 'ETB'));
  });

  it('is the span from the lowest to the highest, both amounts in the sentence of the language', () => {
    const text = span(45050, 120000, 'ETB')!;
    expect(text).toContain(formatMinor(locale, 45050, 'ETB'));
    expect(text).toContain(formatMinor(locale, 120000, 'ETB'));
    expect(text.indexOf('450.50')).toBeLessThan(text.indexOf('1,200.00'));
    expect(text).toBe(translate(locale, 'buyer.price.range').replace('{min}', formatMinor(locale, 45050, 'ETB')).replace('{max}', formatMinor(locale, 120000, 'ETB')));
  });

  it('keeps a dollar sign in an amount as written (a replacement pattern such as $1 is not expanded)', () => {
    const one = formatMinor(locale, 1000, 'USD');
    const two = formatMinor(locale, 2000, 'USD');
    expect(one).toContain('$10.00');
    const text = span(1000, 2000, 'USD')!;
    expect(text).toContain(one);
    expect(text).toContain(two);
  });

  it('is null when there is nothing to price', () => {
    expect(span(null, null, null)).toBeNull();
    expect(span(1000, null, 'ETB')).toBeNull();
    expect(span(null, 1000, 'ETB')).toBeNull();
    expect(span(1000, 1000, null)).toBeNull();
  });
});

describe('fillSlots', () => {
  it.each([
    ['a Ge\'ez store name', STORE_NAME],
    ['a person name', NAME],
    ['a mixed Latin and Ge\'ez name with digits', MIXED],
    ['a long caption', LONG],
    ['an unbroken run with no space', UNBROKEN],
    ['a name with emoji', `${STORE_NAME} \u{1F600}`],
    ['Ge\'ez digits', `${GEEZ_DIGITS} ${GEEZ_TWELVE}`],
  ])('inserts %s exactly as given, in an English and in an Amharic sentence', (_label, value) => {
    for (const template of [en['buyer.product.seller'], am['buyer.product.seller']]) {
      expect(fillSlots(template, { store: value })).toBe(template.replace('{store}', () => value));
    }
  });

  it('never reads a value as a pattern or a second template (a store name cannot inject text)', () => {
    expect(fillSlots('{a} and {b}', { a: '$& {b} $1 $$', b: 'two' })).toBe('$& {b} $1 $$ and two');
    expect(fillSlots('{a}', { a: '{a}' })).toBe('{a}');
  });

  it('inserts numbers as plain digits and never regroups them', () => {
    expect(fillSlots(en['buyer.saved.counts'], { products: 1234, scenes: 0 })).toBe('Products: 1234, Scenes: 0');
    expect(fillSlots(am['buyer.saved.counts'], { products: 1234, scenes: 0 })).toContain('1234');
    expect(hasEthiopicDigit(fillSlots(am['buyer.saved.counts'], { products: 12, scenes: 3 })!)).toBe(false);
  });

  it('is null, never a half-filled sentence, when a value is missing', () => {
    expect(fillSlots(en['buyer.saved.counts'], { products: 1 })).toBeNull();
    expect(fillSlots(en['buyer.saved.counts'], { products: 1, scenes: null })).toBeNull();
    expect(fillSlots(en['buyer.saved.counts'], undefined)).toBeNull();
  });
});

describe.each(LOCALES)('error messages in %s', (locale) => {
  const message = (error: unknown) => failureMessage(t(locale), error);

  it('come from the catalogue, in the language shown', () => {
    expect(message(new ApiError({ kind: 'offline' }))).toBe(translate(locale, 'common.offline'));
    expect(message(new ApiError({ kind: 'timeout' }))).toBe(translate(locale, 'common.timeout'));
  });

  it('show a server key outside the mobile catalogue as the generic error, never the key or console copy', () => {
    const body = {
      type: 'about:blank',
      title_key: 'error.seller.tier_limit_reached',
      status: 409,
      slots: { capability: 'custom_flows', configured_in: 'console' },
    };
    const text = message(new ApiError({ kind: 'problem', status: 409, problem: body as never }));
    expect(text).toBe(translate(locale, 'error.request.internal'));
    expect(text).not.toMatch(/plan|tier|tier_limit|custom_flows/i);
  });

  it('fill a catalogue sentence with Ge\'ez and mixed slot values as given', () => {
    const body = { type: 'about:blank', title_key: 'error.request.rate_limited', status: 429, slots: { retry_after_seconds: `${GEEZ_TWELVE}` } };
    const text = message(new ApiError({ kind: 'problem', status: 429, problem: body as never }));
    expect(text).toContain(GEEZ_TWELVE);
    expect(text).toBe(translate(locale, 'error.request.rate_limited').replace('{retry_after_seconds}', GEEZ_TWELVE));
  });
});

describe.each(LOCALES)('a message and its time in %s', (locale) => {
  beforeEach(() => useUiStore.setState({ locale }));
  afterEach(() => act(() => useUiStore.setState({ locale: 'en' })));

  const message = (body: string | null, over: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'm1',
    kind: 'SELLER',
    body,
    templateKey: null,
    sentAt: '2026-11-11T08:00:12.123456Z',
    aboutProduct: false,
    aboutOrder: false,
    escalated: false,
    ...over,
  });

  it.each([
    ['Latin', 'Is the basket still available? 2 please, ETB 450.50'],
    ['Ge\'ez', SENTENCE],
    ['mixed Latin, Ge\'ez and digits', MIXED],
    ['long', LONG],
    ['an unbroken run', UNBROKEN],
    ['lines and trailing space', `${STORE_NAME}\n\n  ${NAME}  \n`],
  ])('shows %s message text exactly as sent, in one text node with no height or line limit', async (_label, body) => {
    await render(<MessageBubble message={message(body)} viewer="buyer" />);
    const node = screen.getByText(body);
    expect(node.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(node.props.style)).not.toHaveProperty('height');
    expect(StyleSheet.flatten(node.props.style)).not.toHaveProperty('maxHeight');
  });

  it('keeps the whole message one accessible group that grows with its text', async () => {
    await render(<MessageBubble message={message(LONG)} viewer="buyer" />);
    let bubble = screen.getByText(LONG).parent!;
    while (!bubble.props.accessible) bubble = bubble.parent!;
    const style = StyleSheet.flatten(bubble.props.style) as Record<string, unknown>;
    expect(bubble.props.accessible).toBe(true);
    expect(style.maxWidth).toBe('88%');
    expect(style.height).toBeUndefined();
    expect(style.maxHeight).toBeUndefined();
  });

  it('writes the sent time in the language of the sentence, from a timestamp with microseconds, and never "Invalid Date"', async () => {
    await render(<MessageBubble message={message('hello')} viewer="buyer" />);
    const sentence = translate(locale, 'buyer.chat.sent_at');
    const prefix = sentence.slice(0, sentence.indexOf('{time}')).trim();
    const sent = screen.getByText(new RegExp(`^${prefix}.*2026`)).props.children as string;
    expect(sent).not.toMatch(/Invalid/i);
    expect(hasEthiopicDigit(sent)).toBe(false);
    expect(sent).toMatch(/[0-9]{1,2}:[0-9]{2}/);
  });
});
