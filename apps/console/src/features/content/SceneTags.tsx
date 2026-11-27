import { useMemo, useState, type FormEvent } from 'react';
import type { SceneTag } from '../../contracts/gap-sc-content';
import { Badge } from '../../components/Badge';
import { Field, Group } from '../../components/Form';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { useDirty } from '../shared/dirty';
import { AvailabilityBadge } from '../products/badges';
import { Section } from '../products/Section';
import { CENTRE, fromPercent, toPercent, type Point } from './hotspot';
import { canDo, imageSrc, type SceneSectionProps } from './sceneEditorModel';
import { Stage, type Marker } from './Stage';

interface LocalHotspot {
  id: string;
  x_norm: number;
  y_norm: number;
}
interface LocalTag {
  product_id: string;
  title: string;
  availability: SceneTag['availability'];
  eligible: boolean;
  hotspots: LocalHotspot[];
}

const fromScene = (tags: readonly SceneTag[]): LocalTag[] => tags.map((tag) => ({ product_id: tag.product_id, title: tag.title, availability: tag.availability, eligible: tag.eligible, hotspots: tag.hotspots.map((h) => ({ ...h })) }));
/** What the server would store: order, Product and coordinates. Ids and labels are not part of it. */
const shape = (tags: readonly { product_id: string; hotspots: readonly { x_norm: number; y_norm: number }[] }[]): string =>
  JSON.stringify(tags.map((tag) => [tag.product_id, tag.hotspots.map((h) => [h.x_norm, h.y_norm])]));

function Candidates({ tagged, onTag, editable }: { tagged: ReadonlySet<string>; onTag: (id: string, title: string, availability: SceneTag['availability']) => void; editable: boolean }) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const { state, retry } = useSellerQuery('scenes.tag_candidates.get', { query });
  return (
    <div className="stack">
      <h3 className="subhead">{t('scenes.find_title')}</h3>
      <form
        role="search"
        className="row search-row"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setQuery(draft);
        }}
      >
        <Field id="tag-search" label={t('scenes.find_label')}>
          {(control) => <input {...control} className="text-input" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} />}
        </Field>
        <button type="submit" className="btn btn-quiet">
          {t('products.search_submit')}
        </button>
      </form>
      {state.status === 'loading' ? <Skeleton rows={2} /> : null}
      {state.status === 'error' ? (
        <StatePanel kind="danger" alert title={t('scenes.find_error')} actions={<button type="button" className="btn btn-primary" onClick={retry}>{t('state.retry')}</button>}>
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'ready' && state.data.items.length === 0 ? <p className="empty">{t('scenes.find_empty')}</p> : null}
      {state.status === 'ready' && state.data.items.length > 0 ? (
        <ul className="ledger" aria-label={t('scenes.find_list_label')}>
          {state.data.items.map((c) => (
            <li key={c.id} className="ledger-row">
              <span className="ledger-main">
                <span className="ledger-title">{c.title}</span>
                <AvailabilityBadge availability={c.availability} />
                {!c.taggable ? <span className="ledger-meta">{t('scenes.find_not_taggable')}</span> : null}
              </span>
              {tagged.has(c.id) ? (
                <Badge tone="success" icon="check">
                  {t('scenes.find_tagged')}
                </Badge>
              ) : editable && c.taggable ? (
                <button type="button" className="btn btn-quiet" onClick={() => onTag(c.id, c.title, c.availability)}>
                  {t('scenes.find_tag', { title: c.title })}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Product tags and hotspots (SCN S23-S25, CON S61-S63). Tags are explicit relationships to the SAME Seller's published
 * Products (the server enforces ownership: a foreign id is just ineligible); order is independent of hotspot geometry; a
 * hotspot is an optional point on the image, normalised to its presentation. Edits are local until saved, in one command.
 */
export function SceneTagsSection({ scene, onChange, onReload, localImage }: SceneSectionProps) {
  const run = useSellerCommand();
  const action = useAction(true);
  const editable = canDo(scene, 'EDIT');
  const [tags, setTags] = useState<LocalTag[]>(() => fromScene(scene.tags));
  const [active, setActive] = useState<string | null>(scene.tags[0]?.product_id ?? null);
  const live = useMemo(() => new Map(scene.tags.map((tag) => [tag.product_id, tag] as const)), [scene.tags]);
  const dirty = shape(tags) !== shape(scene.tags);
  useDirty('tags', dirty);
  const tagged = useMemo(() => new Set(tags.map((tag) => tag.product_id)), [tags]);
  const image = scene.image;
  const src = imageSrc(scene, localImage);

  const activeTag = tags.find((tag) => tag.product_id === active) ?? null;
  const markers: Marker[] = tags.flatMap((tag) => tag.hotspots.map((h) => ({ id: h.id, title: tag.title, x_norm: h.x_norm, y_norm: h.y_norm, current: tag.product_id === active, n: 0 }))).map((m, i) => ({ ...m, n: i + 1 }));

  const edit = (productId: string, change: (h: LocalHotspot[]) => LocalHotspot[]) => setTags((prev) => prev.map((tag) => (tag.product_id === productId ? { ...tag, hotspots: change(tag.hotspots) } : tag)));
  const addHotspot = (p: Point) => {
    if (active) edit(active, (h) => [...h, { id: crypto.randomUUID(), ...p }]);
  };
  const moveHotspot = (id: string, p: Point) => setTags((prev) => prev.map((tag) => ({ ...tag, hotspots: tag.hotspots.map((h) => (h.id === id ? { ...h, ...p } : h)) })));
  const removeHotspot = (id: string) => setTags((prev) => prev.map((tag) => ({ ...tag, hotspots: tag.hotspots.filter((h) => h.id !== id) })));
  function tag(id: string, title: string, availability: SceneTag['availability']) {
    setTags((prev) => [...prev, { product_id: id, title, availability, eligible: true, hotspots: [] }]);
    setActive((a) => a ?? id);
  }
  function untag(id: string) {
    setTags((prev) => prev.filter((x) => x.product_id !== id));
    setActive((a) => (a === id ? (tags.find((x) => x.product_id !== id)?.product_id ?? null) : a));
  }
  function move(id: string, by: -1 | 1) {
    setTags((prev) => {
      const i = prev.findIndex((x) => x.product_id === id);
      const j = i + by;
      const a = prev[i];
      const b = prev[j];
      if (!a || !b) return prev;
      const next = [...prev];
      next[i] = b;
      next[j] = a;
      return next;
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() =>
      run('scenes.update', { scene_id: scene.id, version: scene.version, tags: tags.map((x) => ({ product_id: x.product_id, hotspots: x.hotspots.map((h) => ({ x_norm: h.x_norm, y_norm: h.y_norm })) })) }),
    );
    if (next) onChange(next);
  }

  return (
    <Section id="tags" title={t('scenes.tags_title')}>
      <p className="hint">{t('scenes.tags_hint')}</p>
      {editable ? (
        <div className="subsection-end">
          <Candidates tagged={tagged} editable={editable} onTag={tag} />
        </div>
      ) : null}
      <form onSubmit={(e) => void save(e)} noValidate className="stack">
        <ActionProblem action={action} onReload={onReload} />
        {tags.length === 0 ? (
          <p className="empty">{t('scenes.tags_empty')}</p>
        ) : (
          <ul className="ledger" aria-label={t('scenes.tags_list_label')}>
            {tags.map((tg, i) => {
              const current = live.get(tg.product_id);
              return (
                <li key={tg.product_id} className="ledger-row">
                  <span className="ledger-main">
                    <span className="ledger-title">{tg.title}</span>
                    <AvailabilityBadge availability={current?.availability ?? tg.availability} />
                    {current && !current.eligible ? <span className="ledger-meta">{t('scenes.tag_not_eligible')}</span> : null}
                    <span className="ledger-meta">{t('scenes.tag_hotspots', { count: tg.hotspots.length })}</span>
                  </span>
                  {editable ? (
                    <span className="actions">
                      <button type="button" className="btn btn-quiet" aria-disabled={i === 0} onClick={() => move(tg.product_id, -1)}>
                        {t('scenes.tag_up', { title: tg.title })}
                      </button>
                      <button type="button" className="btn btn-quiet" aria-disabled={i === tags.length - 1} onClick={() => move(tg.product_id, 1)}>
                        {t('scenes.tag_down', { title: tg.title })}
                      </button>
                      <button type="button" className="btn btn-quiet" onClick={() => untag(tg.product_id)}>
                        {t('scenes.tag_remove', { title: tg.title })}
                      </button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {editable && tags.length > 0 ? (
          <div id="hotspots" className="stack subsection">
            <h3 className="subhead">{t('scenes.hotspots_title')}</h3>
            {image === null ? (
              <p className="empty">{t('scenes.hotspots_need_image')}</p>
            ) : (
              <>
                <Group id="hotspot-target" legend={t('scenes.hotspots_for')} error={action.fields['hotspots']}>
                  {tags.map((tg) => (
                    <label key={tg.product_id} className="choice">
                      <input type="radio" name="hotspot_target" checked={active === tg.product_id} onChange={() => setActive(tg.product_id)} />
                      <span>{tg.title}</span>
                    </label>
                  ))}
                </Group>
                <p id="stage-help" className="hint">
                  {t('scenes.hotspots_help')}
                </p>
                <Stage
                  aspect={image.aspect}
                  imageName={image.file_name}
                  imageUrl={src.url}
                  measure={src.measure}
                  markers={markers}
                  placeLabel={activeTag ? t('scenes.place_for', { title: activeTag.title }) : undefined}
                  describedBy="stage-help"
                  onPlace={activeTag ? addHotspot : undefined}
                  onMove={moveHotspot}
                  onRemove={removeHotspot}
                />
                {activeTag ? (
                  <div className="stack">
                    {activeTag.hotspots.length === 0 ? <p className="empty">{t('scenes.hotspots_none', { title: activeTag.title })}</p> : null}
                    <ul className="plain-list" aria-label={t('scenes.hotspots_list_label', { title: activeTag.title })}>
                      {activeTag.hotspots.map((h, n) => (
                        <li key={h.id} className="stack">
                          <h4>{t('scenes.hotspot_n', { n: n + 1 })}</h4>
                          <Field id={`hx-${h.id}`} label={t('scenes.hotspot_x', { n: n + 1 })}>
                            {(control) => (
                              <input
                                {...control}
                                className="text-input"
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={toPercent(h.x_norm)}
                                onChange={(e) => {
                                  const v = fromPercent(e.target.value);
                                  if (v !== null) moveHotspot(h.id, { x_norm: v, y_norm: h.y_norm });
                                }}
                              />
                            )}
                          </Field>
                          <Field id={`hy-${h.id}`} label={t('scenes.hotspot_y', { n: n + 1 })}>
                            {(control) => (
                              <input
                                {...control}
                                className="text-input"
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={toPercent(h.y_norm)}
                                onChange={(e) => {
                                  const v = fromPercent(e.target.value);
                                  if (v !== null) moveHotspot(h.id, { x_norm: h.x_norm, y_norm: v });
                                }}
                              />
                            )}
                          </Field>
                          <div className="actions">
                            <button type="button" className="btn btn-quiet" onClick={() => removeHotspot(h.id)}>
                              {t('scenes.hotspot_remove', { n: n + 1 })}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="actions">
                      <button type="button" className="btn btn-quiet" onClick={() => addHotspot(CENTRE)}>
                        {t('scenes.hotspot_add', { title: activeTag.title })}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {editable ? (
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {action.busy ? t('editor.saving') : t('scenes.tags_save')}
            </button>
            <p role="status" className="hint">
              {dirty ? t('scenes.tags_unsaved') : ''}
            </p>
          </div>
        ) : null}
      </form>
    </Section>
  );
}
