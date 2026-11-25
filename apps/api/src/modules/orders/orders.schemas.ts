import { z } from 'zod';

/** C3 — the cart (ADU-API-01 v1.6 §12.3). Order, payment and refund bodies retired with the Reservation model (0063). */

export const addCartLineBody = z.object({
  variant_id: z.uuid(),
  quantity: z.number().int().min(1).max(99),
});

export const patchCartLineBody = z.object({
  quantity: z.number().int().min(1).max(99),
});

export type AddCartLineBody = z.infer<typeof addCartLineBody>;
export type PatchCartLineBody = z.infer<typeof patchCartLineBody>;
