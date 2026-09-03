/**
 * features/trade/PaymentDecisions.tsx -- THE TWO DECISIONS.
 *
 * ==========================================================================
 * THIS BLOCK IS SPECIFIED, NOT DESIGNED (ADU-CON-03 v1.1 S7, SC-04)
 * ==========================================================================
 * Every rule below is transcribed. None of it is styling preference, and the
 * reason it is written down at all is stated in the specification: a seller
 * who confirms a payment that never arrived has given away goods, and there
 * is no recovery path in this product for that.
 *
 *   1. "Confirm Payment Received" and "Payment Not Received" are EQUALLY
 *      WEIGHTED. Neither is styled as the safe default. They share a class,
 *      a size and a weight; the CSS gives `.decision` no variant, and the
 *      only thing distinguishing the two buttons is the words on them.
 *
 *      There is no primary button here, and that is deliberate. A styled
 *      default is a recommendation, and neither decision is recommended --
 *      the seller's bank account is the only thing that knows.
 *
 *   2. "Confirm Payment Received", VERBATIM. Never "Accept Payment".
 *      Accepting is what you do to a request; confirming is what you do to a
 *      fact you have checked. The word does the teaching.
 *
 *   3. THE VERIFY SENTENCE IS ADJACENT, ALWAYS VISIBLE, NEVER BEHIND A
 *      DISCLOSURE. Not a tooltip, not a details/summary, not a modal on
 *      click: it renders in the same block, above the two controls, on every
 *      render. It is the sentence that stops the fraud this screen enables.
 *
 *   4. CONFIRMING WITHOUT OPENING THE EVIDENCE IS A NORMAL PATH
 *      (ADU-ARCH-01 S3.3). The seller's bank app is the real check, so this
 *      component does not track whether SC-05 was opened, does not disable
 *      confirm until it is, does not badge it as unread, and does not nag.
 *      There is no "you have not viewed the evidence" anything. A screen
 *      that nags about the wrong check trains people to dismiss it.
 *
 *   5. REJECTION IS A TWO-STEP CONFIRMATION, and step two STATES THE
 *      CONSEQUENCE: the order returns to awaiting payment with the clock
 *      still running, the buyer may submit new evidence once, and a second
 *      rejection ends the order. That is what the seller is agreeing to, so
 *      it is what the second step says.
 *
 * ==========================================================================
 * IDEMPOTENCY KEYS ARE MINTED ON MOUNT, NOT ON CLICK
 * ==========================================================================
 * A key minted on click is a new key per tap, which is exactly the retry the
 * header exists to defeat: two taps on a slow connection become two confirms.
 * One key per mounted control, re-used by every attempt that control makes.
 */
import { useState } from 'react';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { mintKey } from '../../lib/idempotency';
import { ProblemBanner } from '../../components/Feedback';

interface Props {
  readonly sellerId: string;
  readonly orderId: string;
  /** Refetch after a decision. The screen re-reads state from the server. */
  readonly onDecided: () => void;
  /**
   * Where this block is rendered. SC-05 repeats the decisions inside the
   * evidence modal "so the seller need not close to act" (S7), and the ids
   * must not collide with SC-04's copy behind it.
   */
  readonly idPrefix: string;
}

export function PaymentDecisions({ sellerId, orderId, onDecided, idPrefix }: Props) {
  const [confirmKey] = useState(mintKey);
  const [rejectKey] = useState(mintKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  /** Step two of rejection. Null while the seller has not asked to reject. */
  const [rejecting, setRejecting] = useState<string | null>(null);

  const call = async (path: string, key: string, body?: unknown) => {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/orders/${orderId}${path}`, {
        method: 'POST',
        sellerId,
        idempotencyKey: key,
        ...(body === undefined ? {} : { body }),
      });
      setRejecting(null);
      onDecided();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="payment-decisions" data-region="payment-decisions">
      {problem ? <ProblemBanner problem={problem.problem} /> : null}

      {/*
        RULE 3. Adjacent, always visible, never behind a disclosure. It is
        rendered BEFORE the controls in document order so a screen reader
        reaches it before either button, and it is a plain <p> -- there is no
        state in this component that can hide it.
      */}
      <p className="verify-first" data-verbatim="verify-in-your-own-bank">
        {en['console.trade.payment.verify_first']}
      </p>

      {rejecting === null ? (
        // RULE 1. Same class, same element, same order every render. The CSS
        // for `.decision` carries no primary/secondary variant to apply.
        <div className="decision-pair">
          <button
            type="button"
            className="decision"
            id={`${idPrefix}-confirm`}
            data-decision="confirm"
            disabled={busy}
            onClick={() => void call('/payment/confirm', confirmKey)}
          >
            {en['console.trade.payment.confirm']}
          </button>
          <button
            type="button"
            className="decision"
            id={`${idPrefix}-reject`}
            data-decision="reject"
            disabled={busy}
            onClick={() => setRejecting('')}
          >
            {en['console.trade.payment.reject']}
          </button>
        </div>
      ) : (
        /*
          RULE 5, step two. It states the consequence in full before asking
          again -- three sentences the seller is agreeing to, not a "are you
          sure?". The reason field is the API's (`reason`, 1..500 chars) and
          it is required there, so it is required here rather than sent empty
          and refused as a 400 the seller cannot interpret.
        */
        <div className="reject-confirm" role="group" aria-labelledby={`${idPrefix}-reject-heading`}>
          <h4 id={`${idPrefix}-reject-heading`}>{en['console.trade.payment.reject_heading']}</h4>
          <p className="consequence">{en['console.trade.payment.reject_consequence']}</p>
          <label htmlFor={`${idPrefix}-reject-reason`}>
            {en['console.trade.payment.reject_reason_label']}
          </label>
          <textarea
            id={`${idPrefix}-reject-reason`}
            maxLength={500}
            value={rejecting}
            onChange={(e) => setRejecting(e.target.value)}
          />
          <div className="decision-pair">
            <button
              type="button"
              className="decision"
              data-decision="reject-confirm"
              disabled={busy || rejecting.trim().length === 0}
              onClick={() => void call('/payment/reject', rejectKey, { reason: rejecting.trim() })}
            >
              {en['console.trade.payment.reject_final']}
            </button>
            <button
              type="button"
              className="decision"
              data-decision="reject-cancel"
              disabled={busy}
              onClick={() => setRejecting(null)}
            >
              {en['console.trade.payment.reject_back']}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
