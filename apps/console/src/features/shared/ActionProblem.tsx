import { ErrorSummary } from '../../components/Form';
import { Problem } from '../../components/Problem';
import { t } from '../../i18n/t';
import type { ActionApi } from './useAction';

/**
 * Everything a failed write shows: the field summary, the problem that belongs to no field, and, for a stale version, the
 * reload that fetches the newer state. A validation failure on fields this screen does not render still shows the
 * generic problem, so it is never a silent no-op.
 */
export function ActionProblem({ action, onReload }: { action: ActionApi; onReload?: () => void }) {
  const hasFields = action.summary.length > 0;
  return (
    <>
      <ErrorSummary errors={action.summary} focusToken={action.token} />
      <Problem error={hasFields ? null : action.error} />
      <p role="status" className="hint">
        {action.saved ? t('action.saved') : ''}
      </p>
      {action.conflict && onReload ? (
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={onReload}>
            {t('action.reload')}
          </button>
        </div>
      ) : null}
    </>
  );
}
