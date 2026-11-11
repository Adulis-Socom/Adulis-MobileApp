import { z } from 'zod';
import { AdulisException } from '../../common/errors/adulis-exception';

/**
 * Private Buyer Collections (ADU-SRC-01 v3.2 S18-S22): request shapes and the pure rules the
 * controller and service share.
 */
export const TARGET_TYPES = ['PRODUCT_POST', 'SCENE_POST'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/** Where a Save was made (provenance, S20). Never an analytics event or a ranking signal. */
export const SOURCE_SURFACES = [
  'PRODUCT_DETAIL',
  'SCENE_EXPLORER',
  'SEARCH',
  'SHOP',
  'SELLER_PROFILE',
  'FOR_YOU',
  'SAVED',
] as const;

export const ITEM_FILTERS = ['ALL', 'PRODUCT_POST', 'SCENE_POST'] as const;
export type ItemFilter = (typeof ITEM_FILTERS)[number];

/**
 * shortcut: provisional bounds (ON-20261111-088) -- the design gives no number. A name is at
 * most 60 characters (the 0061 CHECK agrees); one saved-state batch holds at most 60 targets
 * (a payload bound, two Search pages of cards).
 */
export const NAME_MAX = 60;
export const SAVED_STATE_MAX = 60;

const PUBLIC_REF = /^[A-Za-z0-9_-]{22}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A Product Post is addressed by its public `id` (uuid); a Scene by its `public_ref`. No global slug. */
const target = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PRODUCT_POST'), ref: z.string().regex(UUID) }).strict(),
  z.object({ type: z.literal('SCENE_POST'), ref: z.string().regex(PUBLIC_REF) }).strict(),
]);
export type Target = z.infer<typeof target>;

export const nameBody = z.object({ name: z.string().max(1000) }).strict();

export const addItemBody = z
  .object({
    target,
    source_surface: z.enum(SOURCE_SURFACES),
    // The Scene the Product was reached from. Validated against the Scene's CURRENT public
    // revision; an unverifiable context is dropped, never stored (S20).
    context: z.object({ scene_ref: z.string().regex(PUBLIC_REF) }).strict().optional(),
  })
  .strict();
export type AddItemBody = z.infer<typeof addItemBody>;

export const savedStateBody = z
  .object({ targets: z.array(target).min(1).max(SAVED_STATE_MAX) })
  .strict();

/**
 * A Collection name as stored: NFC, any whitespace run as one space, trimmed, 1-60 characters
 * (code points, as PostgreSQL's char_length counts), no control characters.
 */
export function normalizeName(raw: string): string {
  const name = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const length = Array.from(name).length;
  if (length < 1 || length > NAME_MAX || /\p{Cc}/u.test(name)) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'name' } });
  }
  return name;
}

/** An opaque ref that is not a uuid names nothing this caller owns: the same 404 as a foreign one. */
export function assertRef(value: string): void {
  if (!UUID.test(value)) throw new AdulisException('NOT_FOUND');
}

export function parseFilter(raw: string | undefined): ItemFilter {
  const filter = (raw ?? 'ALL') as ItemFilter;
  if (!ITEM_FILTERS.includes(filter)) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'type' } });
  }
  return filter;
}
