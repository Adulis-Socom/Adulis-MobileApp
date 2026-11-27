// DEVELOPMENT ONLY. The fixture transport: typed, deterministic, in-memory, no network (ESLint refuses fetch, XMLHttpRequest and
// WebSocket in this directory), no import of the live transport, no fallback either way. It serves exactly the operations the
// typed registry marks SERVED_*; anything else, and anything on the prohibited list, is REFUSED and logged.
import { asAccountRef, asMarketRef, MOBILE_AUDIENCE, ORDINARY_PRINCIPAL, type BootstrapView, type ClientVerdict, type MobileOpId, type MobileOps } from '../contracts/gap-mob-session';
import { OP_SPECS } from '../contracts/ops';
import { TransportError, type CallContext, type MobileTransport } from '../transport/port';
import { FIXTURE_CHALLENGE_PREFIX, FIXTURE_CREDENTIAL_PREFIX, FIXTURE_IDS, FIXTURE_REFUSAL, FIXTURE_VERSION } from './ids';
import { CATEGORIES, CHANNELS, knownCategory, productTile, sceneUnit, pageOf, productDetail, productsOf, publicScene, search, sellerProfile, shopProducts, visibleScenes } from './discovery';
import { PERSONAS, type Persona } from './personas';
import { createEngagementWorld } from './engagement';
import { createStoryWorld } from './stories';

/** The deny-list backstop: never served, whatever the registry says (GOV-06 S2). */
const PROHIBITED = /payment|payout|handoff|claim|report|moderation|evidence|trust|review_grant|reservation|order/i;

export interface OpLogEntry {
  readonly op: string;
  readonly outcome: 'SERVED' | typeof FIXTURE_REFUSAL;
}

export type ClientScenario = 'OK' | 'UPGRADE_RECOMMENDED' | 'UPGRADE_REQUIRED';

export interface FixtureHandle {
  readonly version: string;
  readonly opLog: readonly OpLogEntry[];
  /** The next call to `op` waits until the returned function is called: deterministic late-response tests, no timers. */
  hold(op: MobileOpId): () => void;
  setClient(scenario: ClientScenario): void;
  /** The server withdraws a Scene: it answers NOT_FOUND on open and drops out of every list (public visibility is a server fact). */
  withdraw(sceneRef: string): void;
  /** The server expires, withdraws or restricts a Seller's Stories: the row drops them and a group read answers NOT_FOUND. */
  expireStories(sellerRef: string): void;
  /** Linked content (a Product or Scene ref) stopped being public: its Story is suppressed. */
  makeStoryTargetPrivate(ref: string): void;
  /** The next call of `op` fails with `code` (failure-state tests). */
  failNext(op: MobileOpId, code: 'NETWORK' | 'INTERNAL' | 'NOT_FOUND'): void;
  /** The fixture server clock (null: the real clock). Story publication and expiry are re-taken from it on reset(). */
  setNow(now: (() => number) | null): void;
  /** Accounts the fixture currently has a session for (isolation tests). */
  sessionAccounts(): readonly string[];
  reset(): void;
}

export function createFixtureTransport(): { readonly transport: MobileTransport; readonly handle: FixtureHandle } {
  let clock: (() => number) | null = null;
  const stories = createStoryWorld(() => (clock ?? Date.now)());
  const log: OpLogEntry[] = [];
  const sessions = new Map<string, Persona>(); // credential -> persona
  const challenges = new Map<string, Persona | null>(); // challenge ref -> persona (null: unknown number, still answered the same)
  const holds = new Map<string, Promise<void>[]>();
  const spent = new Set<string>(); // expiry / revocation scenarios fire once per credential
  const withdrawn = new Set<string>();
  const engagement = createEngagementWorld();
  const failures = new Map<string, 'NETWORK' | 'INTERNAL' | 'NOT_FOUND'>();
  let client: ClientScenario = 'OK';
  let sequence = 0;

  const verdict = (): ClientVerdict =>
    client === 'UPGRADE_REQUIRED'
      ? { status: 'UPGRADE_REQUIRED', message: null, storeLink: null }
      : client === 'UPGRADE_RECOMMENDED'
        ? { status: 'UPGRADE_RECOMMENDED', message: null }
        : { status: 'OK' };

  /** The Account behind this request's bearer. An Account-bound operation without one is refused, exactly as a server would. */
  function personaOf(ctx: CallContext): Persona {
    const persona = ctx.bearer === null ? undefined : sessions.get(ctx.bearer);
    if (persona === undefined) throw new TransportError('AUTHENTICATION_REQUIRED');
    return persona;
  }

  function serve(op: MobileOpId, input: unknown, ctx: CallContext): unknown {
    switch (op) {
      case 'device.register': {
        const { deviceId } = input as MobileOps['device.register']['in'];
        if (!String(deviceId).startsWith('fx_')) throw new TransportError('REFUSED'); // no live identity in the fixture either
        return {};
      }
      case 'bootstrap.get': {
        const persona = ctx.bearer === null ? undefined : sessions.get(ctx.bearer);
        const base = { serverTime: '2026-01-01T00:00:00.000Z', client: verdict(), market: { status: 'RESOLVED', marketRef: asMarketRef(FIXTURE_IDS.market), resolvedAt: 0 } } as const;
        if (persona === undefined) return { ...base, account: null } satisfies BootstrapView;
        if (persona.scenario === 'NETWORK_DOWN') throw new TransportError('NETWORK');
        const key = `${ctx.bearer}`;
        if (persona.scenario === 'SESSION_EXPIRES' && !spent.has(key)) {
          spent.add(key);
          throw new TransportError('SESSION_EXPIRED');
        }
        if (persona.scenario === 'SESSION_REVOKED' && !spent.has(key)) {
          spent.add(key);
          throw new TransportError('SESSION_REVOKED');
        }
        return { ...base, account: { accountRef: asAccountRef(persona.accountId), eligibility: persona.modes } } satisfies BootstrapView;
      }
      case 'session.requestCode': {
        const { destination } = input as MobileOps['session.requestCode']['in'];
        sequence += 1;
        const ref = `${FIXTURE_CHALLENGE_PREFIX}_${sequence}`;
        challenges.set(ref, PERSONAS.find((p) => p.phone === destination.trim()) ?? null); // an unknown number is answered identically
        return { challengeRef: ref, inputHint: null };
      }
      case 'session.verifyCode': {
        const { challengeRef, code } = input as MobileOps['session.verifyCode']['in'];
        const persona = challenges.get(challengeRef);
        if (persona === undefined) throw new TransportError('OTP_EXPIRED');
        if (persona === null || persona.code !== code) throw new TransportError('OTP_INVALID');
        sequence += 1;
        const credential = `${FIXTURE_CREDENTIAL_PREFIX}_${persona.key}_${sequence}`;
        if (persona.scenario === 'OPERATOR_ONLY') {
          // Not an ordinary principal on this surface: the app must refuse it and store nothing.
          return { accountRef: asAccountRef(persona.accountId), credential, audience: 'OPERATOR', principalKind: 'OPERATOR' };
        }
        sessions.set(credential, persona);
        return { accountRef: asAccountRef(persona.accountId), credential, audience: MOBILE_AUDIENCE, principalKind: ORDINARY_PRINCIPAL };
      }
      case 'session.signOut': {
        if (ctx.bearer !== null) sessions.delete(ctx.bearer);
        return {};
      }
      case 'engagement.state.get':
        return engagement.state(personaOf(ctx).key, input as MobileOps['engagement.state.get']['in']);
      case 'scene.like.set': {
        const { sceneRef, liked } = input as MobileOps['scene.like.set']['in'];
        if (publicScene(sceneRef, withdrawn) === null) throw new TransportError('NOT_FOUND');
        return engagement.like(personaOf(ctx).key, sceneRef, liked);
      }
      case 'scene.save.set': {
        const { sceneRef, saved } = input as MobileOps['scene.save.set']['in'];
        if (publicScene(sceneRef, withdrawn) === null) throw new TransportError('NOT_FOUND');
        return engagement.saveScene(personaOf(ctx).key, sceneRef, saved);
      }
      case 'product.save.set': {
        const { productRef, saved } = input as MobileOps['product.save.set']['in'];
        if (productDetail(productRef) === null) throw new TransportError('NOT_FOUND');
        return engagement.saveProduct(personaOf(ctx).key, productRef, saved);
      }
      case 'seller.follow.set': {
        const { sellerRef, following } = input as MobileOps['seller.follow.set']['in'];
        if (sellerProfile(sellerRef) === null) throw new TransportError('NOT_FOUND');
        return engagement.follow(personaOf(ctx).key, sellerRef, following);
      }
      case 'saved.list.get': {
        const mine = engagement.saved(personaOf(ctx).key);
        // A Scene withdrawn since it was saved is simply absent: the server decides what is public.
        return {
          scenes: mine.scenes.map((ref) => (withdrawn.has(ref) ? undefined : sceneUnit(ref))).filter((s) => s !== undefined),
          products: mine.products.map((ref) => productTile(ref)).filter((p) => p !== undefined),
        };
      }
      case 'collections.list.get':
        return { collections: engagement.collections(personaOf(ctx).key) };
      case 'collection.create': {
        const created = engagement.createCollection(personaOf(ctx).key, (input as MobileOps['collection.create']['in']).name);
        if (created === null) throw new TransportError('VALIDATION_FAILED');
        return { collection: created };
      }
      case 'collection.get': {
        const found = engagement.collection(personaOf(ctx).key, (input as MobileOps['collection.get']['in']).collectionRef);
        if (found === undefined) throw new TransportError('NOT_FOUND');
        const items = found.items.map((item) => {
          const scene = item.kind === 'SCENE_POST' && !withdrawn.has(item.ref) ? sceneUnit(item.ref) : undefined;
          if (scene) return { kind: 'SCENE_POST' as const, scene };
          const product = item.kind === 'PRODUCT_POST' ? productTile(item.ref) : undefined;
          if (product) return { kind: 'PRODUCT_POST' as const, product };
          return { kind: 'UNAVAILABLE' as const, item }; // no name, caption or picture of what it once was
        });
        return { collection: { collectionRef: found.collectionRef, name: found.name }, items };
      }
      case 'collection.rename': {
        const { collectionRef, name } = input as MobileOps['collection.rename']['in'];
        const renamed = engagement.rename(personaOf(ctx).key, collectionRef, name);
        if (renamed === 'NOT_FOUND') throw new TransportError('NOT_FOUND');
        if (renamed === 'INVALID') throw new TransportError('VALIDATION_FAILED');
        return { collection: renamed };
      }
      case 'collection.delete': {
        // Deleting what is already gone is the outcome asked for (recovered from the archived saved-privacy cases).
        engagement.remove(personaOf(ctx).key, (input as MobileOps['collection.delete']['in']).collectionRef);
        return {};
      }
      case 'collection.item.add':
      case 'collection.item.remove': {
        const { collectionRef, item } = input as MobileOps['collection.item.add']['in'];
        const adding = op === 'collection.item.add';
        // Only something public can be added; anything can be removed (including what stopped being public).
        const publicNow = item.kind === 'SCENE_POST' ? sceneUnit(item.ref) !== undefined && !withdrawn.has(item.ref) : productTile(item.ref) !== undefined;
        if (adding && !publicNow) throw new TransportError('NOT_FOUND');
        if (!engagement.setMember(personaOf(ctx).key, collectionRef, item, adding)) throw new TransportError('NOT_FOUND');
        return { item };
      }
      case 'stories.row.get':
        return { groups: stories.row(), nextCursor: null };
      case 'stories.group.get': {
        const found = stories.group((input as MobileOps['stories.group.get']['in']).sellerRef);
        if (found === null) throw new TransportError('NOT_FOUND');
        return found;
      }
      case 'home.channels.get':
        return { channels: CHANNELS };
      case 'feed.forYou.page':
        return pageOf(visibleScenes(withdrawn), (input as MobileOps['feed.forYou.page']['in']).cursor);
      case 'feed.following.page': {
        const persona = ctx.bearer === null ? undefined : sessions.get(ctx.bearer);
        if (persona === undefined) throw new TransportError('AUTHENTICATION_REQUIRED');
        return pageOf(visibleScenes(withdrawn).filter((s) => engagement.isFollowing(persona.key, s.seller.sellerRef)), (input as MobileOps['feed.following.page']['in']).cursor);
      }
      case 'scene.get': {
        const found = publicScene((input as MobileOps['scene.get']['in']).sceneRef, withdrawn);
        if (found === null) throw new TransportError('NOT_FOUND');
        return { scene: found };
      }
      case 'search.query': {
        const { q, type, cursor } = input as MobileOps['search.query']['in'];
        return { ...pageOf(search(q, type, withdrawn), cursor), type, marketState: 'RESOLVED' };
      }
      case 'shop.products.page': {
        const { cursor, category } = input as MobileOps['shop.products.page']['in'];
        if (category !== null && !knownCategory(category)) throw new TransportError('VALIDATION_FAILED');
        return { ...pageOf(shopProducts(category), cursor), marketState: 'RESOLVED' };
      }
      case 'categories.list':
        return { items: CATEGORIES };
      case 'product.get': {
        const found = productDetail((input as MobileOps['product.get']['in']).productRef);
        if (found === null) throw new TransportError('NOT_FOUND');
        return { product: found };
      }
      case 'seller.get': {
        const found = sellerProfile((input as MobileOps['seller.get']['in']).sellerRef);
        if (found === null) throw new TransportError('NOT_FOUND');
        return { seller: found };
      }
      case 'seller.scenes.page': {
        const { sellerRef, cursor } = input as MobileOps['seller.scenes.page']['in'];
        if (sellerProfile(sellerRef) === null) throw new TransportError('NOT_FOUND');
        return pageOf(visibleScenes(withdrawn, sellerRef), cursor);
      }
      case 'seller.products.page': {
        const { sellerRef, cursor } = input as MobileOps['seller.products.page']['in'];
        if (sellerProfile(sellerRef) === null) throw new TransportError('NOT_FOUND');
        return pageOf(productsOf(sellerRef), cursor);
      }
    }
  }

  const transport: MobileTransport = {
    kind: 'fixture',
    async json<K extends MobileOpId>(op: K, input: MobileOps[K]['in'], ctx: CallContext) {
      const spec = (OP_SPECS as Partial<Record<string, (typeof OP_SPECS)[MobileOpId]>>)[op];
      if (spec === undefined || spec.fixture === 'BLOCKED' || PROHIBITED.test(op)) {
        log.push({ op, outcome: FIXTURE_REFUSAL });
        throw new TransportError('REFUSED');
      }
      const queued = holds.get(op)?.shift();
      if (queued) await queued;
      const failure = failures.get(op);
      if (failure !== undefined) {
        failures.delete(op);
        log.push({ op, outcome: 'SERVED' });
        throw new TransportError(failure);
      }
      let value: unknown;
      try {
        value = serve(op, input, ctx);
      } catch (error) {
        log.push({ op, outcome: 'SERVED' });
        throw error;
      }
      log.push({ op, outcome: 'SERVED' });
      return { value: value as MobileOps[K]['out'], stamp: ctx.stamp };
    },
  };

  const handle: FixtureHandle = {
    version: FIXTURE_VERSION,
    opLog: log,
    hold(op) {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      holds.set(op, [...(holds.get(op) ?? []), gate]);
      return release;
    },
    setClient(scenario) {
      client = scenario;
    },
    withdraw: (sceneRef) => void withdrawn.add(sceneRef),
    expireStories: (sellerRef) => stories.makeUnavailable(sellerRef),
    makeStoryTargetPrivate: (ref) => stories.makeTargetPrivate(ref),
    failNext: (op, code) => void failures.set(op, code),
    setNow(now) {
      clock = now;
    },
    sessionAccounts: () => [...sessions.values()].map((p) => p.accountId),
    reset() {
      log.length = 0;
      sessions.clear();
      challenges.clear();
      holds.clear();
      spent.clear();
      withdrawn.clear();
      stories.reset();
      engagement.reset();
      failures.clear();
      client = 'OK';
      sequence = 0;
    },
  };
  return { transport, handle };
}
