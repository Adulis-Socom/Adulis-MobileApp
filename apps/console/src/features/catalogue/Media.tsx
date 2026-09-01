/**
 * features/catalogue/Media.tsx -- SC-10, a section of SC-08.
 *
 * DELETE /v1/seller/products/{id}/images/{position} -
 * PUT .../images/order - DELETE .../video.
 *
 * REORDER SENDS THE WHOLE ORDERING AS AN ID ARRAY, which is what the server
 * takes: `order: z.array(z.uuid())`, positions assigned 1..n FROM ARRAY ORDER
 * (catalogue.schemas.ts / reorderImages). The C-5 adversarial pass found the
 * first version sending [{id, position}] -- every reorder 400'd and the
 * failure rendered nothing, so the feature had never worked against the real
 * API and the happy-path e2e shipped it green (register D-219a).
 *
 * MOVES OPERATE ON DISPLAY INDEX, NOT ON POSITION VALUES. Deleting position 2
 * of [1,2,3,4] leaves [1,3,4] -- positions with gaps, which the server does
 * not renumber on delete. Index-based moves are immune to the gaps, and any
 * reorder renumbers everything contiguously as a side effect (the server
 * assigns 1..n). The thumbnail label follows position 1; after a deletion
 * removes position 1, no image is the thumbnail until a reorder renumbers,
 * and the copy under the list says exactly that instead of mislabelling one.
 *
 * PUT carries NO idempotency key: ADU-API-01 S8 requires one on state-changing
 * POST and on nothing else -- a PUT of the whole ordering is idempotent by
 * construction (the availability-overrides reasoning). DELETE likewise.
 *
 * [!] THE UPLOAD PIPELINE IS NOT BUILT HERE (D-219): browser resize to three
 * derivatives, a signed PUT per derivative, then COMMIT is its own subsystem.
 * This section manages the media that exists and states the upload as owed.
 *
 * Mutation failures render a ProblemBanner (and a ValidationSummary when the
 * envelope carries field items) -- never nothing. The pass's B2 class.
 */
import { useState } from 'react';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { fillTemplate } from '../../lib/intl';
import type { ProductImage, ProductVideo } from './types';

interface Props {
  readonly sellerId: string;
  readonly productId: string;
  readonly images: readonly ProductImage[];
  readonly video: ProductVideo | null;
  readonly onChanged: () => void;
}

export function Media({ sellerId, productId, images, video, onChanged }: Props) {
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  // Display order is position order; index is what moves operate on.
  const ordered = [...images].sort((a, b) => a.position - b.position);
  const hasThumbnail = ordered.some((im) => im.position === 1);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteImage = (position: number) =>
    run(() => api(`/seller/products/${productId}/images/${position}`, { method: 'DELETE', sellerId }));

  const moveByIndex = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= ordered.length) return;
    const ids = ordered.map((im) => im.id);
    const a = ids[index] as string;
    ids[index] = ids[to] as string;
    ids[to] = a;
    // The WHOLE ordering, as ids; the server assigns positions 1..n.
    return run(() =>
      api(`/seller/products/${productId}/images/order`, {
        method: 'PUT',
        sellerId,
        body: { order: ids },
      }),
    );
  };

  const deleteVideo = () =>
    run(() => api(`/seller/products/${productId}/video`, { method: 'DELETE', sellerId }));

  return (
    <section aria-labelledby="media-heading" className="media">
      <h2 id="media-heading">{en['console.catalogue.media.heading']}</h2>
      {problem ? <ProblemBanner problem={problem.problem} /> : null}

      {ordered.length === 0 ? (
        <p className="empty" data-state="EMPTY">
          {en['console.catalogue.media.empty']}
        </p>
      ) : (
        <>
          <ol className="media-list">
            {ordered.map((im, i) => (
              <li key={im.id} className="media-item">
                <span className="media-position">
                  {im.position === 1
                    ? en['console.catalogue.media.thumbnail']
                    : fillTemplate(en['console.catalogue.media.position'], { n: String(im.position) })}
                </span>
                <button type="button" className="button" disabled={busy || i === 0} onClick={() => void moveByIndex(i, -1)}>
                  {en['console.catalogue.media.up']}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy || i === ordered.length - 1}
                  onClick={() => void moveByIndex(i, 1)}
                >
                  {en['console.catalogue.media.down']}
                </button>
                <button type="button" className="button" disabled={busy} onClick={() => void deleteImage(im.position)}>
                  {en['console.catalogue.media.remove']}
                </button>
              </li>
            ))}
          </ol>
          {!hasThumbnail ? <p className="hint">{en['console.catalogue.media.no_thumbnail']}</p> : null}
        </>
      )}
      <p className="media-upload-owed">{en['console.catalogue.media.upload_owed']}</p>

      {video ? (
        <div className="media-video">
          <span>{en['console.catalogue.media.video_present']}</span>
          <button type="button" className="button" disabled={busy} onClick={() => void deleteVideo()}>
            {en['console.catalogue.media.remove_video']}
          </button>
        </div>
      ) : (
        <p className="media-no-video">{en['console.catalogue.media.no_video']}</p>
      )}
    </section>
  );
}
