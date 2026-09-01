/**
 * features/conversation/types.ts -- LOCAL transcriptions of chat.service.ts's
 * wire shapes (the D-98 class; deleted the day the contract carries schemas).
 *
 * THE SELLER LIST ROW IS FOUR FIELDS. No buyer name (the D-153 class -- the
 * buyer arm gets store_name+handle; the seller arm gets a bare account uuid),
 * no last-message preview, no unread marker, no linked order, and the DB
 * view's unanswered_count is never selected. Every one of those is what the
 * wireframe drew and the wire cannot carry -- named on SC-20 and registered.
 */
export interface ConversationRow {
  readonly id: string;
  readonly buyer_account_id: string;
  readonly started_at: string;
  readonly last_message_at: string;
}
export interface ConversationPage {
  readonly data: readonly ConversationRow[];
  readonly next_cursor: string | null;
}

/** A human message row; BOT rows carry template_key instead of body. */
export interface MessageRow {
  readonly id: string;
  readonly sender_kind: 'BUYER' | 'SELLER' | 'TEAM_MEMBER' | 'BOT';
  readonly body?: string;
  readonly template_key?: string;
  readonly slots?: Record<string, unknown>;
  readonly resolution_path?: string;
  readonly locale?: string;
  readonly sent_at: string;
  readonly read_at?: string | null;
  readonly product_id?: string | null;
  readonly order_id?: string | null;
}
export interface MessagePage {
  readonly data: readonly MessageRow[];
  readonly next_cursor: string | null;
}

/** GET /v1/notifications rows -- notifications.controller.ts. */
export interface NotificationRow {
  readonly id: string;
  readonly template_key: string;
  readonly locale: string;
  readonly slots: Record<string, unknown> | null;
  readonly order_id: string | null;
  readonly suppressible: boolean;
  readonly scheduled_for: string;
  readonly read_at: string | null;
}
export interface NotificationPage {
  readonly data: readonly NotificationRow[];
  readonly next_cursor: string | null;
}
