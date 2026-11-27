import type { DestinationKey, SellerAccess } from '../contracts/gap-sc';
import type { IconName } from '../components/Icon';

/**
 * Destinations as presentation. WHAT the account may see is the server's `SellerAccess`; this table only says what
 * each destination is called, where it lives and which icon it wears. Missing permission = the destination is not in
 * `access.destinations` and is never rendered; missing entitlement = `NO_ENTITLEMENT`, rendered disabled with a reason.
 */
export type NavLabelKey = 'nav.home' | 'nav.products' | 'nav.content' | 'nav.inbox' | 'nav.insights' | 'nav.store' | 'nav.trust' | 'nav.settings';
export type AreaTitleKey = 'nav.home' | 'area.products' | 'area.content' | 'area.inbox' | 'area.insights' | 'area.store' | 'area.trust' | 'area.settings';

export interface DestinationMeta {
  readonly key: DestinationKey;
  readonly path: string;
  readonly label: NavLabelKey;
  readonly area: AreaTitleKey;
  readonly icon: IconName;
  /** In the narrow bottom bar (Home, Products, Inbox, More): CONSOLE-02 S23 with Orders removed by the Nov 24 layer. */
  readonly bottomBar: boolean;
}

export const DESTINATIONS: readonly DestinationMeta[] = [
  { key: 'home', path: '', label: 'nav.home', area: 'nav.home', icon: 'home', bottomBar: true },
  { key: 'products', path: 'products', label: 'nav.products', area: 'area.products', icon: 'box', bottomBar: true },
  { key: 'content', path: 'content', label: 'nav.content', area: 'area.content', icon: 'image', bottomBar: false },
  { key: 'inbox', path: 'inbox', label: 'nav.inbox', area: 'area.inbox', icon: 'inbox', bottomBar: true },
  { key: 'insights', path: 'insights', label: 'nav.insights', area: 'area.insights', icon: 'chart', bottomBar: false },
  { key: 'store', path: 'store', label: 'nav.store', area: 'area.store', icon: 'store', bottomBar: false },
  { key: 'trust', path: 'trust', label: 'nav.trust', area: 'area.trust', icon: 'shield', bottomBar: false },
  { key: 'settings', path: 'settings', label: 'nav.settings', area: 'area.settings', icon: 'sliders', bottomBar: false },
];

export type Access = 'GRANTED' | 'NO_ENTITLEMENT' | 'HIDDEN';

export function destinationAccess(access: SellerAccess, key: DestinationKey): Access {
  const found = access.destinations.find((d) => d.key === key);
  return found ? found.access : 'HIDDEN';
}

/** A capability the server listed. An unknown string from a newer server is simply not one this version acts on. */
export function can(access: SellerAccess, capability: string): boolean {
  return access.capabilities.includes(capability);
}

export interface NavItem {
  readonly meta: DestinationMeta;
  readonly access: 'GRANTED' | 'NO_ENTITLEMENT';
}

export interface Nav {
  /** Sidebar: every destination the account can see, in the fixed order. */
  readonly sidebar: readonly NavItem[];
  /** Bottom bar entries (before "More"): granted ones only, so a disabled entry and its reason live in More. */
  readonly bottom: readonly NavItem[];
  /** What "More" lists: everything not in the bottom bar. */
  readonly more: readonly NavItem[];
}

export function navFor(access: SellerAccess): Nav {
  const visible: NavItem[] = DESTINATIONS.flatMap((meta) => {
    const a = destinationAccess(access, meta.key);
    return a === 'HIDDEN' ? [] : [{ meta, access: a }];
  });
  return {
    sidebar: visible,
    bottom: visible.filter((i) => i.meta.bottomBar && i.access === 'GRANTED'),
    more: visible.filter((i) => !(i.meta.bottomBar && i.access === 'GRANTED')),
  };
}

export function sellerPath(sellerId: string, suffix = ''): string {
  return suffix === '' ? `/s/${sellerId}` : `/s/${sellerId}/${suffix}`;
}
