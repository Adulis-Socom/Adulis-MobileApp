import type { DestinationKey, ReadinessItem, SellerAccess } from '../../contracts/gap-sc';
import { codeText, t } from '../../i18n/t';
import { destinationAccess, sellerPath } from '../../seller/access';

/**
 * Where a resolving action leads. The admission step, Products (SC-FE-04) and the Store profile and fulfilment (SC-FE-06) are built; the others lead to destinations
 * that honestly say they arrive later. An unknown kind has no destination, so it shows no action at all.
 */
const TARGETS: Record<string, { dest: DestinationKey; path: string; built: boolean }> = {
  CONNECT_SOCIAL_ACCOUNT: { dest: 'home', path: 'admission', built: true },
  EDIT_COMPANY_DETAILS: { dest: 'store', path: 'store', built: false },
  EDIT_STORE_PROFILE: { dest: 'store', path: 'store', built: true },
  CONFIGURE_FULFILMENT: { dest: 'store', path: 'store/fulfilment', built: true },
  ADD_PRODUCT: { dest: 'products', path: 'products', built: true },
};

export type RowAction =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'disabled'; readonly label: string }
  | { readonly kind: 'link'; readonly label: string; readonly to: string; readonly built: boolean };

/**
 * What a requirement's resolving action looks like to THIS account, from the server's answers only. Permission is
 * checked first and always wins: the action's own and its destination's. Only then entitlement, the action's own or
 * its destination's, which shows the action disabled with a reason. Only an action that is permitted, entitled and
 * leads to a built destination is an active link.
 */
export function actionFor(item: ReadinessItem, access: SellerAccess, sellerId: string): RowAction | null {
  const action = item.resolving_action;
  if (item.satisfied || !action) return null;
  if (action.denied === 'NO_PERMISSION') return { kind: 'hidden' };
  const target = TARGETS[action.kind];
  if (!target) return { kind: 'hidden' };
  const reach = destinationAccess(access, target.dest);
  if (reach === 'HIDDEN') return { kind: 'hidden' };
  const label = codeText('readiness.action', action.kind) ?? t('readiness.action.unknown');
  if (action.denied === 'NO_ENTITLEMENT' || reach === 'NO_ENTITLEMENT') return { kind: 'disabled', label };
  return { kind: 'link', label, to: sellerPath(sellerId, target.path), built: target.built };
}
