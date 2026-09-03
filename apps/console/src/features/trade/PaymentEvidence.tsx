/**
 * features/trade/PaymentEvidence.tsx -- SC-05, modal over SC-04.
 * GET /v1/seller/orders/{id}/payment-evidence - seller.payment_evidence:read.
 *
 * ==========================================================================
 * WHAT THIS SCREEN IS NOT ALLOWED TO HAVE
 * ==========================================================================
 * S7 lists them, and the absences are the specification:
 *
 *   NO download.  NO print.  NO share.  NO copy-image.  NO save.
 *   NO "looks valid" affordance OF ANY KIND.
 *
 * The last one is the one that would arrive by accident. A checkmark, a
 * "verified" chip, a green border, an "amount matches" hint -- any of them
 * moves the decision from the seller's bank account to this image, and this
 * image is a screenshot a stranger uploaded. The screen shows the picture and
 * the time it was submitted, and it makes no claim about either.
 *
 * The others would arrive as helpfulness. A download button on a payment
 * screenshot puts a copy of someone's bank record in a Downloads folder,
 * outside every retention rule the platform has, forever. There is no
 * `download` attribute in this file and no anchor pointing at the blob.
 *
 * ==========================================================================
 * A BLOB URL, REVOKED ON UNMOUNT (ADU-SEC-01 S7)
 * ==========================================================================
 * The bytes arrive over the authenticated request and become an object URL
 * scoped to this document. Never a public URL, never a predictable one, and
 * never one that outlives the modal: the effect's cleanup revokes it, so
 * closing the modal invalidates the only reference that existed.
 *
 * EVERY OPEN IS LOGGED, including the seller's own (financial.
 * read_payment_evidence takes a justification and writes the access row).
 * S7: "the seller does not need to be told this each time, but the privacy
 * page states it" -- so there is no banner here saying so.
 *
 * ==========================================================================
 * THE DECISIONS ARE REPEATED HERE
 * ==========================================================================
 * "so the seller need not close to act" (S7). It is the same component SC-04
 * renders, with a different id prefix -- not a copy of it, because two copies
 * of the equally-weighted rule is one copy that can drift.
 */
import { useEffect, useState } from 'react';
import { en } from '@adulis/locale';
import { apiBlob, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import { stateFromProblem, type UiState } from '../../lib/states';
import { timeFormatter } from '../../lib/intl';
import { useMarketContext } from '../../lib/market';
import { PaymentDecisions } from './PaymentDecisions';

interface Props {
  readonly sellerId: string;
  readonly orderId: string;
  readonly submittedAt: string | null;
  /** Whether the order is still awaiting a decision. */
  readonly decidable: boolean;
  readonly onDecided: () => void;
  readonly onClose: () => void;
}

export function PaymentEvidence({
  sellerId,
  orderId,
  submittedAt,
  decidable,
  onDecided,
  onClose,
}: Props) {
  const market = useMarketContext();
  const [state, setState] = useState<UiState>('LOADING');
  const [src, setSrc] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await apiBlob(`/seller/orders/${orderId}/payment-evidence`, { sellerId });
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
        setState('READY');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) {
          setProblem(e);
          setState(stateFromProblem(e.problem));
        } else {
          setProblem(null);
          setState('TRANSPORT_ERROR');
        }
      }
    })();
    return () => {
      cancelled = true;
      // THE REVOKE. Not conditional, not deferred, not skipped when the
      // request failed -- if a URL was ever minted it is invalidated here,
      // and this is the only place that can do it.
      if (url) URL.revokeObjectURL(url);
    };
  }, [orderId, sellerId]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="evidence-title" className="modal evidence">
        <h2 id="evidence-title">{en['console.trade.evidence.title']}</h2>

        <ScreenState
          state={state}
          {...(problem ? { problem: problem.problem } : {})}
          emptyText={en['console.trade.evidence.none']}
        >
          {/*
            The image, zoomable -- by the browser's own zoom on a plain <img>
            in a scroll container. No pan/zoom widget: a custom viewer is code
            that can leak the source into a canvas, and canvas is a save
            affordance wearing a different name.

            No `download` attribute exists on any element here, the image is
            not wrapped in an anchor, and there is no context-menu handler
            adding one. `-webkit-touch-callout` and `user-select` are off in
            the stylesheet for `.evidence-image`, which discourages the
            long-press save without pretending to prevent it -- a screenshot
            is always possible and this screen does not claim otherwise.
          */}
          {src ? (
            <div className="evidence-frame">
              <img className="evidence-image" src={src} alt={en['console.trade.evidence.alt']} />
            </div>
          ) : null}

          <p className="evidence-submitted">
            {submittedAt && market
              ? timeFormatter(market).format(new Date(submittedAt))
              : en['console.trade.evidence.no_time']}
          </p>
        </ScreenState>

        {/* The decisions, repeated, so the seller need not close to act. */}
        {decidable ? (
          <PaymentDecisions
            sellerId={sellerId}
            orderId={orderId}
            onDecided={onDecided}
            idPrefix="evidence"
          />
        ) : null}

        <button type="button" className="modal-close" onClick={onClose}>
          {en['console.trade.evidence.close']}
        </button>
      </div>
    </div>
  );
}
