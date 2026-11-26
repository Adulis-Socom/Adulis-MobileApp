/**
 * Hotspot geometry (SCN-01 S22, S24). A hotspot is a point on the CANONICAL image presentation, normalised to 0..1 on both
 * axes: `rendered = rect.left + x_norm * rect.width`. Never device pixels, so the same Scene lands on the same spot on the
 * Console, Mobile and Storefront at any size. Pure functions, no DOM.
 */
export interface Point {
  readonly x_norm: number;
  readonly y_norm: number;
}
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Four decimals is far finer than a pixel on any screen and keeps floating-point noise out of what is sent. */
const round = (v: number): number => Math.round(v * 10_000) / 10_000;
export const clampNorm = (v: number): number => round(Math.min(1, Math.max(0, v)));

/** Where a pointer is inside the presentation rectangle, or null when the rectangle has no area (nothing laid out yet). */
export function pointFromRect(rect: Rect, clientX: number, clientY: number): Point | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  return { x_norm: clampNorm((clientX - rect.left) / rect.width), y_norm: clampNorm((clientY - rect.top) / rect.height) };
}

export const CENTRE: Point = { x_norm: 0.5, y_norm: 0.5 };

/** Move a point by a fraction of the presentation, staying inside it. */
export function nudge(p: Point, dx: number, dy: number): Point {
  return { x_norm: clampNorm(p.x_norm + dx), y_norm: clampNorm(p.y_norm + dy) };
}

export const toPercent = (v: number): number => Math.round(v * 100);

/** Percent text from a number field to a normalised value, or null when it is not a number from 0 to 100. */
export function fromPercent(text: string): number | null {
  const clean = text.trim();
  if (!/^\d{1,3}(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return n >= 0 && n <= 100 ? clampNorm(n / 100) : null;
}

/** Arrow keys move a hotspot by one percent; with Shift, by five. Anything else is not a move. */
export function stepFor(key: string, shift: boolean): { dx: number; dy: number } | null {
  const step = shift ? 0.05 : 0.01;
  switch (key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 };
    case 'ArrowRight':
      return { dx: step, dy: 0 };
    case 'ArrowUp':
      return { dx: 0, dy: -step };
    case 'ArrowDown':
      return { dx: 0, dy: step };
    default:
      return null;
  }
}
