// Hotspot geometry (MOB-02 S24-S28, R-06): a pure function from a normalised point to a position inside the rendered image.
// The photo is drawn with resizeMode "contain", so it can be letterboxed; a fraction of the IMAGE is not a fraction of the
// CONTAINER. Hotspots belong to Scene Explorer only, never to the For You card.
export interface Box {
  readonly width: number;
  readonly height: number;
}
export interface Rect extends Box {
  readonly left: number;
  readonly top: number;
}

/** The rectangle a `contain`-fitted image of this aspect (width over height) occupies inside the container. */
export function containRect(container: Box, aspect: number): Rect {
  if (!(aspect > 0) || container.width <= 0 || container.height <= 0) return { left: 0, top: 0, width: 0, height: 0 };
  const containerAspect = container.width / container.height;
  if (aspect >= containerAspect) {
    const height = container.width / aspect;
    return { left: 0, top: (container.height - height) / 2, width: container.width, height };
  }
  const width = container.height * aspect;
  return { left: (container.width - width) / 2, top: 0, width, height: container.height };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/** Where the hotspot centre sits in the container, in the container's own coordinates. */
export function hotspotPosition(point: { readonly x: number; readonly y: number }, container: Box, aspect: number): { readonly left: number; readonly top: number } {
  const rect = containRect(container, aspect);
  return { left: rect.left + clamp01(point.x) * rect.width, top: rect.top + clamp01(point.y) * rect.height };
}
