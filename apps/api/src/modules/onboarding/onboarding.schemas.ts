import { z } from 'zod';

/**
 * Zod at the door (ADU-CON-02 section 3.8) — every body below is parsed
 * before a handler touches it, and a ZodError leaves as one 400 carrying
 * every failing path.
 *
 * The wire rules hold: money would be { amount_minor, currency },
 * timestamps RFC 3339 UTC, dates ISO calendar dates in the market's
 * timezone where the document says so (availability overrides).
 */

export const createSellerBody = z.object({
  entity_type: z.enum(['INDIVIDUAL', 'COMPANY']),
  store_name: z.string().trim().min(1).max(120),
  // Handle rules: lowercase, url-safe, 3-40 — the storefront's /{handle}.
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/),
  description: z.string().trim().max(2000).optional(),
  category_id: z.uuid().optional(),
});

export const patchProfileBody = z
  .object({
    store_name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    category_id: z.uuid().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty patch' });

export const socialAccountBody = z.object({
  platform: z.enum(['TIKTOK', 'INSTAGRAM']),
  handle: z.string().trim().min(1).max(120),
});

export const identityVerificationBody = z.object({
  // OPERATOR-ONLY since G1.1. The subject is named explicitly because an
  // operator attests ABOUT SOMEONE ELSE and cannot derive them from their
  // own session — they hold no seller relationship at all.
  person_id: z.uuid(),
  // The vendor session outcome, relayed by the client. NO image, NO
  // document, NO upload URL — there is no field for one, deliberately
  // (S13.1), and adding one is the load-bearing absence in CLAUDE.md.
  // OPERATOR_ATTESTED is new in ADU-DB-01 v1.12, and exists because neither
  // other value would be true: there is no KYC vendor and there is no video
  // call. An audit row that says something other than what occurred is
  // worse than one that says less.
  verifier_kind: z.enum(['KYC_VENDOR', 'VIDEO_CALL', 'OPERATOR_ATTESTED']),
  vendor_reference: z.string().trim().min(1).max(200),
  id_type: z.string().trim().min(1).max(60),
  legal_name: z.string().trim().min(1).max(200),
  // The keyed HMAC of the document number, computed BEFORE the call — the
  // raw identifier never crosses this boundary (S7.3). Hex, 64 chars
  // (HMAC-SHA256).
  id_hash: z.string().regex(/^[0-9a-f]{64}$/),
  verified_on: z.iso.date(),
  step_up_challenge_id: z.uuid(),
});

const availabilityWindow = z
  .object({
    weekday: z.number().int().min(1).max(7),
    opens_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    closes_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine((w) => w.opens_at < w.closes_at, { message: 'window must open before it closes' });

/**
 * The WHOLE weekly pattern in one request: zero windows is valid and means
 * closed (S13.1) — an empty array is a legitimate store.
 */
export const availabilityBody = z.object({
  windows: z.array(availabilityWindow).max(56),
});

export const overridePutBody = z.object({
  // The existence of the override is the fact; the note is decoration
  // (S13.1a — there is no is_closed field to send).
  note: z.string().trim().max(120).optional(),
});

export const companyDetailsBody = z.object({
  registration_identifier: z.string().trim().min(1).max(120),
  trade_licence_number: z.string().trim().min(1).max(120),
  tin: z.string().trim().min(1).max(60),
  representative_person_id: z.uuid(),
  representative_relationship: z.string().trim().min(1).max(120),
});

export const fulfilmentMethodsBody = z.object({
  methods: z
    .array(
      z.object({
        method: z.enum(['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY']),
        handoff_note: z.string().trim().max(500).optional(),
        is_active: z.boolean().default(true),
      }),
    )
    .max(3),
});

export type CreateSellerBody = z.infer<typeof createSellerBody>;
export type PatchProfileBody = z.infer<typeof patchProfileBody>;
export type SocialAccountBody = z.infer<typeof socialAccountBody>;
export type IdentityVerificationBody = z.infer<typeof identityVerificationBody>;
export type AvailabilityBody = z.infer<typeof availabilityBody>;
export type OverridePutBody = z.infer<typeof overridePutBody>;
export type CompanyDetailsBody = z.infer<typeof companyDetailsBody>;
export type FulfilmentMethodsBody = z.infer<typeof fulfilmentMethodsBody>;
