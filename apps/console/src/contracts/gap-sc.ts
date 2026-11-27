/**
 * PROVISIONAL fixture contracts GAP-SC-01..07 (docs/rebuild/SC-FE-00-CONSOLE-SOURCE-TO-SCREEN.md S5, RBL-04 GAP-RB-06).
 *
 * THESE ARE NOT THE API CONTRACT. The generated OpenAPI holds no Seller business endpoint yet; each shape below is the
 * Console's best reading of the governing designs (AUTH-02, ONB-01, CONSOLE-02, NOTIF-01, MKT-01), named for the GAP
 * it stands in for, so the backend work order (SC-BE-02, SC-BE-03, SC-BE-06) can confirm or replace it. They are never
 * written into contracts/openapi.json or packages/api-client. When a real contract lands the live transport is wired
 * to it, the matching entry here is deleted, and the compile-time guard in transport/live.ts fails until that happens.
 *
 * GAP-SC-01 phone OTP, resend, expiry, recovery, declarations, session   (SC-BE-02, AUTH-02)
 * GAP-SC-02 account context: Seller relationships, roles, capabilities   (SC-BE-02)
 * GAP-SC-03 Seller creation, type, social evidence, eligibility outcome  (SC-BE-03, ONB-01)
 * GAP-SC-04 publication readiness items and resolving actions            (SC-BE-03)
 * GAP-SC-05 Home brief: nonfinancial cards, alerts, obligations          (SC-BE-03 and owning domains)
 * GAP-SC-06 notification list and unread count                           (SC-BE-06, NOTIF-01)
 * GAP-SC-07 Market context                                               (SC-BE-03, MKT-01)
 * GAP-SC-08..10 taxonomy, Catalogue/Variants, Inventory   -> gap-sc-catalogue.ts (SC-FE-04)
 * GAP-SC-11..12 Scene Posts and Seller Stories            -> gap-sc-content.ts   (SC-FE-05, SC-FE-05S)
 * GAP-SC-13..14 Store configuration, Courier relationships -> gap-sc-store.ts     (SC-FE-06)
 *
 * Every deadline is an absolute UTC ISO-8601 instant the SERVER decided (AUTH-02 S16, CONSOLE-02 S125). Durations,
 * attempt limits and rate-limit values are open decisions: the Console never assumes any of them.
 */
export const PROVISIONAL_CONTRACT_VERSION = 'gap-sc-provisional-2';

export type SellerStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
export type Publication = 'NEVER_PUBLISHED' | 'PUBLISHED' | 'UNPUBLISHED';
export type SellerType = 'INDIVIDUAL' | 'COMPANY';
/** CONSOLE-02 S17. Roles explain; capabilities authorize. */
export type SellerRole = 'OWNER' | 'ADMIN' | 'SALES_SUPPORT' | 'INVENTORY' | 'ANALYST' | 'CAMPAIGN_MANAGER';
export type Relationship = 'OWNER' | 'TEAM';

export interface SellerSummary {
  readonly id: string;
  readonly display_name: string;
  readonly seller_type: SellerType;
  readonly status: SellerStatus;
  readonly publication: Publication;
}

// ---- GAP-SC-01 -----------------------------------------------------------------------------------------------------
export interface OtpChallenge {
  readonly challenge_id: string;
  readonly server_time: string;
  readonly expires_at: string;
  readonly resend_available_at: string;
}
export interface OtpStatus {
  readonly state: 'PENDING' | 'EXPIRED' | 'LOCKED';
  readonly server_time: string;
  readonly expires_at: string;
  readonly resend_available_at: string;
  /** The server decides; the client never infers it from the clock. */
  readonly resend_allowed: boolean;
}
export type VerifyResult =
  | { readonly result: 'SIGNED_IN' }
  | { readonly result: 'DECLARATIONS_REQUIRED'; readonly policy_version: string };

// ---- GAP-SC-02 -----------------------------------------------------------------------------------------------------
export interface Membership {
  readonly seller: SellerSummary;
  readonly relationship: Relationship;
  readonly roles: readonly SellerRole[];
}
export interface AccountContext {
  readonly account: { readonly id: string; readonly display_name: string };
  readonly memberships: readonly Membership[];
}

/** Closed set used by the Console. An unknown capability string from a newer server is ignored, never granted. */
export type Capability =
  | 'readiness.resolve'
  | 'admission.manage'
  | 'notifications.view'
  | 'catalogue.write'
  | 'inventory.write'
  | 'content.write'
  | 'store.manage'
  | 'couriers.manage'
  | 'inbox.read'
  | 'inbox.reply'
  | 'trust.read'
  | 'reviews.read';
export type DestinationKey = 'home' | 'products' | 'content' | 'inbox' | 'insights' | 'store' | 'trust' | 'settings';
export interface DestinationAccess {
  readonly key: DestinationKey;
  /** A destination the account lacks permission for is ABSENT from the list, never `DENIED`. */
  readonly access: 'GRANTED' | 'NO_ENTITLEMENT';
}
export interface SellerAccess {
  readonly seller_id: string;
  readonly seller_status: SellerStatus;
  readonly capabilities: readonly string[];
  readonly destinations: readonly DestinationAccess[];
  readonly restriction: { readonly reason_code: string } | null;
}

// ---- GAP-SC-03 -----------------------------------------------------------------------------------------------------
export interface CreateSellerInput {
  readonly market_id: string;
  readonly seller_type: SellerType;
  readonly display_name: string;
  readonly handle: string;
}
export type SocialPlatform = 'TIKTOK' | 'INSTAGRAM';
export interface SocialAccountState {
  readonly platform: SocialPlatform;
  readonly handle: string;
  readonly control: 'VERIFIED' | 'PENDING' | 'UNVERIFIED';
}
export interface Eligibility {
  readonly seller_id: string;
  readonly policy_version: string;
  /** ONB-01 S38: canonical outcome is SATISFIED or NOT_SATISFIED; PENDING is a workflow fact, not an outcome. */
  readonly outcome: 'SATISFIED' | 'NOT_SATISFIED' | 'PENDING';
  readonly workflow_state: 'WAITING_FOR_PROVIDER' | 'WAITING_FOR_DM_REVIEW' | 'NEEDS_SELLER_ACTION' | null;
  readonly reason_codes: readonly string[];
  readonly social_accounts: readonly SocialAccountState[];
}
export interface SocialChallenge {
  readonly seller_id: string;
  readonly platform: SocialPlatform;
  readonly official_account_handle: string;
  readonly code_sent_to: string;
  readonly expires_at: string;
}

// ---- GAP-SC-04 -----------------------------------------------------------------------------------------------------
export type ReadinessItemCode =
  | 'ACCOUNT_CREATED'
  | 'SELLER_TYPE_DECLARED'
  | 'ELIGIBILITY_SATISFIED'
  | 'COMPANY_DETAILS'
  | 'STORE_PROFILE'
  | 'FULFILMENT_CONFIG'
  | 'AT_LEAST_ONE_PRODUCT';
export type ResolveKind = 'CONNECT_SOCIAL_ACCOUNT' | 'EDIT_COMPANY_DETAILS' | 'EDIT_STORE_PROFILE' | 'CONFIGURE_FULFILMENT' | 'ADD_PRODUCT';
export interface ResolvingAction {
  readonly kind: string;
  /** Present when the action exists but THIS account may not use it: NO_PERMISSION hides, NO_ENTITLEMENT disables. */
  readonly denied: 'NO_PERMISSION' | 'NO_ENTITLEMENT' | null;
}
export interface ReadinessItem {
  /** A code a newer server adds is rendered generically, never dropped: dropping would hide a blocker. */
  readonly code: string;
  readonly satisfied: boolean;
  readonly workflow_state: 'WAITING_FOR_PROVIDER' | 'WAITING_FOR_DM_REVIEW' | 'NEEDS_SELLER_ACTION' | null;
  readonly reason_codes: readonly string[];
  readonly resolving_action: ResolvingAction | null;
}
export interface Readiness {
  readonly seller_id: string;
  readonly ready: boolean;
  readonly policy_version: string;
  readonly items: readonly ReadinessItem[];
}

// ---- GAP-SC-05 -----------------------------------------------------------------------------------------------------
export type RoleView = 'OWNER_ADMIN' | 'SALES_SUPPORT' | 'INVENTORY' | 'ANALYST' | 'CAMPAIGN_MANAGER';
export type AreaKey = 'PRODUCTS' | 'INVENTORY' | 'SCENES' | 'STORIES' | 'INBOX' | 'INSIGHTS' | 'NOTIFICATIONS' | 'SETTINGS';
export interface BriefArea {
  readonly key: string;
  /** DEFERRED: the owning domain does not exist yet. The Console says so; it never shows a zero or a count. */
  readonly state: 'AVAILABLE' | 'DEFERRED' | 'NO_ENTITLEMENT';
}
export interface BriefAlert {
  readonly code: string;
  readonly severity: 'INFO' | 'WARN';
  readonly occurred_at: string;
}
export interface BriefObligation {
  readonly code: string;
  readonly due_at: string | null;
}
export interface HomeBrief {
  readonly seller_id: string;
  /** The server decides which Home the Seller sees (CONSOLE-02 S29); the client never derives it. */
  readonly mode: 'READINESS_HUB' | 'OPERATING_BRIEF';
  readonly role_view: RoleView;
  readonly areas: readonly BriefArea[];
  readonly alerts: readonly BriefAlert[];
  readonly obligations: readonly BriefObligation[];
}

// ---- GAP-SC-06 -----------------------------------------------------------------------------------------------------
export interface NotificationItem {
  readonly id: string;
  readonly kind: string;
  readonly created_at: string;
  readonly read: boolean;
}
export interface NotificationList {
  readonly seller_id: string;
  readonly unread_count: number;
  readonly items: readonly NotificationItem[];
}

// ---- GAP-SC-07 -----------------------------------------------------------------------------------------------------
export interface MarketContext {
  readonly seller_id: string;
  readonly market_id: string;
  readonly country: string;
  /** IANA timezone of the Market: the Console formats UTC instants in it and never guesses from the browser. */
  readonly timezone: string;
}

export interface OnboardingMarket {
  readonly market_id: string;
  readonly country: string;
  readonly timezone: string;
}

import type { CatalogueOperations } from './gap-sc-catalogue';
import type { SceneOperations, StoryOperations } from './gap-sc-content';
import type { InboxOperations } from './gap-sc-inbox';
import type { StoreOperations } from './gap-sc-store';
import type { TrustOperations } from './gap-sc-trust';

// ---- the operation table the transport speaks ----------------------------------------------------------------------
export interface Operations extends CatalogueOperations, SceneOperations, StoryOperations, StoreOperations, InboxOperations, TrustOperations {
  readonly 'auth.otp.start': { in: { phone: string }; out: OtpChallenge };
  readonly 'auth.otp.status': { in: { challenge_id: string }; out: OtpStatus };
  readonly 'auth.otp.resend': { in: { challenge_id: string }; out: OtpChallenge };
  readonly 'auth.otp.verify': { in: { challenge_id: string; code: string }; out: VerifyResult };
  readonly 'auth.declarations.accept': { in: { adult_declaration: boolean; policy_accepted: boolean; policy_version: string }; out: { result: 'SIGNED_IN' } };
  readonly 'auth.recovery.start': { in: { phone: string }; out: { result: 'RECORDED' } };
  readonly 'auth.session.end': { in: Record<string, never>; out: { result: 'ENDED' } };
  readonly 'account.context.get': { in: Record<string, never>; out: AccountContext };
  readonly 'seller.access.get': { in: Record<string, never>; out: SellerAccess };
  readonly 'seller.create': { in: CreateSellerInput; out: SellerSummary };
  readonly 'seller.eligibility.get': { in: Record<string, never>; out: Eligibility };
  readonly 'seller.eligibility.recheck': { in: Record<string, never>; out: Eligibility };
  readonly 'seller.social.start': { in: { platform: SocialPlatform; handle: string }; out: SocialChallenge };
  readonly 'seller.readiness.get': { in: Record<string, never>; out: Readiness };
  readonly 'seller.home.get': { in: Record<string, never>; out: HomeBrief };
  readonly 'notifications.list': { in: Record<string, never>; out: NotificationList };
  readonly 'market.context.get': { in: Record<string, never>; out: MarketContext };
  /** The explicitly active onboarding Market a new Seller is created in (ONB-01 S19). Not Seller-scoped. */
  readonly 'market.onboarding.get': { in: Record<string, never>; out: OnboardingMarket };
}
export type OpId = keyof Operations;
export type OpInput<K extends OpId> = Operations[K]['in'];
export type OpOutput<K extends OpId> = Operations[K]['out'];

/** Operations that run inside a Seller context: the transport requires a sellerId for exactly these. */
export const SELLER_SCOPED_OPS = [
  'seller.access.get',
  'seller.eligibility.get',
  'seller.eligibility.recheck',
  'seller.social.start',
  'seller.readiness.get',
  'seller.home.get',
  'notifications.list',
  'market.context.get',
  'catalogue.categories.get',
  'catalogue.category.attributes.get',
  'products.list',
  'products.create',
  'products.get',
  'products.update',
  'products.publish',
  'products.withdraw',
  'products.media.add',
  'products.media.remove',
  'products.media.arrange',
  'products.tiktok.attach',
  'products.tiktok.detach',
  'variants.create',
  'variants.update',
  'inventory.set',
  'inventory.confirm',
  'inventory.history.get',
  'scenes.list',
  'scenes.create',
  'scenes.get',
  'scenes.update',
  'scenes.media.set',
  'scenes.publish',
  'scenes.archive',
  'scenes.tag_candidates.get',
  'stories.list',
  'stories.targets.get',
  'stories.create',
  'stories.withdraw',
  'store.get',
  'store.profile.update',
  'store.location.search',
  'store.location.set',
  'store.coverage.set',
  'store.hours.set',
  'store.fulfilment.set',
  'store.company.update',
  'couriers.list',
  'couriers.invite',
  'couriers.revoke',
  'inbox.list',
  'inbox.thread.get',
  'inbox.context.get',
  'inbox.reply.send',
  'inbox.read.mark',
  'standing.get',
  'reviews.summary.get',
  'reviews.list',
] as const satisfies readonly OpId[];
export type SellerOp = (typeof SELLER_SCOPED_OPS)[number];
