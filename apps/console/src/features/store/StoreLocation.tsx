import { useState, type FormEvent } from 'react';
import type { LocationCandidate, StoreLocation as Location } from '../../contracts/gap-sc-store';
import { Field } from '../../components/Form';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { label, t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { Section } from '../products/Section';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { StoreFrame, type StoreProps } from './StoreFrame';

const asCandidate = (l: Location): LocationCandidate => ({ provider: l.provider, provider_reference: l.provider_reference, display_address: l.display_address, latitude: l.latitude, longitude: l.longitude });

function Search({ onPick, busy }: { onPick: (c: LocationCandidate) => void; busy: boolean }) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const { state, retry } = useSellerQuery('store.location.search', { query });
  return (
    <div className="stack">
      <h3>{t('store.location_search_title')}</h3>
      <form
        role="search"
        className="row"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setQuery(draft);
        }}
      >
        <Field id="place-search" label={t('store.location_search_label')} hint={t('store.location_search_hint')}>
          {(control) => <input {...control} className="text-input" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} />}
        </Field>
        <button type="submit" className="btn btn-quiet">
          {t('store.location_search_submit')}
        </button>
      </form>
      {state.status === 'loading' ? <Skeleton rows={2} /> : null}
      {state.status === 'error' ? (
        <StatePanel kind="danger" alert title={t('store.location_search_error')} actions={<button type="button" className="btn btn-primary" onClick={retry}>{t('state.retry')}</button>}>
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'ready' && state.data.candidates.length === 0 ? <p className="empty">{t('store.location_search_empty')}</p> : null}
      {state.status === 'ready' && state.data.candidates.length > 0 ? (
        <ul className="ledger" aria-label={t('store.location_results_label')}>
          {state.data.candidates.map((c) => (
            <li key={`${c.provider}-${c.provider_reference}`} className="ledger-row">
              <span className="ledger-main">
                <span className="ledger-title">{c.display_address}</span>
                <span className="ledger-meta">{label('store.provider', c.provider)}</span>
              </span>
              <button type="button" className="btn btn-quiet" aria-disabled={busy} onClick={() => onPick(c)}>
                {t('store.location_use', { address: c.display_address })}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Body({ view, onChange, onReload, editable }: StoreProps) {
  const run = useSellerCommand();
  const action = useAction(true);
  const location = view.location;
  const [isPublic, setPublic] = useState(location?.public ?? false);

  async function set(candidate: LocationCandidate | null, visible: boolean) {
    const next = await action.run(() => run('store.location.set', { version: view.version, candidate, public: visible }));
    if (next) {
      onChange(next);
      setPublic(next.location?.public ?? false);
    }
  }

  return (
    <Section id="location" title={t('store.location_title')}>
      <p className="hint">{t('store.location_hint')}</p>
      <ActionProblem action={action} onReload={onReload} />
      {location === null ? (
        <p className="empty">{t('store.location_none')}</p>
      ) : (
        <div className="stack">
          <dl className="facts">
            <dt>{t('store.location_address')}</dt>
            <dd>{location.display_address}</dd>
            <dt>{t('store.location_provider')}</dt>
            <dd>{label('store.provider', location.provider)}</dd>
            <dt>{t('store.location_visibility')}</dt>
            <dd>{location.public ? t('store.location_shown') : t('store.location_hidden')}</dd>
          </dl>
          {editable ? (
            <div className="stack">
              <label className="choice">
                <input type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} />
                <span>{t('store.location_public')}</span>
              </label>
              <div className="actions">
                <button type="button" className="btn btn-primary" aria-disabled={action.busy} onClick={() => void set(asCandidate(location), isPublic)}>
                  {t('store.location_save_visibility')}
                </button>
                <button type="button" className="btn btn-quiet" aria-disabled={action.busy} onClick={() => void set(null, false)}>
                  {t('store.location_remove')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
      <p className="hint">{t('store.map_note')}</p>
      {editable ? <Search busy={action.busy} onPick={(c) => void set(c, isPublic)} /> : null}
    </Section>
  );
}

/**
 * Physical-store location (CONSOLE-02 S98): structured map-provider data the server resolved, never a typed address. A place is
 * chosen from the provider's results; whether Buyers see it is a separate, explicit choice that starts hidden.
 */
export function StoreLocation() {
  return <StoreFrame title={t('store.location_page')}>{(p) => <Body {...p} />}</StoreFrame>;
}
