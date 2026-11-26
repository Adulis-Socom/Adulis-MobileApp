/**
 * PROVISIONAL fixture contracts GAP-SC-11..12: Scene Posts and Seller Stories (SC-FE-05, SC-FE-05S). Same status as
 * gap-sc.ts: NOT the API contract. Sources: SCN-01 v3.2 S20-S36, CATINV-01 v3.3 S12-S19 and S116, CONSOLE-02 S58-S70,
 * Governance/STORY_CONTRACT_2026-11-24.md and the founder rulings in docs/rebuild/SC-FE-04-06 reports (optional Story link).
 *
 * GAP-SC-11 Scene Post authoring: image, caption, same-Seller Product tags, hotspots, publish blockers, visibility
 * GAP-SC-12 Seller Stories: one photo, optional text, zero or one same-Seller target, server-authored 24-hour lifetime
 *
 * Conflicts RB-B02B-09 (report 17): the code for "zero tags" is PRODUCT_TAG_REQUIRED in SCN and SCENE_PRODUCT_TAG_REQUIRED in CATINV, and the
 * Private reason is ALL_TAGGED_PRODUCTS_UNAVAILABLE in SCN and ALL_TAGGED_PRODUCTS_OUT_OF_STOCK in CON/CATINV. These shapes
 * carry an OPAQUE code: the Console branches on neither spelling for behaviour, only for the one sentence CON quotes.
 */

// ---- GAP-SC-11 -----------------------------------------------------------------------------------------------------
/** SCN S65: publication_state and visibility are orthogonal. */
export type ScenePublication = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'REMOVED';
export type SceneVisibility = 'PUBLIC' | 'PRIVATE';
/** CON S59 content-list tabs. */
export type SceneTab = 'ALL' | 'DRAFT' | 'PUBLIC' | 'PRIVATE' | 'ARCHIVED' | 'RESTRICTED';
/** CON S68: shown only when the state exists in canonical moderation. The Console makes no moderation decision. */
export interface ModerationView {
  readonly state: string;
  readonly reason_code: string | null;
  readonly updated_at: string;
}
export interface SceneSummary {
  readonly id: string;
  readonly caption_preview: string;
  readonly publication_state: ScenePublication;
  readonly visibility: SceneVisibility;
  /** Why a PRIVATE Scene is private (management contract only, never a public response). */
  readonly private_reason: string | null;
  readonly moderation: ModerationView | null;
  readonly tag_count: number;
  readonly available_tag_count: number;
}
export interface SceneList {
  readonly seller_id: string;
  readonly items: readonly SceneSummary[];
  readonly next_cursor: string | null;
  readonly allowed_actions: readonly string[];
}

export interface Hotspot {
  readonly id: string;
  /** Normalised to the canonical image presentation, 0 to 1 (SCN S22). Never device pixels. */
  readonly x_norm: number;
  readonly y_norm: number;
}
export interface SceneTag {
  readonly product_id: string;
  readonly title: string;
  readonly availability: 'AVAILABLE' | 'LOW' | 'NOT_AVAILABLE';
  /** Structural tag eligibility (same Seller, same Market, published). The server decides; availability is separate (SCN S26). */
  readonly eligible: boolean;
  readonly hotspots: readonly Hotspot[];
}
export interface SceneImage {
  readonly file_name: string;
  readonly state: 'PROCESSING' | 'READY' | 'REJECTED';
  /** Width over height of the canonical presentation, so hotspots can be placed before real pixels exist. */
  readonly aspect: number;
}
export interface SceneDetail {
  readonly seller_id: string;
  readonly id: string;
  readonly version: number;
  readonly caption: string;
  readonly image: SceneImage | null;
  /** Order is the presentation order (SCN S23). */
  readonly tags: readonly SceneTag[];
  readonly publication_state: ScenePublication;
  readonly visibility: SceneVisibility;
  readonly private_reason: string | null;
  readonly moderation: ModerationView | null;
  readonly blockers: readonly { readonly code: string; readonly field: string | null }[];
  /** Known members: EDIT, PUBLISH, ARCHIVE. Unknown members are ignored. */
  readonly allowed_actions: readonly string[];
}
export interface ScenePublishOutcome {
  readonly seller_id: string;
  readonly result: 'PUBLISHED' | 'BLOCKED';
  readonly scene: SceneDetail;
}
export interface TagCandidate {
  readonly id: string;
  readonly title: string;
  readonly availability: 'AVAILABLE' | 'LOW' | 'NOT_AVAILABLE';
  /** False for a Product the server will not accept as a tag (withdrawn, restricted). It is shown with that fact, not hidden. */
  readonly taggable: boolean;
}
export interface TagCandidates {
  readonly seller_id: string;
  readonly items: readonly TagCandidate[];
}

// ---- GAP-SC-12 -----------------------------------------------------------------------------------------------------
export type StoryState = 'PUBLISHED' | 'WITHDRAWN' | 'RESTRICTED' | 'EXPIRED';
export interface StoryTarget {
  readonly kind: 'PRODUCT' | 'SCENE';
  readonly id: string;
  readonly label: string;
}
export interface StoryView {
  readonly seller_id: string;
  readonly id: string;
  readonly version: number;
  readonly state: StoryState;
  readonly photo_name: string;
  readonly text: string | null;
  /** Zero or one. A Story with no target shows no Product or Scene call to action. */
  readonly target: StoryTarget | null;
  readonly published_at: string;
  /** Server-authored: published_at plus the fixed 24 hours. The Console never computes it and never extends it. */
  readonly expires_at: string;
  /** Effective public visibility is computed by the server, never trusted from a stored flag (STORY contract). */
  readonly public: boolean;
  /** Present when not public: EXPIRED, WITHDRAWN, RESTRICTED or TARGET_NOT_ELIGIBLE. */
  readonly not_public_reason: string | null;
  readonly moderation: ModerationView | null;
  /** Known members: WITHDRAW. Published Stories are not edited in the MVP (STORY contract). */
  readonly allowed_actions: readonly string[];
}
export interface StoryList {
  readonly seller_id: string;
  readonly items: readonly StoryView[];
  readonly allowed_actions: readonly string[];
}
export interface StoryTargets {
  readonly seller_id: string;
  /** Only targets the server currently accepts: same Seller, same Market, publicly eligible. */
  readonly products: readonly { readonly id: string; readonly label: string }[];
  readonly scenes: readonly { readonly id: string; readonly label: string }[];
}

export interface SceneOperations {
  readonly 'scenes.list': { in: { tab: SceneTab; cursor: string | null }; out: SceneList };
  readonly 'scenes.create': { in: Record<string, never>; out: SceneDetail };
  readonly 'scenes.get': { in: { scene_id: string }; out: SceneDetail };
  /** Replaces the whole tag list (explicit relationship rows, SCN S23) and/or the caption. */
  readonly 'scenes.update': {
    in: { scene_id: string; version: number; caption?: string; tags?: readonly { product_id: string; hotspots: readonly { x_norm: number; y_norm: number }[] }[] };
    out: SceneDetail;
  };
  readonly 'scenes.media.set': { in: { scene_id: string; version: number; file_name: string; content_type: string }; out: SceneDetail };
  readonly 'scenes.publish': { in: { scene_id: string; version: number }; out: ScenePublishOutcome };
  readonly 'scenes.archive': { in: { scene_id: string; version: number }; out: SceneDetail };
  readonly 'scenes.tag_candidates.get': { in: { query: string }; out: TagCandidates };
}

export interface StoryOperations {
  readonly 'stories.list': { in: Record<string, never>; out: StoryList };
  readonly 'stories.targets.get': { in: Record<string, never>; out: StoryTargets };
  readonly 'stories.create': {
    in: { photo_name: string; content_type: string; text: string | null; target: { kind: 'PRODUCT' | 'SCENE'; id: string } | null };
    out: StoryView;
  };
  readonly 'stories.withdraw': { in: { story_id: string; version: number }; out: StoryView };
}
