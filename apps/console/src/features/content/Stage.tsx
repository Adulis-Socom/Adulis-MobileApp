import { useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { t } from '../../i18n/t';
import { CENTRE, nudge, pointFromRect, stepFor, toPercent, type Point } from './hotspot';

export interface Marker {
  readonly id: string;
  /** The number shown on the marker and used in its accessible name. */
  readonly n: number;
  readonly title: string;
  readonly x_norm: number;
  readonly y_norm: number;
  /** The marker of the Product being placed. */
  readonly current: boolean;
}

/**
 * The image presentation with its hotspots. Positions are normalised fractions of the presentation (SCN S22), so the stage
 * only has to be a box with the right aspect ratio: the same coordinates land on the same spot at any size.
 *
 * Operable without a pointer: the hit area is a real button (Enter adds a hotspot at the centre), every marker is a
 * focusable button (arrow keys move it by 1%, Shift by 5%, Delete removes it), and the editor beside it offers the same
 * through number fields. A visual overlay is never the only way to do anything (SCN S24).
 * With no handlers it is a read-only rendering (the preview), whose markers are hidden from assistive technology
 * because the accessible Product list carries the same information.
 */
export function Stage({
  aspect,
  imageName,
  markers,
  placeLabel,
  describedBy,
  onPlace,
  onMove,
  onRemove,
}: {
  aspect: number;
  imageName: string | null;
  markers: readonly Marker[];
  placeLabel?: string | undefined;
  describedBy?: string | undefined;
  onPlace?: ((point: Point) => void) | undefined;
  onMove?: ((id: string, point: Point) => void) | undefined;
  onRemove?: ((id: string) => void) | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function place(event: MouseEvent<HTMLButtonElement>) {
    if (!onPlace) return;
    const rect = ref.current?.getBoundingClientRect();
    // detail 0 means the click came from the keyboard, which has no pointer position: start at the centre.
    onPlace(event.detail === 0 || !rect ? CENTRE : (pointFromRect(rect, event.clientX, event.clientY) ?? CENTRE));
  }
  function keys(event: KeyboardEvent<HTMLButtonElement>, marker: Marker) {
    const step = stepFor(event.key, event.shiftKey);
    if (step && onMove) {
      event.preventDefault();
      onMove(marker.id, nudge(marker, step.dx, step.dy));
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && onRemove) {
      event.preventDefault();
      onRemove(marker.id);
    }
  }

  return (
    <div className="stage" ref={ref} style={{ aspectRatio: String(aspect) }}>
      <span className="stage-name">{imageName ?? t('scenes.no_image')}</span>
      {onPlace ? <button type="button" className="stage-hit" aria-label={placeLabel ?? t('scenes.place_default')} onClick={place} /> : null}
      {markers.map((m) => {
        const spot = { left: `${m.x_norm * 100}%`, top: `${m.y_norm * 100}%` };
        return onMove ? (
          <button
            key={m.id}
            type="button"
            className="marker"
            data-current={m.current}
            style={spot}
            aria-describedby={describedBy}
            aria-label={t('scenes.marker_label', { n: m.n, title: m.title, x: toPercent(m.x_norm), y: toPercent(m.y_norm) })}
            onKeyDown={(e) => keys(e, m)}
          >
            {m.n}
          </button>
        ) : (
          <span key={m.id} className="marker" data-current={m.current} style={spot} aria-hidden="true">
            {m.n}
          </span>
        );
      })}
    </div>
  );
}
