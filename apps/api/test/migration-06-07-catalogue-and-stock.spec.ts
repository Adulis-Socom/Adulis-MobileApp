import { Pool, PoolClient } from 'pg';

/** A savepoint-guarded client — see the tx helper. */
type Tx = { query: PoolClient['query'] };

/**
 * Migrations 06 and 07 — catalogue, media, social posts, and the derived stock
 * count.
 *
 * Migration 07 is one of the three ADU-DB-01 §28 marks to read by hand, and the
 * concurrency-critical one: "everywhere else, a mistake raises an exception; in
 * those two, IT PRODUCES WRONG DATA." So the tests here are not shaped like the
 * others. Most of this file exercises the one pair of triggers §10.1 calls "the
 * single most important pair in the schema", including under a real race — the
 * only test in this repository that needs two connections at once.
 */

const CONNECTION_STRING = process.env['DATABASE_URL'];

const M = '33333333-1111-4000-8000-000000000001';
const A = '33333333-1111-4000-8000-000000000002';
const S = '33333333-1111-4000-8000-000000000003';
const P = '33333333-1111-4000-8000-000000000004';
const V = '33333333-1111-4000-8000-000000000005';

describe('migrations 06-07 — catalogue, media, and the derived stock count', () => {
  let pool: Pool;

  const tx = async <T>(fn: (c: Tx) => Promise<T>): Promise<T> => {
    const c = await pool.connect();
    const guarded: Tx = {
      query: async (...args: Parameters<PoolClient['query']>) => {
        await c.query('SAVEPOINT stmt');
        try {
          const r = await (c.query as (...a: unknown[]) => Promise<unknown>)(...args);
          await c.query('RELEASE SAVEPOINT stmt');
          return r;
        } catch (e) {
          await c.query('ROLLBACK TO SAVEPOINT stmt');
          throw e;
        }
      },
    } as Tx;
    try {
      await c.query('BEGIN');
      return await fn(guarded);
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  };

  /** A seller with one product and one variant, inside the caller's transaction. */
  const seed = async (c: Tx, suffix = '01') => {
    await c.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live)
       VALUES ($1, $2, 'Catalogue', 'PHASE_1', 'ETB', 'Africa/Addis_Ababa', 'en', false)`,
      [M, `C${suffix}`],
    );
    await c.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [A, `+2519113330${suffix}`, M],
    );
    await c.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Catalogue Co',$4,'ACTIVE')`,
      [S, M, A, `cat-co-${suffix}`],
    );
    await c.query(
      `INSERT INTO core.product (id, seller_id, market_id, name,
                                 base_price_minor, base_price_currency)
       VALUES ($1,$2,$3,'Canvas tote',45000,'ETB')`,
      [P, S, M],
    );
    await c.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
                                         price_currency, variant_key)
       VALUES ($1,$2,$3,45000,'ETB','default')`,
      [V, P, S],
    );
  };

  const addStock = (c: Tx, delta: number, reason = 'SELLER_SET') =>
    c.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::core.stock_event_reason)`,
      [V, S, delta, reason],
    );

  const countOf = async (c: Tx) =>
    ((await c.query(`SELECT stock_count FROM core.product_variant WHERE id=$1`, [V])) as {
      rows: { stock_count: number }[];
    }).rows[0]?.stock_count;

  beforeAll(() => {
    if (!CONNECTION_STRING) throw new Error('DATABASE_URL is not set.');
    pool = new Pool({ connectionString: CONNECTION_STRING, max: 4 });
  });
  afterAll(async () => {
    await pool.end();
  });

  // =========================================================================
  describe('stock_count is not writable, and that is the whole mechanism', () => {
    /**
     * §10.1 takes "the strongest available form" of PRD §7's invariant: rather
     * than requiring an event alongside every mutation, it makes the column
     * unwritable so the event is not a RECORD of the change but its CAUSE.
     */
    it('refuses a direct UPDATE of stock_count', async () => {
      await tx(async (c) => {
        await seed(c);
        await expect(
          c.query(`UPDATE core.product_variant SET stock_count = 99 WHERE id=$1`, [V]),
        ).rejects.toThrow(/stock_count is derived from core\.stock_event/);
      });
    });

    it('refuses it even inside a statement that changes other columns too', async () => {
      await tx(async (c) => {
        await seed(c);
        await expect(
          c.query(
            `UPDATE core.product_variant SET price_minor = 1, stock_count = 5 WHERE id=$1`,
            [V],
          ),
        ).rejects.toThrow(/stock_count is derived/);
      });
    });

    it('still permits every other column, which is why the guard is a trigger', async () => {
      await tx(async (c) => {
        await seed(c);
        await expect(
          c.query(
            `UPDATE core.product_variant
                SET price_minor = 50000, status = 'ACTIVE', stock_confirmed_at = now()
              WHERE id=$1`,
            [V],
          ),
        ).resolves.toBeDefined();
      });
    });

    it('moves the count only through an event, and records the resulting count', async () => {
      await tx(async (c) => {
        await seed(c);
        await addStock(c, 10);
        expect(await countOf(c)).toBe(10);
        await addStock(c, -3, 'ORDER_CREATED');
        expect(await countOf(c)).toBe(7);

        const { rows } = (await c.query(
          `SELECT delta, resulting_count FROM core.stock_event
            WHERE variant_id=$1 ORDER BY occurred_at`,
          [V],
        )) as { rows: { delta: number; resulting_count: number }[] };
        expect(rows).toEqual([
          { delta: 10, resulting_count: 10 },
          { delta: -3, resulting_count: 7 },
        ]);
      });
    });

    /**
     * §10.1's prose says AFTER INSERT; its function body assigns
     * NEW.resulting_count, which only takes effect in a BEFORE trigger. The
     * migration uses BEFORE and reports the contradiction — this asserts the
     * consequence, because under AFTER every row would carry NULL here and
     * nothing would raise.
     */
    it('populates resulting_count at all — the AFTER/BEFORE contradiction', async () => {
      await tx(async (c) => {
        await seed(c);
        await addStock(c, 4);
        const { rows } = (await c.query(
          `SELECT count(*)::int AS n FROM core.stock_event
            WHERE variant_id=$1 AND resulting_count IS NULL`,
          [V],
        )) as { rows: { n: number }[] };
        expect(rows[0]?.n).toBe(0);
      });
    });

    it('keeps the count equal to the sum of its events', async () => {
      await tx(async (c) => {
        await seed(c);
        for (const d of [10, -2, 5, -1, -4]) {
          await addStock(c, d, d > 0 ? 'RESTOCK' : 'LINE_CANCELLED');
        }
        const { rows } = (await c.query(
          `SELECT sum(delta)::int AS s FROM core.stock_event WHERE variant_id=$1`,
          [V],
        )) as { rows: { s: number }[] };
        expect(await countOf(c)).toBe(rows[0]?.s);
        expect(await countOf(c)).toBe(8);
      });
    });
  });

  // =========================================================================
  describe('overselling is a transaction failure, not a negative number', () => {
    it('rejects a decrement below zero and leaves no phantom event', async () => {
      await tx(async (c) => {
        await seed(c);
        await addStock(c, 7);
        await expect(addStock(c, -100, 'ORDER_CREATED')).rejects.toThrow(/stock_count_check/);
        expect(await countOf(c)).toBe(7);
        const { rows } = (await c.query(
          `SELECT count(*)::int AS n FROM core.stock_event WHERE variant_id=$1`,
          [V],
        )) as { rows: { n: number }[] };
        expect(rows[0]?.n).toBe(1);
      });
    });

    it('permits a decrement to exactly zero', async () => {
      await tx(async (c) => {
        await seed(c);
        await addStock(c, 3);
        await expect(addStock(c, -3, 'ORDER_CREATED')).resolves.toBeDefined();
        expect(await countOf(c)).toBe(0);
      });
    });
  });

  // =========================================================================
  describe('the CP-4 race — two connections, one variant', () => {
    /**
     * ADU-PROJ-01 §13.5 names "AI-generated code wrong under concurrency" as a
     * live risk, and §10.1 says stock decrement is where it would first show.
     *
     * The shape that makes this safe is inside the trigger:
     * `stock_count = stock_count + NEW.delta` reads and writes in ONE statement,
     * so the row lock serialises the two sessions. A read-then-write in the
     * application would let both read 7, both write 1, and lose an event.
     *
     * This needs two real connections and committed rows, so it cleans up after
     * itself rather than using the rollback helper — and it cannot delete the
     * stock events it made, because they are append-only. It uses a variant of
     * its own and leaves it, which is why the fixture ids differ.
     */
    it('lets exactly one decrement win, and never goes negative', async () => {
      // FRESH IDS EVERY RUN. The first version of this test reused fixed ones
      // and could not run twice: its own stock events are append-only, so the
      // variant they reference cannot be deleted, and the second run collided
      // on the primary key. The fixture is small and left behind deliberately.
      const uniq = await pool.query('SELECT gen_random_uuid() AS a, gen_random_uuid() AS b, ' +
        'gen_random_uuid() AS c, gen_random_uuid() AS d, gen_random_uuid() AS e');
      const rm = uniq.rows[0].a as string;
      const ra = uniq.rows[0].b as string;
      const rs = uniq.rows[0].c as string;
      const rp = uniq.rows[0].d as string;
      const rv = uniq.rows[0].e as string;
      const tag = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

      const setup = await pool.connect();
      try {
        await setup.query(
          `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                    display_timezone, default_locale, is_live)
           VALUES ($1,$2,'Race','PHASE_1','ETB','Africa/Addis_Ababa','en',false)`,
          [rm, `R${tag}`.slice(0, 8)],
        );
        await setup.query(
          `INSERT INTO core.account (id, phone_e164, market_id, status)
           VALUES ($1,$2,$3,'ACTIVE')`,
          [ra, `+2519${String(Date.now()).slice(-9)}`, rm],
        );
        await setup.query(
          `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                    store_name, handle, status)
           VALUES ($1,$2,$3,'INDIVIDUAL','Race Co',$4,'ACTIVE')`,
          [rs, rm, ra, `race-${tag}`],
        );
        await setup.query(
          `INSERT INTO core.product (id, seller_id, market_id, name,
                                     base_price_minor, base_price_currency)
           VALUES ($1,$2,$3,'Race tote',45000,'ETB')`,
          [rp, rs, rm],
        );
        await setup.query(
          `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
                                             price_currency, variant_key)
           VALUES ($1,$2,$3,45000,'ETB',$4)`,
          [rv, rp, rs, `race-${tag}`],
        );
        await setup.query(
          `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
           VALUES (gen_random_uuid(),$1,$2,7,'SELLER_SET')`,
          [rv, rs],
        );
      } finally {
        setup.release();
      }

      // Both want six of the seven. One of them must lose.
      const decrement = async () => {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          await c.query('SELECT pg_sleep(0.25)');
          await c.query(
            `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
             VALUES (gen_random_uuid(),$1,$2,-6,'ORDER_CREATED')`,
            [rv, rs],
          );
          await c.query('COMMIT');
          return 'committed';
        } catch {
          await c.query('ROLLBACK').catch(() => {});
          return 'rejected';
        } finally {
          c.release();
        }
      };

      const [a, b] = await Promise.all([decrement(), decrement()]);
      expect([a, b].filter((x) => x === 'committed')).toHaveLength(1);
      expect([a, b].filter((x) => x === 'rejected')).toHaveLength(1);

      const check = await pool.connect();
      try {
        const { rows } = await check.query(
          `SELECT v.stock_count,
                  (SELECT count(*)::int FROM core.stock_event e WHERE e.variant_id=v.id) AS events,
                  (SELECT sum(delta)::int FROM core.stock_event e WHERE e.variant_id=v.id) AS total
             FROM core.product_variant v WHERE v.id=$1`,
          [rv],
        );
        // One increment of 7 and exactly one decrement of 6 survived.
        expect(rows[0]).toEqual({ stock_count: 1, events: 2, total: 1 });
        expect(rows[0].stock_count).toBeGreaterThanOrEqual(0);
      } finally {
        check.release();
      }
    }, 60_000);
  });

  // =========================================================================
  describe('append-only, and the composite key that scopes an event', () => {
    it('raises on UPDATE and on DELETE, and revokes both from the app role', async () => {
      await tx(async (c) => {
        await seed(c);
        await addStock(c, 1);
        await expect(c.query(`UPDATE core.stock_event SET delta = 0`)).rejects.toThrow(
          /append-only; UPDATE is not permitted/,
        );
        await expect(c.query(`DELETE FROM core.stock_event`)).rejects.toThrow(
          /append-only; DELETE is not permitted/,
        );
      });
      const { rows } = await pool.query(
        `SELECT has_table_privilege('adulis_app','core.stock_event','INSERT') AS ins,
                has_table_privilege('adulis_app','core.stock_event','UPDATE') AS upd,
                has_table_privilege('adulis_app','core.stock_event','DELETE') AS del`,
      );
      expect(rows[0]).toEqual({ ins: true, upd: false, del: false });
    });

    /** This migration's addition, not the document's — see its header. */
    it('refuses an event whose seller is not the variant seller', async () => {
      await tx(async (c) => {
        await seed(c);
        await expect(
          c.query(
            `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
             VALUES (gen_random_uuid(), $1, $2, 1, 'RESTOCK')`,
            [V, A], // an account id where a seller id belongs
          ),
        ).rejects.toThrow(/stock_event_variant_seller/);
      });
    });
  });

  // =========================================================================
  describe('the catalogue absences Appendix C polices', () => {
    /** Check 1. §9.5: originals are resized on receipt and discarded. */
    it('has no original_key, image_url or photo_url anywhere in core', async () => {
      const { rows } = await pool.query(
        `SELECT table_name, column_name FROM information_schema.columns
          WHERE table_schema='core' AND column_name ~ '(original_key|image_url|photo_url)'`,
      );
      expect(rows).toEqual([]);
    });

    /** §9.5: five images, as a structural fact rather than a counting rule. */
    it('caps images at five by unique position, not by a count', async () => {
      await tx(async (c) => {
        await seed(c);
        const img = (position: number) =>
          c.query(
            `INSERT INTO core.product_image (id, product_id, position, thumb_key, card_key, full_key)
             VALUES (gen_random_uuid(), $1, $2, 't', 'c', 'f')`,
            [P, position],
          );
        for (let i = 1; i <= 5; i += 1) await expect(img(i)).resolves.toBeDefined();
        await expect(img(6)).rejects.toThrow(/position_check/);
        await expect(img(3)).rejects.toThrow(/product_image_position/);
      });
    });

    /** §9.5: no server-side transcoding in V1, so one clip and no renditions. */
    it('permits one video per product and no rendition table', async () => {
      await tx(async (c) => {
        await seed(c);
        const vid = () =>
          c.query(
            `INSERT INTO core.product_video (id, product_id, key, duration_seconds, height_px, bytes)
             VALUES (gen_random_uuid(), $1, 'k', 20, 480, 100)`,
            [P],
          );
        await expect(vid()).resolves.toBeDefined();
        await expect(vid()).rejects.toThrow(/product_video_product_id_key/);
      });
      const { rows } = await pool.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema='core' AND table_name ~ '(rendition|transcode)'`,
      );
      expect(rows).toEqual([]);
    });

    it('refuses a video over 30 seconds or over 480p', async () => {
      await tx(async (c) => {
        await seed(c);
        await expect(
          c.query(
            `INSERT INTO core.product_video (id, product_id, key, duration_seconds, height_px, bytes)
             VALUES (gen_random_uuid(), $1, 'k', 31, 480, 100)`,
            [P],
          ),
        ).rejects.toThrow(/duration_seconds_check/);
        await expect(
          c.query(
            `INSERT INTO core.product_video (id, product_id, key, duration_seconds, height_px, bytes)
             VALUES (gen_random_uuid(), $1, 'k', 20, 1080, 100)`,
            [P],
          ),
        ).rejects.toThrow(/height_px_check/);
      });
    });

    /** Check 3 / C1: base_price seeds a variant and prices nothing. */
    it('keeps price on the variant, with base_price only on the product', async () => {
      const { rows } = await pool.query(
        `SELECT table_name, column_name FROM information_schema.columns
          WHERE table_schema='core' AND column_name LIKE 'base_price%' ORDER BY 1,2`,
      );
      expect(rows.map((r) => r.table_name)).toEqual(['product', 'product']);
      const priced = await pool.query(
        `SELECT count(*)::int AS n FROM information_schema.columns
          WHERE table_schema='core' AND table_name='product_variant' AND column_name='price_minor'`,
      );
      expect(priced.rows[0].n).toBe(1);
    });

    it('has no stored entitlement boolean anywhere', async () => {
      const { rows } = await pool.query(
        `SELECT table_name, column_name FROM information_schema.columns
          WHERE table_schema IN ('core','billing')
            AND column_name ~ '(has_chatbot|can_broadcast|is_pro|blue_tick)'`,
      );
      expect(rows).toEqual([]);
    });
  });

  // =========================================================================
  describe('variant identity and cross-seller safety', () => {
    it('refuses two variants of one product with the same attribute combination', async () => {
      await tx(async (c) => {
        await seed(c);
        await expect(
          c.query(
            `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
                                               price_currency, variant_key)
             VALUES (gen_random_uuid(), $1, $2, 45000, 'ETB', 'default')`,
            [P, S],
          ),
        ).rejects.toThrow(/variant_key_per_product/);
      });
    });

    it('refuses a variant whose denormalised seller is not the product seller', async () => {
      await tx(async (c) => {
        await seed(c);
        const { rows } = (await c.query(
          `INSERT INTO core.account (id, phone_e164, market_id, status)
           VALUES (gen_random_uuid(), '+251911333999', $1, 'ACTIVE') RETURNING id`,
          [M],
        )) as { rows: { id: string }[] };
        const other = (await c.query(
          `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                    store_name, handle, status)
           VALUES (gen_random_uuid(),$1,$2,'INDIVIDUAL','Other','other-co','ACTIVE')
           RETURNING id`,
          [M, rows[0]?.id],
        )) as { rows: { id: string }[] };

        await expect(
          c.query(
            `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
                                               price_currency, variant_key)
             VALUES (gen_random_uuid(), $1, $2, 45000, 'ETB', 'other')`,
            [P, other.rows[0]?.id],
          ),
        ).rejects.toThrow(/variant_product_seller/);
      });
    });

    /** §9.1: only variant-defining definitions may carry a variant value. */
    it('refuses a variant attribute value on a non-variant-defining definition', async () => {
      await tx(async (c) => {
        await seed(c);
        const cat = (await c.query(
          `INSERT INTO core.category (id, code) VALUES (gen_random_uuid(), 'cat-x') RETURNING id`,
        )) as { rows: { id: string }[] };
        const def = (await c.query(
          `INSERT INTO core.attribute_definition
             (id, category_id, code, label_key, data_type, is_variant_defining)
           VALUES (gen_random_uuid(), $1, 'material', 'attr.material', 'TEXT', false)
           RETURNING id`,
          [cat.rows[0]?.id],
        )) as { rows: { id: string }[] };

        await expect(
          c.query(
            `INSERT INTO core.variant_attribute_value
               (variant_id, attribute_definition_id, value_text)
             VALUES ($1, $2, 'canvas')`,
            [V, def.rows[0]?.id],
          ),
        ).rejects.toThrow(/variant_value_definition_is_variant_defining/);
      });
    });

    /** §9.6: a post link resolves only within the seller who tagged it. */
    it('refuses a social-post link whose seller is not the product seller', async () => {
      await tx(async (c) => {
        await seed(c);
        const post = (await c.query(
          `INSERT INTO core.social_post (id, platform, canonical_post_id)
           VALUES (gen_random_uuid(), 'TIKTOK', 'abc123') RETURNING id`,
        )) as { rows: { id: string }[] };
        await expect(
          c.query(
            `INSERT INTO core.product_social_post (product_id, seller_id, social_post_id)
             VALUES ($1, $2, $3)`,
            [P, A, post.rows[0]?.id],
          ),
        ).rejects.toThrow(/product_social_post_product_seller/);
      });
    });

    it('permits one post link on many products by the same seller', async () => {
      await tx(async (c) => {
        await seed(c);
        const post = (await c.query(
          `INSERT INTO core.social_post (id, platform, canonical_post_id)
           VALUES (gen_random_uuid(), 'INSTAGRAM', 'xyz789') RETURNING id`,
        )) as { rows: { id: string }[] };
        const p2 = (await c.query(
          `INSERT INTO core.product (id, seller_id, market_id, name,
                                     base_price_minor, base_price_currency)
           VALUES (gen_random_uuid(), $1, $2, 'Second', 1000, 'ETB') RETURNING id`,
          [S, M],
        )) as { rows: { id: string }[] };
        for (const pid of [P, p2.rows[0]?.id]) {
          await expect(
            c.query(
              `INSERT INTO core.product_social_post (product_id, seller_id, social_post_id)
               VALUES ($1, $2, $3)`,
              [pid, S, post.rows[0]?.id],
            ),
          ).resolves.toBeDefined();
        }
      });
    });
  });

  // =========================================================================
  describe('v_stock_confidence is computed, never stored', () => {
    it('is a view, so it cannot drift when a job misses a run', async () => {
      const { rows } = await pool.query(
        `SELECT table_type FROM information_schema.tables
          WHERE table_schema='core' AND table_name='v_stock_confidence'`,
      );
      expect(rows[0]?.table_type).toBe('VIEW');
    });

    it('has no confidence column stored on the variant', async () => {
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='core' AND table_name='product_variant'
            AND column_name ~ 'confidence' AND column_name <> 'stock_confirmed_at'`,
      );
      expect(rows).toEqual([]);
    });

    it('bands a fresh confirmation at 1 and a stale one at 5', async () => {
      await tx(async (c) => {
        await seed(c);
        await c.query(
          `UPDATE core.product_variant SET stock_confirmed_at = now() WHERE id=$1`,
          [V],
        );
        let r = (await c.query(
          `SELECT confidence_level FROM core.v_stock_confidence WHERE variant_id=$1`,
          [V],
        )) as { rows: { confidence_level: number }[] };
        expect(r.rows[0]?.confidence_level).toBe(1);

        await c.query(
          `UPDATE core.product_variant SET stock_confirmed_at = now() - interval '30 days'
            WHERE id=$1`,
          [V],
        );
        r = (await c.query(
          `SELECT confidence_level FROM core.v_stock_confidence WHERE variant_id=$1`,
          [V],
        )) as { rows: { confidence_level: number }[] };
        expect(r.rows[0]?.confidence_level).toBe(5);
      });
    });
  });
});
