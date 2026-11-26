import { useEffect, useState, type FormEvent } from 'react';
import type { StepUpChallenge, StepUpPurpose } from '../../contracts/gap-sc-account';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Form';
import { t } from '../../i18n/t';
import { useAccountCommand } from '../../session/account';
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
 * purpose and this target only; the dialog hands it to the command and closes. Step-up never supplies a missing permission.
 */
export function StepUp({ open, purpose, sellerId, onClose, onGranted }: { open: boolean; purpose: StepUpPurpose; sellerId: string | null; onClose: () => void; onGranted: (grant: string) => void }) {
  const run = useAccountCommand();
  const starting = useAction();
  const verifying = useAction();
  const [challenge, setChallenge] = useState<StepUpChallenge | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!open) {
      setChallenge(null);
      setCode('');
      return;
    }
    void starting.run(() => run('account.stepup.start', { purpose, seller_id: sellerId })).then((c) => {
      if (c) setChallenge(c);
    });
    // A challenge is started once per opening, for this purpose and target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, purpose, sellerId]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    if (!/^\d{6}$/.test(code.trim())) {
      verifying.fail({ stepup_code: 'OTP_FORMAT' });
      return;
    }
    const result = await verifying.run(() => run('account.stepup.verify', { challenge_id: challenge.challenge_id, code: code.trim() }));
    if (result) onGranted(result.grant);
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('stepup.title')}>
      <ActionProblem action={starting} />
      {challenge ? (
        <form onSubmit={(e) => void verify(e)} noValidate className="stack">
          <p>{t(SENTENCE[challenge.purpose], { target: challenge.target_label })}</p>
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
    </Dialog>
  );
}
