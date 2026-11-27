import type { DestinationKey, OpId, OpInput, OpOutput } from '../contracts/gap-sc';
import { TransportError, type CallContext } from '../transport/port';

/**
 * Shared helpers for the fixture domain modules (catalogue, content, store). DEVELOPMENT ONLY, reached only through the
 * fixtures door (src/transport/select.ts). A module is a server-like resolver: it enforces what the real backend would
 * (permission, ownership, concurrency, publication rules) so the Console is exercised against realistic answers. It proves
 * nothing about real authorization (GOV-06).
 */
export interface Authz {
  readonly accountId: string;
  /** The Seller's Owner (not a team member): some changes, such as the company representative, are Owner-only. */
  readonly isOwner: boolean;
  readonly sellerId: string;
  readonly sellerName: string;
  readonly caps: ReadonlySet<string>;
  /** Whether the destination is both permitted and entitled for this account on this Seller. */
  readonly reach: (dest: DestinationKey) => boolean;
}

export interface SellerFlags {
  readonly name: string;
  readonly product: boolean;
  readonly store: boolean;
  readonly fulfilment: boolean;
  readonly company: boolean;
  readonly companyDetails: boolean;
}

export interface Kit {
  now(): number;
  iso(ms: number): string;
  authz(ctx: CallContext): Authz;
  /** A fresh synthetic id with the reserved fixture prefix. */
  next(prefix: string): string;
  /** Seed flags of the Seller, so the readiness derived from this data starts as the earlier fixture world did. */
  flags(sellerId: string): SellerFlags;
}

export type Handlers<K extends OpId> = { [P in K]: (input: OpInput<P>, ctx: CallContext) => OpOutput<P> };

export const denied = (): TransportError => new TransportError('PERMISSION_DENIED');
export const conflict = (): TransportError => new TransportError('CONFLICT');
export const notFound = (): TransportError => new TransportError('NOT_FOUND');
export const invalid = (fields: Record<string, string>): TransportError => new TransportError('VALIDATION_FAILED', { fields });

export function need(a: Authz, dest: DestinationKey): void {
  if (!a.reach(dest)) throw denied();
}
export function needCap(a: Authz, capability: string): void {
  if (!a.caps.has(capability)) throw denied();
}

/**
 * Idempotency (CATINV S120), scoped like a real server would scope it. A replay is served only when the SAME authorized scope
 * (account, Seller), the SAME operation, the SAME key and the SAME payload fingerprint come back:
 *  - the same key with a different payload is refused (CONFLICT, detail IDEMPOTENCY_KEY_REUSED), never answered with the old result;
 *  - another Seller or another account never sees this entry, because both are part of the cache key;
 *  - authorization runs BEFORE the cache is consulted, so a cached success can never bypass a permission that has since been revoked;
 *  - only successes are cached: a refused request can be corrected and sent again.
 * Wraps the listed operations; the wrapped handler itself knows nothing about keys.
 */
export function withIdempotency<Ops extends OpId>(kit: Kit, handlers: Handlers<Ops>, rules: Partial<Record<Ops, { dest: DestinationKey; cap: string }>>): Handlers<Ops> {
  const cache = new Map<string, { fingerprint: string; result: unknown }>();
  const wrapped = { ...handlers } as unknown as Record<string, (input: unknown, ctx: CallContext) => unknown>;
  for (const [op, rule] of Object.entries(rules) as [string, { dest: DestinationKey; cap: string }][]) {
    const inner = wrapped[op];
    if (!inner) continue;
    wrapped[op] = (input, ctx) => {
      const a = kit.authz(ctx);
      need(a, rule.dest);
      needCap(a, rule.cap);
      const key = ctx.idempotencyKey;
      if (!key) return inner(input, ctx);
      const id = `${a.accountId}|${a.sellerId}|${op}|${key}`;
      const fingerprint = JSON.stringify(input);
      const hit = cache.get(id);
      if (hit) {
        if (hit.fingerprint !== fingerprint) throw new TransportError('CONFLICT', { detail: 'IDEMPOTENCY_KEY_REUSED' });
        return hit.result;
      }
      const result = inner(input, ctx);
      cache.set(id, { fingerprint, result });
      return result;
    };
  }
  return wrapped as unknown as Handlers<Ops>;
}

/**
 * A bundled demonstration image as a data URL: what a server derivative would be, with no network and no real photo. It says it is a
 * demonstration inside the picture. Colour names only (no hex literal), so the palette rule holds for fixtures too.
 */
export function demoImage(label: string, aspect: number): string {
  const w = 400;
  const h = Math.round(w / aspect);
  const safe = label.replace(/[<>&"']/g, ' ').slice(0, 40);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="gainsboro"/>` +
    `<circle cx="${w * 0.3}" cy="${h * 0.35}" r="${w * 0.12}" fill="lightslategray"/>` +
    `<path d="M0 ${h} L${w * 0.35} ${h * 0.6} L${w * 0.6} ${h * 0.8} L${w * 0.8} ${h * 0.55} L${w} ${h * 0.75} L${w} ${h} Z" fill="slategray"/>` +
    `<text x="${w / 2}" y="${h - 16}" text-anchor="middle" font-family="sans-serif" font-size="14" fill="dimgray">Demonstration image: ${safe}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
