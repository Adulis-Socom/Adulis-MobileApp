// The ratchet of ops/scripts/fk-audit.mjs (WO-INFRA-012): known test leaks are named, nothing else
// passes, and the list only shrinks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KNOWN_TEST_LEAKS, judge } from './fk-audit.mjs';

const row = (constraint, count = 1) => ({
  constraint,
  count,
  child: 'c',
  parent: 'p',
  validated: true,
  orphans: [],
});

test('strict by default: any orphan fails', () => {
  const { failures, tolerated } = judge([row('device_market_id_fkey')]);
  assert.equal(failures.length, 1);
  assert.equal(tolerated.length, 0);
});

test('a known test leak is tolerated, a new one is not', () => {
  const { failures, tolerated } = judge(
    [row('device_market_id_fkey', 3), row('seller_public_stats_seller_id_fkey')],
    KNOWN_TEST_LEAKS,
  );
  assert.deepEqual(
    failures.map((r) => r.constraint),
    ['seller_public_stats_seller_id_fkey'],
  );
  assert.deepEqual(
    tolerated.map((r) => r.constraint),
    ['device_market_id_fkey'],
  );
});

test('the known list names exactly the five measured leaks, each with its reason', () => {
  assert.deepEqual(Object.keys(KNOWN_TEST_LEAKS).sort(), [
    'claim_evidence_item_claim_id_fkey',
    'device_market_id_fkey',
    'notification_recipient_account_id_fkey',
    'order_state_transition_order_id_fkey',
    'otp_delivery_attempt_otp_challenge_id_fkey',
  ]);
  for (const reason of Object.values(KNOWN_TEST_LEAKS)) assert.ok(reason.length > 20);
});
