import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import type { AutomationOverview, KnowledgeView, ReturnsAcceptance, TestResult } from '../../contracts/gap-sc-automation';
import { Badge } from '../../components/Badge';
import { Field, Group } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant, label, t } from '../../i18n/t';
import { can, sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { Section } from '../products/Section';
import { ActionProblem } from '../shared/ActionProblem';
import { DirtyProvider, UnsavedNote, useDirty } from '../shared/dirty';
import { useAction } from '../shared/useAction';
import { NoPermission } from '../unavailable/Gate';
import { MetricValue } from '../../components/MetricValue';

/**
 * Scripted assistance administration (SC-FE-08 completion; CONSOLE-02 S76-S82, CHATBOT-01 v3.3). Route `inbox/automation` from the SC-FE-00 route map,
 * gated by the AUTH-02 chatbot capabilities and NOT by the Inbox destination: configuration never implies Inbox access (CONSOLE S76), so a Campaign
 * Manager can configure without seeing a conversation. Everything here is deterministic: platform-managed intents, versioned templates, Seller
 * knowledge for facts no other domain owns, and a test simulator that reaches no Buyer. The dialogue is a provisional demonstration, labelled so.
 */
function Failed({ title, retry }: { title: string; retry: () => void }) {
  return (
    <StatePanel kind="danger" alert title={title} actions={<button type="button" className="btn btn-primary" onClick={retry}>{t('state.retry')}</button>}>
      <p>{t('state.transport_error_body')}</p>
    </StatePanel>
  );
}

/** Route guard: a capability the server listed, else the same denial as a hidden destination. */
export function AutomationGate({ capability, children }: { capability: string; children: ReactNode }) {
  const { access } = useSeller();
  return can(access, capability) ? <>{children}</> : <NoPermission />;
}

function AutomationNav() {
  const { sellerId, access } = useSeller();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = sellerPath(sellerId, 'inbox/automation');
  const parts = [
    { path: '', label: t('auto.nav_overview'), end: true },
    { path: 'knowledge', label: t('auto.nav_knowledge') },
    ...(can(access, 'chatbot.test') ? [{ path: 'test', label: t('auto.nav_test') }] : []),
  ];
  const here = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, '') : '';
  const to = (path: string) => (path === '' ? base : `${base}/${path}`);
  return (
    <>
      <nav aria-label={t('auto.nav_label')} className="actions subnav-wide">
        {parts.map((p) => (
          <NavLink key={p.path} className="btn btn-quiet" to={to(p.path)} end={p.end ?? false}>
            {p.label}
          </NavLink>
        ))}
      </nav>
      <div className="subnav-narrow">
        <label htmlFor="auto-section">{t('auto.nav_picker')}</label>
        <select id="auto-section" className="text-input" value={here} onChange={(e) => void navigate(to(e.target.value))}>
          {parts.map((p) => (
            <option key={p.path} value={p.path}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export function AutomationLayout() {
  return (
    <AutomationGate capability="chatbot.read">
      <PageTitle title={t('auto.title')}>{t('auto.title')}</PageTitle>
      <p className="lead">{t('auto.lead')}</p>
      <p className="notice">
        <Icon name="info" />
        <span>{t('auto.provisional')}</span>
      </p>
      <AutomationNav />
      <Outlet />
    </AutomationGate>
  );
}

function Readiness({ overview }: { overview: AutomationOverview }) {
  const { sellerId } = useSeller();
  return (
    <Section id="readiness" title={t('auto.readiness_title')}>
      <p className="hint">{t('auto.readiness_note')}</p>
      <ul className="ledger">
        {overview.readiness.map((g) => (
          <li key={g.code} className="ledger-row">
            <div className="stack">
              <div className="row-start">
                <strong>{label('auto.group', g.code)}</strong>
                <Badge tone={g.state === 'COMPLETE' ? 'success' : g.state === 'INCOMPLETE' ? 'warn' : 'neutral'} icon={g.state === 'COMPLETE' ? 'check' : g.state === 'INCOMPLETE' ? 'alert' : 'info'}>
                  {label('auto.state', g.state)}
                </Badge>
              </div>
              {g.state === 'NOT_DEFINED' ? <p className="hint">{t('auto.not_defined_note')}</p> : null}
              {g.missing.length > 0 ? (
                <ul>
                  {g.missing.map((m) => (
                    <li key={m}>{label('auto.missing', m)}</li>
                  ))}
                </ul>
              ) : null}
              {g.missing.length > 0 && overview.allowed_actions.includes('CONFIGURE') ? (
                <p>
                  <Link to={sellerPath(sellerId, 'inbox/automation/knowledge')}>{t('auto.fill_link')}</Link>
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function AutomationOverviewPage() {
  const { state, retry } = useSellerQuery('automation.overview.get', {});
  const market = useSellerQuery('market.context.get', {});
  const timezone = market.state.status === 'ready' ? market.state.data.timezone : undefined;
  if (state.status === 'loading') return <Skeleton rows={6} />;
  if (state.status === 'error') return <Failed title={t('auto.error_title')} retry={retry} />;
  const o = state.data;
  return (
    <>
      <Readiness overview={o} />
      <Section id="intents" title={t('auto.intents_title')}>
        <p className="hint">{t('auto.intents_note')}</p>
        <ul className="ledger">
          {o.intents.map((i) => (
            <li key={i.code} className="ledger-row">
              <div className="stack">
                <div className="row-start">
                  <strong>{i.label}</strong>
                  <Badge tone={i.coverage === 'READY' ? 'success' : 'warn'} icon={i.coverage === 'READY' ? 'check' : 'alert'}>
                    {label('auto.coverage', i.coverage)}
                  </Badge>
                </div>
                <p className="ledger-meta">{label('auto.owner', i.owner)}</p>
                <p className="ledger-meta">{t('auto.intent_template', { key: i.template.key, version: String(i.template.version) })}</p>
                {i.missing.map((m) => (
                  <p key={m} className="hint">
                    {label('auto.missing', m)}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Section>
      {o.aggregates ? (
        <Section id="activity" title={t('auto.activity_title', { days: String(o.aggregates.window_days) })}>
          <dl className="facts">
            <dt>{t('auto.metric_handled')}</dt>
            <dd>
              <MetricValue metric={o.aggregates.handled} />
            </dd>
            <dt>{t('auto.metric_escalated')}</dt>
            <dd>
              <MetricValue metric={o.aggregates.escalated} />
            </dd>
          </dl>
          <h3>{t('auto.unmatched_title')}</h3>
          {o.aggregates.unmatched === null ? (
            <p className="hint">{t('metric.UNAVAILABLE')}</p>
          ) : o.aggregates.unmatched.length === 0 ? (
            <p className="hint">{t('auto.unmatched_empty')}</p>
          ) : (
            <ul>
              {o.aggregates.unmatched.map((u) => (
                <li key={u.text}>{t('auto.unmatched_row', { text: u.text, count: String(u.count) })}</li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
      <Section id="history" title={t('auto.history_title')}>
        <p className="hint">{t('auto.history_note')}</p>
        <ol className="plain-list stack">
          {o.history.map((h) => (
            <li key={h.version}>{t('auto.history_row', { version: String(h.version), time: formatInstant(h.changed_at, timezone), actor: h.actor_label })}</li>
          ))}
        </ol>
      </Section>
    </>
  );
}

function KnowledgeForm({ initial, onSaved, onReload }: { initial: KnowledgeView; onSaved: (next: KnowledgeView) => void; onReload: () => void }) {
  const run = useSellerCommand();
  const action = useAction(true);
  const k = initial.knowledge;
  const editable = initial.allowed_actions.includes('CONFIGURE');
  const [acceptance, setAcceptance] = useState<ReturnsAcceptance | null>(k.returns_acceptance);
  const [windowDays, setWindowDays] = useState(k.returns_window_days === null ? '' : String(k.returns_window_days));
  const [conditions, setConditions] = useState(k.returns_conditions);
  const [warranty, setWarranty] = useState(k.warranty);
  const [guidance, setGuidance] = useState(k.guidance);
  const dirty =
    acceptance !== k.returns_acceptance ||
    windowDays !== (k.returns_window_days === null ? '' : String(k.returns_window_days)) ||
    conditions !== k.returns_conditions ||
    warranty !== k.warranty ||
    guidance !== k.guidance;
  useDirty('knowledge', editable && dirty);

  async function save(event: FormEvent) {
    event.preventDefault();
    const accepted = acceptance === 'ACCEPTED';
    // Only a whole number is sent; anything else is refused here with the same message the server would give.
    const days = windowDays.trim() === '' ? null : /^\d+$/.test(windowDays.trim()) ? Number(windowDays.trim()) : NaN;
    if (accepted && (days === null || Number.isNaN(days))) {
      action.fail({ returns_window_days: 'RETURNS_WINDOW_INVALID' });
      return;
    }
    const next = await action.run(() =>
      run('automation.knowledge.save', {
        version: k.version,
        returns_acceptance: acceptance,
        returns_window_days: accepted ? days : null,
        returns_conditions: accepted ? conditions : '',
        warranty,
        guidance,
      }),
    );
    if (next) onSaved(next);
  }

  if (!editable) {
    return (
      <Section id="knowledge" title={t('auto.knowledge_title')}>
        <p className="hint">{t('auto.read_only')}</p>
        <dl className="facts">
          <dt>{t('auto.returns_legend')}</dt>
          <dd>{k.returns_acceptance === null ? t('auto.not_given') : label('auto.returns', k.returns_acceptance)}</dd>
          {k.returns_window_days !== null ? (
            <>
              <dt>{t('auto.returns_window')}</dt>
              <dd>{t('auto.days', { n: String(k.returns_window_days) })}</dd>
            </>
          ) : null}
          <dt>{t('auto.warranty')}</dt>
          <dd>{k.warranty === '' ? t('auto.not_given') : k.warranty}</dd>
          <dt>{t('auto.guidance')}</dt>
          <dd>{k.guidance === '' ? t('auto.not_given') : k.guidance}</dd>
        </dl>
      </Section>
    );
  }
  return (
    <form onSubmit={(e) => void save(e)} noValidate className="stack panel" aria-labelledby="knowledge-h">
      <h2 id="knowledge-h">{t('auto.knowledge_title')}</h2>
      <ActionProblem action={action} onReload={onReload} />
      <Group id="returns_acceptance" legend={t('auto.returns_legend')} error={action.fields['returns_acceptance']}>
        {(['ACCEPTED', 'NOT_ACCEPTED'] as const).map((v) => (
          <label key={v} className="choice">
            <input type="radio" name="returns_acceptance" value={v} checked={acceptance === v} onChange={() => setAcceptance(v)} />
            <span>{label('auto.returns', v)}</span>
          </label>
        ))}
      </Group>
      {acceptance === 'ACCEPTED' ? (
        <>
          <Field id="returns_window_days" label={t('auto.returns_window')} hint={t('auto.returns_window_hint')} error={action.fields['returns_window_days']}>
            {(control) => <input {...control} className="text-input" inputMode="numeric" value={windowDays} onChange={(e) => setWindowDays(e.target.value)} />}
          </Field>
          <Field id="returns_conditions" label={t('auto.returns_conditions')} hint={t('auto.text_hint')} error={action.fields['returns_conditions']}>
            {(control) => <textarea {...control} className="text-input" rows={3} value={conditions} onChange={(e) => setConditions(e.target.value)} />}
          </Field>
        </>
      ) : null}
      <Field id="warranty" label={t('auto.warranty')} hint={t('auto.text_hint')} error={action.fields['warranty']}>
        {(control) => <textarea {...control} className="text-input" rows={3} value={warranty} onChange={(e) => setWarranty(e.target.value)} />}
      </Field>
      <Field id="guidance" label={t('auto.guidance')} hint={t('auto.guidance_hint')} error={action.fields['guidance']}>
        {(control) => <textarea {...control} className="text-input" rows={3} value={guidance} onChange={(e) => setGuidance(e.target.value)} />}
      </Field>
      <p className="hint">{t('auto.version_note', { version: String(k.version) })}</p>
      <div className="actions">
        <button type="submit" className="btn btn-highlight" aria-disabled={action.busy}>
          {action.busy ? t('editor.saving') : t('auto.save')}
        </button>
      </div>
    </form>
  );
}

export function AutomationKnowledgePage() {
  const { state, retry } = useSellerQuery('automation.knowledge.get', {});
  const [saved, setSaved] = useState<KnowledgeView | null>(null);
  if (state.status === 'loading') return <Skeleton rows={6} />;
  if (state.status === 'error') return <Failed title={t('auto.error_title')} retry={retry} />;
  // The answer to a save is adopted only while it is the newer version (a refresh never rolls a save back).
  const view = saved && saved.knowledge.version >= state.data.knowledge.version ? saved : state.data;
  return (
    <DirtyProvider>
      <UnsavedNote />
      <p className="lead">{t('auto.knowledge_lead')}</p>
      <Section id="owned" title={t('auto.owned_title')}>
        <ul>
          {view.owned_elsewhere.map((o) => (
            <li key={o}>{label('auto.owned', o)}</li>
          ))}
        </ul>
      </Section>
      <KnowledgeForm
        key={view.knowledge.version}
        initial={view}
        onSaved={setSaved}
        onReload={() => {
          setSaved(null);
          retry();
        }}
      />
    </DirtyProvider>
  );
}

function Result({ result }: { result: TestResult }) {
  return (
    <section className="panel stack" aria-labelledby="result-h" aria-live="polite">
      <h2 id="result-h">{t('auto.result_title')}</h2>
      <p className="notice">
        <Icon name="info" />
        <span>{t('auto.test_only')}</span>
      </p>
      <dl className="facts">
        <dt>{t('auto.result_outcome')}</dt>
        <dd>{label('auto.outcome', result.outcome)}</dd>
        <dt>{t('auto.result_intent')}</dt>
        <dd>{result.intent ? result.intent.label : t('auto.result_no_intent')}</dd>
        <dt>{t('auto.result_template')}</dt>
        <dd>{result.template ? t('auto.intent_template', { key: result.template.key, version: String(result.template.version) }) : t('auto.result_no_template')}</dd>
        <dt>{t('auto.result_answer')}</dt>
        <dd>{result.answer ?? t('auto.result_no_answer')}</dd>
      </dl>
      {result.missing.length > 0 ? (
        <ul>
          {result.missing.map((m) => (
            <li key={m}>{label('auto.missing', m)}</li>
          ))}
        </ul>
      ) : null}
      <h3>{t('auto.result_path')}</h3>
      <ol>
        {result.path.map((step, n) => (
          <li key={`${step.layer}-${String(n)}`}>
            {t('auto.step', { layer: label('auto.layer', step.layer), detail: label('auto.detail', step.detail) })}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AutomationTestPage() {
  const options = useSellerQuery('automation.test.options.get', {});
  const run = useSellerCommand();
  const action = useAction();
  const [question, setQuestion] = useState('');
  const [productId, setProductId] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  // A changed question or Product makes an earlier result describe something else: drop it rather than leave it beside the new input.
  useEffect(() => setResult(null), [question, productId]);

  async function test(event: FormEvent) {
    event.preventDefault();
    if (question.trim() === '') {
      action.fail({ question: 'QUESTION_REQUIRED' });
      return;
    }
    const next = await action.run(() => run('automation.test.run', { question, product_id: productId === '' ? null : productId }));
    if (next) setResult(next);
  }

  if (options.state.status === 'loading') return <Skeleton rows={4} />;
  if (options.state.status === 'error') return <Failed title={t('auto.error_title')} retry={options.retry} />;
  const o = options.state.data;
  return (
    <>
      <form onSubmit={(e) => void test(e)} noValidate className="stack panel" aria-labelledby="test-h">
        <h2 id="test-h">{t('auto.test_title')}</h2>
        <p className="hint">{t('auto.test_lead')}</p>
        <ActionProblem action={action} />
        <Field id="question" label={t('auto.question')} hint={t('auto.question_hint')} error={action.fields['question']}>
          {(control) => <input {...control} className="text-input" value={question} onChange={(e) => setQuestion(e.target.value)} />}
        </Field>
        <div className="actions">
          {o.sample_questions.map((q) => (
            <button key={q} type="button" className="btn btn-quiet" onClick={() => setQuestion(q)}>
              {t('auto.try', { question: q })}
            </button>
          ))}
        </div>
        <Field id="product" label={t('auto.product')} hint={t('auto.product_hint')} error={action.fields['product']}>
          {(control) => (
            <select {...control} className="text-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">{t('auto.product_none')}</option>
              {o.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="actions">
          <button type="submit" className="btn btn-highlight" aria-disabled={action.busy}>
            {t('auto.run')}
          </button>
        </div>
      </form>
      {result ? <Result result={result} /> : null}
    </>
  );
}

/** The Knowledge page needs no capability beyond reading; testing needs seller.chatbot:test. */
export function AutomationTestRoute() {
  return (
    <AutomationGate capability="chatbot.test">
      <AutomationTestPage />
    </AutomationGate>
  );
}
