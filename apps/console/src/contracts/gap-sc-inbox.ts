/**
 * PROVISIONAL fixture contract GAP-SC-15: the Seller Inbox (SC-FE-08). Same status as gap-sc.ts: NOT the API contract.
 * Sources: CHAT-01 v3.3 S1-S10 and S15 (with its 24 November amendment: messaging is live, commerce context deferred), CHATBOT-01 v3.3
 * S12-S22 and S77, CONSOLE-02 v4.3 S71-S82, AUTH-02 v3.3 (inbox permissions), PRV-01 v3.3 (message privacy).
 *
 * One Conversation per Buyer, Seller and Market. The Conversation carries no Product or Scene: context belongs to each MESSAGE and is
 * immutable after it is sent (CHAT S3-S4). A Scene is provenance; a Product is the subject. A Scene that is no longer public is shown as a
 * safe "unavailable" reference, never as newer private content (CHAT S4). Automated replies are labelled as automated and as provisional.
 *
 * Deliberately absent: model-generated reply text, an intent classifier, any "AI write reply", any stored reply-text or entitlement boolean,
 * Order context and Order timeline events, typing or presence, per-employee read receipts, and any retention figure (PRV: legal review).
 */

export type SenderKind = 'BUYER' | 'SELLER_TEAM' | 'AUTOMATED' | 'SYSTEM';
/** CHATBOT S17: WAITING_FOR_HUMAN is a thread that automation cannot serve and a team member must pick up. */
export type ThreadState = 'OPEN' | 'WAITING_FOR_HUMAN';

/**
 * A Scene as one Message referenced it (CHAT S4): the exact Scene and REVISION the Message was sent against, a bounded display snapshot
 * taken at send time (never re-read from the current Scene), and whether the Scene can be opened NOW (`available`, resolved on every
 * read). A Scene that is no longer public keeps its snapshot label and is shown as unavailable; its newer content is never exposed.
 */
export interface SceneReference {
  readonly ref: string;
  readonly revision: number;
  readonly label: string;
  readonly available: boolean;
}

/**
 * The ONE authoritative primary subject of a Message (CHAT S4, CHAT-INV-04), immutable after the server accepted it. The Product label is
 * the display snapshot taken at send time. ORDER is a subject kind in CHAT S4, but no real Order exists in the no-payment MVP (D24-01), so
 * this contract serves none.
 */
export type MessageSubject =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'PRODUCT'; readonly ref: string; readonly label: string }
  | ({ readonly kind: 'SCENE' } & SceneReference);

export interface Message {
  readonly id: string;
  readonly sender: SenderKind;
  /** The actual team member for a SELLER_TEAM message (CHAT S9), otherwise null. */
  readonly actor_label: string | null;
  /** Plain text only. The Console never renders message text as markup (CONSOLE-02 S152). */
  readonly body: string;
  readonly subject: MessageSubject;
  /** Provenance, only for a PRODUCT subject chosen from a Scene: the Scene is source context, never a competing subject (CHAT S4). */
  readonly source: SceneReference | null;
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
  /** Scenes of THIS Seller that are public now, each at its current revision. A private, draft, removed or restricted Scene is not newly selectable (CHAT S4). */
  readonly scenes: readonly { readonly id: string; readonly label: string; readonly revision: number }[];
  /** With no Scene: the Seller's full eligible catalogue. With a Scene: only the Products tagged in it (CHAT S5). */
  readonly products: readonly { readonly id: string; readonly label: string }[];
}

export interface InboxOperations {
  readonly 'inbox.list': { in: { cursor: string | null }; out: ConversationList };
  readonly 'inbox.thread.get': { in: { conversation_id: string }; out: ThreadView };
  readonly 'inbox.context.get': { in: { scene_id: string | null }; out: ContextOptions };
  /**
   * Idempotent. A lost response and a retry with the same key make one message (CHAT S15, S19). The server derives the one subject from the
   * selection (CHAT S5): Product (with the Scene as provenance when both are chosen), else Scene, else none. `scene_revision` is the revision
   * the composer offered; the Product must be tagged in THAT revision and the Scene must be public now. Field codes follow CHAT S15:
   * MESSAGE_EMPTY, MESSAGE_SCENE_POST_INVALID, MESSAGE_PRODUCT_POST_INVALID, MESSAGE_PRODUCT_NOT_IN_SCENE_POST, MESSAGE_CONTEXT_CONFLICT.
   */
  readonly 'inbox.reply.send': { in: { conversation_id: string; body: string; scene_id: string | null; scene_revision: number | null; product_id: string | null }; out: ThreadView };
  /**
   * Moves the shared Seller-side read mark forward to `last_read_message_id`, the highest Message the Console has actually shown (CHAT S10
   * high-water). Monotonic and idempotent: a lower mark changes nothing, and a Message that arrived after it stays unread.
   */
  readonly 'inbox.read.mark': { in: { conversation_id: string; last_read_message_id: string }; out: ConversationSummary };
}
