import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SceneSummary, SceneTab } from '../../contracts/gap-sc-content';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { label, t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { ContentNav } from './ContentNav';
import { PrivateReason, SceneBadges } from './sceneBadges';

/** The content-list tabs of CONSOLE-02 S59, in that order. */
const TABS: readonly SceneTab[] = ['ALL', 'DRAFT', 'PUBLIC', 'PRIVATE', 'ARCHIVED', 'RESTRICTED'];

function Card({ scene, sellerId }: { scene: SceneSummary; sellerId: string }) {
  return (
    <li>
      <Link className="ledger-link" to={sellerPath(sellerId, `content/scenes/${scene.id}`)}>
        <span className="ledger-main">
          <span className="ledger-title">{scene.caption_preview.trim() === '' ? t('scenes.no_caption') : scene.caption_preview}</span>
          <SceneBadges publication={scene.publication_state} visibility={scene.visibility} moderation={scene.moderation} />
          {scene.publication_state === 'PUBLISHED' && scene.visibility === 'PRIVATE' ? <PrivateReason reason={scene.private_reason} /> : null}
          <span className="ledger-meta">{t('scenes.tag_count', { count: scene.tag_count })}</span>
          <span className="ledger-meta">{t('scenes.available_tag_count', { count: scene.available_tag_count })}</span>
        </span>
      </Link>
    </li>
  );
}

/** Scenes (CONSOLE-02 S58-S59): a tabbed, cursor-paginated inventory. Lifecycle, visibility and moderation stay separate marks. */
export function Scenes() {
  const { sellerId } = useSeller();
  const navigate = useNavigate();
  const run = useSellerCommand();
  const create = useAction();
  const [tab, setTab] = useState<SceneTab>('ALL');
  const [cursor, setCursor] = useState<string | null>(null);
  const [earlier, setEarlier] = useState<readonly SceneSummary[]>([]);
  const { state, retry } = useSellerQuery('scenes.list', { tab, cursor });

  const current = state.status === 'ready' && !state.refreshing ? state.data : null;
  const shown = current ? [...earlier, ...current.items] : earlier;
  const canCreate = state.status === 'ready' && state.data.allowed_actions.includes('CREATE');

  function pick(next: SceneTab) {
    setEarlier([]);
    setCursor(null);
    setTab(next);
  }
  function more() {
    if (!current?.next_cursor) return;
    setEarlier(shown);
    setCursor(current.next_cursor);
  }
  async function add() {
    await create.run(async () => {
      const scene = await run('scenes.create', {});
      void navigate(sellerPath(sellerId, `content/scenes/${scene.id}`));
    });
  }

  return (
    <>
      <PageTitle title={t('scenes.title')}>{t('scenes.title')}</PageTitle>
      <p className="lead">{t('scenes.lead')}</p>
      <ContentNav />
      <div role="group" aria-label={t('scenes.tabs_label')} className="actions">
        {TABS.map((id) => (
          <button key={id} type="button" className="btn btn-quiet" aria-pressed={tab === id} onClick={() => pick(id)}>
            {label('scenes.tab', id)}
          </button>
        ))}
      </div>
      {canCreate ? (
        <div className="actions">
          <button type="button" className="btn btn-highlight" aria-disabled={create.busy} onClick={() => void add()}>
            {t('scenes.add')}
          </button>
        </div>
      ) : null}
      <ActionProblem action={create} />
      {state.status === 'error' ? (
        <StatePanel
          kind="danger"
          alert
          title={t('scenes.error_title')}
          actions={
            <button type="button" className="btn btn-primary" onClick={retry}>
              {t('state.retry')}
            </button>
          }
        >
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'loading' || (state.status === 'ready' && state.refreshing && shown.length === 0) ? <Skeleton rows={4} /> : null}
      {current && shown.length === 0 ? <StatePanel kind="neutral" title={tab === 'ALL' ? t('scenes.empty') : t('scenes.empty_tab')} /> : null}
      {shown.length > 0 ? (
        <ul className="ledger" aria-label={t('scenes.list_label')} aria-busy={state.status === 'ready' && state.refreshing}>
          {shown.map((s) => (
            <Card key={s.id} scene={s} sellerId={sellerId} />
          ))}
        </ul>
      ) : null}
      {current?.next_cursor ? (
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={more}>
            {t('scenes.more')}
          </button>
        </div>
      ) : null}
    </>
  );
}
