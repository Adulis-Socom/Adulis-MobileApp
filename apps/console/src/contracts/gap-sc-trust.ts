/**
 * PROVISIONAL fixture contract GAP-SC-16: Trust standing and Reviews, READ ONLY (SC-FE-09). Same status as gap-sc.ts: NOT the API contract.
 * Sources: TRUST-01 v3.3 S3, S9-S11, S20, S35, S73; REV-01 v3.3 S17-S19, S23, S28-S30, S41; CONSOLE-02 v4.3 S90-S93; AUTH-02 v3.3
 * (seller.trust:read, seller.reviews:read). The 24 November decision register and per-design amendments are not in the repository, so the
 * boundary below is read from CLAUDE.md, GOV-03, GOV-06, GOV-07 and SC-FE-00 only.
 *
 * Operation names avoid the fixture fail-closed words (trust, report, claim, moderation, evidence, order) on purpose: those words guard
 * WRITES, and this contract has none.
 *
 * What a Seller may see: the level (server-authoritative, never set, never guessed), when it was last evaluated, and that no transaction
 * evidence is connected. What is deliberately NOT here: a score or a progress percentage, thresholds, requirement counts, anything derived
 * from Orders or Handoffs, a combined rating, a Seller reply, a purchase proof, a transaction reference, an evidence badge, removed or
 * restricted reviews, and any way to report, appeal or alter a review (all deferred until Operator intake).
 */

/** TRUST-01 S9. REBUILDING is a formerly promoted Seller now below Established; it is never shown as NEW (INV-03). */
export type TrustLevel = 'NEW' | 'REBUILDING' | 'ESTABLISHED' | 'TRUSTED';

export interface StandingView {
  readonly seller_id: string;
  readonly level: TrustLevel;
  /** When the server last evaluated the level, or null if it never has. The Console never computes or extends it. */
  readonly evaluated_at: string | null;
}

/** REV-01 S17-S19, S30: Product and Seller-service ratings are separate dimensions with separate aggregates. There is no overall rating. */
export type ReviewDimension = 'PRODUCT' | 'SELLER_SERVICE';
export type Stars = 1 | 2 | 3 | 4 | 5;

export interface ReviewAggregate {
  readonly dimension: ReviewDimension;
  readonly count: number;
  /** Count per star, 1 to 5, as the server aggregated it. The Console never averages or ranks. */
  readonly distribution: Readonly<Record<'1' | '2' | '3' | '4' | '5', number>>;
}

export interface ReviewSummary {
  readonly seller_id: string;
  readonly product: ReviewAggregate;
  readonly seller_service: ReviewAggregate;
}

export interface ReviewItem {
  readonly id: string;
  readonly dimension: ReviewDimension;
  readonly stars: Stars;
  /** Plain text, written by the Buyer. A Seller cannot edit, hide, delay or remove it (REV-01 S23, S41). Null when only a rating was left. */
  readonly text: string | null;
  readonly written_at: string;
  /** The Product's title for a PRODUCT review, null for a Seller-service review. */
  readonly product_label: string | null;
}

export interface ReviewList {
  readonly seller_id: string;
  readonly dimension: ReviewDimension;
  readonly items: readonly ReviewItem[];
  readonly next_cursor: string | null;
}

export interface TrustOperations {
  readonly 'standing.get': { in: Record<string, never>; out: StandingView };
  readonly 'reviews.summary.get': { in: Record<string, never>; out: ReviewSummary };
  readonly 'reviews.list': { in: { dimension: ReviewDimension; cursor: string | null }; out: ReviewList };
}
