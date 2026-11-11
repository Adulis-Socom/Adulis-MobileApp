import type { components } from '@adulis/api-client';

import { DEFAULT_COLLECTION_REF, problem, type installFakeApi, type Recorded, type Reply, type ShopProduct } from './fake-api';

type S = components['schemas'];
type Target = { type: 'PRODUCT_POST' | 'SCENE_POST'; ref: string };
type Item = { ref: string; collection: string; target: Target; at: number };

/**
 * An in-memory Collections server for mobile tests (WO-009), on the real API's rules: one
 * DEFAULT, owner-only (one Buyer here), a repeated Save returns the same membership, removal is
 * idempotent, and items resolve NOW -- a target in `hidden` is UNAVAILABLE with no detail.
 */
export function installFakeCollections(
  api: ReturnType<typeof installFakeApi>,
  { products = {}, scenes = {} }: { products?: Record<string, ShopProduct>; scenes?: Record<string, S['SearchSceneDto']> } = {},
) {
  let clock = 0;
  let next = 100; // never DEFAULT_COLLECTION_REF (...0001)
  const id = () => `0c000000-0000-4000-8000-${String(next++).padStart(12, '0')}`;
  const collections: Array<{ ref: string; kind: 'DEFAULT' | 'USER_CREATED'; name: string | null; at: number }> = [
    { ref: DEFAULT_COLLECTION_REF, kind: 'DEFAULT', name: null, at: clock++ },
  ];
  const items: Item[] = [];
  const hidden = new Set<string>();
  // A test can answer a route itself (fail it, hold it); undefined falls through to the fake.
  const intercepts: Partial<Record<'add' | 'saves' | 'collections' | 'state', (call: Recorded) => Reply | undefined | Promise<Reply | undefined>>> = {};
  const via =
    (name: keyof typeof intercepts, handler: (call: Recorded) => Reply) =>
    async (call: Recorded): Promise<Reply> =>
      (await intercepts[name]?.(call)) ?? handler(call);
  const key = (t: Target) => `${t.type}:${t.ref}`;
  const ts = (n: number) => `2026-11-11T08:00:${String(n % 60).padStart(2, '0')}.000000Z`;

  const summary = (c: (typeof collections)[number]): S['CollectionDto'] => ({
    ref: c.ref,
    kind: c.kind,
    name: c.name,
    product_count: items.filter((i) => i.collection === c.ref && i.target.type === 'PRODUCT_POST').length,
    scene_count: items.filter((i) => i.collection === c.ref && i.target.type === 'SCENE_POST').length,
    created_at: ts(c.at),
    updated_at: ts(c.at),
  });
  const present = (i: Item): S['CollectionItemDto'] => {
    const visible = !hidden.has(key(i.target));
    const product = visible && i.target.type === 'PRODUCT_POST' ? (products[i.target.ref] ?? null) : null;
    const scene = visible && i.target.type === 'SCENE_POST' ? (scenes[i.target.ref] ?? null) : null;
    return {
      ref: i.ref,
      collection_ref: i.collection,
      target_type: i.target.type,
      state: product || scene ? 'VISIBLE' : 'UNAVAILABLE',
      saved_at: ts(i.at),
      product,
      scene,
    };
  };
  const filtered = (call: Recorded, list: Item[]) => {
    const type = call.query.type ?? 'ALL';
    return list.filter((i) => type === 'ALL' || i.target.type === type).sort((a, b) => b.at - a.at);
  };
  const owned = (ref: string | undefined) => collections.find((c) => c.ref === ref);
  const refAt = (path: string, n: number) => path.split('/')[n];

  api.on(
    'GET /v1/collections',
    via('collections', () => ({
      status: 200,
      body: { default_collection_ref: DEFAULT_COLLECTION_REF, data: collections.map(summary), next_cursor: null },
    })),
  );
  api.on('POST /v1/collections', (call) => {
    const name = String(call.body?.name ?? '').trim();
    if (name.length < 1 || name.length > 60) return problem(400, 'VALIDATION_FAILED', 'request', { path: 'name' });
    const c = { ref: id(), kind: 'USER_CREATED' as const, name, at: clock++ };
    collections.push(c);
    return { status: 201, body: { ref: c.ref } };
  });
  api.on(
    'GET /v1/collections/saves',
    via('saves', (call) => {
      const seen = new Set<string>();
      const latest = filtered(call, items).filter((i) => (seen.has(key(i.target)) ? false : (seen.add(key(i.target)), true)));
      return { status: 200, body: { data: latest.map(present), next_cursor: null } };
    }),
  );
  api.on('POST /v1/collections/saved-state:batch', via('state', (call) => ({
    status: 200,
    body: {
      default_collection_ref: DEFAULT_COLLECTION_REF,
      items: ((call.body?.targets ?? []) as Target[]).map((t) => {
        const held = items.filter((i) => key(i.target) === key(t));
        const inDefault = held.find((i) => i.collection === DEFAULT_COLLECTION_REF);
        return {
          ...t,
          saved: inDefault !== undefined,
          default_item_ref: inDefault?.ref ?? null,
          memberships: held.map((i) => ({ collection_ref: i.collection, item_ref: i.ref })),
        };
      }),
    },
  })));
  api.onPattern('GET', /^\/v1\/collections\/[^/]+$/, (call) => {
    const c = owned(refAt(call.path, 3));
    if (!c) return problem(404, 'NOT_FOUND', 'request');
    return { status: 200, body: { collection: summary(c), data: filtered(call, items.filter((i) => i.collection === c.ref)).map(present), next_cursor: null } };
  });
  api.onPattern('PATCH', /^\/v1\/collections\/[^/]+$/, (call) => {
    const c = owned(refAt(call.path, 3));
    if (!c) return problem(404, 'NOT_FOUND', 'request');
    if (c.kind === 'DEFAULT') return problem(400, 'VALIDATION_FAILED', 'request', { path: 'collectionRef' });
    c.name = String(call.body?.name ?? '').trim();
    return { status: 200, body: summary(c) };
  });
  api.onPattern('DELETE', /^\/v1\/collections\/[^/]+$/, (call) => {
    const c = owned(refAt(call.path, 3));
    if (!c) return problem(404, 'NOT_FOUND', 'request');
    if (c.kind === 'DEFAULT') return problem(400, 'VALIDATION_FAILED', 'request', { path: 'collectionRef' });
    collections.splice(collections.indexOf(c), 1);
    for (let n = items.length - 1; n >= 0; n--) if (items[n]!.collection === c.ref) items.splice(n, 1);
    return { status: 204 };
  });
  api.onPattern('POST', /^\/v1\/collections\/[^/]+\/items$/, via('add', (call) => {
    const c = owned(refAt(call.path, 3));
    const target = call.body?.target as Target | undefined;
    if (!c || !target || hidden.has(key(target))) return problem(404, 'NOT_FOUND', 'request');
    const existing = items.find((i) => i.collection === c.ref && key(i.target) === key(target));
    const item = existing ?? { ref: id(), collection: c.ref, target, at: clock++ };
    if (!existing) items.push(item);
    return { status: 201, body: { ref: item.ref, collection_ref: item.collection, target_type: item.target.type, saved_at: ts(item.at) } };
  }));
  api.onPattern('DELETE', /^\/v1\/collections\/[^/]+\/items\/[^/]+$/, (call) => {
    const c = owned(refAt(call.path, 3));
    if (!c) return problem(404, 'NOT_FOUND', 'request');
    const n = items.findIndex((i) => i.collection === c.ref && i.ref === refAt(call.path, 5));
    if (n >= 0) items.splice(n, 1);
    return { status: 204 };
  });

  return {
    collections,
    items,
    intercept: (name: keyof typeof intercepts, fn: (call: Recorded) => Reply | undefined | Promise<Reply | undefined>) => {
      intercepts[name] = fn;
    },
    /** A named Collection that already exists on the server. */
    named: (name: string) => {
      const c = { ref: id(), kind: 'USER_CREATED' as const, name, at: clock++ };
      collections.push(c);
      return c.ref;
    },
    /** The target stops resolving publicly (unpublished, PRIVATE, another Market...). */
    hide: (t: Target) => hidden.add(key(t)),
    /** Another device saved it: the server has it, this app has not asked yet. */
    saveElsewhere: (t: Target, collection = DEFAULT_COLLECTION_REF) => items.push({ ref: id(), collection, target: t, at: clock++ }),
  };
}
