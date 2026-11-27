import { describe, expect, it } from 'vitest';
import { ACTION_LABEL, BUCKET_LABEL, COPY, MODE_LABEL, ROLE_LABEL, SIM_MARKER, STATE_LABEL } from './copy';
import { ALL_STATE_NAMES, allowedActions, apply, canPrepare, canRead, changeElsewhere, seed, SimConflict, SimRefused, type SimRole } from './model';

const ROLES: SimRole[] = ['OWNER', 'ADMIN', 'SALES_SUPPORT', 'INVENTORY', 'ANALYST'];
const order = (id: string) => {
  const found = seed().find((o) => o.id === id);
  if (!found) throw new Error(`no seeded order ${id}`);
  return found;
};

describe('SC-FE-07 permissions (AUTH-02 Order codes as the design digest records them)', () => {
  it('lets Owner, Admin, Sales Support and Inventory read, and Analyst nothing', () => {
    expect(ROLES.filter(canRead)).toEqual(['OWNER', 'ADMIN', 'SALES_SUPPORT', 'INVENTORY']);
  });
  it('lets only Owner, Admin and Inventory prepare; Sales Support reads only', () => {
    expect(ROLES.filter(canPrepare)).toEqual(['OWNER', 'ADMIN', 'INVENTORY']);
    expect(allowedActions('SALES_SUPPORT', order('fx_sim_ord_001'))).toEqual([]);
    expect(allowedActions('ANALYST', order('fx_sim_ord_001'))).toEqual([]);
  });
  it('lists exactly one next action, and none once the Order is Ready', () => {
    expect(allowedActions('INVENTORY', order('fx_sim_ord_001'))).toEqual(['START_PREPARING']);
    expect(allowedActions('INVENTORY', order('fx_sim_ord_003'))).toEqual(['MARK_READY']);
    expect(allowedActions('OWNER', order('fx_sim_ord_004'))).toEqual([]);
  });
});

describe('SC-FE-07 transitions', () => {
  it('walks Needs action to Preparing to Ready and stops', () => {
    const one = order('fx_sim_ord_001');
    const preparing = apply(seed(), 'INVENTORY', one.id, one.version, 'START_PREPARING');
    const afterStart = preparing.find((o) => o.id === one.id);
    expect(afterStart?.bucket).toBe('PREPARING');
    const ready = apply(preparing, 'INVENTORY', one.id, afterStart?.version ?? 0, 'MARK_READY');
    expect(ready.find((o) => o.id === one.id)?.bucket).toBe('READY');
    expect(() => apply(ready, 'INVENTORY', one.id, 3, 'MARK_READY')).toThrow(SimRefused);
  });
  it('refuses a role without the permission BEFORE it looks at the version', () => {
    const one = order('fx_sim_ord_001');
    expect(() => apply(seed(), 'SALES_SUPPORT', one.id, 999, 'START_PREPARING')).toThrow(SimRefused);
  });
  it('refuses a stale write with a conflict, and the stored Order is unchanged', () => {
    const one = order('fx_sim_ord_001');
    const moved = changeElsewhere(seed(), one.id);
    expect(() => apply(moved, 'INVENTORY', one.id, one.version, 'START_PREPARING')).toThrow(SimConflict);
    expect(moved.find((o) => o.id === one.id)?.version).toBe(one.version + 1);
  });
  it('treats an unknown Order as not found', () => {
    expect(() => apply(seed(), 'OWNER', 'fx_sim_ord_999', 1, 'START_PREPARING')).toThrow(SimRefused);
  });
  it('never mutates the list it was given', () => {
    const before = seed();
    const frozen = JSON.stringify(before);
    apply(before, 'OWNER', 'fx_sim_ord_001', 1, 'START_PREPARING');
    expect(JSON.stringify(before)).toBe(frozen);
  });
});

describe('SC-FE-07 boundary: nothing that implies payment, handover, delivery or a refund exists', () => {
  const FORBIDDEN = /pay|paid|refund|revenue|gmv|payout|handoff|handover|transit|delivered|out for delivery|picked up|tracking|settle|reservation|charge/i;
  it('has only the three preparation states', () => {
    expect(ALL_STATE_NAMES).toEqual(['NEEDS_ACTION', 'PREPARING', 'READY']);
    for (const name of ALL_STATE_NAMES) expect(name).not.toMatch(FORBIDDEN);
  });
  it('has no forbidden word in any visible label or sentence', () => {
    const everything = [...Object.values(COPY), ...Object.values(BUCKET_LABEL), ...Object.values(ACTION_LABEL), ...Object.values(ROLE_LABEL), ...Object.values(STATE_LABEL), ...Object.values(MODE_LABEL)];
    // "delivery" is allowed only as the NAME of a fulfilment method the designs define (Seller Delivery, Courier Delivery), and "No stock, payment..." only as a negation.
    const offending = everything.filter((text) => FORBIDDEN.test(text.replace(/\b(Seller|Courier) Delivery\b/g, '').replace(/No stock, payment or delivery was affected\./, '').replace(/Payment, handover and delivery are not part of this demonstration\./, '').replace(/No Order, stock, money or delivery exists/, '')));
    expect(offending).toEqual([]);
  });
  it('states clearly that it is synthetic, and every id carries the reserved prefix', () => {
    expect(COPY.notice).toMatch(/synthetic/i);
    for (const o of seed()) expect(o.id.startsWith('fx_sim_ord_')).toBe(true);
    expect(SIM_MARKER.length).toBeGreaterThan(10);
  });
});
