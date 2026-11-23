// The catalogue fixture sets (BUY-03A): what each set writes, that every row is guarded, deterministic,
// synthetic and confined to the schemas the sets may touch, and how `requires` and `conflicts` behave.
// No database is involved here: the SQL text is read. The same SQL is run on a disposable stack by the
// validation recorded in NATIVE-FIXTURE-READINESS.md.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { guardSql, loadSet, SETS } from '../fixtures/index.mjs';
import {
  ASSISTANT,
  itemName,
  itemPrice,
  MARKET_B,
  POTTERY,
  publicRef,
  SCENES,
  scenePublicRef,
  WEAVES,
  WEAVES_PRODUCTS,
} from '../fixtures/catalogue.mjs';
import { evaluateGuard } from './guard-model.mjs';
import { makeIo, world } from './fakes.mjs';
import { readManifest } from '../lib/manifest.mjs';

const NEW_SETS = ['catalogue-core', 'scenes', 'market-b', 'extras', 'assistant'];
const sqlOf = (name, w = world()) => SETS[name].sql(w.m);
const allSql = (w) => NEW_SETS.map((n) => sqlOf(n, w)).join('\n');

const withDir = async (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'native-sets-'));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('the new sets exist next to the baseline, which is unchanged', () => {
  for (const n of ['baseline', ...NEW_SETS]) assert.ok(Object.hasOwn(SETS, n), n);
  const w = world();
  assert.equal(
    SETS.baseline.sql(w.m).includes('INSERT INTO core.category (id, code) VALUES ('),
    true,
  );
  assert.deepEqual(SETS.baseline.conflicts, []);
  assert.equal(SETS.baseline.requires, undefined);
});

test('requires: scenes, extras and assistant refuse to load without catalogue-core; the others do not need it', async () => {
  for (const n of ['scenes', 'extras', 'assistant']) {
    assert.deepEqual(SETS[n].requires, ['catalogue-core'], n);
    const w = world();
    w.m.fixtures = ['baseline'];
    await withDir((dir) =>
      assert.rejects(
        loadSet(w.m, makeIo(w), n, { dir }),
        /requires 'catalogue-core' to be loaded first/,
        n,
      ),
    );
    assert.equal(w.pg.executed, undefined, `${n} wrote nothing`);
  }
  for (const n of ['catalogue-core', 'market-b']) assert.equal(SETS[n].requires, undefined, n);
});

test('each set loads behind the guard, in one transaction, and is recorded in the manifest', async () => {
  const w = world();
  await withDir(async (dir) => {
    let m = w.m;
    for (const n of ['baseline', ...NEW_SETS]) {
      m = await loadSet(m, makeIo(w), n, { dir });
      const sent = w.pg.executed;
      assert.ok(
        sent.startsWith(guardSql(m).trim().slice(0, 20)) || sent.indexOf('\nDO $guard$') >= 0,
      );
      assert.ok(
        sent.indexOf('native run identity mismatch') < sent.search(/INSERT INTO|SELECT core\./),
        `${n}: the guard comes first`,
      );
      const g = evaluateGuard(sent, w.pg.live);
      assert.equal(g.guarded, true, n);
    }
    assert.deepEqual(m.fixtures, ['baseline', ...NEW_SETS]);
    assert.deepEqual(readManifest(dir).fixtures, ['baseline', ...NEW_SETS]);
  });
});

test('a set cannot be loaded twice and an unknown set is refused', async () => {
  const w = world();
  w.m.fixtures = ['catalogue-core'];
  await withDir(async (dir) => {
    await assert.rejects(loadSet(w.m, makeIo(w), 'catalogue-core', { dir }), /already loaded/);
    await assert.rejects(loadSet(w.m, makeIo(w), 'catalogue', { dir }), /unknown fixture set/);
  });
  assert.equal(w.pg.executed, undefined);
});

test('the existing conflicts rule still holds with a requires-carrying set', async () => {
  const w = world();
  w.m.fixtures = ['catalogue-core'];
  SETS.foryou = { conflicts: ['catalogue-core'], sql: () => '' };
  try {
    await withDir((dir) =>
      assert.rejects(loadSet(w.m, makeIo(w), 'foryou', { dir }), /cannot share a stack/),
    );
  } finally {
    delete SETS.foryou;
  }
});

test('ids are deterministic for a run, differ between runs, and phones are synthetic +2519 numbers', () => {
  const a = world();
  const b = world();
  for (const n of NEW_SETS) {
    assert.equal(sqlOf(n, a), sqlOf(n, a), `${n} is stable`);
    assert.notEqual(sqlOf(n, a), sqlOf(n, b), `${n} differs between runs`);
  }
  const sql = allSql(a);
  const phones = [...sql.matchAll(/'(\+[0-9]+)'/g)].map((x) => x[1]);
  assert.ok(phones.length === 3);
  for (const p of phones) assert.match(p, /^\+2519[0-9]{8}$/);
  assert.equal(new Set(phones).size, phones.length, 'no phone twice');
  assert.ok(!phones.includes('+251900000901'), 'the baseline phone is not reused');
  assert.doesNotMatch(sql, /@/, 'no e-mail address');
  assert.notEqual(scenePublicRef(a.m, 'explore'), scenePublicRef(b.m, 'explore'));
});

test('every Scene public reference is 22 characters of [A-Za-z0-9_-]', () => {
  const w = world();
  for (const s of SCENES) assert.match(scenePublicRef(w.m, s.key), /^[A-Za-z0-9_-]{22}$/);
  assert.match(publicRef('x'), /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(scenePublicRef(w.m, 'private'), scenePublicRef(w.m, 'explore'));
});

test('catalogue-core states the asserted Seller, Product, price and stock values', () => {
  const sql = sqlOf('catalogue-core');
  for (const s of [
    `'Fixture Weaves'`,
    `'fixture-weaves'`,
    `'Baskets, scarves and cups from our Addis Ababa workshop.'`,
    `'BUYER_COLLECTION'`,
    `'BETA'`,
    `'Hand-woven in Addis Ababa from dyed grass.'`,
    `'Shemma cotton with a woven border.'`,
    `'Carved wood, for the coffee ceremony.'`,
  ])
    assert.ok(sql.includes(s), s);
  const rows = Object.fromEntries(WEAVES_PRODUCTS.map((p) => [p.name, p]));
  assert.deepEqual(Object.keys(rows), ['Woven basket', 'Cotton scarf', 'Clay cup', 'Coffee tray']);
  assert.deepEqual(
    WEAVES_PRODUCTS.map((p) => p.slug),
    ['woven-basket', 'cotton-scarf', 'clay-cup', 'coffee-tray'],
  );
  assert.deepEqual(
    rows['Woven basket'].variants.map((v) => [v.key, v.price, v.stock]),
    [
      ['Small', 90000, 3],
      ['Large', 120000, 0],
    ],
  );
  assert.equal(rows['Woven basket'].base, 100000);
  assert.deepEqual(
    rows['Cotton scarf'].variants.map((v) => [v.key, v.price, v.stock]),
    [['One size', 45050, 0]],
  );
  assert.deepEqual(
    rows['Clay cup'].variants.map((v) => [v.price, v.stock]),
    [[35000, 4]],
  );
  assert.equal(rows['Clay cup'].description, null);
  assert.deepEqual(
    rows['Coffee tray'].variants.map((v) => [v.price, v.stock]),
    [[150000, 2]],
  );
  assert.equal(rows['Cotton scarf'].category, 'FASHION');
  assert.ok(sql.includes(`code = 'FASHION'`));
  // prices appear as minor units, never as a formatted amount
  for (const n of [90000, 120000, 45050, 35000, 150000, 100000]) assert.ok(sql.includes(`${n}`), n);
  assert.doesNotMatch(sql, /1,000\.00|900\.00|5,000\.00/);
  // stock is an event (the count is derived); zero stock writes no event; the scarf and Large never get one
  assert.equal((sql.match(/INSERT INTO core\.stock_event/g) ?? []).length, 3);
  assert.doesNotMatch(sql, /stock_count/);
});

test('catalogue-core orders created_at and published_at strictly ascending: basket < scarf < cup < tray', () => {
  const sql = sqlOf('catalogue-core');
  const rows = [
    ...sql.matchAll(/INSERT INTO core\.product \(.*?VALUES \('[^']+', '[^']+', [^;]*?\);/gs),
  ].map((x) => x[0]);
  assert.equal(rows.length, 4);
  const secs = rows.map((r) =>
    [...r.matchAll(/interval '(\d+) seconds'/g)].map((x) => Number(x[1])),
  );
  assert.deepEqual(
    secs,
    [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ],
    'created_at and published_at, each a different explicit second',
  );
  assert.ok(/greatest\(now\(\)/.test(sql), 'later than every Product already published');
  assert.ok(
    sql.includes('AND seller_id <> '),
    'the base ignores the Weaves Products themselves (no drift)',
  );
});

test('scenes: two Scenes published through the function, exact captions, tags in order, newest first', () => {
  const w = world();
  const sql = sqlOf('scenes', w);
  assert.equal((sql.match(/fn_scene_post_publish\(/g) ?? []).length, 2);
  assert.ok(sql.includes(`'Coffee tray and scarf, set for the ceremony.'`));
  assert.ok(sql.includes(SCENES[1].caption));
  assert.ok(SCENES[1].caption.includes('Morning light on the new baskets'));
  assert.ok(SCENES[1].caption.endsWith('every piece here is from our own workshop.'));
  assert.deepEqual(SCENES[0].tags, ['tray', 'scarf']);
  assert.deepEqual(SCENES[1].tags, ['basket', 'scarf', 'cup']);
  assert.ok(SCENES[1].hoursAgo < SCENES[0].hoursAgo, 'the explore Scene is the newest');
  assert.ok(sql.includes(scenePublicRef(w.m, 'explore')));
  assert.ok(sql.includes(scenePublicRef(w.m, 'private')));
  // image keys are plain strings: no object store write exists in the set
  assert.match(sql, /scenes\/[A-Za-z0-9_-]{22}\/img\/(thumb|card|full)\.webp/);
  assert.doesNotMatch(sql, /\bmc\b|minio|s3:\/\//i);
  // publish comes after the revision and its tags; the feed time is set after the publish
  const iPub = sql.indexOf('fn_scene_post_publish');
  assert.ok(sql.indexOf('INSERT INTO core.scene_post_product') < iPub);
  assert.ok(iPub < sql.indexOf('UPDATE core.scene_post SET published_at'));
});

test('market-b is a second ACTIVE Market with the same handle and a Product the SEED Market must not show', () => {
  const sql = sqlOf('market-b');
  assert.ok(sql.includes(`'FXB'`) && sql.includes(`'Fixture Market B'`));
  assert.equal(MARKET_B.product.price, 500000);
  assert.ok(sql.includes(`'Market B size'`) && sql.includes('500000'));
  assert.ok(sql.includes(`'Fixture Weaves B'`) && sql.includes(`'fixture-weaves'`));
  assert.ok(sql.includes(`'ACTIVE'`));
  assert.doesNotMatch(sql, /code = 'SEED'/, 'nothing of Market B is written into the SEED Market');
  assert.match(sql, /INSERT INTO core\.market /);
  assert.ok(sql.indexOf('INSERT INTO core.market ') < sql.indexOf('INSERT INTO core.seller '));
  assert.doesNotMatch(sql, /otp_enabled|is_live/);
});

test('extras: Fixture Pottery with 32 Shop items older than every Weaves Product, three of them categorised', () => {
  const sql = sqlOf('extras');
  assert.ok(sql.includes(`'Fixture Pottery'`) && sql.includes(`'fixture-pottery'`));
  assert.equal(POTTERY.items, 32);
  for (const n of [1, 9, 10, 32]) assert.ok(sql.includes(`'${itemName(n)}'`), itemName(n));
  assert.equal(itemName(1), 'Shop item 01');
  assert.equal(itemPrice(1), 10100);
  assert.ok(sql.includes('10100') && sql.includes('13200'));
  assert.equal((sql.match(/INSERT INTO core\.product \(/g) ?? []).length, 32);
  assert.equal((sql.match(/INSERT INTO core\.stock_event/g) ?? []).length, 32);
  assert.equal((sql.match(/'shop-item-\d\d'/g) ?? []).length, 32);
  // published_at: now() minus 39 .. 8 days: older than every Weaves Product (now plus seconds)
  assert.deepEqual(
    [...sql.matchAll(/interval '(\d+) days'/g)].map((x) => Number(x[1])).filter((d) => d < 40)
      .length >= 64,
    true,
  );
  assert.ok(sql.includes(`interval '39 days'`) && sql.includes(`interval '8 days'`));
  assert.deepEqual(POTTERY.categories, { 30: 'ELECTRONICS', 31: 'COSMETICS', 32: 'COSMETICS' });
  assert.equal((sql.match(/code = 'COSMETICS'/g) ?? []).length, 2);
  assert.equal((sql.match(/code = 'ELECTRONICS'/g) ?? []).length, 1);
  assert.doesNotMatch(sql, /code = 'FASHION'/);
});

test('assistant: one intent, one phrase and one Seller answer template, with no slots', () => {
  const sql = sqlOf('assistant');
  assert.ok(sql.includes(`'WO013_FIXTURE_DELIVERY'`));
  assert.ok(sql.includes(`'Delivery times?'`) && sql.includes(`'SEED'`));
  assert.ok(sql.includes(`'nlu.answer.wo013_delivery'`) && sql.includes(`'{}'`));
  assert.equal(ASSISTANT.phrase.toLowerCase(), 'delivery times?');
  for (const t of ['nlu.intent ', 'nlu.intent_phrase ', 'nlu.answer_template '])
    assert.equal(
      (sql.match(new RegExp(`INSERT INTO ${t.replace('.', '\\.')}`, 'g')) ?? []).length,
      1,
      t,
    );
});

test('the sets write only the tables they are meant to, and never anything about payment, orders or reviews', () => {
  const w = world();
  const allowed = new Set([
    'core.account',
    'core.seller',
    'core.seller_fulfilment_method',
    'billing.subscription',
    'core.product',
    'core.product_variant',
    'core.stock_event',
    'core.scene_post',
    'core.scene_post_revision',
    'core.scene_post_product',
    'core.market',
    'nlu.intent',
    'nlu.intent_phrase',
    'nlu.answer_template',
  ]);
  const sql = allSql(w);
  const written = new Set([...sql.matchAll(/INSERT INTO ([a-z_.]+)/g)].map((x) => x[1]));
  for (const t of written) assert.ok(allowed.has(t), `${t} is not an allowed target`);
  assert.doesNotMatch(
    sql,
    /fn_order_payment_verified|"order"|core\.review|payment|notification|chat\.|CREATE OR REPLACE|DROP |TRUNCATE|DELETE |ALTER |GRANT |COPY |\bSET ROLE\b|set_config/i,
  );
  // updates: only the Scene feed time
  const updates = [...sql.matchAll(/\bUPDATE ([a-z_.]+)/g)].map((x) => x[1]);
  assert.deepEqual([...new Set(updates)], ['core.scene_post']);
  // every statement of every set sits behind the guard when loaded (it is prepended by execGuarded)
  assert.match(guardSql(w.m), /RAISE EXCEPTION/);
});

test('no set holds a secret, a URL, a real-looking name or a statement outside the generated data', () => {
  const sql = allSql(world());
  assert.doesNotMatch(sql, /https?:\/\/|password|secret|token/i);
  const text = [WEAVES.storeName, MARKET_B.displayName, POTTERY.storeName].join(' ');
  assert.match(text, /^Fixture /);
});
