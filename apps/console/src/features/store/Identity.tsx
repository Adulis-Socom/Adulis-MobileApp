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
 * the background. GET /v1/seller/social-accounts (T15 Phase 4) now LISTS the
 * linked accounts with follower_count and the DATE it was captured, so "as of
 * <date>" names the real capture instant rather than the moment one session
 * witnessed the verify response. The Re-check action is still owed to the wire
 * (the verify short-circuits a VERIFIED account before the platform fetch), so
 * that gap alone stays named; the list gap is closed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { useIdempotencyKey } from '../../lib/idempotency';
import { fillTemplate, timeFormatter } from '../../lib/intl';
import { useMarketContext } from '../../lib/market';
import type { SocialAccountCreated, SocialVerified, SellerSocialAccount } from './types';

export function Identity() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [platform, setPlatform] = useState<'TIKTOK' | 'INSTAGRAM'>('TIKTOK');
  const [handle, setHandle] = useState('');
  const [created, setCreated] = useState<SocialAccountCreated | null>(null);
  const [accounts, setAccounts] = useState<readonly SellerSocialAccount[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [justVerified, setJustVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const createKey = useIdempotencyKey();
  const verifyKey = useIdempotencyKey();
  // Only the latest list load may commit (the D-227 class; pass minor).
  const listGen = useRef(0);

  const load = useCallback(async () => {
    if (!sellerId) return;
    const gen = ++listGen.current;
    try {
      const r = await api<{ accounts: SellerSocialAccount[] }>(`/seller/social-accounts`, { sellerId });
      if (gen !== listGen.current) return;
      setAccounts(r.accounts);
      setListFailed(false);
    } catch {
      // A FAILED list is not an EMPTY list (the C-5 success-empty class the
      // pass flagged, M4): accounts stays as it was, a failure line renders in
      // the list region, and the create/verify controls stay live.
      if (gen !== listGen.current) return;
      setListFailed(true);
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setJustVerified(false);
      // The new (PENDING) account now appears in the list read below.
      void load();
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
      await api<SocialVerified>(`/seller/social-accounts/${created.social_account_id}/verify`, {
        method: 'POST',
        sellerId,
        idempotencyKey: verifyKey.current(),
      });
      verifyKey.remint();
      setJustVerified(true);
      // The list carries the real follower_count and captured_at now, so the
      // proof of the verify is the account appearing VERIFIED below with its
      // real "as of" date -- not a session-stamped moment.
      void load();
    } catch (e) {
      if (e instanceof ApiError) {
        const reason = e.problem.slots?.['reason'];
        if (reason === 'CODE_NOT_FOUND_IN_BIO') {
          setFieldError(en['console.store.identity.code_not_in_bio']);
        } else if (reason === 'CHALLENGE_EXPIRED') {
          setFieldError(en['console.store.identity.code_expired']);
        } else {
          setProblem(e);
        }
      }
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

        {justVerified ? <p className="callout">{en['console.store.identity.verified']}</p> : null}

        {/* THE LINKED ACCOUNTS, read back from the server (T15 Phase 4). A
            verified account shows its follower count with the real "as of"
            date it was captured (verified_at), which is R24 done properly --
            no session-stamped guess, no background refresh. */}
        <div className="linked-accounts" data-linked-accounts>
          <h3>{en['console.store.identity.linked_heading']}</h3>
          {listFailed ? (
            // Failure is not emptiness (pass M4): a seller with verified
            // accounts on a flaky connection must not read "none yet".
            <p className="problem" role="alert">
              {en['console.common.refetch_failed']}
            </p>
          ) : null}
          {accounts === null ? null : accounts.length === 0 && !listFailed ? (
            <p className="empty" data-state="EMPTY">
              {en['console.store.identity.linked_empty']}
            </p>
          ) : accounts.length === 0 ? null : (
            <ul>
              {accounts.map((a) => (
                <li key={a.id} data-account={a.id} data-status={a.status}>
                  <span className="account-handle">
                    {a.platform} {a.handle}
                  </span>
                  {a.status === 'VERIFIED' && a.follower_count !== null && a.captured_at ? (
                    <span className="account-followers">
                      {fillTemplate(en['console.store.identity.follower_count'], {
                        n: String(a.follower_count),
                        date: fmt ? fmt.format(new Date(a.captured_at)) : a.captured_at,
                      })}
                    </span>
                  ) : (
                    <span className="account-status">
                      {a.status === 'VERIFIED'
                        ? en['console.store.identity.status_verified']
                        : en['console.store.identity.status_pending']}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* R24, on screen: the count never refreshes on its own. The Re-check
              action is still owed to the wire (the verify short-circuits a
              VERIFIED account before the platform fetch -- register D-225). */}
          <p className="hint">{en['console.store.identity.no_auto_refresh']}</p>
          <p className="hint">{en['console.store.identity.recheck_owed']}</p>
        </div>
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
