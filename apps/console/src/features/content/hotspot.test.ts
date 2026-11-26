import { describe, expect, it } from 'vitest';
import { CENTRE, clampNorm, fromPercent, nudge, pointFromRect, stepFor, toPercent } from './hotspot';

const rect = { left: 100, top: 50, width: 400, height: 500 };

describe('hotspot geometry: normalised to the image presentation, never to device pixels', () => {
  it('maps a pointer to 0..1 inside the rectangle, whatever the size or offset', () => {
    expect(pointFromRect(rect, 300, 300)).toEqual({ x_norm: 0.5, y_norm: 0.5 });
    expect(pointFromRect(rect, 100, 50)).toEqual({ x_norm: 0, y_norm: 0 });
    expect(pointFromRect(rect, 500, 550)).toEqual({ x_norm: 1, y_norm: 1 });
    // the same relative spot on a rectangle half the size is the same normalised point
    expect(pointFromRect({ left: 10, top: 10, width: 200, height: 250 }, 110, 135)).toEqual({ x_norm: 0.5, y_norm: 0.5 });
  });

  it('clamps a pointer outside the rectangle onto its edge, and refuses a rectangle with no area', () => {
    expect(pointFromRect(rect, -50, 9999)).toEqual({ x_norm: 0, y_norm: 1 });
    expect(pointFromRect({ left: 0, top: 0, width: 0, height: 100 }, 5, 5)).toBeNull();
    expect(pointFromRect({ left: 0, top: 0, width: Number.NaN, height: 100 }, 5, 5)).toBeNull();
  });

  it('keeps floating-point noise out of what is sent', () => {
    expect(clampNorm(0.1 + 0.2)).toBe(0.3);
    expect(pointFromRect({ left: 0, top: 0, width: 3, height: 3 }, 1, 2)).toEqual({ x_norm: 0.3333, y_norm: 0.6667 });
  });

  it('nudges by one percent, five with Shift, and never leaves the image', () => {
    expect(nudge(CENTRE, 0.01, 0)).toEqual({ x_norm: 0.51, y_norm: 0.5 });
    expect(nudge({ x_norm: 0.99, y_norm: 0.01 }, 0.05, -0.05)).toEqual({ x_norm: 1, y_norm: 0 });
    expect(stepFor('ArrowLeft', false)).toEqual({ dx: -0.01, dy: 0 });
    expect(stepFor('ArrowDown', true)).toEqual({ dx: 0, dy: 0.05 });
    expect(stepFor('Enter', false)).toBeNull();
  });

  it('converts between percent text and normalised values, refusing anything that is not 0 to 100', () => {
    expect(toPercent(0.425)).toBe(43);
    expect(fromPercent('42.5')).toBe(0.425);
    expect(fromPercent(' 100 ')).toBe(1);
    for (const bad of ['', 'abc', '-1', '101', '12.', '1e2', '50%']) expect(fromPercent(bad)).toBeNull();
  });
});
