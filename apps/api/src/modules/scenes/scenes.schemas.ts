import { z } from 'zod';

/**
 * Scene Post request bodies (ADU-SCN-01 v3.2 S18, S20, S23; WO-DISC-001 S20).
 *
 * The caption is bounded plain text (S20). The design gives no number; 5000
 * is the repository's existing bound for Product description text, and the
 * database CHECK enforces the same. The tag list bound is a payload limit,
 * not a business cap: the design sets no maximum number of tags.
 */
const caption = z.string().max(5000);
const productIds = z.array(z.uuid()).max(40);
const objectKey = z.string().min(1).max(300);

export const createScenePostBody = z.object({
  caption: caption.optional(),
  product_ids: productIds.optional(),
});
export type CreateScenePostBody = z.infer<typeof createScenePostBody>;

/** Each field present replaces that part of the working revision; absent fields are kept. */
export const patchScenePostDraftBody = z
  .object({
    caption: caption.nullable().optional(),
    product_ids: productIds.optional(),
    image: z
      .object({ thumb_key: objectKey, card_key: objectKey, full_key: objectKey })
      .nullable()
      .optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'at least one field' });
export type PatchScenePostDraftBody = z.infer<typeof patchScenePostDraftBody>;
