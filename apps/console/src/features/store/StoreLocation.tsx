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
import { useDirty } from '../shared/dirty';
import { StoreFrame, type StoreProps } from './StoreFrame';

const asCandidate = (l: Location): LocationCandidate => ({ provider: l.provider, provider_reference: l.provider_reference, display_address: l.display_address, latitude: l.latitude, longitude: l.longitude });

/** Where a point falls inside Ethiopia's rough bounding box, as a 0..1 position on the demonstration outline. Not a map projection to be trusted. */
const place = (lat: number, lon: number): { x: number; y: number } => ({ x: Math.min(1, Math.max(0, (lon - 33) / 15)), y: Math.min(1, Math.max(0, (15 - lat) / 12)) });

/**
 * A demonstration map preview (CON S98 asks for one). No map provider is connected, and the figure says so: it plots the provider-resolved
 * coordinates on a plain outline, so the Seller can see that choosing a different place moves the pin. Never presented as a real map.
 */
function MapPreview({ target }: { target: LocationCandidate | null }) {
  if (target === null) return <p className="hint">{t('store.map_none')}</p>;
  const p = place(target.latitude, target.longitude);
  return (
    <figure className="map-preview">
      <svg viewBox="0 0 300 200" role="img" aria-label={t('store.map_alt', { address: target.display_address })}>
        <rect className="map-bg" x="0" y="0" width="300" height="200" />
        {[1, 2, 3].map((i) => (
          <line key={`v${i}`} className="map-line" x1={i * 75} y1="0" x2={i * 75} y2="200" />
        ))}
        {[1, 2, 3].map((i) => (
          <line key={`h${i}`} className="map-line" x1="0" y1={i * 50} x2="300" y2={i * 50} />
        ))}
        <circle className="map-pin" cx={p.x * 300} cy={p.y * 200} r="9" />
      </svg>
      <figcaption>
        <strong>{target.display_address}</strong>
        <span className="hint block">{t('store.map_coordinates', { latitude: target.latitude.toFixed(4), longitude: target.longitude.toFixed(4) })}</span>
      </figcaption>
    </figure>
  );
}

function Search({ onPick, onPreview, previewed, busy }: { onPick: (c: LocationCandidate) => void; onPreview: (c: LocationCandidate) => void; previewed: string | null; busy: boolean }) {
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
              <span className="actions">
                <button type="button" className="btn btn-quiet" aria-pressed={previewed === c.provider_reference} onClick={() => onPreview(c)}>
                  {t('store.location_preview', { address: c.display_address })}
                </button>
                <button type="button" className="btn btn-quiet" aria-disabled={busy} onClick={() => onPick(c)}>
                  {t('store.location_use', { address: c.display_address })}
                </button>
              </span>
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
  const [previewed, setPreviewed] = useState<LocationCandidate | null>(null);
  useDirty('location', location !== null && isPublic !== location.public);

  async function set(candidate: LocationCandidate | null, visible: boolean) {
    const next = await action.run(() => run('store.location.set', { version: view.version, candidate, public: visible }));
    if (next) {
      onChange(next);
      setPreviewed(null);
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
      <MapPreview target={previewed ?? (location ? asCandidate(location) : null)} />
      <p className="hint">{t('store.map_note')}</p>
      {editable ? <Search busy={action.busy} previewed={previewed?.provider_reference ?? null} onPreview={setPreviewed} onPick={(c) => void set(c, isPublic)} /> : null}
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
