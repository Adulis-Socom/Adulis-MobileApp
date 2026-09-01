/**
 * features/store/types.ts -- LOCAL transcriptions of the store-group service
 * shapes (onboarding.service.ts, couriers.controller.ts, storefront
 * categories). The D-98 class: these endpoints are schema-less in the
 * contract, so the types are transcribed from the services and marked for
 * deletion the day the contract carries schemas. Never hand-edit
 * packages/api-client for this.
 */

/** GET /v1/categories (public) -- storefront.controller.ts `categories`. */
export interface CategoryRow {
  readonly id: string;
  readonly code: string;
  readonly parent_id: string | null;
}

/** GET /v1/seller/fulfilment-methods -- onboarding.service.ts. */
export type FulfilmentMethodCode = 'BUYER_COLLECTION' | 'SELLER_DELIVERY' | 'COURIER_DELIVERY';
export interface FulfilmentMethod {
  readonly method: FulfilmentMethodCode;
  readonly handoff_note: string | null;
  readonly is_active: boolean;
}

/** GET /v1/seller/availability-overrides -- date-cursor page. */
export interface AvailabilityOverride {
  readonly date: string;
  readonly note: string | null;
}
export interface OverridePage {
  readonly data: readonly AvailabilityOverride[];
  readonly has_more: boolean;
  readonly next_cursor: string | null;
}

/** POST /v1/seller/social-accounts -- the bio code to place. */
export interface SocialAccountCreated {
  readonly social_account_id: string;
  readonly code: string;
  readonly expires_at: string;
}

/** POST /v1/seller/social-accounts/{id}/verify -- success arm. */
export interface SocialVerified {
  readonly status: 'VERIFIED';
  readonly already?: boolean;
  readonly follower_count_at_verification?: number;
}

/**
 * GET /v1/seller/couriers -- couriers.controller.ts. The ONE namespace is the
 * invite id; `claimed_at` non-null is the entire claimed marker. No name, no
 * account_id, no assignment count, no last activity -- each of those absences
 * is NAMED on SC-23 and registered, not faked.
 */
export interface CourierRow {
  readonly id: string;
  readonly phone: string;
  readonly invited_at: string;
  readonly claimed_at: string | null;
}
