import { ApiError } from '../../../api/client';
import {
  applyItems,
  asLineId,
  asSellerKey,
  type CartLine,
  type CartSet,
  type LineId,
  type SellerCart,
  type ServerItem,
  type VariantId,
} from '../../cart/model';
import type { AddAccepted, AddRequest } from '../../cart/port';
import { apiProblem, gatewayPage, offline, proxyJson, timeout } from '../api-errors';
import { demoCatalogue, moneyOf, type DemoSeller, type DemoVariant } from './scenarios';

/**
 * An in-memory simulator of the server side of the cart, for Jest only. It plays the server: it keeps
 * carts per caller, answers from a demonstration catalogue, remembers idempotency keys, and fails or waits
 * on command. It models no payment, no fee, no quote, no delivery and no Order, and it calls no network.
 * Whether it exists in any build is not decided; it is imported only by tests and by the test-only folder.
 *
 * Its rules are labelled assumptions where the contract is silent: same-option adds merge unless told
 * not to; price changes are reported only when told to, against a baseline the simulator keeps per line.
 */

/** What happens to a guest's cart when the same device signs in. Models no product decision. */
export type AdoptionPolicy = 'ADOPT_IF_EMPTY' | 'DROP_GUEST' | 'UNRESOLVED_CONFLICT';

/**
 * How a call fails. `afterCommit`: the server processed the request before the failure reached the
 * caller (a connection that drops after the commit); without it the request was not processed.
 */
export type FailureSpec =
  | Readonly<{ kind: 'offline'; afterCommit?: boolean }>
  | Readonly<{ kind: 'timeout'; afterCommit?: boolean }>
  /** The API's own problem shape (every field of its envelope present). */
  | Readonly<{ kind: 'problem'; status: number; code: string; retryAfterSeconds?: number; afterCommit?: boolean }>
  /** JSON with a `code` but none of the API's other fields: a proxy's page. */
  | Readonly<{ kind: 'proxy-json'; status: number; code: string; afterCommit?: boolean }>
  /** A non-success answer that is not JSON: a gateway page. */
  | Readonly<{ kind: 'unexpected'; status: number; afterCommit?: boolean }>
  /** A success answer whose body cannot be read: the request was processed. */
  | Readonly<{ kind: 'unreadable-2xx' }>;

export type Op = 'getCarts' | 'addLine';
export type Held = { release(): void };

/** Who a request speaks for. The credential is read once when the request is made, as a bearer is. */
export type Caller = Readonly<{ actor: string }>;

export type RecordedCall = Readonly<{
  op: Op;
  /** The caller as the request was made. */
  actorAtSend: string;
  /** The caller the request was processed for: always the same as the one it was sent with. */
  actorAtProcess: string;
  key: string | null;
  variantId: string | null;
  quantity: number | null;
}>;

export interface FixtureServer {
  adoption: AdoptionPolicy;
  /** Whether a read carries the Seller subtotal (the server's own sum). */
  serverSubtotal: boolean;
  /** Whether a read reports PRICE_CHANGED, with the previous price, against the price a line had when it was added. */
  reportPriceChanges: boolean;
  /** Whether adding an option that is already in the cart adds to that line (true) or makes a second line. */
  mergeDuplicates: boolean;
  /** Whether adding an option that cannot be bought now is refused (true) or accepted and reported on the next read. */
  refuseUnavailableAdds: boolean;

  setPrice(variant: VariantId, priceMinor: number, currency?: string): void;
  setQuantityAvailable(variant: VariantId, quantity: number): void;
  setVariantStatus(variant: VariantId, status: 'ACTIVE' | 'WITHDRAWN'): void;
  setProductPublished(productSlug: string, published: boolean): void;
  setSellerActive(handle: string, active: boolean): void;
  /** The account signs in on this device: the first read or add it makes applies the adoption policy. */
  bindAccount(accountId: string, deviceId: string): void;

  failNext(op: Op, ...failures: FailureSpec[]): void;
  /** The next call of this operation waits, AFTER its caller is read, until released. */
  pause(op: Op): Held;

  getCarts(caller: Caller): Promise<CartSet>;
  addLine(caller: Caller, request: AddRequest): Promise<AddAccepted>;

  readonly calls: readonly RecordedCall[];
  /** The carts a caller holds now, as the server would answer them, without recording a call. */
  carts(actor: string): CartSet;
}

type LineState = { lineId: LineId; variantId: VariantId; quantity: number; baselinePriceMinor: number };
type SellerCartState = { seller: DemoSeller; lines: LineState[] };

const DAY_MS = 24 * 60 * 60 * 1000;

export function createFixtureServer(
  options: Partial<{
    adoption: AdoptionPolicy;
    serverSubtotal: boolean;
    reportPriceChanges: boolean;
    mergeDuplicates: boolean;
    refuseUnavailableAdds: boolean;
    keyLifeMs: number;
    clock: () => number;
  }> = {},
): FixtureServer {
  const catalogue = new Map<VariantId, DemoVariant>(demoCatalogue().map((v) => [v.id, v]));
  const unpublished = new Set<string>();
  const inactive = new Set<string>();
  const cartsByActor = new Map<string, SellerCartState[]>();
  const stored = new Map<string, { body: string; answer: AddAccepted; at: number }>();
  const pendingAdoption = new Map<string, string>();
  const failures: Record<Op, FailureSpec[]> = { getCarts: [], addLine: [] };
  const holds: Record<Op, Array<Promise<void>>> = { getCarts: [], addLine: [] };
  const calls: RecordedCall[] = [];
  const now = options.clock ?? Date.now;
  const keyLifeMs = options.keyLifeMs ?? DAY_MS;
  let lines = 0;

  const variantOf = (id: VariantId): DemoVariant => {
    const variant = catalogue.get(id);
    if (!variant) throw new Error(`unknown demonstration option ${id}`);
    return variant;
  };

  const cartsOf = (actor: string): SellerCartState[] => {
    let held = cartsByActor.get(actor);
    if (!held) {
      held = [];
      cartsByActor.set(actor, held);
    }
    return held;
  };

  const copyCarts = (from: SellerCartState[]): SellerCartState[] =>
    from.map((cart) => ({ seller: cart.seller, lines: cart.lines.map((line) => ({ ...line })) }));

  /** Applies the adoption policy the first time an Account that signed in on a device speaks. */
  const adoptIfPending = (actor: string) => {
    const device = pendingAdoption.get(actor);
    if (device === undefined) return;
    pendingAdoption.delete(actor);
    const guest = cartsByActor.get(device) ?? [];
    if (guest.length === 0 || server.adoption === 'DROP_GUEST') return;
    const own = cartsOf(actor);
    if (own.length === 0) {
      cartsByActor.set(actor, copyCarts(guest));
      cartsByActor.delete(device);
      return;
    }
    // Both exist. Adopting only into an empty Account leaves the guest cart where it is; the unresolved
    // policy appends it without merging, so one Seller can appear twice.
    if (server.adoption === 'UNRESOLVED_CONFLICT') {
      cartsByActor.set(actor, [...own, ...copyCarts(guest)]);
      cartsByActor.delete(device);
    }
  };

  const item = (code: string, variantId: string | null, over: Partial<ServerItem> = {}): ServerItem => ({
    code,
    variantId,
    requested: null,
    available: null,
    wasMinor: null,
    nowMinor: null,
    currency: null,
    ...over,
  });

  /** One Seller cart as the server answers it: its lines, and the reasons it reports against them. */
  const describeCart = (state: SellerCartState): SellerCart => {
    const base: SellerCart = {
      key: asSellerKey(state.seller.key),
      handle: state.seller.handle,
      storeName: state.seller.storeName,
      lines: state.lines.map((line): CartLine => {
        const variant = variantOf(line.variantId);
        return {
          lineId: line.lineId,
          variantId: line.variantId,
          quantity: line.quantity,
          name: variant.productName,
          option: variant.option,
          productSlug: variant.productSlug,
          imageKey: null,
          unitPrice: moneyOf(variant.priceMinor, variant.currency),
          previousUnitPrice: null,
          availableQuantity: null,
          issues: [],
        };
      }),
      subtotal: null,
    };
    const items: ServerItem[] = [];
    for (const line of state.lines) {
      const variant = variantOf(line.variantId);
      if (variant.status !== 'ACTIVE') items.push(item('VARIANT_WITHDRAWN', line.variantId));
      if (unpublished.has(variant.productSlug)) items.push(item('NO_LONGER_PUBLISHED', line.variantId));
      if (variant.quantityAvailable === 0) items.push(item('SOLD_OUT', line.variantId, { requested: line.quantity, available: 0 }));
      else if (variant.quantityAvailable < line.quantity) {
        items.push(item('INSUFFICIENT_STOCK', line.variantId, { requested: line.quantity, available: variant.quantityAvailable }));
      }
      if (server.reportPriceChanges && variant.priceMinor !== line.baselinePriceMinor) {
        items.push(item('PRICE_CHANGED', line.variantId, { wasMinor: line.baselinePriceMinor, nowMinor: variant.priceMinor, currency: variant.currency }));
      }
    }
    if (inactive.has(state.seller.handle)) items.push(item('SELLER_UNAVAILABLE', null));
    const described = applyItems(base, items);
    if (!server.serverSubtotal || state.lines.length === 0) return described;
    // The server's own sum, in the Seller's currency: the simulator answers for the server.
    const currency = variantOf(state.lines[0]!.variantId).currency;
    const sum = state.lines.reduce((total, line) => total + variantOf(line.variantId).priceMinor * line.quantity, 0);
    return { ...described, subtotal: moneyOf(sum, currency) };
  };

  const describeAll = (actor: string): CartSet => ({
    carts: (cartsByActor.get(actor) ?? []).filter((cart) => cart.lines.length > 0).map(describeCart),
    checkedAt: new Date(now()).toISOString(),
  });

  const toError = (failure: FailureSpec): ApiError => {
    switch (failure.kind) {
      case 'offline':
        return offline();
      case 'timeout':
        return timeout();
      case 'problem':
        return apiProblem(failure.status, failure.code, failure.retryAfterSeconds);
      case 'proxy-json':
        return proxyJson(failure.status, failure.code);
      case 'unexpected':
        return gatewayPage(failure.status);
      case 'unreadable-2xx':
        return new ApiError({ kind: 'unexpected', status: 200 });
    }
  };

  /** Records the call, waits if told to, fails if told to, then processes it for the caller it was made with. */
  async function run<T>(
    op: Op,
    caller: Caller,
    detail: { key: string | null; variantId: string | null; quantity: number | null },
    process: (actor: string) => T,
  ): Promise<T> {
    const actorAtSend = caller.actor;
    const index = calls.length;
    calls.push({ op, actorAtSend, actorAtProcess: actorAtSend, ...detail });
    const hold = holds[op].shift();
    if (hold) await hold;
    const failure = failures[op].shift();
    const actorAtProcess = caller.actor;
    calls[index] = { ...calls[index]!, actorAtProcess };
    if (failure === undefined) return process(actorAtProcess);
    // A failure after the commit still processed the request: its effects stand and its answer is lost.
    if (failure.kind === 'unreadable-2xx' || failure.afterCommit === true) process(actorAtProcess);
    throw toError(failure);
  }

  const server: FixtureServer = {
    adoption: options.adoption ?? 'ADOPT_IF_EMPTY',
    serverSubtotal: options.serverSubtotal ?? false,
    reportPriceChanges: options.reportPriceChanges ?? false,
    mergeDuplicates: options.mergeDuplicates ?? true,
    refuseUnavailableAdds: options.refuseUnavailableAdds ?? false,

    setPrice(variant, priceMinor, currency) {
      const v = variantOf(variant);
      v.priceMinor = priceMinor;
      if (currency !== undefined) v.currency = currency;
    },
    setQuantityAvailable(variant, quantity) {
      variantOf(variant).quantityAvailable = quantity;
    },
    setVariantStatus(variant, status) {
      variantOf(variant).status = status;
    },
    setProductPublished(productSlug, published) {
      if (published) unpublished.delete(productSlug);
      else unpublished.add(productSlug);
    },
    setSellerActive(handle, active) {
      if (active) inactive.delete(handle);
      else inactive.add(handle);
    },
    bindAccount(accountId, deviceId) {
      pendingAdoption.set(`ACCOUNT:${accountId}`, `DEVICE:${deviceId}`);
    },

    failNext(op, ...next) {
      failures[op].push(...next);
    },
    pause(op) {
      let release: () => void = () => undefined;
      holds[op].push(new Promise<void>((resolve) => (release = resolve)));
      return { release: () => release() };
    },

    getCarts(caller) {
      return run('getCarts', caller, { key: null, variantId: null, quantity: null }, (actor) => {
        adoptIfPending(actor);
        return describeAll(actor);
      });
    },

    addLine(caller, request) {
      const detail = { key: request.idempotencyKey, variantId: request.variantId, quantity: request.quantity };
      return run('addLine', caller, detail, (actor): AddAccepted => {
        adoptIfPending(actor);
        const body = `${request.variantId}|${request.quantity}`;
        const recordKey = `${actor}|${request.idempotencyKey}`;
        const earlier = stored.get(recordKey);
        if (earlier) {
          // The same request returns what was stored; a different body, or a record past its life, is refused.
          if (earlier.body !== body || now() - earlier.at >= keyLifeMs) throw apiProblem(409, 'IDEMPOTENCY_KEY_REUSED');
          return earlier.answer;
        }
        if (!Number.isInteger(request.quantity) || request.quantity < 1) throw apiProblem(400, 'VALIDATION_FAILED');
        const variant = catalogue.get(request.variantId);
        if (!variant) throw apiProblem(404, 'NOT_FOUND');
        const buyable =
          variant.status === 'ACTIVE' && !unpublished.has(variant.productSlug) && !inactive.has(variant.seller.handle) && variant.quantityAvailable > 0;
        if (server.refuseUnavailableAdds && !buyable) throw apiProblem(404, 'NOT_FOUND');

        // The Seller comes from the option, never from the request.
        const mine = cartsOf(actor);
        let cart = mine.find((c) => c.seller.key === variant.seller.key);
        if (!cart) {
          cart = { seller: variant.seller, lines: [] };
          mine.push(cart);
        }
        let line = server.mergeDuplicates ? cart.lines.find((l) => l.variantId === request.variantId) : undefined;
        if (line) line.quantity += request.quantity;
        else {
          lines += 1;
          line = { lineId: asLineId(`DEMO-LINE-${lines}`), variantId: request.variantId, quantity: request.quantity, baselinePriceMinor: variant.priceMinor };
          cart.lines.push(line);
        }
        const answer: AddAccepted = { lineId: line.lineId };
        stored.set(recordKey, { body, answer, at: now() });
        return answer;
      });
    },

    calls,
    carts: describeAll,
  };
  return server;
}
