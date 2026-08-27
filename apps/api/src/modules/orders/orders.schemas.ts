import { z } from 'zod';

/** C3 — cart, orders and payment decisions (ADU-API-01 v1.6 §12.3, §12.4, §12.11). */

export const addCartLineBody = z.object({
  variant_id: z.uuid(),
  quantity: z.number().int().min(1).max(99),
});

export const patchCartLineBody = z.object({
  quantity: z.number().int().min(1).max(99),
});

/**
 * The whole-cart revalidation contract (S8.3): the client names the prices
 * it SHOWED the buyer, and the order function refuses with complete
 * items[] where anything changed. The client computes nothing — these are
 * the numbers it displayed, echoed back.
 */
export const createOrderBody = z.object({
  cart_id: z.uuid(),
  expected: z
    .array(
      z.object({
        variant_id: z.uuid(),
        unit_price_minor: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(50),
});

export const rejectPaymentBody = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const reportRefundBody = z.object({
  reservation_id: z.uuid(),
  amount_minor: z.number().int().min(0),
  currency: z.string().length(3),
});

export type AddCartLineBody = z.infer<typeof addCartLineBody>;
export type PatchCartLineBody = z.infer<typeof patchCartLineBody>;
export type CreateOrderBody = z.infer<typeof createOrderBody>;
export type RejectPaymentBody = z.infer<typeof rejectPaymentBody>;
export type ReportRefundBody = z.infer<typeof reportRefundBody>;
