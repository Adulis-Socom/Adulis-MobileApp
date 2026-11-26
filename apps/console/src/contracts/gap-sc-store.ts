/**
 * PROVISIONAL fixture contracts GAP-SC-13..14: Store configuration and Courier relationships (SC-FE-06). Same status as
 * gap-sc.ts: NOT the API contract. Sources: CONSOLE-02 S97-S103 and S108, FUL-01 v3.3 S13 and S16, MKT-01 v3.3 S9 (Market is
 * not service area), and B02B-D02 (Courier relationship management retained; live assignment, handoff and compensation deferred).
 *
 * GAP-SC-13 Store: profile, structured location, explicit service coverage, operating hours in the Market timezone,
 *           fulfilment modes
 * GAP-SC-14 Courier relationships: invite, status, revoke. Delivery execution is reported UNAVAILABLE by the server.
 *
 * Open questions kept visible, not answered here (report 17, C-3): compensation, Courier applications and per-relationship
 * terms are NOT in this contract; B02B-D02 defers or omits them.
 */

// ---- GAP-SC-13 -----------------------------------------------------------------------------------------------------
/** The three governing Buyer fulfilment modes (FUL-01 S1). Private Courier Pools and the Cross-Seller Network are relationship models, not modes. */
export type FulfilmentMode = 'BUYER_COLLECTION' | 'SELLER_DELIVERY' | 'COURIER_DELIVERY';

export interface StoreProfile {
  readonly display_name: string;
  readonly bio: string;
  /** Owned by the Storefront domain (CON S99): shown, never edited here. */
  readonly handle: string;
}
/** CON S98: structured map-provider data, never a Seller-authored free-text address. */
export interface StoreLocation {
  readonly provider: 'GOOGLE_MAPS' | 'APPLE_MAPS';
  readonly provider_reference: string;
  readonly display_address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly public: boolean;
}
export interface LocationCandidate {
  readonly provider: 'GOOGLE_MAPS' | 'APPLE_MAPS';
  readonly provider_reference: string;
  readonly display_address: string;
  readonly latitude: number;
  readonly longitude: number;
}
export interface CoverageOption {
  readonly id: string;
  readonly label: string;
}
/** A weekday key as the server names it. Local business time in the Market timezone (CON S102, S125). */
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export interface HoursInterval {
  /** 24-hour local clock "HH:MM" in the Market timezone. Sent as local time with explicit timezone context (CON S125). */
  readonly open: string;
  readonly close: string;
}
export interface DayHours {
  readonly day: Weekday;
  readonly intervals: readonly HoursInterval[];
}
export interface Closure {
  /** Local calendar date YYYY-MM-DD in the Market timezone (CON S103). */
  readonly date: string;
  readonly note: string;
}
export interface FulfilmentSetting {
  readonly mode: FulfilmentMode;
  /** Whether the Seller's Market has this mode enabled at all (CON S100). A mode that is not available is shown as such, not omitted. */
  readonly available: boolean;
  readonly enabled: boolean;
  readonly instructions: string;
}
export interface StoreView {
  readonly seller_id: string;
  readonly version: number;
  readonly timezone: string;
  readonly profile: StoreProfile;
  readonly location: StoreLocation | null;
  /** Explicit coverage: Market eligibility grants no universal delivery coverage (FUL-01 Nov 24 change 2). */
  readonly coverage: { readonly selected: readonly string[]; readonly options: readonly CoverageOption[] };
  readonly hours: { readonly weekly: readonly DayHours[]; readonly closures: readonly Closure[] };
  readonly fulfilment: readonly FulfilmentSetting[];
  /** Known members: EDIT. Unknown members are ignored. */
  readonly allowed_actions: readonly string[];
}

// ---- GAP-SC-14 -----------------------------------------------------------------------------------------------------
export type RelationshipStatus = 'INVITED' | 'ACTIVE' | 'DECLINED' | 'REVOKED';
export interface CourierRelationship {
  readonly id: string;
  readonly courier_display_name: string;
  readonly status: RelationshipStatus;
  readonly status_at: string;
  /** Known members: REVOKE (also withdraws a pending invitation). Unknown members are ignored. */
  readonly allowed_actions: readonly string[];
}
export interface CourierList {
  readonly seller_id: string;
  readonly items: readonly CourierRelationship[];
  /** Known members: INVITE. */
  readonly allowed_actions: readonly string[];
  /** Always UNAVAILABLE in this release (B02B-D02): the Console says so instead of showing any delivery state. */
  readonly delivery_execution: 'UNAVAILABLE';
}

export interface StoreOperations {
  readonly 'store.get': { in: Record<string, never>; out: StoreView };
  readonly 'store.profile.update': { in: { version: number; display_name: string; bio: string }; out: StoreView };
  readonly 'store.location.search': { in: { query: string }; out: { seller_id: string; candidates: readonly LocationCandidate[] } };
  readonly 'store.location.set': { in: { version: number; candidate: LocationCandidate | null; public: boolean }; out: StoreView };
  readonly 'store.coverage.set': { in: { version: number; selected: readonly string[] }; out: StoreView };
  readonly 'store.hours.set': { in: { version: number; weekly: readonly DayHours[]; closures: readonly Closure[] }; out: StoreView };
  readonly 'store.fulfilment.set': { in: { version: number; settings: readonly { mode: FulfilmentMode; enabled: boolean; instructions: string }[] }; out: StoreView };
  readonly 'couriers.list': { in: Record<string, never>; out: CourierList };
  readonly 'couriers.invite': { in: { phone: string }; out: CourierList };
  readonly 'couriers.revoke': { in: { relationship_id: string }; out: CourierList };
}
