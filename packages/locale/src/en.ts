/**
 * SHARED English catalogue (every client, and the whole of `@adulis/locale/mobile`). English-first
 * (RB25 product rules); en DEFINES THE KEY UNION.
 *
 * Clean replacement catalogue (ARC-BE-05). The legacy screen copy is NOT carried: it described retired
 * screens and flows (RB25-D03). Each surface work order adds the keys of the screens it builds, verified
 * against the current design. The archive keeps the old copy (tag recovery/legacy-dev-20261125).
 *
 * RULES (carried, REUSE VERIFIED structure):
 *  1. One whole sentence per key, named slots in {braces}, never fragments: word order differs in Amharic.
 *  2. No formatting in the catalogue: dates, numbers and money are formatted client-side with Intl.
 *  3. ASCII English; a brace appears only as part of a {slot}.
 *  4. Never software-subscription selling copy here (plans, tiers, pricing, billing): that is console-only
 *     (en.console.ts) and never reaches a mobile bundle.
 *  5. Every key needs its am.ts entry (a compile error otherwise), PENDING until a human translation is reviewed.
 */
export const enCommon = {
  // Problem envelope title keys: error.<group>.<code> (apps/api/src/platform/problem.ts).
  'error.auth.authentication_required': 'Sign in to continue.',
  'error.rbac.permission_denied': 'You do not have permission to do this.',
  'error.request.validation_failed': 'Some details need correcting. Check the highlighted fields.',
  'error.request.not_found': 'We could not find what you were looking for.',
  'error.request.payload_too_large': 'That is too large to send. Try something smaller.',
  'error.request.internal': 'Something went wrong on our side. Please try again.',
} as const;

export type CommonMessageKey = keyof typeof enCommon;
