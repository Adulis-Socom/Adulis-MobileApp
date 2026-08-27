import { z } from 'zod';

/** C5 — handoff and courier (ADU-API-01 v1.6 §12.6, §12.6.1, §12.17). */

const scanItem = z.object({
  nonce: z.uuid(),
  order_ref: z.uuid(),
  // Epoch MILLISECONDS, per the A5 rule: an integer, so there is no
  // timezone to get wrong and no parser to disagree with.
  signed_at: z.number().int().positive(),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});

/** Up to 50 scans; above that, 413 (section 12.6.1). */
export const handoffSyncBody = z.object({
  scans: z.array(scanItem).min(1).max(50),
});

export type HandoffSyncBody = z.infer<typeof handoffSyncBody>;
export type ScanItem = z.infer<typeof scanItem>;
