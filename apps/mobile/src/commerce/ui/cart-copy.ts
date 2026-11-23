import type { MobileMessageKey } from '@adulis/locale/mobile';

import type { LineIssue } from '../cart/model';

/**
 * The words for each reason a cart line can carry: one key per value the Cart model defines, and no value it does not
 * (a Record over LineIssue fails to compile if the model gains or loses a reason). UNAVAILABLE is defined by the model
 * but never produced by it (an answer that only says "not available" is read as UNKNOWN), so its sentence is
 * unreachable today; it exists so the table stays exhaustive.
 */
export const LINE_ISSUE_KEY: Record<LineIssue, MobileMessageKey> = {
  NO_LONGER_PUBLISHED: 'buyer.cart.issue.NO_LONGER_PUBLISHED',
  VARIANT_WITHDRAWN: 'buyer.cart.issue.VARIANT_WITHDRAWN',
  SELLER_UNAVAILABLE: 'buyer.cart.issue.SELLER_UNAVAILABLE',
  SOLD_OUT: 'buyer.cart.issue.SOLD_OUT',
  UNAVAILABLE: 'buyer.cart.issue.UNAVAILABLE',
  INSUFFICIENT_STOCK: 'buyer.cart.issue.INSUFFICIENT_STOCK',
  PRICE_CHANGED: 'buyer.cart.issue.PRICE_CHANGED',
  UNKNOWN: 'buyer.cart.issue.UNKNOWN',
};

/** Why a cart that cannot be vouched for is not drawn with its facts. */
export const UNVERIFIED_KEY = {
  offline: 'buyer.cart.unverified_offline',
  failed: 'buyer.cart.unverified_failed',
  checking: 'buyer.cart.unverified_checking',
} as const satisfies Record<'offline' | 'failed' | 'checking', MobileMessageKey>;
