import { z } from 'zod';

/** C6 — identity and session (ADU-API-01 v1.6 section 12.2; ADU-AUTH-01 v2.4). */

/** E.164, the same shape core.e164 enforces below. */
export const phone = z.string().regex(/^\+[1-9][0-9]{7,14}$/);

const code = z.string().regex(/^[0-9]{6}$/);

export const otpRequestBody = z.object({
  phone,
  purpose: z.literal('SIGN_IN'),
});

export const otpResendBody = otpRequestBody;

export const otpVerifyBody = z.object({
  phone,
  code,
  audience: z.enum(['MOBILE', 'CONSOLE']),
  device_id: z.uuid(),
  /**
   * Required the first time this phone signs in (identity creation blocks
   * below 18 — ADU-AUTH-01 section 13); ignored for an existing account.
   */
  age_declared_over_18: z.boolean().optional(),
  /** R17 — console only; asserts "this is not the borrowed laptop". */
  remember_device: z.boolean().optional(),
});

export const stepUpRequestBody = z.object({
  action: z.enum([
    'PAYOUT_CHANGE',
    'REISSUE_INSTRUCTIONS',
    'TEAM_CHANGE',
    'SUBSCRIPTION_CHANGE',
    'SELLER_DELETION',
    'REVOKE_ALL_SESSIONS',
    'IDENTITY_CHANGE',
    'OWNERSHIP_TRANSFER',
  ]),
  target_ref: z.uuid().nullable().optional(),
});

export const stepUpVerifyBody = z.object({
  challenge_id: z.uuid(),
  code,
});

export const revokeOthersBody = z.object({
  step_up_challenge_id: z.uuid(),
});

export const deviceRegisterBody = z.object({
  id: z.uuid(),
  platform: z.enum(['ANDROID', 'IOS']),
});

export const devicePatchBody = z.object({
  push_token: z.string().max(4096).nullable().optional(),
  notification_permission: z.enum(['GRANTED', 'DENIED', 'NOT_ASKED']).optional(),
});

export const recoveryBody = z.object({
  phone,
  reason: z.string().max(500).optional(),
});

export const deletionOtpRequestBody = z.object({ phone });

export const deletionOtpVerifyBody = z.object({ phone, code });

export const deletionConfirmBody = z.object({
  /** The confirm step requires explicit acknowledgement (ADU-WEB-01 S6.2). */
  acknowledge: z.literal(true),
});
