import { describe, expect, it } from 'vitest';
import type { DestinationAccess, ReadinessItem, ResolvingAction, SellerAccess } from '../../contracts/gap-sc';
import { actionFor } from './action';

const access = (destinations: DestinationAccess[]): SellerAccess => ({ seller_id: 'fx_s', seller_status: 'ACTIVE', capabilities: [], destinations, restriction: null });
const item = (kind: string, denied: ResolvingAction['denied'] = null, satisfied = false): ReadinessItem => ({
  code: 'X',
  satisfied,
  workflow_state: null,
  reason_codes: [],
  resolving_action: { kind, denied },
});
const all: DestinationAccess[] = [
  { key: 'home', access: 'GRANTED' },
  { key: 'store', access: 'GRANTED' },
  { key: 'products', access: 'GRANTED' },
];

describe('a readiness action respects permission, entitlement, destination and whether the destination is built', () => {
  it('is an active link only when permitted, entitled and the destination is built', () => {
    expect(actionFor(item('CONNECT_SOCIAL_ACCOUNT'), access(all), 'fx_s')).toMatchObject({ kind: 'link', built: true, to: '/s/fx_s/admission' });
  });

  it('leads to Company details now that it is built: an active link', () => {
    expect(actionFor(item('EDIT_COMPANY_DETAILS'), access(all), 'fx_s')).toMatchObject({ kind: 'link', built: true, to: '/s/fx_s/store/company' });
  });

  it('leads to Products now that it is built: an active link', () => {
    expect(actionFor(item('ADD_PRODUCT'), access(all), 'fx_s')).toMatchObject({ kind: 'link', built: true, to: '/s/fx_s/products' });
  });

  it('hides the action when its own permission is missing, whatever the entitlement', () => {
    expect(actionFor(item('ADD_PRODUCT', 'NO_PERMISSION'), access(all), 'fx_s')).toEqual({ kind: 'hidden' });
  });

  it('hides the action when the DESTINATION permission is missing (absent from the list), even if the action itself is entitlement-denied', () => {
    const noStore = access(all.filter((d) => d.key !== 'store'));
    expect(actionFor(item('EDIT_STORE_PROFILE'), noStore, 'fx_s')).toEqual({ kind: 'hidden' });
    expect(actionFor(item('EDIT_STORE_PROFILE', 'NO_ENTITLEMENT'), noStore, 'fx_s')).toEqual({ kind: 'hidden' });
  });

  it('disables (never links) an action whose own entitlement is missing', () => {
    expect(actionFor(item('ADD_PRODUCT', 'NO_ENTITLEMENT'), access(all), 'fx_s')).toMatchObject({ kind: 'disabled' });
  });

  it('disables (never links) an action whose DESTINATION is entitlement-denied, even though the action itself carries no denial', () => {
    const noEnt = access(all.map((d) => (d.key === 'products' ? { ...d, access: 'NO_ENTITLEMENT' as const } : d)));
    const result = actionFor(item('ADD_PRODUCT'), noEnt, 'fx_s');
    expect(result).toMatchObject({ kind: 'disabled' });
    expect(result).not.toHaveProperty('to');
  });

  it('shows no action for a satisfied requirement, a requirement without an action, or a kind this version does not know', () => {
    expect(actionFor(item('ADD_PRODUCT', null, true), access(all), 'fx_s')).toBeNull();
    expect(actionFor({ ...item('ADD_PRODUCT'), resolving_action: null }, access(all), 'fx_s')).toBeNull();
    expect(actionFor(item('SOMETHING_NEWER'), access(all), 'fx_s')).toEqual({ kind: 'hidden' });
  });
});
