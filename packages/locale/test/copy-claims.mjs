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
 *    or received, and popularity wording (Search orders by how closely words match, nothing else).
 *    Every key is scanned (the error.* keys the Buyer can be shown included) except the namespaces
 *    written for Sellers, which describe orders and payments on purpose: obligation.*, sms.*,
 *    deletion.*, ownership_transfer.*, seller.*. The list is short on purpose and must be
 *    revisited when ordering or payment ships: a phrase that becomes true is removed, not worked
 *    around. "Sign in to start ordering" is deliberately not listed: it is the design text for the
 *    signed-out Orders tab.
 * 3. UNKNOWN-OUTCOME KEYS. The keys in UNKNOWN_OUTCOME_KEYS carry the sentences for an outcome the
 *    app does not know; each must exist and hedge ("could not confirm", "can no longer confirm",
 *    "may already").
 *
 * The patterns must bite: each is run against a sentence it exists to catch before it is used.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const failures = [];

/** Every key and its string value in `enCommon`; a value that is not a plain string is a failure. */
function readCatalogue(file) {
  const sourceFile = ts.createSourceFile(file, readFileSync(path.join(src, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const text = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isParenthesizedExpression(node)) return text(node.expression);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = text(node.left);
      const right = text(node.right);
      return left === null || right === null ? null : left + right;
    }
    return null;
  };
  const values = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText() === 'enCommon' && node.initializer) {
      const literal = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (!ts.isObjectLiteralExpression(literal)) failures.push('enCommon is not an object literal');
      else {
        for (const member of literal.properties) {
          const key = ts.isPropertyAssignment(member) ? member.name.getText().replace(/^['"]|['"]$/g, '') : member.getText();
          const value = ts.isPropertyAssignment(member) ? text(member.initializer) : null;
          if (value === null) failures.push(`${key}: the value is not a plain string, so it cannot be checked`);
          else values.set(key, value);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return values;
}

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
];
/** Written for Sellers: they describe orders and payments on purpose. */
const NOT_SCANNED = /^(obligation|sms|deletion|ownership_transfer|seller)\./;

/** Keys whose job is an outcome the app does not know: each must hedge. */
const UNKNOWN_OUTCOME_KEYS = ['buyer.chat.maybe_not_sent', 'buyer.chat.cannot_confirm', 'buyer.chat.ask_unconfirmed', 'buyer.save.unconfirmed'];
const HEDGE = /\b(could not confirm|cannot confirm|can no longer confirm|may already)\b/i;

for (const { pattern, bite } of FORBIDDEN) {
  if (!pattern.test(bite)) failures.push(`pattern ${pattern} does not match its own sample: "${bite}"`);
}
if (HEDGE.test('Your question could not be passed to the Seller.')) failures.push('the hedge pattern matches a definite failure');
if (!HEDGE.test('We could not confirm whether this change was made.')) failures.push('the hedge pattern misses a hedged sentence');

const values = readCatalogue('en.ts');
if (values.size < 500) failures.push(`only ${values.size} strings were read from en.ts: the reader or the file moved`);

let scanned = 0;
for (const [key, value] of values) {
  if (NOT_SCANNED.test(key)) continue;
  scanned += 1;
  for (const { why, pattern } of FORBIDDEN) {
    if (pattern.test(value)) failures.push(`${key} says "${value}" (${why})`);
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
