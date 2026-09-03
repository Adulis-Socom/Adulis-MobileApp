/**
 * features/catalogue/Media.tsx -- SC-10, a section of SC-08.
 *
 * THE UPLOAD PIPELINE IS BUILT (T20 S4 -- D-219/D-98 closed). Pick a file,
 * resize it to three WebP derivatives IN THE BROWSER, REQUEST_UPLOAD to get a
 * signed PUT per derivative, PUT all three straight to object storage, then
 * COMMIT the keys. Media never transits the API; the bytes go browser ->
 * storage, and the API only signs and later validates.
 *
 * IT RENDERS THE IMAGE NOW, not a position label. The public origin comes from
 * bootstrap (mediaPublicOrigin, T20 S4) and the card derivative is shown as
 * `${origin}/${card_key}`. When storage is unconfigured the origin is '' and
 * the row shows its label alone rather than a broken <img>.
 *
 * TWO FAILURES, ONE SYMPTOM (S4.2). A CSP refusal never leaves the browser and
 * fires securitypolicyviolation; a bucket-CORS refusal is a preflight that DID
 * leave and came back wrong. putDerivative tags the first so the thrown error
 * names which wall was hit, because "upload failed" is the same words for two
 * different fixes.
 *
 * REORDER sends the whole ordering as an id array (the server assigns 1..n);
 * moves operate on DISPLAY INDEX so a delete's position gaps do not matter.
 * PUT/DELETE carry no idempotency key -- idempotent by construction (S8).
 */
import { useRef, useState } from 'react';
import { useIdempotencyKey } from '../../lib/idempotency';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { useMarket } from '../../lib/market';
import { fillTemplate } from '../../lib/intl';
import type { ProductImage, ProductVideo } from './types';

interface Props {
  readonly sellerId: string;
  readonly productId: string;
  readonly images: readonly ProductImage[];
  readonly video: ProductVideo | null;
  readonly onChanged: () => void;
}

const MAX_IMAGES = 5;

/** Longest-edge bounds; WebP; tuned for a phone photo. The server re-inspects
 *  byte sizes at COMMIT -- these keep an honest client under the caps. */
const DERIVATIVES = [
  { kind: 'thumb', edge: 160, quality: 0.8 },
  { kind: 'card', edge: 640, quality: 0.82 },
  { kind: 'full', edge: 1600, quality: 0.85 },
] as const;

type UploadResponse = {
  uploads: { thumb: Sign; card: Sign; full: Sign };
};
interface Sign {
  readonly key: string;
  readonly url: string;
}

let lastCspViolation = '';
if (typeof document !== 'undefined') {
  document.addEventListener('securitypolicyviolation', (e) => {
    lastCspViolation = `${e.violatedDirective} blocked ${e.blockedURI}`;
  });
}

async function resizeToWebp(file: File, edge: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  try {
    const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality));
    if (!blob) throw new Error('webp encode failed');
    return blob;
  } finally {
    bmp.close();
  }
}

async function putDerivative(url: string, blob: Blob): Promise<void> {
  lastCspViolation = '';
  let res: Response;
  try {
    res = await fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/webp' } });
  } catch {
    const wall = lastCspViolation
      ? `blocked by this page's security policy (${lastCspViolation})`
      : 'refused by storage before upload (bucket CORS or network)';
    throw new Error(`Upload could not start -- ${wall}.`);
  }
  if (!res.ok) throw new Error(`Storage rejected the upload (${res.status}).`);
}

export function Media({ sellerId, productId, images, video, onChanged }: Props) {
  const { mediaPublicOrigin } = useMarket();
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  // MOUNT-MINTED, never per click (the rule T14-C's M1 restored after finding
  // exactly this violated): a double-fire of the same intent carries the same
  // key and the server replays. Two keys, because the flow is two POSTs with
  // two distinct intents (sign, then commit); each REMINTS after its half
  // completes so the next upload is a new intent.
  const signKey = useIdempotencyKey();
  const commitKey = useIdempotencyKey();

  const ordered = [...images].sort((a, b) => a.position - b.position);
  const hasThumbnail = ordered.some((im) => im.position === 1);
  const atCap = ordered.length >= MAX_IMAGES;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setProblem(null);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
      else if (e instanceof Error) setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const upload = (file: File) =>
    run(async () => {
      // The next free position. Delete leaves gaps; the smallest unused 1..5 is
      // what the structural cap admits, and REQUEST_UPLOAD refuses a sixth
      // before any bytes move (server-side, S4).
      const taken = new Set(ordered.map((im) => im.position));
      let position = 1;
      while (taken.has(position)) position += 1;

      const blobs = await Promise.all(
        DERIVATIVES.map((d) => resizeToWebp(file, d.edge, d.quality)),
      );
      const req = await api<UploadResponse>(`/seller/products/${productId}/images`, {
        method: 'POST',
        sellerId,
        idempotencyKey: signKey.current(),
        body: { action: 'REQUEST_UPLOAD', position },
      });
      signKey.remint();
      const signs = [req.uploads.thumb, req.uploads.card, req.uploads.full];
      await Promise.all(signs.map((s, i) => putDerivative(s.url, blobs[i] as Blob)));
      await api(`/seller/products/${productId}/images`, {
        method: 'POST',
        sellerId,
        idempotencyKey: commitKey.current(),
        body: {
          action: 'COMMIT',
          position,
          thumb_key: req.uploads.thumb.key,
          card_key: req.uploads.card.key,
          full_key: req.uploads.full.key,
        },
      });
      commitKey.remint();
    });

  const deleteImage = (position: number) =>
    run(() => api(`/seller/products/${productId}/images/${position}`, { method: 'DELETE', sellerId }));

  // DRAG REORDER (T20 S4.5 -- the browser proof D-242's history demands).
  // HTML5 DnD over display indexes; drop sends the WHOLE ordering, the same
  // request the buttons send, so there is one reorder path on the wire. The
  // buttons stay: drag is not keyboard-reachable and the console's rules do
  // not bend for a mouse-only affordance.
  const dragFrom = useRef<number | null>(null);

  const dropTo = (to: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === to) return;
    const ids = ordered.map((im) => im.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved as string);
    return run(() =>
      api(`/seller/products/${productId}/images/order`, {
        method: 'PUT',
        sellerId,
        body: { order: ids },
      }),
    );
  };

  const moveByIndex = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= ordered.length) return;
    const ids = ordered.map((im) => im.id);
    const a = ids[index] as string;
    ids[index] = ids[to] as string;
    ids[to] = a;
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
      {error ? (
        <p className="problem" role="alert" data-media-error>
          {error}
        </p>
      ) : null}

      {ordered.length === 0 ? (
        <p className="empty" data-state="EMPTY">
          {en['console.catalogue.media.empty']}
        </p>
      ) : (
        <>
          <ol className="media-list">
            {ordered.map((im, i) => (
              <li
                key={im.id}
                className="media-item"
                data-media-item={im.position}
                draggable
                onDragStart={() => {
                  dragFrom.current = i;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void dropTo(i);
                }}
              >
                {mediaPublicOrigin ? (
                  <img
                    className="media-thumb"
                    src={`${mediaPublicOrigin}/${im.card_key}`}
                    alt={
                      im.position === 1
                        ? en['console.catalogue.media.thumbnail']
                        : fillTemplate(en['console.catalogue.media.position'], { n: String(im.position) })
                    }
                    width={80}
                    height={80}
                  />
                ) : null}
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

      {/* THE UPLOAD CONTROL. Labelled (a placeholder is not a label), disabled
          at the structural cap, and its help line says what the pipeline does. */}
      <div className="media-upload">
        <label htmlFor="media-file">{en['console.catalogue.media.add']}</label>
        <input
          id="media-file"
          ref={fileInput}
          type="file"
          accept="image/*"
          disabled={busy || atCap}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            if (fileInput.current) fileInput.current.value = '';
          }}
        />
        <p className="hint">
          {atCap ? en['console.catalogue.media.at_cap'] : en['console.catalogue.media.add_help']}
        </p>
      </div>

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
