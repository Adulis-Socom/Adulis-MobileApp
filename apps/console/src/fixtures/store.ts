import type {
  Closure,
  CompanyDetails,
  CourierList,
  CourierRelationship,
  DayHours,
  FulfilmentMode,
  FulfilmentSetting,
  LocationCandidate,
  StoreLocation,
  StoreView,
  Weekday,
} from '../contracts/gap-sc-store';
import type { CallContext } from '../transport/port';
import { conflict, DAY_MS, denied, invalid, need, needCap, notFound, withIdempotency, type Authz, type Handlers, type Kit } from './kit';

/**
 * Fixture Store and Courier relationships (GAP-SC-13, GAP-SC-14). DEVELOPMENT ONLY. The server-side rules shown here are the
 * ones the governing designs state: coverage is EXPLICIT (Market eligibility grants no universal coverage, FUL Nov 24 change 2),
 * a delivery mode needs coverage, hours are local to the Market timezone (CON S102), the location is structured map-provider
 * data the server resolved (CON S98), and Courier delivery execution is not live (B02B-D02: only invitations, status,
 * relationships and revoke are retained).
 *
 * The readiness rules derived below (a Store profile is complete when name and bio are set; fulfilment is configured when a
 * mode is on, with coverage when it is a delivery mode) are FIXTURE rules for demonstration, recorded as provisional proposals.
 */
const WEEK: readonly Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MODES: readonly FulfilmentMode[] = ['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY'];
const TIMEZONE = 'Africa/Addis_Ababa';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const area = (label: string) => ({ id: `fx_area_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, label: `Demonstration area: ${label}` });
const ADDIS = area('Addis Ababa');
const COVERAGE_OPTIONS = [ADDIS, ...['Adama', 'Hawassa', 'Bahir Dar', 'Dire Dawa'].map(area)];
const PLACE_ONE: LocationCandidate = { provider: 'GOOGLE_MAPS', provider_reference: 'fx_place_1', display_address: 'Demonstration place 1, Bole, Addis Ababa', latitude: 9.0107, longitude: 38.7612 };
const PLACES: readonly LocationCandidate[] = [
  PLACE_ONE,
  { provider: 'GOOGLE_MAPS', provider_reference: 'fx_place_2', display_address: 'Demonstration place 2, Piassa, Addis Ababa', latitude: 9.0359, longitude: 38.7525 },
  { provider: 'APPLE_MAPS', provider_reference: 'fx_place_3', display_address: 'Demonstration place 3, Adama', latitude: 8.54, longitude: 39.27 },
];

interface StoreRec {
  version: number;
  display_name: string;
  bio: string;
  handle: string;
  location: StoreLocation | null;
  coverage: string[];
  weekly: DayHours[];
  closures: Closure[];
  modes: Record<FulfilmentMode, { enabled: boolean; instructions: string }>;
  company: CompanyDetails | null;
}
interface CourierRec {
  id: string;
  name: string;
  phone: string;
  status: CourierRelationship['status'];
  statusAt: number;
}

type StoreOps =
  | 'store.get'
  | 'store.profile.update'
  | 'store.location.search'
  | 'store.location.set'
  | 'store.coverage.set'
  | 'store.hours.set'
  | 'store.fulfilment.set'
  | 'store.company.update'
  | 'couriers.list'
  | 'couriers.invite'
  | 'couriers.revoke';

export interface Store {
  readonly handlers: Handlers<StoreOps>;
  /** Readiness facts, resolved from the data the Console can change, never from a stored flag. */
  profileComplete(sellerId: string): boolean;
  /** Readiness (COMPANY_DETAILS): true for a Seller that is not a Company, otherwise name, representative and contact are set. */
  companyComplete(sellerId: string): boolean;
  fulfilmentConfigured(sellerId: string): boolean;
}

export function createStore(kit: Kit): Store {
  const stores = new Map<string, StoreRec>();
  const couriers = new Map<string, CourierRec[]>();

  const week = (hours: Partial<Record<Weekday, [string, string][]>>): DayHours[] =>
    WEEK.map((day) => ({ day, intervals: (hours[day] ?? []).map(([open, close]) => ({ open, close })) }));

  function seed(sellerId: string): StoreRec {
    const f = kit.flags(sellerId);
    const rich = sellerId === 'fx_seller_alem';
    return {
      version: 1,
      display_name: f.name,
      bio: f.store ? `${f.name}: a demonstration store profile.` : '',
      handle: sellerId.replace('fx_seller_', ''),
      location: rich ? { ...PLACE_ONE, public: true } : null,
      coverage: f.fulfilment ? [ADDIS.id] : [],
      weekly: rich
        ? week({ MON: [['08:30', '17:30']], TUE: [['08:30', '17:30']], WED: [['08:30', '17:30']], THU: [['08:30', '17:30']], FRI: [['08:30', '12:30'], ['14:00', '17:30']], SAT: [['09:00', '13:00']] })
        : week({}),
      closures: rich ? [{ date: '2026-12-25', note: 'Demonstration holiday' }] : [],
      modes: {
        BUYER_COLLECTION: { enabled: f.fulfilment, instructions: f.fulfilment ? 'Collect at the shop during opening hours.' : '' },
        SELLER_DELIVERY: { enabled: false, instructions: '' },
        COURIER_DELIVERY: { enabled: false, instructions: '' },
      },
      company: f.company
        ? f.companyDetails
          ? { company_name: f.name, description: `${f.name} is a demonstration company.`, representative_name: 'Demonstration representative', contact_phone: '+251900000099' }
          : { company_name: '', description: '', representative_name: '', contact_phone: '' }
        : null,
    };
  }
  const storeOf = (sellerId: string): StoreRec => {
    let s = stores.get(sellerId);
    if (!s) {
      s = seed(sellerId);
      stores.set(sellerId, s);
    }
    return s;
  };
  /** One Seller's Market has a mode switched off (demonstration), so an unavailable mode is a state the Console must show. */
  const available = (sellerId: string, mode: FulfilmentMode): boolean => !(sellerId === 'fx_seller_kidist' && mode === 'COURIER_DELIVERY');

  function view(sellerId: string, s: StoreRec, a: Authz): StoreView {
    const fulfilment: FulfilmentSetting[] = MODES.map((mode) => ({ mode, available: available(sellerId, mode), enabled: s.modes[mode].enabled, instructions: s.modes[mode].instructions }));
    return {
      seller_id: sellerId,
      version: s.version,
      timezone: TIMEZONE,
      profile: { display_name: s.display_name, bio: s.bio, handle: s.handle },
      location: s.location,
      coverage: { selected: s.coverage, options: COVERAGE_OPTIONS },
      hours: { weekly: s.weekly, closures: s.closures },
      fulfilment,
      company: s.company,
      allowed_actions: a.caps.has('store.manage') ? (a.isOwner ? ['EDIT', 'EDIT_REPRESENTATIVE'] : ['EDIT']) : [],
    };
  }
  /** Common entry for a Store write: Seller scope, destination, capability, optimistic concurrency. */
  function open(ctx: CallContext, version: number): { a: Authz; s: StoreRec } {
    const a = kit.authz(ctx);
    need(a, 'store');
    needCap(a, 'store.manage');
    const s = storeOf(a.sellerId);
    if (s.version !== version) throw conflict();
    return { a, s };
  }
  const deliveryOn = (s: StoreRec): boolean => s.modes.SELLER_DELIVERY.enabled || s.modes.COURIER_DELIVERY.enabled;

  // ---- Couriers --------------------------------------------------------------------------------------------------------
  function courierSeed(sellerId: string): CourierRec[] {
    if (sellerId !== 'fx_seller_alem') return [];
    const rec = (n: number, name: string, status: CourierRec['status'], daysAgo: number): CourierRec => ({ id: `fx_rel_alem_${n}`, name, phone: `+25190000010${n}`, status, statusAt: kit.now() - daysAgo * DAY_MS });
    return [rec(3, 'Tigist (demonstration)', 'REVOKED', 12), rec(2, 'Yonas (demonstration)', 'INVITED', 1), rec(1, 'Meseret (demonstration)', 'ACTIVE', 30)];
  }
  const couriersOf = (sellerId: string): CourierRec[] => {
    let list = couriers.get(sellerId);
    if (!list) {
      list = courierSeed(sellerId);
      couriers.set(sellerId, list);
    }
    return list;
  };
  const courierList = (sellerId: string, a: Authz): CourierList => ({
    seller_id: sellerId,
    items: couriersOf(sellerId).map(
      (c): CourierRelationship => ({
        id: c.id,
        courier_display_name: c.name,
        status: c.status,
        status_at: kit.iso(c.statusAt),
        allowed_actions: a.caps.has('couriers.manage') && (c.status === 'ACTIVE' || c.status === 'INVITED') ? ['REVOKE'] : [],
      }),
    ),
    allowed_actions: a.caps.has('couriers.manage') ? ['INVITE'] : [],
    delivery_execution: 'UNAVAILABLE',
  });

  const handlers: Store['handlers'] = {
    'store.get': (_i, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'store');
      return view(a.sellerId, storeOf(a.sellerId), a);
    },
    'store.profile.update': ({ version, display_name, bio }, ctx) => {
      const { a, s } = open(ctx, version);
      if (display_name.trim() === '') throw invalid({ display_name: 'DISPLAY_NAME_REQUIRED' });
      s.display_name = display_name.trim();
      s.bio = bio;
      s.version += 1;
      return view(a.sellerId, s, a);
    },
    'store.location.search': ({ query }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'store');
      needCap(a, 'store.manage');
      const q = query.trim().toLowerCase();
      return { seller_id: a.sellerId, candidates: PLACES.filter((p) => q === '' || p.display_address.toLowerCase().includes(q)) };
    },
    'store.location.set': ({ version, candidate, public: isPublic }, ctx) => {
      const { a, s } = open(ctx, version);
      if (candidate === null) s.location = null;
      else {
        // The provider data is the server's to resolve: a place it did not offer cannot be set, and a typed address is not accepted.
        const known = PLACES.find((p) => p.provider === candidate.provider && p.provider_reference === candidate.provider_reference);
        if (!known) throw invalid({ location: 'LOCATION_NOT_RECOGNISED' });
        s.location = { ...known, public: isPublic };
      }
      s.version += 1;
      return view(a.sellerId, s, a);
    },
    'store.coverage.set': ({ version, selected }, ctx) => {
      const { a, s } = open(ctx, version);
      const errors: Record<string, string> = {};
      if (selected.some((id) => !COVERAGE_OPTIONS.some((o) => o.id === id))) errors['coverage'] = 'COVERAGE_AREA_UNKNOWN';
      else if (selected.length === 0 && deliveryOn(s)) errors['coverage'] = 'COVERAGE_REQUIRED_FOR_DELIVERY';
      if (Object.keys(errors).length > 0) throw invalid(errors);
      s.coverage = [...new Set(selected)];
      s.version += 1;
      return view(a.sellerId, s, a);
    },
    'store.hours.set': ({ version, weekly, closures }, ctx) => {
      const { a, s } = open(ctx, version);
      const errors: Record<string, string> = {};
      for (const day of weekly) {
        const ranges = day.intervals.map((i) => [i.open, i.close] as const);
        if (ranges.some(([o, c]) => !HHMM.test(o) || !HHMM.test(c) || o >= c)) errors[`hours-${day.day}`] = 'HOURS_INVALID';
        else {
          const sorted = [...ranges].sort(([x], [y]) => x.localeCompare(y));
          if (sorted.some((r, i) => i > 0 && (sorted[i - 1]?.[1] ?? '') > r[0])) errors[`hours-${day.day}`] = 'HOURS_OVERLAP';
        }
      }
      const seen = new Set<string>();
      closures.forEach((c, i) => {
        if (!DATE.test(c.date) || Number.isNaN(Date.parse(`${c.date}T00:00:00Z`))) errors[`closure-${i}`] = 'CLOSURE_DATE_INVALID';
        else if (seen.has(c.date)) errors[`closure-${i}`] = 'CLOSURE_DUPLICATE';
        seen.add(c.date);
      });
      if (Object.keys(errors).length > 0) throw invalid(errors);
      s.weekly = WEEK.map((d) => ({ day: d, intervals: weekly.find((x) => x.day === d)?.intervals.map((i) => ({ ...i })) ?? [] }));
      s.closures = closures.map((c) => ({ ...c })).sort((x, y) => x.date.localeCompare(y.date));
      s.version += 1;
      return view(a.sellerId, s, a);
    },
    'store.company.update': ({ version, details }, ctx) => {
      const { a, s } = open(ctx, version);
      if (s.company === null) throw notFound(); // not a Company Seller: there is nothing to edit
      const errors: Record<string, string> = {};
      if (details.company_name.trim() === '') errors['company_name'] = 'COMPANY_NAME_REQUIRED';
      if (details.representative_name.trim() === '') errors['representative_name'] = 'REPRESENTATIVE_REQUIRED';
      if (details.contact_phone.trim() !== '' && !/^\+?\d{9,15}$/.test(details.contact_phone.replace(/[\s-]/g, ''))) errors['contact_phone'] = 'PHONE_INVALID';
      if (Object.keys(errors).length > 0) throw invalid(errors);
      // Representative changes stay Owner-only (ONB-01 S178); ordinary metadata is Owner or Admin.
      if (!a.isOwner && details.representative_name.trim() !== s.company.representative_name && s.company.representative_name !== '') throw denied();
      s.company = { company_name: details.company_name.trim(), description: details.description, representative_name: details.representative_name.trim(), contact_phone: details.contact_phone.trim() };
      s.version += 1;
      return view(a.sellerId, s, a);
    },
    'store.fulfilment.set': ({ version, settings }, ctx) => {
      const { a, s } = open(ctx, version);
      const errors: Record<string, string> = {};
      const next = { ...s.modes };
      for (const m of settings) {
        if (m.enabled && !available(a.sellerId, m.mode)) errors[`fulfilment-${m.mode}`] = 'MODE_NOT_AVAILABLE';
        next[m.mode] = { enabled: m.enabled, instructions: m.instructions };
      }
      const wantsDelivery = next.SELLER_DELIVERY.enabled || next.COURIER_DELIVERY.enabled;
      if (wantsDelivery && s.coverage.length === 0) errors['fulfilment'] = 'COVERAGE_REQUIRED_FOR_DELIVERY';
      if (Object.keys(errors).length > 0) throw invalid(errors);
      s.modes = next;
      s.version += 1;
      return view(a.sellerId, s, a);
    },
    'couriers.list': (_i, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'store');
      return courierList(a.sellerId, a);
    },
    'couriers.invite': ({ phone }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'store');
      needCap(a, 'couriers.manage');
      {
        const digits = phone.replace(/[^\d+]/g, '');
        if (!/^\+?\d{9,15}$/.test(digits)) throw invalid({ phone: 'PHONE_INVALID' });
        const list = couriersOf(a.sellerId);
        // The same answer whether or not the number belongs to a Courier account: existence is never disclosed (enumeration resistance).
        if (!list.some((c) => c.phone === digits && (c.status === 'INVITED' || c.status === 'ACTIVE'))) {
          list.unshift({ id: kit.next('fx_rel'), name: `Courier ending ${digits.slice(-3)}`, phone: digits, status: 'INVITED', statusAt: kit.now() });
        }
        return courierList(a.sellerId, a);
      }
    },
    'couriers.revoke': ({ relationship_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'store');
      needCap(a, 'couriers.manage');
      const c = couriersOf(a.sellerId).find((x) => x.id === relationship_id);
      if (!c) throw notFound();
      if (c.status !== 'ACTIVE' && c.status !== 'INVITED') throw conflict();
      c.status = 'REVOKED';
      c.statusAt = kit.now();
      return courierList(a.sellerId, a);
    },
  };

  return {
    handlers: withIdempotency(kit, handlers, { 'couriers.invite': { dest: 'store', cap: 'couriers.manage' } }),
    profileComplete: (sellerId) => {
      const s = storeOf(sellerId);
      return s.display_name.trim() !== '' && s.bio.trim() !== '';
    },
    companyComplete: (sellerId) => {
      const c = storeOf(sellerId).company;
      return c === null || (c.company_name.trim() !== '' && c.representative_name.trim() !== '' && c.contact_phone.trim() !== '');
    },
    fulfilmentConfigured: (sellerId) => {
      const s = storeOf(sellerId);
      const on = MODES.filter((m) => s.modes[m].enabled && available(sellerId, m));
      return on.length > 0 && (!deliveryOn(s) || s.coverage.length > 0);
    },
  };
}
