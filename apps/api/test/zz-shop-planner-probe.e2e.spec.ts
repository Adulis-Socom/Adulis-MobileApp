import { Pool, type PoolClient } from 'pg';

/**
 * TEMPORARY EVIDENCE PROBE -- never merged. Runs in CI's disposable database only.
 *
 * Question 1 (reproduction): across a grid of data and statistics states, does the OLD planner check
 *   (enable_seqscan off only) sometimes choose a plan without idx_product_shop, and does the NEW check
 *   (enable_seqscan off AND enable_sort off) always choose idx_product_shop, Market-led, with no Sort?
 * Question 2 (regression sensitivity): with the index dropped, reshaped to (market_id) only, or
 *   reshaped to (published_at, id) without the Market, does the NEW check fail every time?
 *
 * Every state change is made inside a transaction that is rolled back, so nothing persists.
 */
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const id = (n: number) => `0e07f000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const MA = id(1);
const MB = id(2);
const SEL = [id(0x20), id(0x21), id(0x22), id(0x23)];

const QUERY = `EXPLAIN (FORMAT JSON) SELECT p.id FROM core.product p
   JOIN core.seller s ON s.id = p.seller_id
   JOIN core.market m ON m.id = p.market_id
  WHERE p.market_id = $1 AND p.visibility = 'PUBLISHED' AND p.published_at IS NOT NULL
    AND s.status::text = ANY($2) AND m.activation_state = 'ACTIVE'
    AND (p.published_at, p.id) < ($3::timestamptz, $4::uuid)
  ORDER BY p.published_at DESC, p.id DESC LIMIT 31`;
const PARAMS = [MA, ['ACTIVE', 'CLOSING', 'BILLING_SUSPENDED'], '2026-11-11T00:00:00.000000Z', id(0x104)];

type Node = Record<string, unknown>;
const nodesOf = (n: Node): Node[] => [n, ...((n['Plans'] as Node[] | undefined) ?? []).flatMap(nodesOf)];

type Verdict = { indexes: string[]; sort: boolean; oldPass: boolean; newPass: boolean };

async function explain(c: PoolClient, sortOff: boolean): Promise<Node[]> {
  await c.query('SAVEPOINT e');
  await c.query('SET LOCAL enable_seqscan = off');
  await c.query(`SET LOCAL enable_sort = ${sortOff ? 'off' : 'on'}`);
  const r = await c.query<{ 'QUERY PLAN': Array<{ Plan: Node }> }>(QUERY, PARAMS);
  await c.query('ROLLBACK TO SAVEPOINT e');
  return nodesOf(r.rows[0]!['QUERY PLAN'][0]!.Plan);
}

// The OLD assertion: the index name appears anywhere in the plan.
const oldCheck = (nodes: Node[]) => nodes.some((n) => n['Index Name'] === 'idx_product_shop');
// The NEW assertions: exactly one scan of the index, Market in its index condition, no Sort node.
const newCheck = (nodes: Node[]) => {
  const scans = nodes.filter((n) => n['Index Name'] === 'idx_product_shop');
  return (
    scans.length === 1 &&
    String(scans[0]!['Index Cond']).includes('market_id') &&
    !nodes.some((n) => /Sort/.test(String(n['Node Type'])))
  );
};

async function verdict(c: PoolClient): Promise<{ old: Verdict; new: Verdict }> {
  const o = await explain(c, false);
  const n = await explain(c, true);
  const v = (nodes: Node[]): Verdict => ({
    indexes: nodes.filter((x) => x['Index Name']).map((x) => `${x['Relation Name']}:${x['Index Name']}`),
    sort: nodes.some((x) => /Sort/.test(String(x['Node Type']))),
    oldPass: oldCheck(nodes),
    newPass: newCheck(nodes),
  });
  return { old: v(o), new: v(n) };
}

describe('PROBE TEST-STABILISE-01 -- Shop planner check across statistics states', () => {
  let admin: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'P7A','Probe A','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'P7B','Probe B','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
      [MA, MB],
    );
    const sellers: Array<[string, string, string]> = [
      [SEL[0]!, MA, 'ACTIVE'],
      [SEL[1]!, MA, 'CLOSING'],
      [SEL[2]!, MA, 'DRAFT'],
      [SEL[3]!, MB, 'ACTIVE'],
    ];
    for (const [i, [sid, mid, status]] of sellers.entries()) {
      await admin.query(`INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,$2,$3,'ACTIVE')`, [
        id(0x10 + i),
        `+25191179000${i}`,
        mid,
      ]);
      await admin.query(
        `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
         VALUES ($1,$2,$3,'INDIVIDUAL',$4,$5,$6)`,
        [sid, mid, id(0x10 + i), `Probe ${i}`, `probe-p7-${i}`, status],
      );
    }
    let n = 0;
    for (const [sid, mid] of [[SEL[0]!, MA], [SEL[0]!, MA], [SEL[0]!, MA], [SEL[1]!, MA], [SEL[2]!, MA], [SEL[3]!, MB]]) {
      n += 1;
      await admin.query(
        `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility, published_at)
         VALUES ($1,$2,$3,$4,1,'ETB','PUBLISHED', now() - ($5 || ' minutes')::interval)`,
        [id(0x100 + n), sid, mid, `Probe product ${n}`, String(n * 10)],
      );
    }
  });

  afterAll(async () => {
    const sellers = SEL.map((s) => `'${s}'`).join(',');
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller WHERE id IN (${sellers})`,
      `DELETE FROM core.account WHERE id::text LIKE '0e07f000-%'`,
      `DELETE FROM core.market WHERE id IN ('${MA}','${MB}')`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  const REL = `ARRAY['core.product'::regclass, 'core.seller'::regclass, 'core.market'::regclass]`;
  const STATS: Record<string, string[]> = {
    asIs: [],
    analyzed: ['ANALYZE core.product', 'ANALYZE core.seller', 'ANALYZE core.market'],
    neverAnalyzed: [
      `DELETE FROM pg_statistic WHERE starelid = ANY(${REL})`,
      `UPDATE pg_class SET reltuples = -1, relpages = 0 WHERE oid = ANY(${REL})`,
    ],
    analyzedThenTinyDensity: [
      'ANALYZE core.product',
      `UPDATE pg_class SET reltuples = 1, relpages = 1 WHERE oid = 'core.product'::regclass`,
    ],
    analyzedThenHugeDensity: [
      'ANALYZE core.product',
      `UPDATE pg_class SET reltuples = 200000, relpages = 1 WHERE oid = 'core.product'::regclass`,
    ],
    sellersHugeProductsTiny: [
      'ANALYZE core.product',
      'ANALYZE core.seller',
      `UPDATE pg_class SET reltuples = 1, relpages = 1 WHERE oid = 'core.product'::regclass`,
      `UPDATE pg_class SET reltuples = 50000, relpages = 1 WHERE oid = 'core.seller'::regclass`,
    ],
  };
  // Extra rows inserted inside the transaction, in the probe's own Sellers.
  const DATA: Record<string, string[]> = {
    none: [],
    otherMarket500: [
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility, published_at)
       SELECT gen_random_uuid(), '${SEL[3]}', '${MB}', 'bulk b ' || g, 1, 'ETB', 'PUBLISHED', now() - (g || ' seconds')::interval
       FROM generate_series(1, 500) g`,
    ],
    sameMarketManySellers: [
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility, published_at)
       SELECT gen_random_uuid(), (ARRAY['${SEL[0]}','${SEL[1]}','${SEL[2]}']::uuid[])[1 + g % 3], '${MA}',
              'bulk a ' || g, 1, 'ETB', CASE WHEN g % 4 = 0 THEN 'DRAFT' ELSE 'PUBLISHED' END::core.product_visibility,
              CASE WHEN g % 4 = 0 THEN NULL ELSE now() - (g || ' seconds')::interval END
       FROM generate_series(1, 400) g`,
    ],
  };

  it('records OLD and NEW verdicts across the grid; NEW passes in every state', async () => {
    const rows: Array<Record<string, unknown>> = [];
    for (const [dataName, dataSql] of Object.entries(DATA)) {
      for (const [statsName, statsSql] of Object.entries(STATS)) {
        const c = await admin.connect();
        try {
          await c.query('BEGIN');
          await c.query(`SET LOCAL lock_timeout = '10s'`);
          for (const q of [...dataSql, ...statsSql]) await c.query(q);
          const v = await verdict(c);
          rows.push({ data: dataName, stats: statsName, ...v });
          await c.query('ROLLBACK');
        } finally {
          c.release();
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log('PROBE-GRID ' + JSON.stringify(rows));
    const oldFails = rows.filter((r) => !(r['old'] as Verdict).oldPass).length;
    // eslint-disable-next-line no-console
    console.log(`PROBE-GRID-SUMMARY cells=${rows.length} oldFails=${oldFails} newFails=${rows.filter((r) => !(r['new'] as Verdict).newPass).length}`);
    for (const r of rows) expect({ cell: `${r['data']}/${r['stats']}`, pass: (r['new'] as Verdict).newPass }).toEqual({ cell: `${r['data']}/${r['stats']}`, pass: true });
  });

  // Question 1b: sweep the planner's cost constants so the two candidate plans cross over.
  const COSTS: string[][] = [];
  for (const rpc of ['1.1', '4', '20', '60'])
    for (const cit of ['0.001', '0.005', '0.05'])
      for (const cop of ['0.0025', '0.05'])
        COSTS.push([`SET LOCAL random_page_cost = ${rpc}`, `SET LOCAL cpu_index_tuple_cost = ${cit}`, `SET LOCAL cpu_operator_cost = ${cop}`]);

  it('cost sweep: records where OLD flips; NEW passes in every cell', async () => {
    const rows: Array<Record<string, unknown>> = [];
    for (const [dataName, dataSql] of Object.entries(DATA)) {
      for (const [statsName, statsSql] of Object.entries(STATS)) {
        for (const cost of COSTS) {
          const c = await admin.connect();
          try {
            await c.query('BEGIN');
            await c.query(`SET LOCAL lock_timeout = '10s'`);
            for (const q of [...dataSql, ...statsSql, ...cost]) await c.query(q);
            const v = await verdict(c);
            rows.push({ data: dataName, stats: statsName, cost: cost.map((x) => x.split(' = ')[1]).join('/'), ...v });
            await c.query('ROLLBACK');
          } finally {
            c.release();
          }
        }
      }
    }
    const oldFails = rows.filter((r) => !(r['old'] as Verdict).oldPass);
    // eslint-disable-next-line no-console
    console.log('PROBE-COST-OLDFAILS ' + JSON.stringify(oldFails));
    // eslint-disable-next-line no-console
    console.log(`PROBE-COST-SUMMARY cells=${rows.length} oldFails=${oldFails.length} newFails=${rows.filter((r) => !(r['new'] as Verdict).newPass).length}`);
    for (const r of rows) expect({ cell: `${r['data']}/${r['stats']}/${r['cost']}`, pass: (r['new'] as Verdict).newPass }).toEqual({ cell: `${r['data']}/${r['stats']}/${r['cost']}`, pass: true });
  }, 600_000);

  const MUTATIONS: Record<string, string[]> = {
    dropped: ['DROP INDEX core.idx_product_shop'],
    marketOnly: [
      'DROP INDEX core.idx_product_shop',
      `CREATE INDEX idx_product_shop ON core.product (market_id) WHERE visibility = 'PUBLISHED'`,
    ],
    noMarket: [
      'DROP INDEX core.idx_product_shop',
      `CREATE INDEX idx_product_shop ON core.product (published_at DESC, id DESC) WHERE visibility = 'PUBLISHED'`,
    ],
  };

  it('NEW detects every index mutation, in every statistics state', async () => {
    const rows: Array<Record<string, unknown>> = [];
    for (const [mName, mSql] of Object.entries(MUTATIONS)) {
      for (const [statsName, statsSql] of Object.entries(STATS)) {
        const c = await admin.connect();
        try {
          await c.query('BEGIN');
          await c.query(`SET LOCAL lock_timeout = '10s'`);
          for (const q of [...mSql, ...statsSql]) await c.query(q);
          const v = await verdict(c);
          rows.push({ mutation: mName, stats: statsName, ...v });
          await c.query('ROLLBACK');
        } finally {
          c.release();
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log('PROBE-MUTATIONS ' + JSON.stringify(rows));
    // eslint-disable-next-line no-console
    console.log(
      `PROBE-MUTATIONS-SUMMARY cells=${rows.length} newDetected=${rows.filter((r) => !(r['new'] as Verdict).newPass).length} oldDetected=${rows.filter((r) => !(r['old'] as Verdict).oldPass).length}`,
    );
    for (const r of rows) expect({ cell: `${r['mutation']}/${r['stats']}`, detected: !(r['new'] as Verdict).newPass }).toEqual({ cell: `${r['mutation']}/${r['stats']}`, detected: true });
  });
});
