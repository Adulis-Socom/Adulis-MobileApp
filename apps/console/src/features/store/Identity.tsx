/**
 * features/store/Identity.tsx -- SC-22 Identity and verification (v1.2 S11).
 *
 * ACCOUNT CONTROL is the seller-driven path: POST /v1/seller/social-accounts
 * mints a code ("ADU-XXXXXXXX", 24h) the seller places in their TikTok or
 * Instagram bio; POST .../{id}/verify fetches and matches. Both are
 * idempotent POSTs -- keys minted on mount, reminted on success.
 *
 * IDENTITY VERIFICATION HAS NO CONTROL ON THIS SCREEN, AND THAT IS G1.1
 * (ADU-RUL-01, carried in ADU-API-01 v1.8 S12.12): the endpoint derives its
 * authority from core.operator_grant and a seller session receives 403 --
 * there is no KYC vendor and no self-serve check; the founder attests
 * directly. ADU-CON-03 v1.2's SC-22 prose still says "hands off to the KYC
 * vendor"; the API and the ruling both post-date and govern, and a button
 * that always 403s is a control for a capability the server will refuse --
 * the class the forbidden-controls rule exists for. The conflict is
 * registered (D-224), not resolved here. What the screen DOES say: identity
 * verification is performed by Adulis; the no-document-photo sentence; and
 * R26's company note -- the check is about the representative as a natural
 * person.
 *
 * R24 -- the follower count is CAPTURED at verification, never refreshed in
 * the background. The wire returns follower_count_at_verification once, in
 * the verify response, and nothing else ever returns it (no GET lists social
 * accounts -- named on screen, D-224). It renders with "as of" the moment
 * this session witnessed, with a Re-check action, and one line saying it
 * does not update on its own.
 */
import { useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { useIdempotencyKey } from '../../lib/idempotency';
import { fillTemplate, timeFormatter } from '../../lib/intl';
import { useMarketContext } from '../../lib/market';
import type { SocialAccountCreated, SocialVerified } from './types';

export function Identity() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [platform, setPlatform] = useState<'TIKTOK' | 'INSTAGRAM'>('TIKTOK');
  const [handle, setHandle] = useState('');
  const [created, setCreated] = useState<SocialAccountCreated | null>(null);
  const [verified, setVerified] = useState<{ count: number | null; at: Date } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const createKey = useIdempotencyKey();
  const verifyKey = useIdempotencyKey();

  const start = async () => {
    if (!sellerId) return;
    setFieldError(null);
    if (!handle.trim()) {
      setFieldError(en['console.store.identity.handle_required']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<SocialAccountCreated>(`/seller/social-accounts`, {
        method: 'POST',
        sellerId,
        idempotencyKey: createKey.current(),
        body: { platform, handle: handle.trim() },
      });
      createKey.remint();
      setCreated(r);
      setVerified(null);
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    if (!sellerId || !created) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<SocialVerified>(`/seller/social-accounts/${created.social_account_id}/verify`, {
        method: 'POST',
        sellerId,
        idempotencyKey: verifyKey.current(),
      });
      verifyKey.remint();
      // "As of" is the moment THIS SESSION witnessed the capture -- the wire
      // carries no captured_at, and stamping the witnessed moment is the only
      // date this client can truthfully attach (R24; absence registered).
      setVerified({ count: r.follower_count_at_verification ?? null, at: new Date() });
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const fmt = market ? timeFormatter(market) : null;

  return (
    <section aria-labelledby="identity-heading" data-screen="SC-22" className="identity">
      <h1 id="identity-heading">{en['console.store.identity.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {fieldError ? (
        <p className="field-error" role="alert">
          {fieldError}
        </p>
      ) : null}

      {/* Both paths explained BEFORE either is chosen (S11). */}
      <p>{en['console.store.identity.account_control_explain']}</p>
      <p>{en['console.store.identity.identity_explain']}</p>
      {/* The sentence that is the difference between trusting the flow and
          abandoning it: no document photo ever reaches Adulis. */}
      <p className="callout">{en['console.store.identity.no_document_photo']}</p>
      {/* R26: for a company, the check is about the representative. */}
      <p className="hint">{en['console.store.identity.company_note']}</p>

      <section aria-labelledby="account-control-heading" className="account-control">
        <h2 id="account-control-heading">{en['console.store.identity.account_control_heading']}</h2>
        <label htmlFor="id-platform">{en['console.store.identity.platform']}</label>
        <select
          id="id-platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as 'TIKTOK' | 'INSTAGRAM')}
        >
          <option value="TIKTOK">TikTok</option>
          <option value="INSTAGRAM">Instagram</option>
        </select>
        <label htmlFor="id-handle">{en['console.store.identity.handle']}</label>
        <input id="id-handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <button type="button" className="button primary" disabled={busy} onClick={() => void start()}>
          {en['console.store.identity.get_code']}
        </button>

        {created ? (
          <div className="bio-code">
            <p>
              {en['console.store.identity.post_this_code']} <strong>{created.code}</strong>
            </p>
            <p className="hint">{en['console.store.identity.where_to_put_it']}</p>
            <p className="hint">
              {fmt
                ? fillTemplate(en['console.store.identity.code_expires'], {
                    time: fmt.format(new Date(created.expires_at)),
                  })
                : en['console.store.identity.code_expires']}
            </p>
            <button type="button" className="button" disabled={busy} onClick={() => void check()}>
              {en['console.store.identity.check']}
            </button>
          </div>
        ) : null}

        {verified ? (
          <div className="follower-card">
            <p className="callout">{en['console.store.identity.verified']}</p>
            {verified.count !== null ? (
              <p>
                {fillTemplate(en['console.store.identity.follower_count'], {
                  n: String(verified.count),
                  date: fmt ? fmt.format(verified.at) : '',
                })}
              </p>
            ) : null}
            {/* R24, on screen: no background refresh, ever. */}
            <p className="hint">{en['console.store.identity.no_auto_refresh']}</p>
            <button type="button" className="button" disabled={busy} onClick={() => void check()}>
              {en['console.store.identity.recheck']}
            </button>
          </div>
        ) : null}

        {/* D-224: linked accounts and their counts cannot be re-read after
            this session -- the absence is named where it will be felt. */}
        <p className="hint">{en['console.store.identity.list_owed']}</p>
      </section>

      <section aria-labelledby="identity-check-heading" className="identity-check">
        <h2 id="identity-check-heading">{en['console.store.identity.identity_heading']}</h2>
        {/* G1.1: operator-only. No control renders, and this line says who
            performs it instead of leaving a hole where a button "should" be. */}
        <p>{en['console.store.identity.operator_performed']}</p>
      </section>
    </section>
  );
}
