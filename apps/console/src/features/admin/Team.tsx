/**
 * features/admin/Team.tsx -- SC-25 Team (ADU-CON-03 v1.2 S12). Business tier
 * only (ADU-PRD-01 S16.1 -- "Yes, RBAC" appears on Business and no other
 * row).
 *
 * THE ENTITLEMENT IS THE SERVER'S ANSWER, NOT AN INFERENCE: GET
 * /v1/seller/team returns seats {allowed, cap}, and allowed=false renders
 * NO_ENTITLEMENT -- the one screen state whose whole point is a disabled
 * control with the unlock named (S3.4). POSTing anyway would earn 409
 * TIER_LIMIT_REACHED; the screen does not offer the attempt.
 *
 * Membership rows carry the MEMBERSHIP id and that id is what DELETE takes
 * (and what ownership transfer's to_member_id wants -- G1.6). No account ids
 * ride the wire. DELETE carries a BODY with step_up_challenge_id; both team
 * mutations guard with TEAM_CHANGE, challengeRequired.
 *
 * Each role names what it can and CANNOT do -- notably Sales/Support cannot
 * see or change payout details despite confirming payments daily (S12).
 *
 * The wireframe drew pending-invitation rows; the API has none -- POST
 * requires the phone to hold an ACTIVE account (404 otherwise), so
 * membership is immediate or refused. The delta is named on screen (D-224).
 *
 * OWNERSHIP TRANSFER (G1.6, ADU-RUL-01 -- policy exists, contra v1.2's
 * stale "no product rules" note, and the later founder documents govern):
 * recipient must already be an ACTIVE ADMIN membership here; activates in
 * 24h; cancellable by either party (DELETE, no step-up -- the recipient's
 * cancel is a decline); blocked while a payout change is pending or a claim
 * is open, and the 409/422 carries items[] -- EVERY one renders.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import { useStepUp } from '../../auth/useStepUp';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useMarketContext } from '../../lib/market';
import { timeFormatter, fillTemplate } from '../../lib/intl';
import type { TeamPage, OwnershipTransfer } from './types';

const ROLES = ['ADMIN', 'SALES_SUPPORT', 'INVENTORY', 'ANALYST', 'CAMPAIGN_MANAGER'] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABEL: Readonly<Record<string, string>> = {
  ADMIN: en['console.admin.team.role_admin'],
  SALES_SUPPORT: en['console.admin.team.role_sales'],
  INVENTORY: en['console.admin.team.role_inventory'],
  ANALYST: en['console.admin.team.role_analyst'],
  CAMPAIGN_MANAGER: en['console.admin.team.role_campaign'],
};

/** What each role can and cannot do -- the CANNOT is the point (S12). */
const ROLE_CAN: Readonly<Record<string, string>> = {
  ADMIN: en['console.admin.team.can_admin'],
  SALES_SUPPORT: en['console.admin.team.can_sales'],
  INVENTORY: en['console.admin.team.can_inventory'],
  ANALYST: en['console.admin.team.can_analyst'],
  CAMPAIGN_MANAGER: en['console.admin.team.can_campaign'],
};
const ROLE_CANNOT: Readonly<Record<string, string>> = {
  SALES_SUPPORT: en['console.admin.team.cannot_sales'],
  INVENTORY: en['console.admin.team.cannot_inventory'],
  ANALYST: en['console.admin.team.cannot_analyst'],
  CAMPAIGN_MANAGER: en['console.admin.team.cannot_campaign'],
};

export function Team() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [team, setTeam] = useState<TeamPage | null>(null);
  const [transfer, setTransfer] = useState<OwnershipTransfer | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('SALES_SUPPORT');
  const [transferTo, setTransferTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { guard, modal } = useStepUp();

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const t = await api<TeamPage>(`/seller/team`, { sellerId });
      setTeam(t);
      try {
        const o = await api<{ transfer: OwnershipTransfer | null }>(`/seller/ownership-transfer`, {
          sellerId,
        });
        setTransfer(o.transfer);
      } catch {
        // A non-owner may not read transfers; the section renders nothing.
        setTransfer(null);
      }
      setState('READY');
    } catch (e) {
      setState(e instanceof ApiError ? stateFromProblem(e.problem) : 'TRANSPORT_ERROR');
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async () => {
    if (!sellerId) return;
    setFieldError(null);
    if (!phone.trim()) {
      setFieldError(en['console.admin.team.phone_required']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const r = await guard(
        'TEAM_CHANGE',
        undefined,
        (challengeId) =>
          api(`/seller/team`, {
            method: 'POST',
            sellerId,
            body: { phone: phone.trim(), role, step_up_challenge_id: challengeId },
          }),
        { challengeRequired: true },
      );
      if (r !== null) {
        setPhone('');
        void load();
      }
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (memberId: string) => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await guard(
        'TEAM_CHANGE',
        memberId,
        (challengeId) =>
          api(`/seller/team/${memberId}`, {
            method: 'DELETE',
            sellerId,
            body: { step_up_challenge_id: challengeId },
          }),
        { challengeRequired: true },
      );
      if (r !== null) void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const startTransfer = async () => {
    if (!sellerId) return;
    setFieldError(null);
    if (!transferTo) {
      setFieldError(en['console.admin.team.transfer_pick_admin']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const r = await guard(
        'OWNERSHIP_TRANSFER',
        transferTo,
        (challengeId) =>
          api(`/seller/ownership-transfer`, {
            method: 'POST',
            sellerId,
            body: { to_member_id: transferTo, step_up_challenge_id: challengeId },
          }),
        { challengeRequired: true },
      );
      if (r !== null) {
        setTransferTo('');
        void load();
      }
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const cancelTransfer = async () => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/ownership-transfer`, { method: 'DELETE', sellerId, body: {} });
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (!team) return <ScreenState state={state} onRetry={() => void load()} />;

  const fmt = market ? timeFormatter(market) : null;

  // The server's entitlement answer -- S3.4's NO_ENTITLEMENT: the control
  // renders DISABLED with the unlock named, and nothing pretends otherwise.
  if (team.seats && !team.seats.allowed) {
    return (
      <section aria-labelledby="team-heading" data-screen="SC-25" className="team">
        <h1 id="team-heading">{en['console.admin.team.heading']}</h1>
        <ScreenState state="NO_ENTITLEMENT" entitlementUnlock={en['console.admin.team.unlock']} />
      </section>
    );
  }

  const admins = team.data.filter((m) => m.role === 'ADMIN' && !m.suspended_at);

  return (
    <section aria-labelledby="team-heading" data-screen="SC-25" className="team">
      <h1 id="team-heading">{en['console.admin.team.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {fieldError ? (
        <p className="field-error" role="alert">
          {fieldError}
        </p>
      ) : null}

      {team.data.length === 0 ? (
        <div className="empty" data-state="EMPTY">
          <h3>{en['console.admin.team.empty_heading']}</h3>
          <p>{en['console.admin.team.empty_body']}</p>
        </div>
      ) : (
        <ul className="team-list">
          {team.data.map((m) => (
            <li key={m.id} className="team-row">
              <span className="team-phone">{m.phone}</span>
              <span className="team-role">{ROLE_LABEL[m.role] ?? m.role}</span>
              <span className="team-can">{ROLE_CAN[m.role] ?? ''}</span>
              {ROLE_CANNOT[m.role] ? <span className="team-cannot">{ROLE_CANNOT[m.role]}</span> : null}
              <span className={`badge badge-${m.suspended_at ? 'suspended' : 'active'}`}>
                {m.suspended_at
                  ? en['console.admin.team.suspended']
                  : en['console.admin.team.active']}
              </span>
              <button type="button" className="button" disabled={busy} onClick={() => void remove(m.id)}>
                {en['console.admin.team.remove']}
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* The wireframe's pending-invitation rows have no wire: membership is
          immediate (an ACTIVE account) or refused (404). Named, not faked. */}
      <p className="hint">{en['console.admin.team.no_pending_note']}</p>

      <section aria-labelledby="invite-heading" className="team-invite">
        <h2 id="invite-heading">{en['console.admin.team.invite_heading']}</h2>
        <label htmlFor="tm-phone">{en['console.admin.team.phone']}</label>
        <input id="tm-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label htmlFor="tm-role">{en['console.admin.team.role']}</label>
        <select id="tm-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button type="button" className="button primary" disabled={busy} onClick={() => void invite()}>
          {en['console.admin.team.invite']}
        </button>
      </section>

      <section aria-labelledby="transfer-heading" className="ownership-transfer">
        <h2 id="transfer-heading">{en['console.admin.team.transfer_heading']}</h2>
        {transfer ? (
          <div className="blocked">
            <p>
              {fillTemplate(en['console.admin.team.transfer_pending'], {
                time: fmt ? fmt.format(new Date(transfer.activates_at)) : transfer.activates_at,
              })}
            </p>
            <button type="button" className="button" disabled={busy} onClick={() => void cancelTransfer()}>
              {transfer.i_am_the_owner
                ? en['console.admin.team.transfer_cancel']
                : en['console.admin.team.transfer_decline']}
            </button>
          </div>
        ) : (
          <>
            {/* G1.6's policy, stated before the control. */}
            <p>{en['console.admin.team.transfer_explain']}</p>
            {admins.length === 0 ? (
              <p className="hint">{en['console.admin.team.transfer_no_admin']}</p>
            ) : (
              <>
                <label htmlFor="tm-transfer">{en['console.admin.team.transfer_to']}</label>
                <select id="tm-transfer" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                  <option value="">{en['console.admin.team.transfer_pick']}</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.phone}
                    </option>
                  ))}
                </select>
                <button type="button" className="button" disabled={busy} onClick={() => void startTransfer()}>
                  {en['console.admin.team.transfer_start']}
                </button>
              </>
            )}
          </>
        )}
      </section>

      {modal}
    </section>
  );
}
