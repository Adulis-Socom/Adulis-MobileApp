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
  /**
   * MOBILE only. A native client generates its device id, persists it in the
   * platform keystore and presents it here. A CONSOLE request carries no
   * device id at all: the browser's identity is the httpOnly cookie
   * /v1/bootstrap minted, which JavaScript cannot read and therefore cannot
   * send (ADU-RUL-03 S2). A device_id sent by a console client is IGNORED,
   * not honoured -- accepting it as a fallback is the arm the ruling closes.
   */
  device_id: z.uuid().optional(),
  /**
   * Required the first time this phone signs in (identity creation blocks
   * below 18 — ADU-AUTH-01 section 13); ignored for an existing account.
   */
  age_declared_over_18: z.boolean().optional(),
  /** R17 — console only; asserts "this is not the borrowed laptop". */
  remember_device: z.boolean().optional(),
})
  .refine((b) => b.audience !== 'MOBILE' || typeof b.device_id === 'string', {
    // Optional in the shape, REQUIRED on the surface that has one. Without
    // this, relaxing device_id for the console would have let a mobile client
    // omit it and reach a lookup with nothing to look up.
    path: ['device_id'],
    message: 'device_id is required for MOBILE',
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
