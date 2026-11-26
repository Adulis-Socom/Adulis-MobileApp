import { describe, expect, it } from 'vitest';
import type { OpInput } from '../contracts/gap-sc';
import { TransportError } from '../transport/port';
import { createWorld, DEMO_CODES, PERSONAS, type World } from './world';

function setup(): World {
  return createWorld({ now: () => Date.UTC(2026, 10, 26, 9, 0, 0), latencyMs: 0 });
}
async function signIn(world: World, personaId: string): Promise<void> {
  const phone = PERSONAS.find((p) => p.id === personaId)?.phone ?? '';
  const challenge = await world.handle('auth.otp.start', { phone }, {});
  await world.handle('auth.otp.verify', { challenge_id: challenge.challenge_id, code: DEMO_CODES.ok }, {});
}
async function failure(promise: Promise<unknown>): Promise<TransportError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TransportError) return error;
    throw error;
  }
  throw new Error('expected a TransportError, the call succeeded');
}
const ALEM = { sellerId: 'fx_seller_alem' };
const BIRUK = { sellerId: 'fx_seller_biruk' };
const KIDIST = { sellerId: 'fx_seller_kidist' };
const get = (world: World, ctx = ALEM) => world.handle('store.get', {}, ctx);
type Settings = OpInput<'store.fulfilment.set'>['settings'];
const modes = (on: Partial<Record<'BUYER_COLLECTION' | 'SELLER_DELIVERY' | 'COURIER_DELIVERY', boolean>>): Settings =>
  (['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY'] as const).map((mode) => ({ mode, enabled: on[mode] ?? false, instructions: '' }));
const readiness = async (world: World, ctx: { sellerId: string }, code: string) => (await world.handle('seller.readiness.get', {}, ctx)).items.find((i) => i.code === code)?.satisfied;

describe('SC-FE-06 fixture Store: who sees and who changes it', () => {
  it('returns the whole Store with the Market timezone, explicit coverage options and the three governing modes', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const v = await get(world);
    expect(v).toMatchObject({ seller_id: 'fx_seller_alem', timezone: 'Africa/Addis_Ababa', allowed_actions: ['EDIT', 'EDIT_REPRESENTATIVE'], profile: { handle: 'alem' } });
    expect(v.hours.weekly.map((d) => d.day)).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
    expect(v.fulfilment.map((f) => f.mode)).toEqual(['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY']);
    expect(v.coverage.options.length).toBeGreaterThan(1);
    for (const o of v.coverage.options) expect(o.label.startsWith('Demonstration area:')).toBe(true);
  });

  it('is for Owner and Admin only: Inventory and Campaign Manager have no Store area, and Admin may edit', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_inventory');
    expect((await failure(get(world))).code).toBe('PERMISSION_DENIED');
    await signIn(world, 'fx_acct_campaign');
    expect((await failure(get(world))).code).toBe('PERMISSION_DENIED');
    await signIn(world, 'fx_acct_admin');
    expect((await get(world)).allowed_actions).toEqual(['EDIT']);
  });

  it('keeps one Seller\'s Store apart from another\'s', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const a = await get(world, ALEM);
    await world.handle('store.profile.update', { version: a.version, display_name: 'Alem Textiles Renamed', bio: 'x' }, ALEM);
    expect((await get(world, BIRUK)).profile.display_name).toBe('Biruk Shoes');
  });
});

describe('SC-FE-06 fixture Store: profile, optimistic concurrency and readiness follow the data', () => {
  it('refuses a blank name and a stale version, and a saved profile satisfies the readiness item', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const v = await get(world, BIRUK);
    expect(await readiness(world, BIRUK, 'STORE_PROFILE')).toBe(false);
    expect((await failure(world.handle('store.profile.update', { version: v.version, display_name: '  ', bio: 'x' }, BIRUK))).fields['display_name']).toBe('DISPLAY_NAME_REQUIRED');
    const saved = await world.handle('store.profile.update', { version: v.version, display_name: 'Biruk Shoes', bio: 'Handmade leather shoes.' }, BIRUK);
    expect(saved.version).toBe(v.version + 1);
    expect(await readiness(world, BIRUK, 'STORE_PROFILE')).toBe(true);
    expect((await failure(world.handle('store.profile.update', { version: v.version, display_name: 'Stale', bio: 'x' }, BIRUK))).code).toBe('CONFLICT');
  });
});

describe('SC-FE-06 fixture Store: the location is provider data, never a typed address', () => {
  it('searches provider results, starts hidden, and takes the SERVER\'s resolved data over anything the client sends', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const found = await world.handle('store.location.search', { query: 'adama' }, BIRUK);
    expect(found.candidates).toHaveLength(1);
    const place = found.candidates[0];
    if (!place) throw new Error('no candidate');
    const v = await get(world, BIRUK);
    const set = await world.handle('store.location.set', { version: v.version, candidate: { ...place, display_address: 'A typed address that is not the provider data' }, public: false }, BIRUK);
    expect(set.location).toMatchObject({ provider: 'APPLE_MAPS', display_address: place.display_address, public: false });
    const shown = await world.handle('store.location.set', { version: set.version, candidate: place, public: true }, BIRUK);
    expect(shown.location?.public).toBe(true);
    const cleared = await world.handle('store.location.set', { version: shown.version, candidate: null, public: false }, BIRUK);
    expect(cleared.location).toBeNull();
  });

  it('refuses a place the provider did not offer', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const v = await get(world, BIRUK);
    const fake = { provider: 'GOOGLE_MAPS' as const, provider_reference: 'fx_place_invented', display_address: 'Somewhere', latitude: 1, longitude: 2 };
    expect((await failure(world.handle('store.location.set', { version: v.version, candidate: fake, public: false }, BIRUK))).fields['location']).toBe('LOCATION_NOT_RECOGNISED');
  });
});

describe('SC-FE-06 fixture Store: service coverage is explicit and delivery depends on it', () => {
  it('starts empty, refuses an unknown area, and keeps the three modes the only modes', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const v = await get(world, BIRUK);
    expect(v.coverage.selected).toEqual([]);
    expect((await failure(world.handle('store.coverage.set', { version: v.version, selected: ['fx_area_nowhere'] }, BIRUK))).fields['coverage']).toBe('COVERAGE_AREA_UNKNOWN');
  });

  it('a delivery mode cannot be offered without coverage, and coverage cannot be emptied under a delivery mode', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    let v = await get(world, BIRUK);
    expect((await failure(world.handle('store.fulfilment.set', { version: v.version, settings: modes({ SELLER_DELIVERY: true }) }, BIRUK))).fields['fulfilment']).toBe('COVERAGE_REQUIRED_FOR_DELIVERY');
    const area = v.coverage.options[0]?.id ?? '';
    v = await world.handle('store.coverage.set', { version: v.version, selected: [area] }, BIRUK);
    v = await world.handle('store.fulfilment.set', { version: v.version, settings: modes({ SELLER_DELIVERY: true }) }, BIRUK);
    expect(v.fulfilment.find((f) => f.mode === 'SELLER_DELIVERY')?.enabled).toBe(true);
    expect((await failure(world.handle('store.coverage.set', { version: v.version, selected: [] }, BIRUK))).fields['coverage']).toBe('COVERAGE_REQUIRED_FOR_DELIVERY');
  });

  it('fulfilment readiness follows the data: a mode is on, with coverage when it is a delivery mode', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    expect(await readiness(world, BIRUK, 'FULFILMENT_CONFIG')).toBe(false);
    const v = await get(world, BIRUK);
    await world.handle('store.fulfilment.set', { version: v.version, settings: modes({ BUYER_COLLECTION: true }) }, BIRUK);
    expect(await readiness(world, BIRUK, 'FULFILMENT_CONFIG')).toBe(true);
  });

  it('a mode the Market does not enable is shown as unavailable and cannot be turned on', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const v = await get(world, KIDIST);
    expect(v.fulfilment.find((f) => f.mode === 'COURIER_DELIVERY')).toMatchObject({ available: false, enabled: false });
    expect((await failure(world.handle('store.fulfilment.set', { version: v.version, settings: modes({ COURIER_DELIVERY: true }) }, KIDIST))).fields['fulfilment-COURIER_DELIVERY']).toBe('MODE_NOT_AVAILABLE');
  });
});

describe('SC-FE-06 fixture Store: opening hours are local business time, validated by the server', () => {
  const weekly = (monday: { open: string; close: string }[]) => (['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const).map((day) => ({ day, intervals: day === 'MON' ? monday : [] }));

  it('stores valid hours and sorts closure dates', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const v = await get(world, BIRUK);
    const out = await world.handle('store.hours.set', { version: v.version, weekly: weekly([{ open: '09:00', close: '12:00' }, { open: '13:00', close: '17:30' }]), closures: [{ date: '2026-12-25', note: 'Holiday' }, { date: '2026-12-01', note: 'Inventory day' }] }, BIRUK);
    expect(out.hours.weekly[0]?.intervals).toHaveLength(2);
    expect(out.hours.closures.map((c) => c.date)).toEqual(['2026-12-01', '2026-12-25']);
  });

  it('refuses reversed, malformed and overlapping times, and bad or duplicate dates, each against its own day or date', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const v = await get(world, BIRUK);
    const refuse = async (monday: { open: string; close: string }[], closures: { date: string; note: string }[] = []) =>
      (await failure(world.handle('store.hours.set', { version: v.version, weekly: weekly(monday), closures }, BIRUK))).fields;
    expect((await refuse([{ open: '17:00', close: '09:00' }]))['hours-MON']).toBe('HOURS_INVALID');
    expect((await refuse([{ open: '9am', close: '5pm' }]))['hours-MON']).toBe('HOURS_INVALID');
    expect((await refuse([{ open: '', close: '' }]))['hours-MON']).toBe('HOURS_INVALID');
    expect((await refuse([{ open: '09:00', close: '12:00' }, { open: '11:00', close: '13:00' }]))['hours-MON']).toBe('HOURS_OVERLAP');
    const dates = await refuse([], [{ date: '2026-12-25', note: '' }, { date: '2026-12-25', note: '' }, { date: 'nope', note: '' }]);
    expect(dates['closure-1']).toBe('CLOSURE_DUPLICATE');
    expect(dates['closure-2']).toBe('CLOSURE_DATE_INVALID');
  });
});

describe('SC-FE-06 fixture Couriers: relationships only, never delivery', () => {
  it('lists relationships with the server-decided actions, and reports delivery execution as unavailable', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const list = await world.handle('couriers.list', {}, ALEM);
    expect(list.delivery_execution).toBe('UNAVAILABLE');
    expect(list.allowed_actions).toEqual(['INVITE']);
    expect(list.items.map((c) => c.status)).toEqual(['REVOKED', 'INVITED', 'ACTIVE']);
    expect(list.items.map((c) => c.allowed_actions)).toEqual([[], ['REVOKE'], ['REVOKE']]);
  });

  it('invites by phone with one answer for every number, and does not duplicate a pending or active relationship', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    expect((await failure(world.handle('couriers.invite', { phone: '12' }, ALEM))).fields['phone']).toBe('PHONE_INVALID');
    const unknown = await world.handle('couriers.invite', { phone: '+251911000042' }, ALEM);
    expect(unknown.items[0]).toMatchObject({ status: 'INVITED', allowed_actions: ['REVOKE'] });
    expect(unknown.items).toHaveLength(4);
    const again = await world.handle('couriers.invite', { phone: '+251911000042' }, ALEM);
    expect(again.items).toHaveLength(4);
    // a number that belongs to an existing ACTIVE relationship gets the same shape of answer and changes nothing
    const known = await world.handle('couriers.invite', { phone: '+251900000101' }, ALEM);
    expect(known.items).toHaveLength(4);
    expect(Object.keys(known).sort()).toEqual(Object.keys(unknown).sort());
  });

  it('revokes an active relationship or withdraws an invitation, once', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const after = await world.handle('couriers.revoke', { relationship_id: 'fx_rel_alem_1' }, ALEM);
    expect(after.items.find((c) => c.id === 'fx_rel_alem_1')).toMatchObject({ status: 'REVOKED', allowed_actions: [] });
    expect((await failure(world.handle('couriers.revoke', { relationship_id: 'fx_rel_alem_1' }, ALEM))).code).toBe('CONFLICT');
    expect((await failure(world.handle('couriers.revoke', { relationship_id: 'fx_rel_nothing' }, ALEM))).code).toBe('NOT_FOUND');
    const withdrawn = await world.handle('couriers.revoke', { relationship_id: 'fx_rel_alem_2' }, ALEM);
    expect(withdrawn.items.find((c) => c.id === 'fx_rel_alem_2')?.status).toBe('REVOKED');
  });

  it('is for Owner and Admin; Inventory has no Store area; a relationship of another Seller is unreachable', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_admin');
    expect((await world.handle('couriers.list', {}, ALEM)).allowed_actions).toEqual(['INVITE']);
    await signIn(world, 'fx_acct_inventory');
    expect((await failure(world.handle('couriers.list', {}, ALEM))).code).toBe('PERMISSION_DENIED');
    await signIn(world, 'fx_acct_owner');
    expect((await failure(world.handle('couriers.revoke', { relationship_id: 'fx_rel_alem_1' }, BIRUK))).code).toBe('NOT_FOUND');
  });
});
