/**
 * features/catalogue/Media.tsx -- SC-10, a section of SC-08.
 *
 * DELETE /v1/seller/products/{id}/images/{position} -
 * PUT .../images/order - DELETE .../video. Display of images and the one
 * video, plus delete and whole-order reorder.
 *
 * REORDER IS ONE REQUEST, NOT TWO WRITES (S8). UNIQUE (product_id, position)
 * makes a two-step swap a constraint violation, so the PUT sends the WHOLE
 * ordering. Position 1 is the storefront thumbnail and is labelled as such.
 *
 * [!] THE UPLOAD PIPELINE IS NOT BUILT HERE, and that is stated rather than
 * stubbed into looking done. S8 requires browser-side resize to three
 * derivatives, a signed-URL PUT per derivative, then COMMIT -- a real
 * client subsystem (canvas resize, three PUTs, progress across them). It is
 * its own unit of work; this section renders and manages the media that
 * exists and REGISTERS the upload as owed. An upload control that pretended
 * to work would be worse than its honest absence.
 */
import { useState } from 'react';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import { stateFromProblem } from '../../lib/states';
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

  const deleteImage = async (position: number) => {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/products/${productId}/images/${position}`, { method: 'DELETE', sellerId });
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const move = async (from: number, to: number) => {
    if (to < 1 || to > images.length) return;
    // The WHOLE ordering, in one request. Build the new position list by
    // swapping the two ids, then send every (id, position) pair.
    const byPos = new Map(images.map((im) => [im.position, im.id]));
    const a = byPos.get(from);
    const b = byPos.get(to);
    if (!a || !b) return;
    byPos.set(from, b);
    byPos.set(to, a);
    const order = [...byPos.entries()].map(([position, id]) => ({ id, position }));
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/products/${productId}/images/order`, {
        method: 'PUT',
        sellerId,
        idempotencyKey: crypto.randomUUID(),
        body: { order },
      });
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteVideo = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/products/${productId}/video`, { method: 'DELETE', sellerId });
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="media-heading" className="media">
      <h2 id="media-heading">{en['console.catalogue.media.heading']}</h2>
      {problem ? <ScreenState state={stateFromProblem(problem.problem)} problem={problem.problem} /> : null}

      {images.length === 0 ? (
        <ScreenState state="EMPTY" emptyText={en['console.catalogue.media.empty']} />
      ) : (
        <ol className="media-list">
          {images.map((im) => (
            <li key={im.id} className="media-item">
              <span className="media-position">
                {im.position === 1
                  ? en['console.catalogue.media.thumbnail']
                  : en['console.catalogue.media.position'].replace('{n}', String(im.position))}
              </span>
              <button type="button" className="button" disabled={busy || im.position === 1} onClick={() => void move(im.position, im.position - 1)}>
                {en['console.catalogue.media.up']}
              </button>
              <button type="button" className="button" disabled={busy || im.position === images.length} onClick={() => void move(im.position, im.position + 1)}>
                {en['console.catalogue.media.down']}
              </button>
              <button type="button" className="button" disabled={busy} onClick={() => void deleteImage(im.position)}>
                {en['console.catalogue.media.remove']}
              </button>
            </li>
          ))}
        </ol>
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
