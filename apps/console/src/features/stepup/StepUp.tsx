import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { StepUpChallenge, StepUpPurpose } from '../../contracts/gap-sc-account';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Form';
import { t } from '../../i18n/t';
import { useAccountCommand } from '../../session/account';
import { useSession } from '../../session/SessionProvider';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';

const SENTENCE = {
  TRANSFER_OWNERSHIP: 'stepup.purpose.TRANSFER_OWNERSHIP',
  CLOSE_SELLER: 'stepup.purpose.CLOSE_SELLER',
  REVOKE_OTHER_SESSIONS: 'stepup.purpose.REVOKE_OTHER_SESSIONS',
  EXPORT_DATA: 'stepup.purpose.EXPORT_DATA',
  DELETE_ACCOUNT: 'stepup.purpose.DELETE_ACCOUNT',
} as const;

/**
 * Fresh proof for one sensitive command (AUTH-02 S45-S48, CONSOLE-02 S21). The person is told exactly what the code authorizes ("Enter the code
 * to transfer ownership of Alem Textiles"), never a bare "enter your code". A correct code yields a grant the server accepts ONCE, for this
 * purpose, session and target only; the dialog hands it to the command and closes. Step-up never supplies a missing permission.
 *
 * Each OPENING is its own component instance (FE12-08): its challenge, its failures, its in-flight guard and its late answers belong to it and to
 * nothing else. Closing, Escape, a change of purpose or target, navigating away or a replaced session ends the opening: an answer that arrives
 * afterwards is dropped (useAccountCommand rejects it as stale), so it can neither be adopted by a newer opening nor call `onGranted`. Cancelling
 * before the protected command is dispatched therefore prevents it. Once `onGranted` has run the command is on its way and nothing here can undo it.
 */
export function StepUp({
  open,
  purpose,
  sellerId,
  recipientMembershipId,
  onClose,
  onGranted,
}: {
  open: boolean;
  purpose: StepUpPurpose;
  sellerId: string | null;
  /** TRANSFER_OWNERSHIP: the membership the code is for. The server binds the grant to it, so it cannot be spent on anyone else. */
  recipientMembershipId?: string | undefined;
  onClose: () => void;
  onGranted: (grant: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t('stepup.title')}>
      <Opening key={`${purpose}|${sellerId ?? ''}|${recipientMembershipId ?? ''}`} purpose={purpose} sellerId={sellerId} recipientMembershipId={recipientMembershipId} onClose={onClose} onGranted={onGranted} />
    </Dialog>
  );
}

function Opening({
  purpose,
  sellerId,
  recipientMembershipId,
  onClose,
  onGranted,
}: {
  purpose: StepUpPurpose;
  sellerId: string | null;
  recipientMembershipId: string | undefined;
  onClose: () => void;
  onGranted: (grant: string) => void;
}) {
  const run = useAccountCommand();
  const starting = useAction();
  const verifying = useAction();
  const [challenge, setChallenge] = useState<StepUpChallenge | null>(null);
  const [code, setCode] = useState('');
  // The session this opening began under: an answer that arrives after the session was replaced belongs to no one here.
  const { epoch } = useSession();
  const began = useRef(epoch);
  const current = useRef(epoch);
  current.current = epoch;

  useEffect(() => {
    const input = recipientMembershipId === undefined ? { purpose, seller_id: sellerId } : { purpose, seller_id: sellerId, recipient_membership_id: recipientMembershipId };
    void starting.run(() => run('account.stepup.start', input)).then((c) => {
      if (c && current.current === began.current) setChallenge(c);
    });
    // A challenge is started once per opening: this component is mounted per opening and keyed by purpose and target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    if (!/^\d{6}$/.test(code.trim())) {
      verifying.fail({ stepup_code: 'OTP_FORMAT' });
      return;
    }
    const result = await verifying.run(() => run('account.stepup.verify', { challenge_id: challenge.challenge_id, code: code.trim() }));
    if (result && current.current === began.current) onGranted(result.grant);
  }

  return (
    <>
      <ActionProblem action={starting} />
      {challenge ? (
        <form onSubmit={(e) => void verify(e)} noValidate className="stack">
          <p>
            {challenge.recipient_label !== null
              ? t('stepup.purpose.TRANSFER_OWNERSHIP_TO', { target: challenge.target_label, recipient: challenge.recipient_label })
              : t(SENTENCE[challenge.purpose], { target: challenge.target_label })}
          </p>
          <ActionProblem action={verifying} />
          <Field id="stepup_code" label={t('stepup.code_label')} hint={t('stepup.code_hint')} error={verifying.fields['stepup_code']}>
            {(control) => <input {...control} className="text-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />}
          </Field>
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={verifying.busy}>
              {t('stepup.confirm')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={onClose}>
              {t('stepup.cancel')}
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
