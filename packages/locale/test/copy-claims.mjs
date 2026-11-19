#!/usr/bin/env node
/**
 * A regression guard over the shared English catalogue (src/en.ts), read with TypeScript's own
 * parser so single-quoted, double-quoted and template values are all read. It is NOT a proof that
 * copy is true; it fails on exactly these things and no others:
 *
 * 1. UNREADABLE VALUE. A value that is not a plain string (a literal, a template without
 *    substitutions, or literals joined with +) fails the run. Nothing is skipped silently.
 * 2. LISTED PHRASES. A string must not match a phrase in FORBIDDEN: Product quality (no Product
 *    review exists), a cart, checkout, placing an order or paying (the app has none), message
 *    read or delivery state, a delivered or received claim, an order or payment placed, confirmed
 *    or received, popularity wording (Search orders by how closely words match, nothing else),
 *    engineering words (retry key, idempotency, payload, endpoint, cursor, JSON, API), a promise
 *    that a Seller will reply, and commerce words nothing in the app can back yet (shipped,
 *    arrived, tracking, out for delivery, held for you, your cart is saved, reserved, in stock,
 *    guaranteed, trending, most viewed).
 *    Every key is scanned (the error.* keys the Buyer can be shown included) except the namespaces
 *    written for Sellers, which describe orders and payments on purpose: obligation.*, sms.*,
 *    deletion.*, ownership_transfer.*, seller.*. The list is short on purpose and must be
 *    revisited when ordering or payment ships: a phrase that becomes true is removed, not worked
 *    around. "Sign in to start ordering" is deliberately not listed: it is the design text for the
 *    signed-out Orders tab.
 * 3. ROLE WORDS. A buyer.*, auth.* or common.* sentence writes Seller and Buyer in capitals and says
 *    Seller, not "store" (a store name arrives only as a {slot}).
 * 4. UNKNOWN-OUTCOME KEYS. The keys in UNKNOWN_OUTCOME_KEYS carry the sentences for an outcome the
 *    app does not know; each must exist and hedge ("could not confirm", "can no longer confirm",
 *    "may already").
 *
 * The patterns must bite: each is run against a sentence it exists to catch before it is used.
 */
import { readCatalogue } from './read-catalogue.mjs';

const failures = [];

const FORBIDDEN = [
  { why: 'no Product reviews exist to show quality', pattern: /\bproduct quality\b/i, bite: 'Product quality is shown on each Product.' },
  {
    why: 'the app has no cart, checkout, ordering or payment',
    pattern: /\b(place (an|your) order|add to (your )?cart|checkout|buy now|pay now)\b/i,
    bite: 'Add to cart.',
  },
  {
    why: 'messages carry no read or delivery state',
    pattern: /\b(read receipts?|seen by|read by the seller|delivered to the seller)\b/i,
    bite: 'Your message was seen by the Seller.',
  },
  { why: 'nothing in the app is delivered or received on the Buyer\'s behalf', pattern: /\b(delivered|received by)\b/i, bite: 'Your message was delivered.' },
  { why: 'the app places, confirms and receives no order or payment', pattern: /\b(order|payment) ((was|is|has been) )?(placed|confirmed|received|complete|completed)\b/i, bite: 'Your payment was received.' },
  { why: 'Search orders by how closely words match, never by popularity', pattern: /\b(popular|best[- ]selling|top[- ]rated|best ratings?)\b/i, bite: 'Popular Products' },
  { why: 'a person is never shown engineering words', pattern: /\b(retry key|idempotency|payload|endpoint|cursor|JSON|API)\b/i, bite: 'The request is missing its retry key.' },
  { why: 'no sentence promises that a Seller will reply', pattern: /\bwill reply\b/i, bite: 'They will reply here.' },
  {
    why: 'the app has no shipment, tracking, stock hold or saved cart to report',
    pattern: /\b(shipped|arrived|tracking|out for delivery|held for you|your cart is saved|reserved|in stock|guaranteed|trending|most viewed)\b/i,
    bite: 'Your order has shipped.',
  },
];
/** Written for Sellers: they describe orders and payments on purpose. */
const NOT_SCANNED = /^(obligation|sms|deletion|ownership_transfer|seller)\./;

/**
 * Role words in lower case. The error.*, seller.* and Seller-audience families are written for other
 * audiences and are not held to this.
 */
const ROLE_NAMESPACES = /^(buyer|auth|common)\./;
const LOWER_CASE_ROLE = /\b(sellers?|buyers?|stores?)\b/;
const withoutSlots = (value) => value.replace(/\{[^}]+\}/g, '');

/** Keys whose job is an outcome the app does not know: each must hedge. */
const UNKNOWN_OUTCOME_KEYS = ['buyer.chat.maybe_not_sent', 'buyer.chat.cannot_confirm', 'buyer.chat.ask_unconfirmed', 'buyer.save.unconfirmed'];
const HEDGE = /\b(could not confirm|cannot confirm|can no longer confirm|may already)\b/i;

for (const { pattern, bite } of FORBIDDEN) {
  if (!pattern.test(bite)) failures.push(`pattern ${pattern} does not match its own sample: "${bite}"`);
}
if (HEDGE.test('Your question could not be passed to the Seller.')) failures.push('the hedge pattern matches a definite failure');
if (!HEDGE.test('We could not confirm whether this change was made.')) failures.push('the hedge pattern misses a hedged sentence');
if (!LOWER_CASE_ROLE.test(withoutSlots('Message the seller.'))) failures.push('the lower-case role pattern does not match its own sample');
if (LOWER_CASE_ROLE.test(withoutSlots('Message the Seller about {store}.'))) failures.push('the lower-case role pattern matches a capitalised role or a slot');

const { values, problems } = readCatalogue('en.ts', 'enCommon');
failures.push(...problems);
if (values.size < 500) failures.push(`only ${values.size} strings were read from en.ts: the reader or the file moved`);

let scanned = 0;
for (const [key, value] of values) {
  if (NOT_SCANNED.test(key)) continue;
  scanned += 1;
  for (const { why, pattern } of FORBIDDEN) {
    if (pattern.test(value)) failures.push(`${key} says "${value}" (${why})`);
  }
  if (ROLE_NAMESPACES.test(key) && LOWER_CASE_ROLE.test(withoutSlots(value))) {
    failures.push(`${key} says "${value}" (a role or "store" written in lower case)`);
  }
}
for (const key of UNKNOWN_OUTCOME_KEYS) {
  const value = values.get(key);
  if (value === undefined) failures.push(`${key} is missing: it is an unknown-outcome sentence`);
  else if (!HEDGE.test(value)) failures.push(`${key} asserts a result for an unknown outcome: "${value}"`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log(`  PASS  ${values.size} strings read, ${scanned} scanned: none matches a listed phrase`);
console.log(`  PASS  ${UNKNOWN_OUTCOME_KEYS.length} unknown-outcome sentences all hedge`);
