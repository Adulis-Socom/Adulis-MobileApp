/**
 * components/ScreenState.tsx -- one renderer per state in the closed
 * vocabulary (lib/states.ts). C-1's "twelve states demonstrable" is
 * discharged by StateDemo rendering every branch of this component.
 *
 * The two states everyone inverts (S3.4 vs S3.5):
 *   NO_PERMISSION  -> NOTHING. The control is not rendered at all.
 *   NO_ENTITLEMENT -> visible and DISABLED, with what unlocks it.
 */
import type { ReactNode } from 'react';
import { en } from '@adulis/locale';
import type { AdulisProblem, UiState } from '../lib/states';
import { ProblemBanner, ValidationSummary } from './Feedback';

interface Props {
  readonly state: UiState;
  readonly children?: ReactNode; // READY / STALE content
  readonly problem?: AdulisProblem;
  readonly emptyText?: string;
  readonly validationErrors?: ReadonlyArray<{ field: string; message: string }>;
  /** Id prefix the screen gives its fields, so the summary can link to them. */
  readonly fieldIdPrefix?: string;
  readonly blockedItem?: { text: string; action: ReactNode };
  readonly entitlementUnlock?: string;
  readonly onRetry?: () => void;
}

export function ScreenState(p: Props) {
  switch (p.state) {
    case 'LOADING':
      // A skeleton matching the final layout's shape -- never a spinner on
      // a blank page (S3). The bars themselves are decorative; the busy
      // region around them is what an assistive technology announces, and
      // it has to actually exist -- this comment used to cite a region no
      // file in the console defined.
      return (
        <div aria-busy="true" aria-live="polite" data-state="LOADING">
          <span className="visually-hidden">{en['console.a11y.loading']}</span>
          <div className="skeleton" aria-hidden="true">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row short" />
          </div>
        </div>
      );
    case 'EMPTY':
      return (
        <p className="empty" data-state="EMPTY">
          {p.emptyText ?? en['console.states.empty_default']}
        </p>
      );
    case 'READY':
      return <div data-state="READY">{p.children}</div>;
    case 'STALE':
      // Existing data stays visible AND interactive; a quiet indicator only.
      return (
        <div data-state="STALE">
          <span className="stale-indicator">{en['console.states.stale']}</span>
          {p.children}
        </div>
      );
    case 'BLOCKED_READINESS':
      return (
        <div data-state="BLOCKED_READINESS" className="blocked">
          <p>{p.blockedItem?.text ?? en['console.states.blocked_default']}</p>
          {p.blockedItem?.action}
        </div>
      );
    case 'NO_PERMISSION':
      // Nothing. Not a disabled control, not an explainer -- nothing (S3.4).
      return null;
    case 'NO_ENTITLEMENT':
      return (
        <div data-state="NO_ENTITLEMENT">
          <button type="button" disabled>
            {en['console.states.entitlement_control']}
          </button>
          <p className="hint">{p.entitlementUnlock ?? en['console.states.entitlement_unlock']}</p>
        </div>
      );
    case 'CONFLICT':
      return p.problem ? <ProblemBanner problem={p.problem} /> : null;
    case 'VALIDATION':
      return p.validationErrors ? (
        <ValidationSummary errors={p.validationErrors} idPrefix={p.fieldIdPrefix ?? 'field'} />
      ) : null;
    case 'TERMINAL':
      return (
        <div data-state="TERMINAL">
          <p>{en['console.states.terminal']}</p>
          {p.children}
        </div>
      );
    case 'TRANSPORT_ERROR':
      return (
        <div data-state="TRANSPORT_ERROR">
          {p.problem ? <ProblemBanner problem={p.problem} /> : null}
          {/* The envelope says whether a retry can help; offering the button
              regardless teaches the seller that it does not work. */}
          {p.onRetry && (p.problem?.retryable ?? true) ? (
            <button type="button" onClick={p.onRetry}>
              {en['common.retry']}
            </button>
          ) : null}
        </div>
      );
    case 'UPGRADE_REQUIRED':
      // A reload prompt and NO OTHER CONTENT (S3).
      return (
        <div data-state="UPGRADE_REQUIRED" className="upgrade">
          <p>{en['console.states.upgrade']}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {en['console.states.upgrade_reload']}
          </button>
        </div>
      );
  }
}
