import { screen, within } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

/**
 * What a discovery surface must never say on its own authority: popularity, trust and
 * conversion are the server's to state, and the contract carries none of them. Counts need
 * a number in front, so ordinary labels such as "View Product" are not flagged.
 */
export const INVENTED_CLAIM = new RegExp(
  [
    String.raw`\d[\d,.]*\s*[km]?\s*(likes?|views?|viewers?|followers?|sold|orders?|reviews?|ratings?|buyers?|people|customers?|shares?|comments?|saves?)\b`,
    String.raw`\b(popular|trending|best[- ]?sellers?|top[- ]rated|highly rated|verified|trusted|trust badge|rating|stars?|selling fast|in demand|recommended|sponsored|promoted|featured)\b`,
    String.raw`\b(discounts?|\d+\s*% off|sale|deal|only \d+ left|few left|low stock|limited stock|price drop|was \S+ now)\b`,
    String.raw`\b(buy now|add to cart|checkout|order now)\b`,
  ].join('|'),
  'i',
);

/** The strings in `texts` that make an invented claim. */
export const claimsIn = (texts: readonly string[]): string[] => texts.filter((text) => INVENTED_CLAIM.test(text));

/** Every text and accessibility label a screen region renders, in tree order. */
export function renderedText(region: Parameters<typeof within>[0]): string[] {
  const scope = within(region);
  const texts = scope.queryAllByText(/[\s\S]+/).map((node) => String(node.props.children));
  const labels = scope
    .queryAllByLabelText(/[\s\S]+/)
    .map((node) => String(node.props.accessibilityLabel ?? node.props['aria-label']));
  return [...texts, ...labels];
}

type Json = { type: string; props: Record<string, unknown>; children: (Json | string)[] | null };

/** Every rendered element at or below the one with this testID, whatever its screen. */
export function elementsUnder(testID: string): Json[] {
  const found: Json[] = [];
  const walk = (node: Json | string, inside: boolean) => {
    if (typeof node === 'string') return;
    const here = inside || node.props.testID === testID;
    if (here) found.push(node);
    for (const child of node.children ?? []) walk(child, here);
  };
  const root = screen.toJSON() as Json | Json[] | null;
  for (const top of Array.isArray(root) ? root : root ? [root] : []) walk(top, false);
  return found;
}

/**
 * The elements that would be a hotspot, marker or pin on a photo: positioned absolutely, or
 * named as one. The contract carries no tag geometry, so a screen has none to draw.
 */
export function overlaysIn(elements: readonly Json[]): string[] {
  return elements
    .filter((node) => {
      const style = StyleSheet.flatten(node.props.style as never) as { position?: string } | undefined;
      const names = [node.props.testID, node.props.accessibilityLabel, node.props['aria-label'], node.props.accessibilityRole];
      return style?.position === 'absolute' || names.some((name) => typeof name === 'string' && /hotspot|marker|\bpin\b/i.test(name));
    })
    .map((node) => `${node.type} ${String(node.props.testID ?? '')}`.trim());
}
