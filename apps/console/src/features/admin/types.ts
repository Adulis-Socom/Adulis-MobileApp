/**
 * features/admin/types.ts -- LOCAL transcriptions of the admin-group service
 * shapes (financial, team, ownership, billing, deletion, notifications, auth
 * sessions). The D-98 class: schema-less in the contract; transcribed from
 * the services and marked for deletion the day the contract carries schemas.
 */

/** GET /v1/seller/payout -- financial.service.ts. Only last4 exists in core. */
export interface PayoutRow {
  readonly id: string;
  readonly bank_code: string;
  readonly account_last4: string;
  readonly state: string;
  readonly requested_at: string;
  readonly activates_at: string | null;
  readonly activated_at: string | null;
}
export interface PayoutState {
  readonly active: PayoutRow | null;
  readonly pending: PayoutRow | null;
  /** D-155: the server's answer to what this seller may do to payout. */
  readonly allowed_actions: readonly string[];
}

/** GET /v1/seller/payout/history -- fixed LIMIT 100, newest first. */
export interface PayoutHistoryRow {
  readonly id: string;
  readonly previous_last4: string | null;
  readonly new_last4: string | null;
  readonly outcome: string;
  readonly occurred_at: string;
}

/** GET /v1/seller/team -- team.service.ts. `id` is the MEMBERSHIP id. */
export interface TeamMember {
  readonly id: string;
  readonly role: string;
  readonly suspended_at: string | null;
  readonly created_at: string;
  readonly phone: string;
}
export interface TeamPage {
  readonly data: readonly TeamMember[];
  readonly seats: { readonly allowed: boolean; readonly cap: number | null } | null;
  /** D-155: staff admin and ownership transfer, named by permission code. */
  readonly allowed_actions: readonly string[];
}

/** GET /v1/seller/ownership-transfer -- ownership.controller.ts. */
export interface OwnershipTransfer {
  readonly id: string;
  readonly i_am_the_owner: boolean;
  readonly residual_role: string | null;
  readonly requested_at: string;
  readonly activates_at: string;
}

/** GET /v1/billing/subscription -- billing.controller.ts. */
export interface Subscription {
  readonly state: 'BETA' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
  readonly tier: string;
  readonly term: string | null;
  readonly trial_ends_at: string | null;
  readonly current_period_start: string | null;
  readonly current_period_end: string | null;
  readonly locked_rate_minor: number | null;
  readonly locked_rate_currency: string | null;
}
export interface PurchaseIntent {
  readonly intent_id: string;
  readonly collection_record_id: string;
  readonly tier: string;
  readonly term: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly expires_at: string;
  readonly marked_transferred_at: string | null;
}
export interface SubscriptionState {
  readonly subscription: Subscription | null;
  readonly intent: PurchaseIntent | null;
}
export interface IntentCreated {
  readonly intent_id: string;
  readonly collection_record_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly reference: string;
  readonly tier: string;
  readonly term: string;
  readonly expires_at: string;
}

/**
 * GET /v1/auth/sessions -- auth.service.ts. ONE list: a remembered device is
 * a session row with `remembered` true, not a separate collection.
 */
export interface SessionRow {
  readonly id: string;
  readonly audience: string;
  readonly first_seen_at: string;
  readonly last_activity_at: string;
  readonly approx_location: string | null;
  readonly expires_at: string;
  readonly device_id: string | null;
  readonly device_platform: string | null;
  readonly remembered_label: string | null;
  readonly remembered: boolean;
  readonly current: boolean;
}

/** GET /v1/seller/notification-preferences -- rows only where written. */
export interface NotificationPreference {
  readonly template_key: string;
  readonly enabled: boolean;
  readonly updated_at: string;
}

/** GET /v1/seller/deletion/blockers -- items[] in the S7 envelope's shape. */
export interface DeletionBlocker {
  readonly code: string;
  readonly message_key: string;
  readonly slots?: Record<string, unknown>;
  readonly resolving_action?: { readonly kind: string };
}
