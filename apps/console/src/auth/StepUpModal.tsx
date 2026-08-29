/**
 * auth/StepUpModal.tsx -- SC-31 (ADU-CON-03 v1.1 S12). Modal, invoked by
 * eight actions. The prompt names THE ACTION AND ITS TARGET: "Enter the
 * code to change your payout account", never a bare "confirm your
 * identity" -- ADU-AUTH-01 binds a challenge to action and target, and a
 * seller who cannot tell what they are authorising cannot notice when it
 * is wrong.
 *
 * Flow: POST /v1/auth/step-up/request (Idempotency-Key minted on modal
 * mount) -> SMS names the action -> POST /v1/auth/step-up/verify -> the
 * satisfied challenge_id is handed back to the CALLING control, which
 * carries it as a body parameter on the protected call. This modal never
 * performs the protected action itself.
 */
import { useEffect, useRef, useState } from 'react';
import { en, type MessageKey } from '@adulis/locale';
import { api, ApiError } from '../api/client';
import { mintKey } from '../lib/idempotency';
import { ProblemBanner } from '../components/Feedback';

export const STEP_UP_ACTIONS = [
  'PAYOUT_CHANGE',
  'REISSUE_INSTRUCTIONS',
  'TEAM_CHANGE',
  'SUBSCRIPTION_CHANGE',
  'SELLER_DELETION',
  'REVOKE_ALL_SESSIONS',
  'IDENTITY_CHANGE',
  'OWNERSHIP_TRANSFER',
] as const;
export type StepUpAction = (typeof STEP_UP_ACTIONS)[number];

interface Props {
  readonly action: StepUpAction;
  readonly targetRef?: string;
  /** The rendered, whole-sentence prompt naming action AND target. */
  readonly onSatisfied: (challengeId: string) => void;
  readonly onCancel: () => void;
}

export function StepUpModal({ action, targetRef, onSatisfied, onCancel }: Props) {
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);

  // Focus moves INTO the dialog when it opens, and back to whatever opened it
  // when it closes -- otherwise the keyboard is left behind the modal.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    codeRef.current?.focus();
    return () => opener?.focus();
  }, []);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  // Minted once per modal mount (S7) -- retrying the request re-uses it,
  // so a flaky connection cannot mint a second live challenge by accident.
  const [requestKey] = useState(mintKey);

  const promptKey = `console.stepup.prompt.${action.toLowerCase()}` as MessageKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api<{ challenge_id: string }>('/auth/step-up/request', {
          method: 'POST',
          idempotencyKey: requestKey,
          body: { action, target_ref: targetRef ?? null },
        });
        if (!cancelled) setChallengeId(r.challenge_id);
      } catch (e) {
        if (!cancelled && e instanceof ApiError) setProblem(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [action, targetRef, requestKey]);

  const verify = async () => {
    if (!challengeId) return;
    setBusy(true);
    setProblem(null);
    try {
      await api('/auth/step-up/verify', {
        method: 'POST',
        body: { challenge_id: challengeId, code },
      });
      onSatisfied(challengeId);
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onKeyDown={(e) => {
        // aria-modal is an announcement, not a behaviour. Without these the
        // dialog guarding a payout change could be tabbed straight out of,
        // and Escape did nothing.
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
          return;
        }
        if (e.key !== 'Tab' || !dialogRef.current) return;
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0] as HTMLElement;
        const last = focusable[focusable.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stepup-title"
        className="modal"
      >
        <h2 id="stepup-title">{en[promptKey]}</h2>
        {problem ? <ProblemBanner problem={problem.problem} /> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <label htmlFor="stepup-code">{en['console.stepup.code_label']}</label>
          <input
            ref={codeRef}
            id="stepup-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" aria-busy={busy} disabled={!challengeId}>
            {en['console.stepup.verify_button']}
          </button>
          <button type="button" onClick={onCancel}>
            {en['console.stepup.cancel_button']}
          </button>
        </form>
      </div>
    </div>
  );
}
