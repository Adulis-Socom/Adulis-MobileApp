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
 *    engineering words (retry key or retry-key, idempotency, payload, endpoint, cursor, JSON, API),
 *    a promise that a Seller will reply (will reply, will respond, will answer, 'll reply, in any
 *    spacing), and commerce words nothing in the app can back yet (shipped, arrived, tracking, out
 *    for delivery, held for you, your cart is saved, reserved, in stock or in-stock, guaranteed,
 *    trending, most viewed).
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
 * 5. KNOWN OPEN SENTENCES. A sentence that breaks a rule above but is owned by someone else and not
 *    yet decided is listed in KNOWN_OPEN with its exact text and the rule it breaks. The entry allows
 *    that one sentence under that one rule and nothing else. The list is exact in both directions:
 *    an entry whose sentence no longer breaks the rule (it was reworded, or the key is gone) FAILS
 *    the run until the entry is removed, so the list cannot go stale.
 *
 * The patterns must bite: each is run against a sentence it exists to catch before it is used.
 */
import { readCatalogue } from './read-catalogue.mjs';

const failures = [];

/** The apostrophe and the typographic apostrophe (U+2019), written as code so this file stays ASCII. */
const APOSTROPHES = "'" + String.fromCharCode(0x2019);

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
  {
    why: 'a person is never shown engineering words',
    pattern: /\b(retry[-\s]+key|idempotency|payload|endpoint|cursor|JSON|API)\b/i,
    bite: 'The request is missing its retry key.',
    alsoBites: ['The retry-key is missing.', 'The retry  key is missing.'],
  },
  {
    why: 'no sentence promises that a Seller will reply',
    pattern: new RegExp(`(?:\\bwill|[${APOSTROPHES}]ll)\\s+(?:reply|respond|answer)\\b`, 'i'),
    bite: 'They will reply here.',
    alsoBites: [
      "They'll reply here.",
      `They${String.fromCharCode(0x2019)}ll reply here.`,
      'The Seller will respond.',
      'They will answer soon.',
      'They will  reply.',
    ],
  },
  {
    why: 'the app has no shipment, tracking, stock hold or saved cart to report',
    pattern: /\b(shipped|arrived|tracking|out for delivery|held for you|your cart is saved|reserved|in[-\s]+stock|guaranteed|trending|most viewed)\b/i,
    bite: 'Your order has shipped.',
    alsoBites: ['Shop in-stock items.'],
  },
];
/** Written for Sellers: they describe orders and payments on purpose. */
const NOT_SCANNED = /^(obligation|sms|deletion|ownership_transfer|seller)\./;

/**
 * KNOWN OPEN sentences: text that breaks a rule above, is owned by someone else (the founder) and has
 * not been decided. Each entry allows exactly this sentence under exactly this rule. When the wording is
 * decided, the sentence changes or the rule is revisited and the entry is deleted: the run fails while
 * an entry is no longer needed.
 */
const KNOWN_OPEN = [
  {
    key: 'chat.bot.escalated',
    value: 'Your question has been passed to the Seller. They will reply here.',
    rule: 'no sentence promises that a Seller will reply',
    note: 'founder-owned: shown to the Buyer and to Sellers on three surfaces, and its wording awaits copy approval',
  },
];

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

for (const { pattern, bite, alsoBites = [] } of FORBIDDEN) {
  for (const sample of [bite, ...alsoBites]) {
    if (!pattern.test(sample)) failures.push(`pattern ${pattern} does not match its own sample: "${sample}"`);
  }
}
for (const { key, rule } of KNOWN_OPEN) {
  if (!FORBIDDEN.some(({ why }) => why === rule)) failures.push(`KNOWN_OPEN ${key} names a rule that does not exist: "${rule}"`);
}
if (HEDGE.test('Your question could not be passed to the Seller.')) failures.push('the hedge pattern matches a definite failure');
if (!HEDGE.test('We could not confirm whether this change was made.')) failures.push('the hedge pattern misses a hedged sentence');
if (!LOWER_CASE_ROLE.test(withoutSlots('Message the seller.'))) failures.push('the lower-case role pattern does not match its own sample');
if (LOWER_CASE_ROLE.test(withoutSlots('Message the Seller about {store}.'))) failures.push('the lower-case role pattern matches a capitalised role or a slot');

const { values, problems } = readCatalogue('en.ts', 'enCommon');
failures.push(...problems);
if (values.size < 500) failures.push(`only ${values.size} strings were read from en.ts: the reader or the file moved`);

let scanned = 0;
const needed = new Set();
for (const [key, value] of values) {
  if (NOT_SCANNED.test(key)) continue;
  scanned += 1;
  for (const { why, pattern } of FORBIDDEN) {
    if (!pattern.test(value)) continue;
    const open = KNOWN_OPEN.find((entry) => entry.key === key && entry.value === value && entry.rule === why);
    if (open) needed.add(open);
    else failures.push(`${key} says "${value}" (${why})`);
  }
  if (ROLE_NAMESPACES.test(key) && LOWER_CASE_ROLE.test(withoutSlots(value))) {
    failures.push(`${key} says "${value}" (a role or "store" written in lower case)`);
  }
}
for (const entry of KNOWN_OPEN) {
  if (!needed.has(entry)) {
    failures.push(`KNOWN_OPEN ${entry.key} is no longer needed: no sentence with its exact text breaks "${entry.rule}". Remove the entry.`);
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
console.log(`  PASS  ${values.size} strings read, ${scanned} scanned: none matches a listed phrase apart from ${KNOWN_OPEN.length} known open sentence(s)`);
console.log(`  PASS  ${UNKNOWN_OUTCOME_KEYS.length} unknown-outcome sentences all hedge`);
