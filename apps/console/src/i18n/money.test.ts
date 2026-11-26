import { describe, expect, it } from 'vitest';
import { formatMoney, inputToMinor, minorDigits, minorToInput } from './money';

describe('money at the edge: integer minor units, digits from Intl', () => {
  it('reads the minor digits of the currency instead of assuming them', () => {
    expect(minorDigits('ETB')).toBe(2);
    expect(minorDigits('JPY')).toBe(0);
  });

  it('parses entered amounts exactly, with no floating-point drift', () => {
    expect(inputToMinor('2000', 'ETB')).toBe(200000);
    expect(inputToMinor('19.99', 'ETB')).toBe(1999);
    expect(inputToMinor('0.1', 'ETB')).toBe(10);
    expect(inputToMinor('1,234.50', 'ETB')).toBe(123450);
    expect(inputToMinor('500', 'JPY')).toBe(500);
  });

  it('refuses text that is not an amount, more fractional digits than the currency has, and unsafe integers', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1e3', '12 .5.1', '99999999999999999999']) expect(inputToMinor(bad, 'ETB')).toBeNull();
    expect(inputToMinor('1.5', 'JPY')).toBeNull();
  });

  it('formats for display and for the edit field', () => {
    expect(formatMoney(200000, 'ETB')).toMatch(/2,000\.00/);
    expect(minorToInput(1999, 'ETB')).toBe('19.99');
    expect(minorToInput(500, 'JPY')).toBe('500');
  });
});
