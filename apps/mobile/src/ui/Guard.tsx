// The screen-level route guard: renders what the pure guard decided. No private data is drawn until the guard says ALLOW, and a
// denied direct link shows one neutral state that does not reveal why (an Order, another person's content and a missing
// relationship look the same).
import { useRouter } from 'expo-router';
import { Fragment, useEffect, type ReactNode } from 'react';

import type { GatedMode } from '../contracts/gap-mob-session';
import { serverText, t } from '../i18n/messages';
import { evaluateRoute, type ModeUnavailable } from '../modes/route-guard';
import { pathOf, type RouteTemplate } from '../modes/routes';
import { useApp } from '../providers/AppProvider';
import { StateView } from './components';

export function Guard({ template, children }: { readonly template: RouteTemplate; readonly children: ReactNode }) {
  const { gate, session, eligibility, retry, runtime } = useApp();
  const router = useRouter();
  const result = evaluateRoute({ template, params: {} }, { app: gate, session, eligibility });

  switch (result.kind) {
    case 'ALLOW':
      // Keyed by the session epoch: every private subtree remounts on an identity change, so no component state, pending
      // mutation or cached render of one Account can survive into the next (M01-R03).
      return <Fragment key={session.epoch}>{children}</Fragment>;
    case 'WAIT':
      return gate.kind === 'READY_OFFLINE' && result.waitingFor !== 'SESSION' ? <StateView kind="offline" onRetry={retry} /> : <StateView kind="loading" />;
    case 'SIGN_IN_REQUIRED': {
      const returnTo = result.returnTo ? `?returnTo=${encodeURIComponent(pathOf(result.returnTo))}` : '';
      return <StateView kind="unauthorized" message={t('error.auth.authentication_required')} action={{ label: t('mobile.auth.sign_in'), onPress: () => router.push(`/auth/sign-in${returnTo}`) }} />;
    }
    case 'MODE_UNAVAILABLE':
      return (
        <StateView
          kind={result.unavailable.status === 'UNCONFIRMED' ? 'offline' : 'unauthorized'}
          message={modeMessage(result.unavailable)}
          {...(result.unavailable.status === 'UNCONFIRMED' ? { onRetry: retry } : {})}
          action={{
            label: t('mobile.mode.back_to_buyer'),
            onPress: () => {
              runtime?.enterMode('BUYER');
              router.replace('/home');
            },
          }}
        />
      );
    case 'UPGRADE_REQUIRED':
      return null; // the root replaces the navigator; nothing renders behind the blocking screen
  }
}

/** One neutral sentence per outcome. NOT_ELIGIBLE and REVOKED give no reason; PENDING and RESTRICTED show the server's. */
export function modeMessage(unavailable: ModeUnavailable): string {
  switch (unavailable.status) {
    case 'PENDING':
      return serverText(unavailable.message, 'mobile.mode.pending');
    case 'RESTRICTED':
      return serverText(unavailable.message, 'mobile.mode.restricted');
    case 'UNCONFIRMED':
      return t('mobile.state.offline');
    case 'NOT_ELIGIBLE':
    case 'REVOKED':
      return t('mobile.state.unauthorized');
  }
}

/** A mode route: guarded, and entering it (including by direct link) sets the active mode; leaving it returns to Buyer. */
export function ModeGate({ mode, template, children }: { readonly mode: GatedMode; readonly template: RouteTemplate; readonly children: ReactNode }) {
  const { gate, session, eligibility, runtime } = useApp();
  const allowed = evaluateRoute({ template, params: {} }, { app: gate, session, eligibility }).kind === 'ALLOW';
  useEffect(() => {
    if (!allowed || runtime === null) return undefined;
    runtime.enterMode(mode);
    return () => {
      runtime.enterMode('BUYER');
    };
  }, [allowed, runtime, mode]);
  return <Guard template={template}>{children}</Guard>;
}
