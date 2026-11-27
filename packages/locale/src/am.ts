import type { AmEntry } from './entry';
import type { CommonMessageKey } from './en';

/**
 * SHARED Amharic catalogue. The annotation is the presence gate: a key missing here is a COMPILE ERROR.
 *
 * NO PUBLIC AMHARIC BEFORE HUMAN REVIEW (RB25 product rules). Every entry stays PENDING until a reviewed human
 * translation replaces it; machine-translated placeholders are not carried from the legacy catalogue. A
 * PENDING entry is never rendered as Amharic and never silently replaced by English inside an Amharic UI:
 * PUBLIC_LOCALES (catalogue.ts) keeps Amharic out of every release until the whole catalogue is REVIEWED.
 */
export const amCommon: { readonly [K in CommonMessageKey]: AmEntry } = {
  'error.auth.authentication_required': { status: 'PENDING' },
  'error.rbac.permission_denied': { status: 'PENDING' },
  'error.request.validation_failed': { status: 'PENDING' },
  'error.request.not_found': { status: 'PENDING' },
  'error.request.payload_too_large': { status: 'PENDING' },
  'error.request.internal': { status: 'PENDING' },
};
