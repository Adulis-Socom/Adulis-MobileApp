// DEVELOPMENT ONLY. The fixture transport: typed, deterministic, in-memory, no network (ESLint refuses fetch, XMLHttpRequest and
// WebSocket in this directory), no import of the live transport, no fallback either way. It serves exactly the operations the
// typed registry marks SERVED_*; anything else, and anything on the prohibited list, is REFUSED and logged.
import { asAccountRef, asMarketRef, MOBILE_AUDIENCE, ORDINARY_PRINCIPAL, type BootstrapView, type ClientVerdict, type MobileOpId, type MobileOps } from '../contracts/gap-mob-session';
import { OP_SPECS } from '../contracts/ops';
import { TransportError, type CallContext, type MobileTransport } from '../transport/port';
import { FIXTURE_CHALLENGE_PREFIX, FIXTURE_CREDENTIAL_PREFIX, FIXTURE_IDS, FIXTURE_REFUSAL, FIXTURE_VERSION } from './ids';
import { CATEGORIES, CHANNELS, followedSellerRefs, knownCategory, pageOf, productDetail, productsOf, publicScene, search, sellerProfile, shopProducts, visibleScenes } from './discovery';
import { PERSONAS, type Persona } from './personas';
import { rowGroups, storiesOf } from './stories';

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
  /** The server expires or withdraws a Seller's Stories: the row drops them and a group read answers NOT_FOUND. */
  expireStories(sellerRef: string): void;
  /** Accounts the fixture currently has a session for (isolation tests). */
  sessionAccounts(): readonly string[];
  reset(): void;
}

export function createFixtureTransport(): { readonly transport: MobileTransport; readonly handle: FixtureHandle } {
  const log: OpLogEntry[] = [];
  const sessions = new Map<string, Persona>(); // credential -> persona
  const challenges = new Map<string, Persona | null>(); // challenge ref -> persona (null: unknown number, still answered the same)
  const holds = new Map<string, Promise<void>[]>();
  const spent = new Set<string>(); // expiry / revocation scenarios fire once per credential
  const withdrawn = new Set<string>();
  const expired = new Set<string>();
  let client: ClientScenario = 'OK';
  let sequence = 0;

  const verdict = (): ClientVerdict =>
    client === 'UPGRADE_REQUIRED'
      ? { status: 'UPGRADE_REQUIRED', message: null, storeLink: null }
      : client === 'UPGRADE_RECOMMENDED'
        ? { status: 'UPGRADE_RECOMMENDED', message: null }
        : { status: 'OK' };

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
      case 'stories.row.get':
        return { groups: rowGroups(expired), nextCursor: null };
      case 'stories.group.get': {
        const found = storiesOf((input as MobileOps['stories.group.get']['in']).sellerRef, expired);
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
        const followed = followedSellerRefs(persona.key);
        return pageOf(visibleScenes(withdrawn).filter((s) => followed.includes(s.seller.sellerRef)), (input as MobileOps['feed.following.page']['in']).cursor);
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
    expireStories: (sellerRef) => void expired.add(sellerRef),
    sessionAccounts: () => [...sessions.values()].map((p) => p.accountId),
    reset() {
      log.length = 0;
      sessions.clear();
      challenges.clear();
      holds.clear();
      spent.clear();
      withdrawn.clear();
      expired.clear();
      client = 'OK';
      sequence = 0;
    },
  };
  return { transport, handle };
}
