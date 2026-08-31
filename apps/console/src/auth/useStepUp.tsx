/**
 * auth/useStepUp.tsx -- the INTERCEPTION and the RETRY. SC-31's modal already
 * existed (StepUpModal); what did not exist was anything that opened it.
 *
 * ==========================================================================
 * THE SHAPE, AND WHY IT IS THIS SHAPE
 * ==========================================================================
 * A protected call fails with `403 STEP_UP_REQUIRED` (ADU-API-01 S7). That is
 * NOT a screen state -- lib/states.ts says so in the comment above
 * `isStepUpRequired`, and routing it through `stateFromProblem` degrades it to
 * NO_PERMISSION, which renders NOTHING. A seller who taps a control and gets
 * a blank region has been told their role is insufficient, which is false.
 *
 * So: the caller wraps the action, this catches the 403, the modal opens, and
 * ON SUCCESS THE ORIGINAL ACTION RUNS AGAIN with the satisfied challenge id.
 * The seller taps once. Making them tap the control a second time after
 * verifying is the whole defect this exists to avoid -- it reads as a failure
 * and it is the point at which a person gives up on a payout change.
 *
 * ==========================================================================
 * THE MODAL STAYS THIN
 * ==========================================================================
 * StepUpModal requests a challenge, takes six digits, verifies, hands back a
 * `challenge_id`, and knows nothing else. It does not know which action it is
 * guarding beyond a prompt key, does not perform the action, and does not
 * retry anything. All of that is here, and here is one file.
 *
 * ==========================================================================
 * TWO WAYS IN, BECAUSE THE API HAS TWO
 * ==========================================================================
 * The obvious one is the 403: call, get refused, satisfy, retry. But the
 * endpoints that need step-up TODAY do not work that way -- `reissueBody`,
 * `payoutChangeBody` and onboarding's identity body all declare
 * `step_up_challenge_id: z.uuid()` as a REQUIRED field. A call without one
 * fails zod with a 400 before `fn_assert_step_up` is ever reached, so
 * "try first and intercept the 403" would show the seller a validation error
 * for a code they were never asked for.
 *
 * The 403 is still real and still reachable: pg-error-translator maps
 * SQLSTATE U0004 -- no challenge, unsatisfied, expired, or another account's
 * -- onto STEP_UP_REQUIRED. That is what happens when a challenge goes stale
 * between verifying and using it, which is a slow tap away on a bad
 * connection.
 *
 * So `challengeRequired` says which door this action uses. Both end in the
 * same place: the modal opens, and ON SUCCESS THE ORIGINAL ACTION RUNS. The
 * caller writes its request once either way.
 *
 * ADU-AUTH-01 v2.6 IS UNDER EVALUATION AND NOT INSTALLED. The challenge
 * table's shape and `fn_assert_step_up` are open questions. Nothing in this
 * file depends on either: it knows that a 403 with code STEP_UP_REQUIRED means
 * "satisfy a challenge and try again", and that the satisfied challenge
 * travels as `step_up_challenge_id` in the retried body. If the mechanism is
 * re-ruled, this file and StepUpModal change; no screen does.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { isStepUpRequired } from '../lib/states';
import { StepUpModal, type StepUpAction } from './StepUpModal';

/**
 * The action being protected, run with whatever challenge has been satisfied
 * so far. `challengeId` is undefined on the first attempt -- most calls
 * succeed there, and requesting a code before the server has asked for one
 * would send an SMS for an action that needed none.
 */
export type ProtectedAction<T> = (challengeId?: string) => Promise<T>;

interface Pending<T> {
  readonly action: StepUpAction;
  readonly targetRef: string | undefined;
  readonly run: ProtectedAction<T>;
  readonly resolve: (value: T | null) => void;
  readonly reject: (reason: unknown) => void;
}

export interface StepUpGuard {
  /**
   * Run `fn`. If the server demands step-up, open the modal and run `fn`
   * again once it is satisfied. Resolves with `fn`'s value, or with null if
   * the seller cancelled the modal -- cancellation is not an error and must
   * not reach a screen as a problem banner.
   */
  readonly guard: <T>(
    action: StepUpAction,
    targetRef: string | undefined,
    fn: ProtectedAction<T>,
    opts?: { readonly challengeRequired?: boolean },
  ) => Promise<T | null>;
  /** Render this somewhere in the screen. Null when no challenge is open. */
  readonly modal: ReactNode;
}

export function useStepUp(): StepUpGuard {
  const [pending, setPending] = useState<Pending<unknown> | null>(null);
  // A ref as well as state: `guard` must not be re-created when a challenge
  // opens, or every control holding it re-renders mid-action.
  const pendingRef = useRef<Pending<unknown> | null>(null);

  const guard = useCallback(
    async <T,>(
      action: StepUpAction,
      targetRef: string | undefined,
      fn: ProtectedAction<T>,
      opts?: { readonly challengeRequired?: boolean },
    ): Promise<T | null> => {
      const open = () =>
        new Promise<T | null>((resolve, reject) => {
          const p: Pending<unknown> = {
            action,
            targetRef,
            run: fn as ProtectedAction<unknown>,
            resolve: resolve as (v: unknown) => void,
            reject,
          };
          pendingRef.current = p;
          setPending(p);
        });

      // The contract demands the satisfied challenge in the body: there is
      // nothing to try first, and trying would spend a request to earn a 400.
      if (opts?.challengeRequired) return await open();

      try {
        return await fn();
      } catch (e) {
        if (!(e instanceof ApiError) || !isStepUpRequired(e.problem)) throw e;
        return await open();
      }
    },
    [],
  );

  const close = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
  }, []);

  const modal = pending ? (
    <StepUpModal
      action={pending.action}
      {...(pending.targetRef === undefined ? {} : { targetRef: pending.targetRef })}
      onSatisfied={(challengeId) => {
        const p = pendingRef.current;
        close();
        if (!p) return;
        /*
         * THE RETRY. A second STEP_UP_REQUIRED here is NOT re-intercepted --
         * it rejects. A challenge the server has just marked satisfied and
         * then refuses is a server-side disagreement, and re-opening the
         * modal on it is an infinite loop that sends an SMS per turn.
         */
        p.run(challengeId).then(p.resolve, p.reject);
      }}
      onCancel={() => {
        const p = pendingRef.current;
        close();
        // Resolved with null, not rejected: a seller who changed their mind
        // has not encountered an error, and a screen that renders one for a
        // cancelled dialog is telling them something went wrong.
        p?.resolve(null);
      }}
    />
  ) : null;

  return { guard, modal };
}
