import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { PageTitle } from './PageTitle';

export type StateKind = 'info' | 'warn' | 'danger' | 'neutral' | 'success';
const ICON: Record<StateKind, IconName> = { success: 'check', info: 'info', warn: 'alert', danger: 'alert', neutral: 'clock' };

/**
 * One panel for every non-READY state of CONSOLE-02 S25 (transport error, no permission, no entitlement, deferred,
 * expired, restricted...). A failed request is a danger panel with a retry, never an empty list.
 */
export function StatePanel({
  kind,
  title,
  children,
  actions,
  alert = false,
  page = false,
}: {
  kind: StateKind;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** Announce immediately (a failure the person must hear); otherwise a polite status. */
  alert?: boolean;
  /** This panel IS the page (not found, no access, expired): its heading is the page h1 and takes focus on arrival. */
  page?: boolean;
}) {
  return (
    <section className={`state state-${kind}`} role={alert ? 'alert' : 'status'}>
      <div className="state-head">
        <Icon name={ICON[kind]} />
        {page ? <PageTitle title={title}>{title}</PageTitle> : <h2>{title}</h2>}
      </div>
      {children ? <div className="state-body">{children}</div> : null}
      {actions ? <div className="actions">{actions}</div> : null}
    </section>
  );
}
