/**
 * features/entry/BecomeSeller.tsx -- SC-02, ADU-CON-03 v1.1 S6.
 *
 * ==========================================================================
 * R26 -- BOTH FACTS APPEAR AT THE MOMENT OF CHOOSING
 * ==========================================================================
 * Choosing COMPANY does two things, and neither is obvious:
 *
 *   1. it adds exactly ONE readiness item (COMPANY_DETAILS). Not two.
 *   2. it CHANGES WHAT IDENTITY VERIFICATION MEANS. The attestation is keyed
 *      on `person_id` and carries no `seller_id` (ADU-DB-01 S7.3), so a
 *      company's attestation is an attestation about its REPRESENTATIVE -- a
 *      named individual, not the business.
 *
 * Both are shown beside the choice rather than after it, because both
 * surprise people, and a seller surprised in the middle of identity
 * verification abandons it. The third fact -- that the choice is not
 * reversible without support -- is on the screen for the same reason.
 *
 * The panel is rendered for BOTH options, not just company: a seller who
 * picks individual should be able to see what they are not choosing, and a
 * disclosure that only appears once you have picked the harder option is a
 * disclosure timed to be missed.
 *
 * ==========================================================================
 * WHAT THIS SCREEN DOES NOT DECIDE
 * ==========================================================================
 * It does not compute eligibility, does not decide which readiness items
 * follow, and does not tell the seller they are approved. `POST /v1/seller`
 * returns the first evaluation inline; this screen navigates to Home and lets
 * the readiness rows say what is outstanding (S3.1).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { useIdempotencyKey } from '../../lib/idempotency';
import { ScreenState } from '../../components/ScreenState';
import type { MessageKey } from '@adulis/locale';
import type { UiState } from '../../lib/states';

type EntityType = 'INDIVIDUAL' | 'COMPANY';

interface CreateSellerResponse {
  seller_id: string;
  status: string;
  eligibility: { outcome?: string; reasons: string[] };
}

/** The server's rule, restated so the field can say it BEFORE a round trip. */
const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

export function BecomeSeller() {
  const nav = useNavigate();
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [storeName, setStoreName] = useState('');
  const [handle, setHandle] = useState('');
  const [state, setState] = useState<UiState>('READY');
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Array<{ field: string; message: string }>>([]);
  /**
   * MINTED ON MOUNT, NEVER ON CLICK (ADU-CON-02 v3.1 S7, console CLAUDE.md).
   * A key minted in the submit handler is a new key per tap, which is exactly
   * the retry the header exists to defeat -- and this is a declaration that
   * mints a person row, so a double-fire is not a cosmetic problem.
   */
  const declareKey = useIdempotencyKey();

  const handleValid = HANDLE_RE.test(handle);
  const canSubmit = entityType !== null && storeName.trim().length > 0 && handleValid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || entityType === null) return;
    setState('LOADING');
    try {
      const r = await api<CreateSellerResponse>('/seller', {
        method: 'POST',
        body: { entity_type: entityType, store_name: storeName.trim(), handle },
        idempotencyKey: declareKey.current(),
      });
      nav(`/s/${r.seller_id}`);
    } catch (err) {
      // Only an ApiError carries a problem envelope. Fabricating one for a
      // thrown TypeError would put an invented request id in front of
      // support, so a non-ApiError renders TRANSPORT_ERROR with no envelope.
      if (!(err instanceof ApiError)) {
        setProblem(null);
        setState('TRANSPORT_ERROR');
        return;
      }
      setProblem(err);
      const p = err.problem;
      if (p.status === 400 || p.status === 422) {
        // THE FIELD IS IN slots.path. The API reports every failing path at
        // once (problem-details.filter.ts: Zod at the door), and each item
        // carries `slots: { path, issue }`. That is what makes S3's
        // VALIDATION contract -- per-field messages AND a summary that links
        // to each field -- implementable rather than aspirational.
        setFieldErrors(
          (p.items ?? []).map((it) => ({
            field: typeof it.slots?.['path'] === 'string' ? it.slots['path'] : 'form',
            message: en[it.message_key as MessageKey] ?? it.code,
          })),
        );
        setState('VALIDATION');
      } else if (p.status === 409) {
        setState('CONFLICT');
      } else {
        setState('TRANSPORT_ERROR');
      }
    }
  }

  return (
    <main className="screen become-seller">
      <h1>{en['console.become.title']}</h1>

      <ScreenState
        state={state}
        {...(problem ? { problem: problem.problem } : {})}
        validationErrors={fieldErrors}
        fieldIdPrefix="become"
        onRetry={() => setState('READY')}
      >
        <form onSubmit={submit} noValidate>
          <fieldset>
            <legend>{en['console.become.type_legend']}</legend>

            <label htmlFor="become-type-individual">
              <input
                id="become-type-individual"
                type="radio"
                name="entity_type"
                value="INDIVIDUAL"
                checked={entityType === 'INDIVIDUAL'}
                onChange={() => setEntityType('INDIVIDUAL')}
              />
              {en['console.become.type_individual']}
            </label>

            <label htmlFor="become-type-company">
              <input
                id="become-type-company"
                type="radio"
                name="entity_type"
                value="COMPANY"
                checked={entityType === 'COMPANY'}
                onChange={() => setEntityType('COMPANY')}
              />
              {en['console.become.type_company']}
            </label>
          </fieldset>

          {/*
            R26, at the moment of choosing. aria-live so a seller using a
            screen reader hears the consequence when they select company,
            rather than discovering it later in verification.
          */}
          <div className="consequence" aria-live="polite">
            {entityType === 'COMPANY' ? (
              <>
                <p>{en['console.become.company_adds_item']}</p>
                <p>{en['console.become.company_identity_meaning']}</p>
                <p className="warn">{en['console.become.not_reversible']}</p>
              </>
            ) : entityType === 'INDIVIDUAL' ? (
              <>
                <p>{en['console.become.individual_identity_meaning']}</p>
                <p className="warn">{en['console.become.not_reversible']}</p>
              </>
            ) : (
              <p className="hint">{en['console.become.choose_prompt']}</p>
            )}
          </div>

          <label htmlFor="become-store_name">{en['console.become.store_name_label']}</label>
          <input
            id="become-store_name"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            maxLength={120}
            required
          />

          <label htmlFor="become-handle">{en['console.become.handle_label']}</label>
          <input
            id="become-handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value.trim().toLowerCase())}
            aria-invalid={handle.length > 0 && !handleValid ? true : undefined}
            aria-describedby="become-handle-hint"
            required
          />
          <p id="become-handle-hint" className="hint">
            {en['console.become.handle_hint']}
          </p>

          <button type="submit" disabled={!canSubmit}>
            {en['console.become.submit']}
          </button>
        </form>
      </ScreenState>
    </main>
  );
}
