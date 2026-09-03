import { Pool, type PoolClient } from 'pg';

/**
 * T6 / G1.9 -- core.product.slug.
 *
 * Doctrine 5: "no internal UUID appears in any public URL." The contract has
 * called the product path parameter {slug} since v1.4 and it has been served
 * by id since C2 (register D-43). The contract was right and the column was
 * the defect.
 *
 * The interesting rules are all about what happens when a name is NOT a
 * clean English noun phrase: a duplicate within one seller, the same name
 * across two sellers, and a name that reduces to nothing at all -- which
 * every Amharic product name does, and Amharic is half this product's
 * audience.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

type Tx = PoolClient;

describe('T6 / G1.9 -- the product slug', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: ADMIN, max: 2 });
  });
  afterAll(async () => {
    await pool.end();
  });

  const tx = async (fn: (c: Tx) => Promise<void>) => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await fn(c);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  };

  const seedSellers = async (c: Tx, suffix: string) => {
    const market = `99999999-3333-4000-8000-0000000000${suffix}0`;
    const owner1 = `99999999-3333-4000-8000-0000000000${suffix}1`;
    const owner2 = `99999999-3333-4000-8000-0000000000${suffix}2`;
    const sellerA = `99999999-3333-4000-8000-0000000000${suffix}3`;
    const sellerB = `99999999-3333-4000-8000-0000000000${suffix}4`;

    await c.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1, $2, 'Slug', 'PHASE_1', 'ETB', 'Africa/Addis_Ababa', 'en', 'ACTIVE', true, 'AFROMESSAGE')`,
      [market, `S${suffix}`],
    );
    await c.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       VALUES ($1, $3, $5, 'ACTIVE'), ($2, $4, $5, 'ACTIVE')`,
      [owner1, owner2, `+2519170000${suffix}1`, `+2519170000${suffix}2`, market],
    );
    await c.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1, $3, $4, 'INDIVIDUAL', 'A', $6, 'ACTIVE'),
              ($2, $3, $5, 'INDIVIDUAL', 'B', $7, 'ACTIVE')`,
      [sellerA, sellerB, market, owner1, owner2, `slug-a-${suffix}`, `slug-b-${suffix}`],
    );
    return { market, sellerA, sellerB };
  };

  /** Insert WITHOUT naming slug -- exactly as all fourteen writers do. */
  const addProduct = async (c: Tx, market: string, seller: string, name: string) => {
    const r = await c.query(
      `INSERT INTO core.product (id, seller_id, market_id, name,
                                 base_price_minor, base_price_currency)
       VALUES (gen_random_uuid(), $1, $2, $3, 1000, 'ETB')
       RETURNING id, slug`,
      [seller, market, name],
    );
    return r.rows[0] as { id: string; slug: string };
  };

  it('is generated from the name when the writer does not supply one', () =>
    tx(async (c) => {
      const { market, sellerA } = await seedSellers(c, '1');
      // Not one of the fourteen INSERT sites names a slug. Had the column
      // been NOT NULL without a generator, every one would have failed --
      // and 23502 has no case in the error translator, so each would have
      // surfaced as an opaque 500.
      const p = await addProduct(c, market, sellerA, 'Canvas Tote!!  ');
      expect(p.slug).toBe('canvas-tote');
    }));

  it('suffixes on collision WITHIN a seller, and only within one', () =>
    tx(async (c) => {
      const { market, sellerA, sellerB } = await seedSellers(c, '2');
      const first = await addProduct(c, market, sellerA, 'Canvas Tote');
      const second = await addProduct(c, market, sellerA, 'Canvas Tote');
      const third = await addProduct(c, market, sellerA, 'canvas tote');
      expect([first.slug, second.slug, third.slug]).toEqual([
        'canvas-tote',
        'canvas-tote-2',
        'canvas-tote-3',
      ]);

      // A DIFFERENT seller takes the unsuffixed slug, because the public
      // path is /{handle}/{slug} and the handle already separates them.
      const other = await addProduct(c, market, sellerB, 'Canvas Tote');
      expect(other.slug).toBe('canvas-tote');
    }));

  it('falls back to "product" when the name reduces to nothing -- every Amharic name does', () =>
    tx(async (c) => {
      const { market, sellerA } = await seedSellers(c, '3');
      const a = await addProduct(c, market, sellerA, 'የሸማ ቦርሳ');
      const b = await addProduct(c, market, sellerA, 'ቀሚስ');
      // Not decoration: a store whose products are all named in Ge'ez must
      // still get usable, distinct URLs rather than a unique violation.
      expect(a.slug).toBe('product');
      expect(b.slug).toBe('product-2');
    }));

  it('is immutable, and the refusal is a 409 rather than a 500', () =>
    tx(async (c) => {
      const { market, sellerA } = await seedSellers(c, '4');
      const p = await addProduct(c, market, sellerA, 'Canvas Tote');

      // The write-once trigger, copying core.fn_reservation_price_write_once.
      // A column-level REVOKE would have looked like the right answer and
      // done nothing: adulis_app holds TABLE-level UPDATE, and a
      // column-level REVOKE does not subtract from a table-level grant.
      await expect(
        c.query(`UPDATE core.product SET slug = 'something-else' WHERE id = $1`, [p.id]),
      ).rejects.toMatchObject({ code: '23001' });
    }));

  it('renaming the product leaves the slug alone -- a shared link must not break', () =>
    tx(async (c) => {
      const { market, sellerA } = await seedSellers(c, '5');
      const p = await addProduct(c, market, sellerA, 'Canvas Tote');
      await c.query(`UPDATE core.product SET name = 'Leather Tote' WHERE id = $1`, [p.id]);
      const after = await c.query(`SELECT name, slug FROM core.product WHERE id = $1`, [p.id]);
      expect(after.rows[0]).toEqual({ name: 'Leather Tote', slug: 'canvas-tote' });
    }));

  it('the backfill left no NULL and no duplicate within any seller', async () => {
    // The Phase A gate, asserted against the whole table rather than a
    // fixture: the column was added to a populated database.
    const c = await pool.connect();
    try {
      const r = await c.query(
        `SELECT count(*) FILTER (WHERE slug IS NULL)::int AS nulls,
                (count(*) - count(DISTINCT (seller_id, slug)))::int AS dupes
           FROM core.product`,
      );
      expect(r.rows[0]).toEqual({ nulls: 0, dupes: 0 });
    } finally {
      c.release();
    }
  });
});
