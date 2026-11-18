/**
 * WCAG 2.x contrast, for tests: computed from the colours the themes actually produce.
 * Six-digit hex only (the theme tests require every role to be one).
 */
const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

export const contrast = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
};

/** The colour a foreground of the given opacity shows as over a background (what `opacity` does to a drawn outline). */
export const blend = (foreground: string, background: string, opacity: number) => {
  const f = parseInt(foreground.slice(1), 16);
  const b = parseInt(background.slice(1), 16);
  const mix = (shift: number) => {
    const from = (b >> shift) & 255;
    return Math.round(from + (((f >> shift) & 255) - from) * opacity);
  };
  return `#${[16, 8, 0].map((shift) => mix(shift).toString(16).padStart(2, '0')).join('')}`;
};
