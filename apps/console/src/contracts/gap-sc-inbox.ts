/**
 * PROVISIONAL fixture contract GAP-SC-15: the Seller Inbox (SC-FE-08). Same status as gap-sc.ts: NOT the API contract.
 * Sources: CHAT-01 v3.3 S1-S10 and S15, CHATBOT-01 v3.3 S12-S22 and S77, CONSOLE-02 v4.3 S71-S82, AUTH-02 v3.3 (inbox permissions),
 * PRV-01 v3.3 (message privacy). The 24 November chat amendment is not in the repository; nothing here relies on it.
 *
 * One Conversation per Buyer, Seller and Market. The Conversation carries no Product or Scene: context belongs to each MESSAGE and is
 * immutable after it is sent (CHAT S3-S4). A Scene is provenance; a Product is the subject. A Scene that is no longer public is shown as a
 * safe "unavailable" reference, never as newer private content (CHAT S4). Automated replies are labelled as automated and as provisional.
 *
 * Deliberately absent: model-generated reply text, an intent classifier, any "AI write reply", any stored reply-text or entitlement boolean,
 * Order context and Order timeline events, typing or presence, per-employee read receipts, and any retention figure (PRV: legal review).
 */

export type SenderKind = 'BUYER' | 'SELLER_TEAM' | 'AUTOMATED' | 'SYSTEM';
export type ContextKind = 'NONE' | 'PRODUCT' | 'SCENE' | 'PRODUCT_IN_SCENE';
/** CHATBOT S17: WAITING_FOR_HUMAN is a thread that automation cannot serve and a team member must pick up. */
export type ThreadState = 'OPEN' | 'WAITING_FOR_HUMAN';

export interface MessageContext {
  readonly kind: ContextKind;
  readonly product: { readonly id: string; readonly label: string } | null;
  /** The Scene as it was when the message was sent. `available: false` means it can no longer be shown; the label is the safe snapshot. */
  readonly scene: { readonly id: string; readonly label: string; readonly available: boolean } | null;
}

export interface Message {
  readonly id: string;
  readonly sender: SenderKind;
  /** The actual team member for a SELLER_TEAM message (CHAT S9), otherwise null. */
  readonly actor_label: string | null;
  /** Plain text only. The Console never renders message text as markup (CONSOLE-02 S152). */
  readonly body: string;
  readonly context: MessageContext;
  readonly sent_at: string;
  /** Present only on an AUTOMATED message. `provisional` is always true in this contract: no dialogue is approved yet. */
  readonly automation: { readonly template_label: string; readonly provisional: true } | null;
}

export interface ConversationSummary {
  readonly id: string;
  readonly buyer_label: string;
  /** A bounded excerpt chosen by the server. The Console never builds one. */
  readonly preview: string;
  readonly last_sender: SenderKind;
  readonly last_at: string;
  readonly unread_count: number;
  readonly state: ThreadState;
}

export interface ConversationList {
  readonly seller_id: string;
  readonly items: readonly ConversationSummary[];
  readonly next_cursor: string | null;
}

export interface ThreadView {
  readonly seller_id: string;
  readonly id: string;
  readonly buyer_label: string;
  readonly state: ThreadState;
  /** Monotonic: a late, older answer never replaces a newer acknowledged one. */
  readonly version: number;
  readonly messages: readonly Message[];
  /** What this account may do here, resolved by the server. A role that can read but not reply gets no REPLY. */
  readonly allowed_actions: readonly 'REPLY'[];
}

export interface ContextOptions {
  readonly seller_id: string;
  /** Scenes of THIS Seller that are public now. A private, draft, removed or restricted Scene is not newly selectable (CHAT S4). */
  readonly scenes: readonly { readonly id: string; readonly label: string }[];
  /** With no Scene: the Seller's full eligible catalogue. With a Scene: only the Products tagged in it (CHAT S5). */
  readonly products: readonly { readonly id: string; readonly label: string }[];
}

export interface InboxOperations {
  readonly 'inbox.list': { in: { cursor: string | null }; out: ConversationList };
  readonly 'inbox.thread.get': { in: { conversation_id: string }; out: ThreadView };
  readonly 'inbox.context.get': { in: { scene_id: string | null }; out: ContextOptions };
  /** Idempotent. A lost response and a retry with the same key make one message (CHAT S15, S19). */
  readonly 'inbox.reply.send': { in: { conversation_id: string; body: string; scene_id: string | null; product_id: string | null }; out: ThreadView };
  /** Moves the Seller-side read mark forward. One shared mark per thread, monotonic (CHAT S10). */
  readonly 'inbox.read.mark': { in: { conversation_id: string }; out: ConversationSummary };
}
