// The ratchet of ops/scripts/fk-audit.mjs (WO-INFRA-012, counted since WO-INFRA-015B): known test
// leaks are named AND counted, nothing else passes, and the list only shrinks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KNOWN_TEST_LEAKS, judge, sinceBaseline } from './fk-audit.mjs';

const row = (constraint, count = 1, table = 'core.device') => ({
  constraint,
  key: `${table}.${constraint}`,
  count,
  child: 'c',
  parent: 'p',
  validated: true,
  orphans: [],
});
const DEVICE = 'core.device.device_market_id_fkey';
const leak = (maxRows) => ({ [DEVICE]: { reason: 'a measured test leak', maxRows } });

test('strict by default: any orphan fails', () => {
  const { failures, tolerated } = judge([row('device_market_id_fkey')]);
  assert.equal(failures.length, 1);
  assert.equal(tolerated.length, 0);
});

test('a known test leak within its count is tolerated, a new one is not', () => {
  const { failures, tolerated } = judge(
    [
      row('device_market_id_fkey', 3),
      row('seller_public_stats_seller_id_fkey', 1, 'core.seller_public_stats'),
      row('device_market_id_fkey', 1, 'other.device'),
      row('constructor', 1, 'x.y'),
    ],
    leak(3),
  );
  assert.deepEqual(
    failures.map((r) => r.key),
    [
      'core.seller_public_stats.seller_public_stats_seller_id_fkey',
      'other.device.device_market_id_fkey',
      'x.y.constructor',
    ],
  );
  assert.deepEqual(
    tolerated.map((r) => r.key),
    [DEVICE],
  );
});

test('more orphans on a known key than its maximum fails, naming the maximum', () => {
  const { failures, tolerated } = judge([row('device_market_id_fkey', 4)], leak(3));
  assert.equal(tolerated.length, 0);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].exceeded, 3);
  assert.equal(failures[0].count, 4);
});

test('an entry without a usable maximum tolerates nothing (fails closed)', () => {
  for (const bad of [null, undefined, -1, 1.5, '3', Number.NaN, Infinity]) {
    const { failures } = judge([row('device_market_id_fkey', 1)], leak(bad));
    assert.equal(failures.length, 1, `maxRows ${String(bad)}`);
  }
  // A bare string reason (the pre-015B shape) is not an entry either.
  const { failures } = judge([row('device_market_id_fkey', 1)], { [DEVICE]: 'reason only' });
  assert.equal(failures.length, 1);
});

test('lower counts and vanished keys are reported, not failed', () => {
  const allowed = {
    ...leak(5),
    'core.x.gone_fkey': { reason: 'a leak that was fixed', maxRows: 2 },
  };
  const r = judge([row('device_market_id_fkey', 2)], allowed);
  assert.equal(r.failures.length, 0);
  assert.deepEqual(r.lowered, [{ key: DEVICE, count: 2, maxRows: 5 }]);
  assert.deepEqual(r.gone, ['core.x.gone_fkey']);
  // At the maximum exactly: tolerated, not lowered.
  assert.deepEqual(judge([row('device_market_id_fkey', 5)], leak(5)).lowered, []);
});

test('the known list names exactly the five measured leaks, each with a reason and a count', () => {
  assert.deepEqual(Object.keys(KNOWN_TEST_LEAKS).sort(), [
    'core.claim_evidence_item.claim_evidence_item_claim_id_fkey',
    DEVICE,
    'core.notification.notification_recipient_account_id_fkey',
    'core.order_state_transition.order_state_transition_order_id_fkey',
    'core.otp_delivery_attempt.otp_delivery_attempt_otp_challenge_id_fkey',
  ]);
  for (const [key, { reason, maxRows }] of Object.entries(KNOWN_TEST_LEAKS)) {
    assert.ok(reason.length > 20, key);
    assert.ok(Number.isInteger(maxRows) && maxRows > 0, `${key}: maxRows must be measured`);
  }
});

// The baseline (WO-INFRA-015B review): a rerun on the same disposable database is judged on what
// that run added, not on the total the database has accumulated.
const orphan = (key, ids) => ({
  constraint: key.split('.').pop(),
  key,
  count: ids.length,
  child: 'c',
  parent: 'p',
  validated: true,
  orphans: ids.map((id) => ({ id })),
});

test('since the baseline: only orphan rows that were not there before are judged', () => {
  const before = [orphan(DEVICE, ['a', 'b', 'c'])];
  const after = [orphan(DEVICE, ['a', 'b', 'c', 'd', 'e', 'f']), orphan('core.x.new_fkey', ['z'])];
  const judged = sinceBaseline(after, before);
  assert.deepEqual(
    judged.map((r) => [r.key, r.count, r.orphans.map((o) => o.id)]),
    [
      [DEVICE, 3, ['d', 'e', 'f']],
      ['core.x.new_fkey', 1, ['z']],
    ],
  );
  // A second full run that leaks exactly its usual three passes; a fourth new row fails.
  assert.equal(judge(judged.slice(0, 1), leak(3)).failures.length, 0);
  assert.equal(
    judge(sinceBaseline([orphan(DEVICE, ['a', 'b', 'c', 'd', 'e', 'f', 'g'])], before), leak(3))
      .failures.length,
    1,
  );
});

test('since the baseline: an empty baseline judges everything, and a bad one is refused', () => {
  const after = [orphan(DEVICE, ['a'])];
  assert.deepEqual(sinceBaseline(after, []), after);
  assert.deepEqual(sinceBaseline([], [orphan(DEVICE, ['a'])]), []);
  for (const bad of [null, {}, 'x', 3]) assert.throws(() => sinceBaseline(after, bad), /baseline/);
});
