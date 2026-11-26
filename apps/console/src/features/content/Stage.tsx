import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
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
 * The image presentation with its hotspots. Positions are normalised fractions of the presentation (SCN S22): the stage is a box with the
 * image's own aspect ratio and the image fills it exactly, so the same coordinates land on the same spot at any size. With an image URL
 * the real pixels are shown; with `measure` the stage takes the image's natural aspect (for a file the Seller just selected, whose geometry
 * the server has not confirmed), otherwise the server's `aspect`.
 *
 * Operable without a pointer, and with one in three ways, none of them the only way (SCN S24):
 * pointer click places a hotspot, a marker can be DRAGGED, and a marker has the keyboard (arrows 1 percent, Shift 5, Delete) while
 * the hit area is a real button (Enter adds one at the centre). The editor beside it offers the same through number fields.
 * With no handlers it is a read-only rendering (the preview), whose markers are hidden from assistive technology because the accessible
 * Product list carries the same information.
 */
export function Stage({
  aspect,
  imageName,
  imageUrl,
  measure = false,
  markers,
  placeLabel,
  describedBy,
  onPlace,
  onMove,
  onRemove,
}: {
  aspect: number;
  imageName: string | null;
  imageUrl?: string | null | undefined;
  measure?: boolean | undefined;
  markers: readonly Marker[];
  placeLabel?: string | undefined;
  describedBy?: string | undefined;
  onPlace?: ((point: Point) => void) | undefined;
  onMove?: ((id: string, point: Point) => void) | undefined;
  onRemove?: ((id: string) => void) | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);
  const [natural, setNatural] = useState<number | null>(null);
  const shownAspect = measure && natural !== null ? natural : aspect;

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
  function startDrag(event: PointerEvent<HTMLButtonElement>, marker: Marker) {
    if (!onMove) return;
    dragging.current = marker.id;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function drag(event: PointerEvent<HTMLButtonElement>) {
    const id = dragging.current;
    const rect = ref.current?.getBoundingClientRect();
    if (id === null || !onMove || !rect) return;
    const point = pointFromRect(rect, event.clientX, event.clientY);
    if (point) onMove(id, point);
  }
  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="stage" ref={ref} style={{ aspectRatio: String(shownAspect) }}>
      {imageUrl ? (
        <img
          className="stage-img"
          src={imageUrl}
          alt={t('stage.image_alt', { name: imageName ?? '' })}
          draggable={false}
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (naturalWidth > 0 && naturalHeight > 0) setNatural(naturalWidth / naturalHeight);
          }}
        />
      ) : (
        <span className="stage-name">{imageName ?? t('scenes.no_image')}</span>
      )}
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
            onPointerDown={(e) => startDrag(e, m)}
            onPointerMove={drag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
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
