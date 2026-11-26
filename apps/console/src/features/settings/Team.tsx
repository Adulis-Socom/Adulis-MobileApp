import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ASSIGNABLE_ROLES, type AssignableRole, type TeamMember, type TeamView } from '../../contracts/gap-sc-team';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { Field, Group } from '../../components/Form';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant, label, t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { Section } from '../products/Section';
import { ActionProblem } from '../shared/ActionProblem';
import { SectionNav } from '../shared/SectionNav';
import { useAction, type ActionApi } from '../shared/useAction';
import { StepUp } from '../stepup/StepUp';

/**
 * Team (SC-FE-11; AUTH-02 S58-S80, S113-S118; CONSOLE-02 S114-S117). The Owner is derived from ownership and has no assignable role; every other
 * member holds one or more of the five roles and their effective access is the union. An active member never has zero roles (remove or suspend
 * instead); the server refuses it too. Invitations name an EXISTING Account by username; another Seller learns only whether the person can
 * accept now. Ownership transfer is Owner-only, to an active Admin, with fresh proof and the server's 24-hour delay, and can be cancelled.
 */
function RoleChoices({ value, onChange, idPrefix, error }: { value: readonly AssignableRole[]; onChange: (next: AssignableRole[]) => void; idPrefix: string; error: string | undefined }) {
  return (
    <Group id={`${idPrefix}roles`} legend={t('team.roles_legend')} hint={t('team.roles_hint')} error={error}>
      {ASSIGNABLE_ROLES.map((r) => (
        <label key={r} className="choice">
          <input type="checkbox" checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
          <span>
            <strong>{label('role', r)}</strong> <span className="hint">{label('team.role_does', r)}</span>
          </span>
        </label>
      ))}
    </Group>
  );
}

function RoleEditor({ member, action, onSave, onCancel }: { member: TeamMember; action: ActionApi; onSave: (roles: AssignableRole[]) => void; onCancel: () => void }) {
  const [roles, setRoles] = useState<AssignableRole[]>([...member.roles]);
  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (roles.length === 0) action.fail({ [`edit-${member.membership_id}-roles`]: 'ROLE_SET_EMPTY' });
        else onSave(roles);
      }}
    >
      <ActionProblem action={action} />
      <RoleChoices value={roles} onChange={setRoles} idPrefix={`edit-${member.membership_id}-`} error={action.fields[`edit-${member.membership_id}-roles`] ?? action.fields['roles']} />
      <div className="actions">
        <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
          {t('team.save_roles', { name: member.display_name })}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          {t('team.cancel')}
        </button>
      </div>
    </form>
  );
}

type Confirm = { kind: 'SUSPEND' | 'REINSTATE' | 'REMOVE'; member: TeamMember } | null;
const ACTION = { SUSPEND: 'team.action.SUSPEND', REINSTATE: 'team.action.REINSTATE', REMOVE: 'team.action.REMOVE' } as const;
const CONFIRM_TITLE = { SUSPEND: 'team.confirm.SUSPEND', REINSTATE: 'team.confirm.REINSTATE', REMOVE: 'team.confirm.REMOVE' } as const;
const CONFIRM_BODY = { SUSPEND: 'team.confirm_body.SUSPEND', REINSTATE: 'team.confirm_body.REINSTATE', REMOVE: 'team.confirm_body.REMOVE' } as const;

export function Team() {
  const { sellerId, membership } = useSeller();
  const query = useSellerQuery('team.get', {});
  const run = useSellerCommand();
  const action = useAction();
  const invite = useAction();
  const transferAction = useAction();
  const [latest, setLatest] = useState<TeamView | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [username, setUsername] = useState('');
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [target, setTarget] = useState('');
  const [stepUp, setStepUp] = useState(false);

  if (query.state.status === 'loading') return <Skeleton rows={6} />;
  if (query.state.status === 'error') {
    return (
      <StatePanel kind="danger" alert title={t('team.error_title')} actions={<button type="button" className="btn btn-primary" onClick={query.retry}>{t('state.retry')}</button>}>
        <p>{t('state.transport_error_body')}</p>
      </StatePanel>
    );
  }
  const view = latest ?? query.state.data;
  const admins = view.members.filter((m) => m.relationship === 'TEAM' && m.standing === 'ACTIVE' && m.roles.includes('ADMIN'));

  async function act(fn: () => Promise<TeamView>, using: ActionApi = action) {
    const next = await using.run(fn);
    if (next) {
      setLatest(next);
      setEditing(null);
      setConfirm(null);
    }
    return next;
  }
  async function sendInvite(event: FormEvent) {
    event.preventDefault();
    const fields: Record<string, string> = {};
    if (username.trim() === '') fields['username'] = 'USERNAME_REQUIRED';
    if (roles.length === 0) fields['invite-roles'] = 'ROLE_SET_EMPTY';
    if (Object.keys(fields).length > 0) {
      invite.fail(fields);
      return;
    }
    const next = await act(() => run('team.invite', { username: username.trim(), roles }), invite);
    if (next) {
      setUsername('');
      setRoles([]);
    }
  }

  return (
    <>
      <PageTitle title={t('team.title')}>{t('team.title')}</PageTitle>
      <p>
        <Link to={sellerPath(sellerId, 'settings')}>{t('settings.back')}</Link>
      </p>
      <p className="lead">{t('team.lead')}</p>
      <SectionNav
        links={[
          { id: 'members', label: t('team.members_title') },
          ...(view.allowed_actions.includes('INVITE') ? [{ id: 'invite', label: t('team.invite_title') }] : []),
          ...(view.sessions ? [{ id: 'team-sessions', label: t('team.sessions_title') }] : []),
          ...(membership.relationship === 'OWNER' ? [{ id: 'ownership', label: t('team.ownership_title') }] : []),
        ]}
      />
      <Section id="members" title={t('team.members_title')}>
        <ActionProblem action={action} onReload={query.retry} />
        <ul className="ledger" aria-label={t('team.members_title')}>
          {view.members.map((m) => (
            <li key={m.membership_id} className="ledger-row">
              <div className="stack">
                <div className="row-start">
                  <strong>{m.display_name}</strong>
                  {m.is_you ? <span className="ledger-meta">{t('team.you')}</span> : null}
                  <Badge tone={m.standing === 'ACTIVE' ? 'success' : 'warn'}>{label('team.standing', m.standing)}</Badge>
                </div>
                <p className="ledger-meta">{m.relationship === 'OWNER' ? t('team.owner_derived') : m.roles.map((r) => label('role', r)).join(', ')}</p>
                {m.standing === 'SUSPENDED' ? <p className="hint">{t('team.suspended_note')}</p> : null}
                {editing === m.membership_id ? (
                  <RoleEditor member={m} action={action} onCancel={() => setEditing(null)} onSave={(next) => void act(() => run('team.roles.set', { membership_id: m.membership_id, version: m.version, roles: next }))} />
                ) : m.allowed_actions.length > 0 ? (
                  <div className="actions">
                    {m.allowed_actions.includes('CHANGE_ROLES') ? (
                      <button type="button" className="btn btn-quiet" onClick={() => setEditing(m.membership_id)}>
                        {t('team.change_roles', { name: m.display_name })}
                      </button>
                    ) : null}
                    {(['SUSPEND', 'REINSTATE', 'REMOVE'] as const)
                      .filter((k) => m.allowed_actions.includes(k))
                      .map((k) => (
                        <button key={k} type="button" className="btn btn-quiet" onClick={() => setConfirm({ kind: k, member: m })}>
                          {t(ACTION[k], { name: m.display_name })}
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {view.allowed_actions.includes('INVITE') ? (
        <Section id="invite" title={t('team.invite_title')}>
          <form onSubmit={(e) => void sendInvite(e)} noValidate className="stack">
            <p className="hint">{t('team.invite_note')}</p>
            <ActionProblem action={invite} />
            <Field id="username" label={t('team.username')} hint={t('team.username_hint')} error={invite.fields['username']}>
              {(control) => <input {...control} className="text-input" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />}
            </Field>
            <RoleChoices value={roles} onChange={setRoles} idPrefix="invite-" error={invite.fields['invite-roles'] ?? invite.fields['roles']} />
            <div className="actions">
              <button type="submit" className="btn btn-highlight" aria-disabled={invite.busy}>
                {t('team.send_invite')}
              </button>
            </div>
          </form>
          <h3>{t('team.pending_title')}</h3>
          {view.invitations.length === 0 ? (
            <p className="hint">{t('team.pending_empty')}</p>
          ) : (
            <ul className="ledger" aria-label={t('team.pending_title')}>
              {view.invitations.map((i) => (
                <li key={i.invitation_id} className="ledger-row">
                  <div className="stack">
                    <strong>{i.target_label}</strong>
                    <p className="ledger-meta">{i.roles.map((r) => label('role', r)).join(', ')}</p>
                    <p className="hint">{label('team.eligibility', i.eligibility)}</p>
                    <div className="actions">
                      <button type="button" className="btn btn-quiet" onClick={() => void act(() => run('team.invitation.withdraw', { invitation_id: i.invitation_id }))}>
                        {t('team.withdraw', { name: i.target_label })}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {view.sessions ? (
        <Section id="team-sessions" title={t('team.sessions_title')}>
          <p className="hint">{t('team.sessions_note')}</p>
          {view.sessions.length === 0 ? (
            <p className="hint">{t('team.sessions_empty')}</p>
          ) : (
            <ul className="ledger" aria-label={t('team.sessions_title')}>
              {view.sessions.map((s) => (
                <li key={s.session_id} className="ledger-row">
                  <div className="stack">
                    <strong>{s.member_label}</strong>
                    <p className="ledger-meta">{t('team.session_line', { device: s.device_label, time: formatInstant(s.last_used_at) })}</p>
                    {view.allowed_actions.includes('REVOKE_SESSIONS') ? (
                      <div className="actions">
                        <button type="button" className="btn btn-quiet" onClick={() => void act(() => run('team.session.revoke', { session_id: s.session_id }))}>
                          {t('team.session_revoke', { name: s.member_label })}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {membership.relationship === 'OWNER' ? (
        <Section id="ownership" title={t('team.ownership_title')}>
          <ActionProblem action={transferAction} />
          {view.transfer ? (
            <div className="stack">
              <p>{t('team.transfer_pending', { name: view.transfer.target_label, time: formatInstant(view.transfer.activates_at) })}</p>
              <p className="hint">{t('team.transfer_outcome_gap')}</p>
              <div className="actions">
                <button type="button" className="btn btn-quiet" onClick={() => void act(() => run('ownership.transfer.cancel', {}), transferAction)}>
                  {t('team.transfer_cancel')}
                </button>
              </div>
            </div>
          ) : admins.length === 0 ? (
            <p className="hint">{t('team.transfer_no_admin')}</p>
          ) : (
            <form
              className="stack"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (target === '') transferAction.fail({ transfer_target: 'TRANSFER_TARGET_REQUIRED' });
                else setStepUp(true);
              }}
            >
              <p className="hint">{t('team.transfer_note')}</p>
              <Field id="transfer_target" label={t('team.transfer_target')} error={transferAction.fields['transfer_target'] ?? transferAction.fields['target']}>
                {(control) => (
                  <select {...control} className="text-input" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">{t('team.transfer_choose')}</option>
                    {admins.map((a) => (
                      <option key={a.membership_id} value={a.membership_id}>
                        {a.display_name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <div className="actions">
                <button type="submit" className="btn btn-quiet">
                  {t('team.transfer_start')}
                </button>
              </div>
            </form>
          )}
          <StepUp
            open={stepUp}
            purpose="TRANSFER_OWNERSHIP"
            sellerId={sellerId}
            onClose={() => setStepUp(false)}
            onGranted={(grant) => {
              setStepUp(false);
              void act(() => run('ownership.transfer.start', { membership_id: target, step_up_grant: grant }), transferAction);
            }}
          />
        </Section>
      ) : null}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm ? t(CONFIRM_TITLE[confirm.kind], { name: confirm.member.display_name }) : ''}>
        {confirm ? (
          <>
            <p>{t(CONFIRM_BODY[confirm.kind])}</p>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const m = confirm.member;
                  const op = confirm.kind === 'SUSPEND' ? 'team.member.suspend' : confirm.kind === 'REINSTATE' ? 'team.member.reinstate' : 'team.member.remove';
                  void act(() => run(op, { membership_id: m.membership_id, version: m.version }));
                }}
              >
                {t(ACTION[confirm.kind], { name: confirm.member.display_name })}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setConfirm(null)}>
                {t('team.cancel')}
              </button>
            </div>
          </>
        ) : null}
      </Dialog>
    </>
  );
}
