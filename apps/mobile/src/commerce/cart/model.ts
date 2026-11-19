/**
 * The Buyer's cart as the server describes it. These are view types of this app, not contract
 * types: the cart operations carry no generated answer yet, and nothing here is a hand-written
 * copy of one. A Seller's carts, their lines and every reason on a line are the server's; the
 * client only draws them.
 */

/** Integer minor units and an ISO currency, as the wire sends money. There is no arithmetic on it, here or anywhere in the commerce folder. */
export type Money = Readonly<{ amountMinor: number; currency: string }>;

type Brand<T extends string> = string & { readonly __brand: T };
/** The id of one option (Variant) of a Product, as the public Product read names it. */
export type VariantId = Brand<'VariantId'>;
/** The server's id of one cart line. */
export type LineId = Brand<'LineId'>;
/** The server's identity of one Seller's cart. */
export type SellerKey = Brand<'SellerKey'>;

export const asVariantId = (value: string): VariantId => value as VariantId;
export const asLineId = (value: string): LineId => value as LineId;
export const asSellerKey = (value: string): SellerKey => value as SellerKey;

/**
 * The reasons a line can carry, in DISPLAY precedence order. They are the server's own item codes,
 * plus UNAVAILABLE for an answer that only says "not available" and UNKNOWN for any code a newer
 * server adds (never purchasable).
 */
export const LINE_ISSUES = [
  'NO_LONGER_PUBLISHED',
  'VARIANT_WITHDRAWN',
  'SELLER_UNAVAILABLE',
  'SOLD_OUT',
  'UNAVAILABLE',
  'INSUFFICIENT_STOCK',
  'PRICE_CHANGED',
  'UNKNOWN',
] as const;
export type LineIssue = (typeof LINE_ISSUES)[number];

export type CartLine = Readonly<{
  lineId: LineId;
  variantId: VariantId;
  /** The server's quantity for this line. */
  quantity: number;
  name: string | null;
  /** The option's own label, when the answer carries one. */
  option: string | null;
  productSlug: string | null;
  imageKey: string | null;
  /** The server's current price. Null when the answer carries none: then none is drawn. */
  unitPrice: Money | null;
  /** The server's own previous price, only when it reports a price change. Never remembered by the client. */
  previousUnitPrice: Money | null;
  /** How many the server says it can supply, only when it says so. Never derived from a stock count. */
  availableQuantity: number | null;
  issues: readonly LineIssue[];
}>;

export type SellerCart = Readonly<{
  key: SellerKey;
  handle: string | null;
  storeName: string | null;
  lines: readonly CartLine[];
  /** The server's subtotal for this Seller cart, only when it sends one. Never summed here. */
  subtotal: Money | null;
}>;

export type CartSet = Readonly<{
  carts: readonly SellerCart[];
  /** The server's time of its check, when it gives one. */
  checkedAt: string | null;
}>;

/** A line may be bought only when the server reports nothing against it (an unknown reason counts). */
export const isPurchasable = (line: CartLine): boolean => line.issues.length === 0;

/** Every cart line the set holds, in order. */
export const allLines = (set: CartSet): readonly CartLine[] => set.carts.flatMap((cart) => cart.lines);

/** The line with this id, wherever it sits, or null. */
export function findLine(set: CartSet, lineId: LineId): CartLine | null {
  return allLines(set).find((line) => line.lineId === lineId) ?? null;
}

/** Codes about the cart as a whole, not about a line. They mark no line. */
const CART_LEVEL_CODES: readonly string[] = ['TRANSACTION_CAP_EXCEEDED', 'CART_EMPTY', 'CART_REVALIDATION_FAILED'];

/**
 * The line reason for a server item code. Null for a code about the whole cart (it marks no line);
 * UNKNOWN for a code this build does not know, so a newer server can never make a line look fine.
 */
export function issueFromServerCode(code: string): LineIssue | null {
  if (CART_LEVEL_CODES.includes(code)) return null;
  return (LINE_ISSUES as readonly string[]).includes(code) && code !== 'UNAVAILABLE' && code !== 'UNKNOWN'
    ? (code as LineIssue)
    : 'UNKNOWN';
}

/** One item of a server answer that lists every affected line together. Its subject is a Variant, not a line. */
export type ServerItem = Readonly<{
  code: string;
  /** The Variant the item is about. Absent for an item about the whole Seller cart. */
  variantId: string | null;
  requested: number | null;
  available: number | null;
  wasMinor: number | null;
  nowMinor: number | null;
  currency: string | null;
}>;

const byPrecedence = (a: LineIssue, b: LineIssue) => LINE_ISSUES.indexOf(a) - LINE_ISSUES.indexOf(b);

function withIssue(line: CartLine, issue: LineIssue, item: ServerItem): CartLine {
  const issues = line.issues.includes(issue) ? line.issues : [...line.issues, issue].sort(byPrecedence);
  let next: CartLine = { ...line, issues };
  if (issue === 'SOLD_OUT') next = { ...next, availableQuantity: item.available ?? 0 };
  if (issue === 'INSUFFICIENT_STOCK' && item.available !== null) next = { ...next, availableQuantity: item.available };
  if (issue === 'PRICE_CHANGED' && item.currency !== null) {
    if (item.wasMinor !== null) next = { ...next, previousUnitPrice: { amountMinor: item.wasMinor, currency: item.currency } };
    if (item.nowMinor !== null) next = { ...next, unitPrice: { amountMinor: item.nowMinor, currency: item.currency } };
  }
  return next;
}

/**
 * The Seller cart with the server's items applied. An item about a Variant reaches EVERY line that
 * names that Variant (an answer may hold two lines for one Variant); an item about no Variant reaches
 * every line of the cart, which may mark a line it is not about but never misses one; a code about the
 * whole cart reaches none.
 */
export function applyItems(cart: SellerCart, items: readonly ServerItem[]): SellerCart {
  let lines = cart.lines;
  for (const item of items) {
    const issue = issueFromServerCode(item.code);
    if (issue === null) continue;
    lines = lines.map((line) =>
      item.variantId === null || line.variantId === item.variantId ? withIssue(line, issue, item) : line,
    );
  }
  return lines === cart.lines ? cart : { ...cart, lines };
}
