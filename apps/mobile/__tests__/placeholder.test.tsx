import { am, en } from '@adulis/locale';
import { family } from '@adulis/tokens/native';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import Placeholder from '../app/index';
import { Text } from '../src/components/Text';

/**
 * The CI half of WO-0b's placeholder gate. The device half -- no missing-glyph
 * box, at the largest OS text size, on both reference devices -- is a person
 * holding a phone and is in DEFERRED-GATES.md; this proves the five things are
 * on the screen together, that nothing else is, and that the Amharic line and
 * the figure are set in the Latin family (ADU-MOB-03 D2, ADU-PRD-01 S23.1).
 */
describe('WO-0b placeholder (ADU-MOB-WO-01 v1.2 S0b.2)', () => {
  it('renders the wordmark, both platform names, a figure and a line of Amharic together, and nothing else', () => {
    render(<Placeholder />);
    expect(screen.getByText('Adulis')).toBeTruthy();
    expect(screen.getByText('TikTok')).toBeTruthy();
    expect(screen.getByText('Instagram')).toBeTruthy();
    expect(screen.getByTestId('figure').props.children).toMatch(/^1,234\.5$/);
    expect(screen.getByText(am['health.ok'])).toBeTruthy();
    expect(screen.queryByText(en['health.ok'])).toBeNull();
    expect(screen.queryByText('Adulis Seller Console')).toBeNull();
  });

  it('sets the Amharic line and the figure in the Latin family and never touches includeFontPadding (D1, D2)', () => {
    render(<Placeholder />);
    for (const id of ['line-am', 'figure']) {
      const style = StyleSheet.flatten(screen.getByTestId(id).props.style) as Record<
        string,
        unknown
      >;
      expect(style['fontFamily']).toBe(family.latin);
      expect(style['fontFamily']).not.toMatch(/Ethiopic/);
      expect(style).not.toHaveProperty('includeFontPadding');
      expect(style).not.toHaveProperty('height');
    }
  });

  it('the mono variant of P1 uses the platform monospace face with tabular digits (S2.3)', () => {
    render(
      <Text variant="mono" testID="mono">
        1234567890123
      </Text>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('mono').props.style) as Record<
      string,
      unknown
    >;
    expect(style['fontVariant']).toEqual(['tabular-nums']);
    expect(String(style['fontFamily'])).toMatch(/Menlo|monospace/);
  });

  it('the negative case: a caller-supplied family is not silently replaced by the token one', () => {
    render(
      <Text variant="body" testID="styled" style={{ fontFamily: 'Other' }}>
        x
      </Text>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('styled').props.style) as Record<
      string,
      unknown
    >;
    expect(style['fontFamily']).toBe('Other');
  });
});
