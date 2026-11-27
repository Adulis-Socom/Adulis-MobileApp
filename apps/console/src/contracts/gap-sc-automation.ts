import type { Metric } from './gap-sc-metrics';

/**
 * PROVISIONAL fixture contract GAP-SC-17: scripted-assistance administration (SC-FE-08 completion). Same status as gap-sc.ts: NOT the API contract.
 * Sources: CHATBOT-01 v3.3 S1-S3, S21-S42, S68-S81, S95-S98 with its 24 November amendment (only approved deterministic or basic Seller help
 * configuration; no AI merchant adviser; no payment affirmation); CONSOLE-02 v4.3 S76-S82; AUTH-02 v3.3 Appendix B and C (seller.chatbot:read,
 * :configure, :test, :analytics_read are the canonical codes; CHATBOT S95 names are not aliases); KB S52 (quotas and plan limits are OPEN).
 *
 * Every intent and template here is a PROVISIONAL demonstration: the dialogue catalogue is proposed commercial input, not approved authority.
 * Intents are platform-managed; a Seller cannot create, rename or retrain one. Seller knowledge covers only facts no other domain owns: it can
 * never override price, stock, Store details, opening hours or fulfilment, which the answer reads from their owners. Nothing here generates
 * text: an answer is an approved template filled with typed slots, or it is a hand-over to a person.
 *
 * Deliberately absent: an automation on/off switch (no state names are defined, CHATBOT gap), a feedback-submission action (no AUTH-02 code
 * exists for it), quotas, plan limits, model or prompt settings, and any learning from Seller feedback.
 */
export interface TemplateRef {
  readonly key: string;
  /** Immutable once used (CHATBOT S30): a changed template is a new version. */
  readonly version: number;
  readonly provisional: true;
}

/** Who owns the fact an intent's answer is filled from (CHATBOT S29 slot resolver). */
export type SlotOwner = 'INVENTORY' | 'SELLER_POLICY';
export type IntentCoverage = 'READY' | 'MISSING_INFORMATION';

export interface IntentRow {
  readonly code: string;
  readonly label: string;
  readonly owner: SlotOwner;
  readonly coverage: IntentCoverage;
  /** Knowledge field codes that must be filled before this intent can answer. */
  readonly missing: readonly string[];
  readonly template: TemplateRef;
}

/** CHATBOT S78: readiness is explainable, never a score. NOT_DEFINED: the platform has not defined that knowledge yet (taxonomy unratified). */
export type ReadinessState = 'COMPLETE' | 'INCOMPLETE' | 'NOT_DEFINED';
export interface ReadinessGroup {
  readonly code: 'SELLER_POLICY' | 'CATEGORY_KNOWLEDGE';
  readonly state: ReadinessState;
  readonly missing: readonly string[];
}

export interface KnowledgeVersion {
  readonly version: number;
  readonly changed_at: string;
  readonly actor_label: string;
}

export interface AutomationAggregates {
  readonly window_days: number;
  readonly handled: Metric;
  readonly escalated: Metric;
  /** Identity-stripped unanswered questions with counts (CONSOLE S82). Null when the figure is not available at all. */
  readonly unmatched: readonly { readonly text: string; readonly count: number }[] | null;
}

export type AutomationAction = 'CONFIGURE' | 'TEST';

export interface AutomationOverview {
  readonly seller_id: string;
  readonly readiness: readonly ReadinessGroup[];
  readonly intents: readonly IntentRow[];
  readonly history: readonly KnowledgeVersion[];
  /** Null for a role without seller.chatbot:analytics_read: the section is not shown, not shown empty. */
  readonly aggregates: AutomationAggregates | null;
  readonly allowed_actions: readonly AutomationAction[];
}

export type ReturnsAcceptance = 'ACCEPTED' | 'NOT_ACCEPTED';
export interface SellerKnowledge {
  readonly version: number;
  readonly returns_acceptance: ReturnsAcceptance | null;
  readonly returns_window_days: number | null;
  readonly returns_conditions: string;
  readonly warranty: string;
  readonly guidance: string;
}
/** Facts the answers read from their owners and that this page never asks for (CHATBOT S32-S33). */
export type OwnedElsewhere = 'PRICE' | 'STOCK' | 'STORE_PROFILE' | 'OPENING_HOURS' | 'FULFILMENT';
export interface KnowledgeView {
  readonly seller_id: string;
  readonly knowledge: SellerKnowledge;
  readonly owned_elsewhere: readonly OwnedElsewhere[];
  readonly allowed_actions: readonly AutomationAction[];
}

export type TestOutcome = 'ANSWERED' | 'MISSING_INFORMATION' | 'NO_MATCH' | 'WAITING_FOR_HUMAN';
export type ResolutionLayer = 'LANGUAGE_CHECK' | 'STRUCTURED_CONTEXT' | 'EXACT_KEYWORD' | 'TEMPLATE' | 'SLOT' | 'HUMAN_ESCALATION';
export interface ResolutionStep {
  readonly layer: ResolutionLayer;
  /** A code explaining the step, shown through the catalogue; never free text. */
  readonly detail: string;
}
export interface TestResult {
  readonly seller_id: string;
  /** Always true: test traffic is excluded from every metric and reaches no Buyer (CHATBOT S96). */
  readonly test_only: true;
  readonly outcome: TestOutcome;
  readonly intent: { readonly code: string; readonly label: string } | null;
  readonly template: TemplateRef | null;
  /** The filled template, or null when nothing would be sent automatically. */
  readonly answer: string | null;
  readonly missing: readonly string[];
  readonly path: readonly ResolutionStep[];
}
export interface TestOptions {
  readonly seller_id: string;
  readonly sample_questions: readonly string[];
  readonly products: readonly { readonly id: string; readonly label: string }[];
}

export interface AutomationOperations {
  readonly 'automation.overview.get': { in: Record<string, never>; out: AutomationOverview };
  readonly 'automation.knowledge.get': { in: Record<string, never>; out: KnowledgeView };
  /** Creates a new knowledge version; a stale `version` is a CONFLICT. Earlier versions stay as history (CHATBOT S41). */
  readonly 'automation.knowledge.save': {
    in: { version: number; returns_acceptance: ReturnsAcceptance | null; returns_window_days: number | null; returns_conditions: string; warranty: string; guidance: string };
    out: KnowledgeView;
  };
  readonly 'automation.test.options.get': { in: Record<string, never>; out: TestOptions };
  /** Deterministic and non-production (CHATBOT S71, S96): nothing is sent, stored as a conversation or counted. */
  readonly 'automation.test.run': { in: { question: string; product_id: string | null }; out: TestResult };
}
