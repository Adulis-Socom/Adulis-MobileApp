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

/**
 * GET /v1/seller/profile -- onboarding.service.ts (T15 Phase 4). The read the
 * write-only form was missing: the editable fields PLUS status and handle, so
 * SC-17 shows what it saved and what the store's public address is.
 */
export interface SellerProfile {
  readonly handle: string;
  readonly store_name: string;
  readonly description: string | null;
  readonly category_id: string | null;
  readonly entity_type: string;
  readonly status: string;
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
 * GET /v1/seller/social-accounts -- onboarding.service.ts (T15 Phase 4). The
 * list SC-22 could not re-read: handle, status, and the follower count with
 * the DATE it was captured (verified_at), so R24's "as of <date>" names a real
 * date instead of the moment one session happened to witness.
 */
export interface SellerSocialAccount {
  readonly id: string;
  readonly platform: string;
  readonly handle: string;
  readonly status: 'PENDING' | 'VERIFIED' | 'REVOKED';
  readonly follower_count: number | null;
  readonly captured_at: string | null;
  readonly follower_count_source: string | null;
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
