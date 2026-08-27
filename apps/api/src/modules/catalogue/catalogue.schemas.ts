import { z } from 'zod';

/** C2 — catalogue, media and stock (ADU-API-01 v1.6 section 12.10). */

const attributeValue = z
  .object({
    attribute_definition_id: z.uuid(),
    value_text: z.string().trim().max(500).optional(),
    value_number: z.number().finite().optional(),
    value_option_id: z.uuid().optional(),
    value_boolean: z.boolean().optional(),
  })
  .refine(
    (v) =>
      [v.value_text, v.value_number, v.value_option_id, v.value_boolean].filter(
        (x) => x !== undefined,
      ).length === 1,
    { message: 'exactly one value form' },
  );

export const createProductBody = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  category_id: z.uuid().optional(),
  base_price_minor: z.number().int().min(0),
  base_price_currency: z.string().length(3),
  attributes: z.array(attributeValue).max(40).optional(),
});

export const patchProductBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    category_id: z.uuid().optional(),
    base_price_minor: z.number().int().min(0).optional(),
    display_order: z.number().int().min(0).optional(),
    attributes: z.array(attributeValue).max(40).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty patch' });

export const createVariantBody = z.object({
  variant_key: z.string().trim().min(1).max(120),
  price_minor: z.number().int().min(0),
  price_currency: z.string().length(3),
  attributes: z.array(attributeValue).max(40).optional(),
});

export const patchVariantBody = z
  .object({
    price_minor: z.number().int().min(0).optional(),
    status: z.string().trim().max(40).optional(),
    attributes: z.array(attributeValue).max(40).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty patch' });

/**
 * The two-phase image flow through ONE catalogued path (register D-25):
 * REQUEST_UPLOAD signs the three derivative PUTs; COMMIT validates what
 * landed and registers the row. The keys are server-minted at signing, so
 * a commit can only name keys this API chose.
 */
export const imageBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('REQUEST_UPLOAD'),
    position: z.number().int().min(1).max(5),
  }),
  z.object({
    action: z.literal('COMMIT'),
    position: z.number().int().min(1).max(5),
    thumb_key: z.string().min(1).max(300),
    card_key: z.string().min(1).max(300),
    full_key: z.string().min(1).max(300),
  }),
]);

export const imageOrderBody = z.object({
  // The WHOLE ordering in one request: UNIQUE (product_id, position) makes
  // a two-step swap a constraint violation, so a reorder is one
  // transaction or it is a defect (section 12.10).
  order: z.array(z.uuid()).min(1).max(5),
});

export const videoBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('REQUEST_UPLOAD') }),
  z.object({
    action: z.literal('COMMIT'),
    key: z.string().min(1).max(300),
    // <=480p, <=30s, compressed on device (S7.4). Bytes are verified
    // against storage; duration and height are the client's own encode
    // metadata, bounded here and CHECKed again by the schema's columns.
    duration_seconds: z.number().int().min(1).max(30),
    height_px: z.number().int().min(1).max(480),
  }),
]);

export const socialPostBody = z.object({
  url: z.url().max(500),
});

/**
 * A delta or an absolute count — and in both cases the server writes a
 * stock EVENT; the count is never assigned (S7's invariant lives in a
 * trigger, and the endpoint shape must not suggest otherwise).
 */
export const stockBody = z
  .object({
    delta: z.number().int().optional(),
    count: z.number().int().min(0).optional(),
  })
  .refine((b) => (b.delta !== undefined) !== (b.count !== undefined), {
    message: 'exactly one of delta or count',
  });

export type CreateProductBody = z.infer<typeof createProductBody>;
export type PatchProductBody = z.infer<typeof patchProductBody>;
export type CreateVariantBody = z.infer<typeof createVariantBody>;
export type PatchVariantBody = z.infer<typeof patchVariantBody>;
export type ImageBody = z.infer<typeof imageBody>;
export type ImageOrderBody = z.infer<typeof imageOrderBody>;
export type VideoBody = z.infer<typeof videoBody>;
export type SocialPostBody = z.infer<typeof socialPostBody>;
export type StockBody = z.infer<typeof stockBody>;
export type AttributeValue = z.infer<typeof attributeValue>;
