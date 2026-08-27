import { z } from 'zod';

/** C4 — the financial boundary's bodies. */

export const evidenceBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('REQUEST_UPLOAD') }),
  z.object({
    action: z.literal('COMMIT'),
    key: z.string().min(1).max(300),
  }),
]);

export const payoutChangeBody = z.object({
  bank_code: z.string().trim().min(2).max(20),
  account_number: z.string().trim().regex(/^\d{6,24}$/),
  account_name: z.string().trim().min(1).max(200),
  step_up_challenge_id: z.uuid(),
});

export const reissueBody = z.object({
  step_up_challenge_id: z.uuid(),
});

export type EvidenceBody = z.infer<typeof evidenceBody>;
export type PayoutChangeBody = z.infer<typeof payoutChangeBody>;
export type ReissueBody = z.infer<typeof reissueBody>;
