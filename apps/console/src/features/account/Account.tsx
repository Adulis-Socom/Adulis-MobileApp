import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import type { StepUpPurpose } from '../../contracts/gap-sc-account';
import { Badge } from '../../components/Badge';
import { Field } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant, label, t } from '../../i18n/t';
import { PlainFrame } from '../../layout/PlainFrame';
import { useAccountCommand, useAccountQuery } from '../../session/account';
import { useSession } from '../../session/SessionProvider';
import { Section } from '../products/Section';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { StepUp } from '../stepup/StepUp';

/**
 * The signed-in Account's own pages (SC-FE-11): security and sessions, notification preferences, privacy (data copy, Account deletion) and team
 * invitations. They belong to the person, not to a Seller, so they live outside every Seller (`/account/*`) and no administrator can act here for
 * someone else (CONSOLE-02 S20, S118; NOTIF-01 S45). No Government ID is asked for. Nothing on these pages deletes anything in this release.
 */
function Failed({ title, retry }: { title: string; retry: () => void }) {
  return (
    <StatePanel kind="danger" alert title={title} actions={<button type="button" className="btn btn-primary" onClick={retry}>{t('state.retry')}</button>}>
      <p>{t('state.transport_error_body')}</p>
    </StatePanel>
  );
}

export function AccountLayout() {
  const parts = [
    { to: '/account', label: t('acct.nav_security'), end: true },
    { to: '/account/notifications', label: t('acct.nav_notifications') },
    { to: '/account/privacy', label: t('acct.nav_privacy') },
    { to: '/account/invitations', label: t('acct.nav_invitations') },
  ];
  return (
    <PlainFrame>
      <PageTitle title={t('acct.title')}>{t('acct.title')}</PageTitle>
      <p>
        <Link to="/sellers">{t('acct.back')}</Link>
      </p>
      <nav aria-label={t('acct.nav_label')} className="actions">
        {parts.map((p) => (
          <NavLink key={p.to} className="btn btn-quiet" to={p.to} end={p.end ?? false}>
            {p.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </PlainFrame>
  );
}

/** Opens fresh proof for one purpose, then runs `then` with the one-use grant. */
function useStepUp(purpose: StepUpPurpose, then: (grant: string) => void): { open: () => void; dialog: ReactNode } {
  const [isOpen, setOpen] = useState(false);
  return {
    open: () => setOpen(true),
    dialog: (
      <StepUp
        open={isOpen}
        purpose={purpose}
        sellerId={null}
        onClose={() => setOpen(false)}
        onGranted={(grant) => {
          setOpen(false);
          then(grant);
        }}
      />
    ),
  };
}

export function AccountSecurity() {
  const security = useAccountQuery('account.security.get', {});
  const sessions = useAccountQuery('account.sessions.get', {});
  const run = useAccountCommand();
  const action = useAction();
  const revokeAll = useStepUp('REVOKE_OTHER_SESSIONS', (grant) => {
    void action.run(() => run('account.sessions.revoke_others', { step_up_grant: grant })).then((next) => next && sessions.replace(next));
  });
  return (
    <>
      <Section id="security" title={t('acct.security_title')}>
        {security.state.status === 'loading' ? <Skeleton rows={2} /> : null}
        {security.state.status === 'error' ? <Failed title={t('acct.error_title')} retry={security.retry} /> : null}
        {security.state.status === 'ready' ? (
          <dl className="facts">
            <dt>{t('acct.phone')}</dt>
            <dd>{security.state.data.phone_masked}</dd>
            <dt>{t('acct.username')}</dt>
            <dd>{security.state.data.username}</dd>
            <dt>{t('acct.sign_in_method')}</dt>
            <dd>{t('acct.sign_in_method_value')}</dd>
          </dl>
        ) : null}
        <p className="hint">{t('acct.recovery_note')}</p>
        <p className="hint">{t('acct.phone_change_later')}</p>
      </Section>
      <Section id="sessions" title={t('acct.sessions_title')}>
        <p className="hint">{t('acct.sessions_note')}</p>
        <ActionProblem action={action} />
        {sessions.state.status === 'loading' ? <Skeleton rows={3} /> : null}
        {sessions.state.status === 'error' ? <Failed title={t('acct.error_title')} retry={sessions.retry} /> : null}
        {sessions.state.status === 'ready' ? (
          <>
            <ul className="ledger" aria-label={t('acct.sessions_title')}>
              {sessions.state.data.sessions.map((s) => (
                <li key={s.session_id} className="ledger-row">
                  <div className="stack">
                    <div className="row-start">
                      <strong>{s.device_label}</strong>
                      {s.current ? <Badge tone="info">{t('acct.this_session')}</Badge> : null}
                    </div>
                    <p className="ledger-meta">{t('acct.session_line', { surface: label('acct.audience', s.audience), time: formatInstant(s.last_used_at) })}</p>
                    <p className="ledger-meta">{s.approx_location ?? t('acct.location_unknown')}</p>
                    {s.current ? null : (
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn-quiet"
                          onClick={() => void action.run(() => run('account.sessions.revoke', { session_id: s.session_id })).then((next) => next && sessions.replace(next))}
                        >
                          {t('acct.revoke', { device: s.device_label })}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {sessions.state.data.sessions.some((s) => !s.current) ? (
              <div className="actions">
                <button type="button" className="btn btn-quiet" onClick={revokeAll.open}>
                  {t('acct.revoke_others')}
                </button>
              </div>
            ) : (
              <p className="hint">{t('acct.only_this_session')}</p>
            )}
          </>
        ) : null}
      </Section>
      {revokeAll.dialog}
    </>
  );
}

export function AccountNotifications() {
  const prefs = useAccountQuery('account.preferences.get', {});
  const run = useAccountCommand();
  const action = useAction();
  return (
    <Section id="notifications" title={t('acct.notifications_title')}>
      <p className="notice">
        <Icon name="info" />
        <span>{t('acct.notifications_provisional')}</span>
      </p>
      <ActionProblem action={action} />
      {prefs.state.status === 'loading' ? <Skeleton rows={4} /> : null}
      {prefs.state.status === 'error' ? <Failed title={t('acct.error_title')} retry={prefs.retry} /> : null}
      {prefs.state.status === 'ready' ? (
        <ul className="plain-list stack" aria-label={t('acct.notifications_title')}>
          {prefs.state.data.categories.map((c) => (
            <li key={c.code}>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  disabled={!c.suppressible}
                  aria-describedby={c.suppressible ? undefined : `pref-${c.code}-why`}
                  onChange={(e) => void action.run(() => run('account.preferences.set', { code: c.code, enabled: e.target.checked })).then((next) => next && prefs.replace(next))}
                />
                <span>{label('acct.pref', c.code)}</span>
              </label>
              {c.suppressible ? null : (
                <p id={`pref-${c.code}-why`} className="hint">
                  {t('acct.pref_locked')}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

export function AccountPrivacy() {
  const privacy = useAccountQuery('privacy.get', {});
  const run = useAccountCommand();
  const exporting = useAction();
  const deleting = useAction();
  const [typed, setTyped] = useState('');
  const exportStep = useStepUp('EXPORT_DATA', (grant) => {
    void exporting.run(() => run('privacy.export.request', { step_up_grant: grant })).then((next) => next && privacy.replace(next));
  });
  const deleteStep = useStepUp('DELETE_ACCOUNT', (grant) => {
    void deleting.run(() => run('privacy.deletion.request', { step_up_grant: grant, typed_confirmation: typed.trim() })).then((next) => {
      if (next) {
        privacy.replace(next);
        setTyped('');
      }
    });
  });
  if (privacy.state.status === 'loading') return <Skeleton rows={6} />;
  if (privacy.state.status === 'error') return <Failed title={t('acct.error_title')} retry={privacy.retry} />;
  const p = privacy.state.data;
  const d = p.deletion;
  const pending = d.state === 'WAITING_BLOCKER' || d.state === 'WAITING_HOLD';

  function beginDeletion(event: FormEvent) {
    event.preventDefault();
    if (typed.trim() !== 'DELETE') {
      deleting.fail({ typed_confirmation: 'DELETION_CONFIRMATION_MISMATCH' });
      return;
    }
    deleteStep.open();
  }

  return (
    <>
      <Section id="data-copy" title={t('acct.export_title')}>
        <p>{t('acct.export_lead')}</p>
        <ActionProblem action={exporting} />
        {p.export_state === 'PREPARING' ? (
          <p role="status">{t('acct.export_preparing')}</p>
        ) : (
          <div className="actions">
            <button type="button" className="btn btn-quiet" onClick={exportStep.open}>
              {t('acct.export_request')}
            </button>
          </div>
        )}
      </Section>
      <Section id="deletion" title={t('acct.delete_title')}>
        <h3>{t('acct.delete_consequences')}</h3>
        <ul>
          {d.consequences.map((c) => (
            <li key={c}>{label('acct.consequence', c)}</li>
          ))}
        </ul>
        <h3>{t('acct.delete_retained')}</h3>
        <ul>
          {d.retained.map((r) => (
            <li key={r}>{label('acct.retained', r)}</li>
          ))}
        </ul>
        <p className="notice">
          <Icon name="info" />
          <span>{t('acct.delete_nothing_owed')}</span>
        </p>
        {d.blockers.length > 0 ? (
          <>
            <h3>{t('acct.delete_blockers')}</h3>
            <ul>
              {d.blockers.map((b) => (
                <li key={b.code}>{t('acct.blocker.OWNS_SELLERS', { count: b.count })}</li>
              ))}
            </ul>
          </>
        ) : null}
        <ActionProblem action={deleting} />
        {pending ? (
          <div className="stack">
            <p role="status">{label('acct.deletion_state', d.state)}</p>
            {d.requested_at ? <p className="hint">{t('acct.deletion_requested', { time: formatInstant(d.requested_at) })}</p> : null}
            {d.hold_reason ? <p className="hint">{label('acct.hold', d.hold_reason)}</p> : null}
            {d.can_cancel ? (
              <div className="actions">
                <button type="button" className="btn btn-quiet" onClick={() => void deleting.run(() => run('privacy.deletion.cancel', {})).then((next) => next && privacy.replace(next))}>
                  {t('acct.deletion_cancel')}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <form onSubmit={beginDeletion} noValidate className="stack">
            {d.state === 'CANCELLED' ? <p className="hint">{t('acct.deletion_cancelled')}</p> : null}
            <Field id="typed_confirmation" label={t('acct.delete_type')} hint={t('acct.delete_type_hint')} error={deleting.fields['typed_confirmation']}>
              {(control) => <input {...control} className="text-input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />}
            </Field>
            <div className="actions">
              <button type="submit" className="btn btn-quiet">
                {t('acct.delete_start')}
              </button>
            </div>
          </form>
        )}
      </Section>
      {exportStep.dialog}
      {deleteStep.dialog}
    </>
  );
}

export function AccountInvitations() {
  const invitations = useAccountQuery('account.invitations.get', {});
  const session = useSession();
  const run = useAccountCommand();
  const action = useAction();
  return (
    <Section id="invitations" title={t('acct.invitations_title')}>
      <p className="hint">{t('acct.invitations_note')}</p>
      <ActionProblem action={action} />
      {invitations.state.status === 'loading' ? <Skeleton rows={2} /> : null}
      {invitations.state.status === 'error' ? <Failed title={t('acct.error_title')} retry={invitations.retry} /> : null}
      {invitations.state.status === 'ready' ? (
        invitations.state.data.items.length === 0 ? (
          <p>{t('acct.invitations_empty')}</p>
        ) : (
          <ul className="ledger" aria-label={t('acct.invitations_title')}>
            {invitations.state.data.items.map((i) => (
              <li key={i.invitation_id} className="ledger-row">
                <div className="stack">
                  <strong>{i.seller_label}</strong>
                  <p className="ledger-meta">{i.roles.map((r) => label('role', r)).join(', ')}</p>
                  {i.blocked ? (
                    <p className="hint">{t('acct.invitation_blocked')}</p>
                  ) : (
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() =>
                          void action.run(() => run('account.invitations.accept', { invitation_id: i.invitation_id })).then(async (next) => {
                            if (!next) return;
                            invitations.replace(next);
                            // The new membership changes what the Account may open: ask the server again.
                            await session.refresh();
                          })
                        }
                      >
                        {t('acct.invitation_accept', { seller: i.seller_label })}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Section>
  );
}
