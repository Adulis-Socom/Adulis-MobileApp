import type { AutomationOverview, IntentRow, KnowledgeVersion, ReadinessGroup, ResolutionStep, SellerKnowledge, TemplateRef, TestResult } from '../contracts/gap-sc-automation';
import type { Availability } from '../contracts/gap-sc-catalogue';
import type { Catalogue } from './catalogue';
import { conflict, invalid, needCap, type Authz, type Handlers, type Kit } from './kit';

/**
 * Fixture scripted-assistance administration (GAP-SC-17, SC-FE-08 completion). DEVELOPMENT ONLY.
 *
 * PROVISIONAL DEMONSTRATION DIALOGUE: the three intents, their keywords and their templates below are placeholders so the administration screens
 * can be exercised. The dialogue catalogue is proposed commercial input awaiting approval; nothing here is an approved Buyer-facing answer.
 *
 * Deterministic only (CHATBOT S1-S3, 24 November amendment): exact keywords, then an immutable template version filled with typed slots from
 * their owners (stock from Inventory, policy from the Seller's knowledge), else a hand-over to a person. No model, no generated text, no learning.
 * Text that is not English goes to a person unread by the matcher (CHAT S8, CHATBOT S18). Test runs reach no Buyer and are not counted.
 * Permissions are the AUTH-02 canonical codes, as fixture capabilities: chatbot.read, chatbot.configure, chatbot.test, chatbot.analytics_read.
 */
type AutomationOps = 'automation.overview.get' | 'automation.knowledge.get' | 'automation.knowledge.save' | 'automation.test.options.get' | 'automation.test.run';
export interface Automation {
  readonly handlers: Handlers<AutomationOps>;
}

const TEXT_MAX = 500; // demonstration value: the real limits are the server's
const WINDOW_MAX_DAYS = 365; // demonstration value
const OWNED_ELSEWHERE = ['PRICE', 'STOCK', 'STORE_PROFILE', 'OPENING_HOURS', 'FULFILMENT'] as const;
const SAMPLES = ['Is this still available?', 'Can I return it if it does not fit?', 'Does it have a warranty?', 'Where are you located exactly?', '\u12ED\u1205 \u12A0\u1208?'];

interface IntentDef {
  readonly code: string;
  readonly label: string;
  readonly owner: IntentRow['owner'];
  readonly keywords: RegExp;
  readonly template: TemplateRef;
  readonly needsProduct: boolean;
}
const tpl = (key: string): TemplateRef => ({ key, version: 1, provisional: true });
const INTENTS: readonly IntentDef[] = [
  { code: 'PRODUCT_AVAILABILITY', label: 'Is this Product available?', owner: 'INVENTORY', keywords: /\b(available|in stock|stock|have it)\b/i, template: tpl('fx_tpl_availability'), needsProduct: true },
  { code: 'RETURNS_POLICY', label: 'Can I return or exchange it?', owner: 'SELLER_POLICY', keywords: /\b(return|returns|exchange)\b/i, template: tpl('fx_tpl_returns'), needsProduct: false },
  { code: 'WARRANTY_AFTER_SALES', label: 'Is there a warranty?', owner: 'SELLER_POLICY', keywords: /\b(warranty|guarantee|repair)\b/i, template: tpl('fx_tpl_warranty'), needsProduct: false },
];
const AVAILABILITY_WORDS: Readonly<Record<Availability, string>> = { AVAILABLE: 'available', LOW: 'available in small numbers', NOT_AVAILABLE: 'not available' };
/** Anything outside printable ASCII is treated as not English for this demonstration (the real language check is the server's). */
const NOT_ENGLISH = /[^ -~\s]/;

interface State {
  current: SellerKnowledge;
  history: KnowledgeVersion[];
}

export function createAutomation(kit: Kit, catalogue: Catalogue): Automation {
  const data = new Map<string, State>();
  const stateOf = (sellerId: string): State => {
    let s = data.get(sellerId);
    if (!s) {
      // Alem starts with returns configured and the warranty missing, so the missing-information state is visible.
      const seeded = sellerId === 'fx_seller_alem';
      s = {
        current: {
          version: 1,
          returns_acceptance: seeded ? 'ACCEPTED' : null,
          returns_window_days: seeded ? 7 : null,
          returns_conditions: seeded ? 'Unworn, with the label attached.' : '',
          warranty: '',
          guidance: '',
        },
        history: [{ version: 1, changed_at: kit.iso(kit.now() - 5 * 86_400_000), actor_label: 'Demonstration setup' }],
      };
      data.set(sellerId, s);
    }
    return s;
  };

  const actions = (a: Authz) => [...(a.caps.has('chatbot.configure') ? (['CONFIGURE'] as const) : []), ...(a.caps.has('chatbot.test') ? (['TEST'] as const) : [])];
  function missingFor(k: SellerKnowledge, code: string): string[] {
    if (code === 'RETURNS_POLICY') {
      if (k.returns_acceptance === null) return ['RETURNS_ACCEPTANCE'];
      return k.returns_acceptance === 'ACCEPTED' && k.returns_window_days === null ? ['RETURNS_WINDOW'] : [];
    }
    if (code === 'WARRANTY_AFTER_SALES') return k.warranty.trim() === '' ? ['WARRANTY'] : [];
    return [];
  }
  function readiness(k: SellerKnowledge): ReadinessGroup[] {
    const missing = [...missingFor(k, 'RETURNS_POLICY'), ...missingFor(k, 'WARRANTY_AFTER_SALES')];
    return [
      { code: 'SELLER_POLICY', state: missing.length === 0 ? 'COMPLETE' : 'INCOMPLETE', missing },
      // Per-category knowledge schemas depend on the taxonomy, which is submitted and not ratified: say so instead of inventing fields.
      { code: 'CATEGORY_KNOWLEDGE', state: 'NOT_DEFINED', missing: [] },
    ];
  }
  const view = (a: Authz, s: State) => ({ seller_id: a.sellerId, knowledge: s.current, owned_elsewhere: [...OWNED_ELSEWHERE], allowed_actions: actions(a) });

  function fill(code: string, k: SellerKnowledge, availability: Availability | null): string {
    if (code === 'PRODUCT_AVAILABILITY') return `This Product is ${AVAILABILITY_WORDS[availability ?? 'NOT_AVAILABLE']} right now.`;
    if (code === 'RETURNS_POLICY') {
      if (k.returns_acceptance === 'NOT_ACCEPTED') return 'This store does not accept returns or exchanges.';
      const conditions = k.returns_conditions.trim() === '' ? '' : ` ${k.returns_conditions.trim()}`;
      return `Returns and exchanges are accepted within ${String(k.returns_window_days)} days.${conditions}`;
    }
    return k.warranty.trim();
  }

  const handlers: Automation['handlers'] = {
    'automation.overview.get': (_input, ctx) => {
      const a = kit.authz(ctx);
      needCap(a, 'chatbot.read');
      const s = stateOf(a.sellerId);
      const intents: IntentRow[] = INTENTS.map((i) => {
        const missing = missingFor(s.current, i.code);
        return { code: i.code, label: i.label, owner: i.owner, coverage: missing.length === 0 ? 'READY' : 'MISSING_INFORMATION', missing, template: i.template };
      });
      const overview: AutomationOverview = {
        seller_id: a.sellerId,
        readiness: readiness(s.current),
        intents,
        history: [...s.history].reverse(),
        // Automated answering is not live in this release, so nothing has been counted: the figures are UNAVAILABLE, never zero.
        aggregates: a.caps.has('chatbot.analytics_read') ? { window_days: 30, handled: { state: 'UNAVAILABLE' }, escalated: { state: 'UNAVAILABLE' }, unmatched: null } : null,
        allowed_actions: actions(a),
      };
      return overview;
    },
    'automation.knowledge.get': (_input, ctx) => {
      const a = kit.authz(ctx);
      needCap(a, 'chatbot.read');
      return view(a, stateOf(a.sellerId));
    },
    'automation.knowledge.save': (input, ctx) => {
      const a = kit.authz(ctx);
      needCap(a, 'chatbot.configure');
      const s = stateOf(a.sellerId);
      if (input.version !== s.current.version) throw conflict();
      const errors: Record<string, string> = {};
      const accepted = input.returns_acceptance === 'ACCEPTED';
      const window = input.returns_window_days;
      if (accepted && (window === null || !Number.isInteger(window) || window < 1 || window > WINDOW_MAX_DAYS)) errors['returns_window_days'] = 'RETURNS_WINDOW_INVALID';
      for (const field of ['returns_conditions', 'warranty', 'guidance'] as const) if (input[field].length > TEXT_MAX) errors[field] = 'TEXT_TOO_LONG';
      if (Object.keys(errors).length > 0) throw invalid(errors);
      s.current = {
        version: s.current.version + 1,
        returns_acceptance: input.returns_acceptance,
        returns_window_days: accepted ? window : null,
        returns_conditions: accepted ? input.returns_conditions.trim() : '',
        warranty: input.warranty.trim(),
        guidance: input.guidance.trim(),
      };
      s.history.push({ version: s.current.version, changed_at: kit.iso(kit.now()), actor_label: a.isOwner ? 'Owner' : 'A team member' });
      return view(a, s);
    },
    'automation.test.options.get': (_input, ctx) => {
      const a = kit.authz(ctx);
      needCap(a, 'chatbot.test');
      return { seller_id: a.sellerId, sample_questions: SAMPLES, products: catalogue.facts(a.sellerId).filter((f) => f.state === 'PUBLISHED').map((f) => ({ id: f.id, label: f.title })) };
    },
    'automation.test.run': ({ question, product_id }, ctx) => {
      const a = kit.authz(ctx);
      needCap(a, 'chatbot.test');
      if (question.trim() === '') throw invalid({ question: 'QUESTION_REQUIRED' });
      const base = { seller_id: a.sellerId, test_only: true as const };
      const escalate = (path: ResolutionStep[], outcome: TestResult['outcome'], missing: string[] = [], intent: TestResult['intent'] = null): TestResult => ({
        ...base, outcome, intent, template: null, answer: null, missing, path: [...path, { layer: 'HUMAN_ESCALATION', detail: 'HANDED_TO_TEAM' }],
      });
      if (NOT_ENGLISH.test(question)) return escalate([{ layer: 'LANGUAGE_CHECK', detail: 'NOT_SUPPORTED_FOR_AUTOMATION' }], 'WAITING_FOR_HUMAN');
      const path: ResolutionStep[] = [{ layer: 'LANGUAGE_CHECK', detail: 'ENGLISH' }];
      const product = product_id === null ? null : (catalogue.fact(a.sellerId, product_id) ?? null);
      if (product_id !== null && (product === null || product.state !== 'PUBLISHED')) throw invalid({ product: 'MESSAGE_PRODUCT_POST_INVALID' });
      path.push({ layer: 'STRUCTURED_CONTEXT', detail: product ? 'PRODUCT_CHOSEN' : 'NO_PRODUCT' });
      const intent = INTENTS.find((i) => i.keywords.test(question));
      if (!intent) return escalate([...path, { layer: 'EXACT_KEYWORD', detail: 'NO_MATCH' }], 'NO_MATCH');
      path.push({ layer: 'EXACT_KEYWORD', detail: 'MATCHED' });
      const named = { code: intent.code, label: intent.label };
      // CHATBOT S13: a Product question with no Product chosen is never guessed.
      if (intent.needsProduct && !product) return escalate(path, 'MISSING_INFORMATION', ['PRODUCT_CONTEXT'], named);
      const k = stateOf(a.sellerId).current;
      const missing = missingFor(k, intent.code);
      if (missing.length > 0) return escalate([...path, { layer: 'SLOT', detail: 'SELLER_POLICY_MISSING' }], 'MISSING_INFORMATION', missing, named);
      path.push({ layer: 'TEMPLATE', detail: 'TEMPLATE_VERSION_RESOLVED' }, { layer: 'SLOT', detail: intent.owner === 'INVENTORY' ? 'FROM_INVENTORY' : 'FROM_SELLER_POLICY' });
      return { ...base, outcome: 'ANSWERED', intent: named, template: intent.template, answer: fill(intent.code, k, product?.availability ?? null), missing: [], path };
    },
  };
  return { handlers };
}
