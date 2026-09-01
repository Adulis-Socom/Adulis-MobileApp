/**
 * lib/readiness.ts -- the ONE mapping from the server's readiness item codes
 * to the labels a person reads. Lived in Home.tsx (SC-01) through C-4; C-5's
 * pass moved it here when SC-08's publish blockers turned out to carry the
 * same codes in items[].slots.item -- the alternative was a second copy, and
 * a rule kept in two places grows a stale one (root CLAUDE.md).
 *
 * A code the server sends that is not in here still RENDERS -- as its own
 * code -- because a screen that silently drops a row it does not recognise
 * turns a new readiness requirement into an invisible one, and the seller
 * would be blocked by something the screen never showed them.
 */
import { en } from '@adulis/locale';

export const ITEM_LABEL: Readonly<Record<string, string>> = {
  ACCOUNT_CREATED: en['console.home.item.account_created'],
  SELLER_TYPE_DECLARED: en['console.home.item.seller_type_declared'],
  ELIGIBILITY_SATISFIED: en['console.home.item.eligibility_satisfied'],
  IDENTITY_VERIFIED: en['console.home.item.identity_verified'],
  COMPANY_DETAILS: en['console.home.item.company_details'],
  STORE_PROFILE: en['console.home.item.store_profile'],
  PAYOUT_DETAILS: en['console.home.item.payout_details'],
  FULFILMENT_CONFIG: en['console.home.item.fulfilment_config'],
  AT_LEAST_ONE_PRODUCT: en['console.home.item.at_least_one_product'],
};
