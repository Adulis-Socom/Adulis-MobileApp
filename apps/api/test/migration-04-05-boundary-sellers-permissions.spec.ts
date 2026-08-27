import { Pool, PoolClient } from 'pg';

/** A savepoint-guarded client. See the tx helper below. */
type Tx = { query: PoolClient['query'] };

/**
 * Migrations 04 and 05 — the verification boundary, sellers, availability, and
 * the permission catalogue.
 *
 * The boundary tests here are the ones that would pass vacuously if
 * `adulis_app` were a superuser, which is why migration 01's suite asserts it
 * is not before any of this runs.
 */

// The privileged credential, deliberately: these suites write fixtures into
// configuration tables and assert grants from the outside, neither of which
// adulis_app (the runtime DATABASE_URL from Tier 3) may do.
const CONNECTION_STRING = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const MARKET = '22222222-0000-4000-8000-000000000001';
const ACCOUNT = '22222222-0000-4000-8000-000000000002';
const SELLER = '22222222-0000-4000-8000-000000000003';
const PERSON = '22222222-0000-4000-8000-000000000004';

/** ADU-AUTH-01 v2.2 section 16.3 — canonical, and the seed is verified against it. */
const STEP_UP_CODES = [
  'seller.account:delete',
  'seller.identity:manage',
  'seller.orders:reissue_instructions',
  'seller.ownership:transfer',
  'seller.payout:update',
  'seller.sessions:revoke_all',
  'seller.staff:admin',
  'seller.subscription:update',
];

/**
 * ADU-AUTH-01 v2.3 section 16.2a - TWELVE, not the nine of section 6.9a's
 * "Companion Phase 1 grants".
 *
 * The previous revision of this suite had to decide for itself what the three
 * **M-squared** permissions carried, because no document said, and it chose
 * {CONSOLE}. v2.3 answers the question the other way: seller.reviews:read,
 * seller.analytics.basic:read and seller.notifications.preferences:write are
 * mobile-reachable. The earlier reading is discarded.
 */
const MOBILE_CODES = [
  'seller.analytics.basic:read',
  'seller.handoff:read',
  'seller.messages:read',
  'seller.messages:send',
  'seller.notifications.preferences:write',
  'seller.notifications:read',
  'seller.order_ready:update',
  'seller.orders:read',
  'seller.orders:respond',
  'seller.payment:confirm',
  'seller.payment_evidence:read',
  'seller.reviews:read',
];

describe('migrations 04-05 — boundary, sellers, permissions', () => {
  let pool: Pool;

  /**
   * Every query runs inside its own SAVEPOINT.
   *
   * WHY. These suites assert that constraints RAISE, and in PostgreSQL a raised
   * statement poisons the rest of its transaction - every following statement
   * returns "current transaction is aborted" instead of the error under test.
   * A savepoint per statement makes an expected failure local to that
   * statement, so a test can assert a rejection and then keep asserting.
   */
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

  const seedSeller = async (c: Tx) => {
    await c.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live)
       VALUES ($1,'ETX','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',false)`,
      [MARKET],
    );
    await c.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       VALUES ($1,'+251911000888',$2,'ACTIVE')`,
      [ACCOUNT, MARKET],
    );
    await c.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Meskel Fashion','meskel-test','ACTIVE')`,
      [SELLER, MARKET, ACCOUNT],
    );
  };

  beforeAll(() => {
    if (!CONNECTION_STRING) throw new Error('DATABASE_URL is not set.');
    pool = new Pool({ connectionString: CONNECTION_STRING, max: 4 });
  });
  afterAll(async () => {
    await pool.end();
  });

  // =========================================================================
  describe('the verification boundary (section 7.3, doctrine 7)', () => {
    /**
     * "Isolated boundaries are separate schemas with separate roles, and their
     * only read path is a SECURITY DEFINER function that writes the access log
     * in the same transaction. You cannot read the evidence without logging the
     * read, because there is no other way to read it."
     */
    it('denies adulis_app a direct read of either table', async () => {
      await tx(async (c) => {
        await c.query(`SET LOCAL ROLE adulis_app`);
        await expect(
          c.query(`SELECT 1 FROM verification.identity_attestation`),
        ).rejects.toThrow(/permission denied/);
      });
      await tx(async (c) => {
        await c.query(`SET LOCAL ROLE adulis_app`);
        await expect(c.query(`SELECT 1 FROM verification.access_log`)).rejects.toThrow(
          /permission denied/,
        );
      });
    });

    /**
     * D7. Appendix C check 10 through v1.8 forbade ANY grant on the schema,
     * including the USAGE without which PostgreSQL refuses the CALL itself —
     * so identity verification could not have worked at all. v1.9 restates the
     * invariant as USAGE on the schema, EXECUTE on the functions, and no
     * privilege on any table. This asserts all three halves.
     */
    it('grants USAGE and EXECUTE but no table privilege — the escorted visitor', async () => {
      const { rows } = await pool.query(
        `SELECT
           has_schema_privilege('adulis_app','verification','USAGE')            AS schema_usage,
           has_schema_privilege('adulis_app','verification','CREATE')           AS schema_create,
           has_function_privilege('adulis_app','verification.read_attestation(uuid,uuid,text)','EXECUTE') AS can_call,
           (SELECT count(*)::int FROM information_schema.table_privileges
             WHERE grantee='adulis_app' AND table_schema IN ('verification','financial')) AS table_privs`,
      );
      expect(rows[0]).toEqual({
        schema_usage: true,
        schema_create: false,
        can_call: true,
        table_privs: 0,
      });
    });

    /**
     * R5 — the fix that turned a logging function into an authorising one.
     * "With no grant lookup the function authorised nothing: it logged a read
     * it was going to perform anyway. Now no grant, no row, and the query that
     * logs is the query that authorises."
     */
    it('raises insufficient_privilege when the caller holds no operator grant', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        await c.query(`INSERT INTO core.person (id) VALUES ($1)`, [PERSON]);
        await c.query(`SET LOCAL ROLE adulis_app`);
        await expect(
          c.query(`SELECT verification.read_attestation($1,$2,'why')`, [PERSON, ACCOUNT]),
        ).rejects.toThrow(/no grant permits reading an identity attestation/);
      });
    });

    it('takes no role parameter — the audit identity cannot be supplied', async () => {
      const { rows } = await pool.query(
        `SELECT p.proname, pg_get_function_arguments(p.oid) AS args
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='verification' AND p.proname IN ('read_attestation','write_attestation')
          ORDER BY 1`,
      );
      expect(rows).toHaveLength(2);
      for (const r of rows) expect(r.args).not.toMatch(/actor_role/);
    });

    it('reads, and logs the read with a DERIVED role, in one transaction', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        await c.query(`INSERT INTO core.person (id) VALUES ($1)`, [PERSON]);
        await c.query(
          `INSERT INTO core.operator_grant (id, account_id, role, reason)
           VALUES (gen_random_uuid(), $1, 'IDENTITY_REVIEWER', 'founder')`,
          [ACCOUNT],
        );

        await c.query(`SET LOCAL ROLE adulis_app`);
        await c.query(
          `SELECT verification.write_attestation($1,'KYC_VENDOR','VND-1','NATIONAL_ID',
                                                 'Alemu Bekele', decode('c0ffee','hex'), 1, DATE '2026-08-01')`,
          [PERSON],
        );
        const read = await c.query(
          `SELECT (verification.read_attestation($1,$2,'recovery review')).legal_name AS n`,
          [PERSON, ACCOUNT],
        );
        expect(read.rows[0].n).toBe('Alemu Bekele');

        await c.query(`RESET ROLE`);
        const log = await c.query(
          `SELECT actor_role, reason FROM verification.access_log WHERE actor_account_id=$1`,
          [ACCOUNT],
        );
        expect(log.rows).toEqual([{ actor_role: 'IDENTITY_REVIEWER', reason: 'recovery review' }]);
      });
    });

    /** D4 — the write path v1.8 asserted was defined and never was. */
    it('upserts on person_id rather than creating a second attestation', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        await c.query(`INSERT INTO core.person (id) VALUES ($1)`, [PERSON]);
        await c.query(`SET LOCAL ROLE adulis_app`);
        const write = (name: string) =>
          c.query(
            `SELECT verification.write_attestation($1,'KYC_VENDOR','VND','NATIONAL_ID',$2,
                                                   decode('01','hex'),1,DATE '2026-08-01') AS id`,
            [PERSON, name],
          );
        const first = await write('Alemu Bekele');
        const second = await write('Alemu Bekele Tesfaye');
        expect(second.rows[0].id).toBe(first.rows[0].id);

        await c.query(`RESET ROLE`);
        const { rows } = await c.query(
          `SELECT count(*)::int AS n, max(legal_name) AS name
             FROM verification.identity_attestation WHERE person_id=$1`,
          [PERSON],
        );
        expect(rows[0]).toEqual({ n: 1, name: 'Alemu Bekele Tesfaye' });
      });
    });

    /** "the write is not logged: that log records READS." */
    it('does not write an access-log row for a write', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        await c.query(`INSERT INTO core.person (id) VALUES ($1)`, [PERSON]);
        await c.query(`SET LOCAL ROLE adulis_app`);
        await c.query(
          `SELECT verification.write_attestation($1,'KYC_VENDOR','V','ID','N',
                                                 decode('02','hex'),1,DATE '2026-08-01')`,
          [PERSON],
        );
        await c.query(`RESET ROLE`);
        const { rows } = await c.query(`SELECT count(*)::int AS n FROM verification.access_log`);
        expect(rows[0].n).toBe(0);
      });
    });

    it('answers duplicate detection with a count and no identity data', async () => {
      const { rows } = await pool.query(
        `SELECT pg_get_function_result(p.oid) AS result
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='verification' AND p.proname='id_hash_matches'`,
      );
      expect(rows[0]?.result).toBe('integer');
    });

    /**
     * INVARIANT — no identity image or video is ever uploaded. "There is no
     * column for one. Not a nullable column, not an image_url left empty."
     */
    it('has no column on the attestation that could hold a document', async () => {
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='verification' AND table_name='identity_attestation'
            AND (column_name ~ '(image|photo|video|document|file|scan|url|object_key)')`,
      );
      expect(rows).toEqual([]);
    });

    /** The attestation is about a person, not a seller (section 4.3). */
    it('is keyed on person_id and carries no seller_id', async () => {
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='verification' AND table_name='identity_attestation'
            AND column_name='seller_id'`,
      );
      expect(rows).toEqual([]);
    });

    /**
     * SECURITY DEFINER runs as the function's OWNER. These migrations are
     * applied by a bootstrap superuser, so an unowned function would run as a
     * superuser and the boundary would be decorative while every test above
     * still passed.
     */
    it('owns the boundary functions by adulis_verification, not by the migrator', async () => {
      const { rows } = await pool.query(
        `SELECT p.proname, pg_get_userbyid(p.proowner) AS owner, p.prosecdef
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='verification' ORDER BY 1`,
      );
      expect(rows.length).toBeGreaterThanOrEqual(3);
      for (const r of rows) {
        expect(r.owner).toBe('adulis_verification');
        expect(r.prosecdef).toBe(true);
      }
    });

    it('is not a superuser itself, or the boundary would be decorative', async () => {
      const { rows } = await pool.query(
        `SELECT rolsuper FROM pg_roles WHERE rolname='adulis_verification'`,
      );
      expect(rows[0]?.rolsuper).toBe(false);
    });
  });

  // =========================================================================
  describe('sellers and the team (sections 7.1, 6.9)', () => {
    /**
     * AMENDMENT A1.3 - THE OWNER RULING. Through v1.9 the Owner could be read
     * from core.seller.owner_account_id OR from a seller_team_member row with
     * role = 'OWNER', and nothing said which governed. A1.3: "the Owner is
     * core.seller.owner_account_id, and only that."
     *
     * This is why "exactly one Owner" is now free rather than enforced by a
     * partial unique index: it is a single NOT NULL column. The index this
     * replaced could only detect a second Owner AFTER one was written.
     */
    it('refuses an OWNER row in seller_team_member outright', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        const { rows } = await c.query(
          `INSERT INTO core.account (id, phone_e164, market_id, status)
           VALUES (gen_random_uuid(), '+251911000901', $1, 'ACTIVE') RETURNING id`,
          [MARKET],
        );
        await expect(
          c.query(
            `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
             VALUES (gen_random_uuid(), $1, $2, 'OWNER')`,
            [SELLER, rows[0].id],
          ),
        ).rejects.toThrow(/team_member_is_never_owner/);
      });
    });

    it('keeps the Owner where the composite-FK anchors already needed it', async () => {
      const { rows } = await pool.query(
        `SELECT a.attnotnull AS not_null
           FROM pg_attribute a
          WHERE a.attrelid = 'core.seller'::regclass AND a.attname = 'owner_account_id'`,
      );
      expect(rows[0]?.not_null).toBe(true);
    });

    it('permits several ADMINs, which is the point of the partial index', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        for (const phone of ['+251911000903', '+251911000904']) {
          const { rows } = await c.query(
            `INSERT INTO core.account (id, phone_e164, market_id, status)
             VALUES (gen_random_uuid(), $1, $2, 'ACTIVE') RETURNING id`,
            [phone, MARKET],
          );
          await c.query(
            `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
             VALUES (gen_random_uuid(), $1, $2, 'ADMIN')`,
            [SELLER, rows[0].id],
          );
        }
        const { rows } = await c.query(
          `SELECT count(*)::int AS n FROM core.seller_team_member WHERE seller_id=$1`,
          [SELLER],
        );
        expect(rows[0].n).toBe(2);
      });
    });

    it('refuses company details on an INDIVIDUAL seller (composite FK)', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        await expect(
          c.query(
            `INSERT INTO core.seller_company_detail (seller_id, tin) VALUES ($1, '000')`,
            [SELLER],
          ),
        ).rejects.toThrow(/company_detail_seller_entity/);
      });
    });

    it('carries the composite unique keys later migrations anchor on', async () => {
      const { rows } = await pool.query(
        `SELECT conname FROM pg_constraint
          WHERE conrelid='core.seller'::regclass AND contype='u' ORDER BY 1`,
      );
      expect(rows.map((r) => r.conname)).toEqual(
        expect.arrayContaining(['seller_id_market', 'seller_id_owner', 'seller_id_entity_type']),
      );
    });
  });

  // =========================================================================
  describe('availability (sections 13.1, 13.1a, 13.1b — R27, D5)', () => {
    it('refuses a window shorter than one hour', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        await expect(
          c.query(
            `INSERT INTO core.seller_availability (id, seller_id, weekday, opens_at, closes_at)
             VALUES (gen_random_uuid(), $1, 1, '09:00', '09:30')`,
            [SELLER],
          ),
        ).rejects.toThrow(/availability_window_minimum/);
      });
    });

    /**
     * INVARIANT — the PRESENCE of a row means closed. "A boolean here would
     * admit a row whose value is false, which is a row that means nothing."
     */
    it('has no is_closed column on the override table', async () => {
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='core' AND table_name='seller_availability_override'
          ORDER BY 1`,
      );
      expect(rows.map((r) => r.column_name)).toEqual([
        'created_at',
        'note',
        'override_date',
        'seller_id',
      ]);
    });

    it('caps the override note at 120 characters, because it renders on a card', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        await expect(
          c.query(
            `INSERT INTO core.seller_availability_override (seller_id, override_date, note)
             VALUES ($1, DATE '2026-09-27', repeat('x', 121))`,
            [SELLER],
          ),
        ).rejects.toThrow(/override_note_length/);
      });
    });

    /**
     * D5, AND THE DEFECT THE FUNCTION EXISTS TO PREVENT.
     *
     * "Comparing it against a UTC timestamp puts the rollover at 03:00 EAT, so
     * a store marked closed for Meskel would show open for the first three
     * hours of it and closed for the first three hours of the following day.
     * This is the single most likely defect in the feature."
     *
     * Addis Ababa is UTC+3, so the local day 2026-09-27 runs from 21:00 UTC on
     * the 26th to 21:00 UTC on the 27th. Both boundary cases are asserted.
     */
    it('resolves the override date in the market timezone, not in UTC', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        await c.query(
          `INSERT INTO core.seller_availability (id, seller_id, weekday, opens_at, closes_at)
           SELECT gen_random_uuid(), $1, d, '09:00', '18:00' FROM generate_series(1,6) d`,
          [SELLER],
        );
        await c.query(
          `INSERT INTO core.seller_availability_override (seller_id, override_date, note)
           VALUES ($1, DATE '2026-09-27', 'Closed for Meskel')`,
          [SELLER],
        );

        const at = async (iso: string) => {
          const { rows } = await c.query(
            `SELECT * FROM core.fn_seller_availability_state($1, $2::timestamptz)`,
            [SELLER, iso],
          );
          return rows[0];
        };

        // 00:30 local on Meskel. A UTC comparison would still read 26 September.
        expect(await at('2026-09-26T21:30:00Z')).toEqual({
          is_open: false,
          reason: 'OVERRIDE_CLOSED',
          note: 'Closed for Meskel',
        });
        // 10:00 local on Meskel — inside the weekly window, and still closed.
        expect(await at('2026-09-27T07:00:00Z')).toMatchObject({
          is_open: false,
          reason: 'OVERRIDE_CLOSED',
        });
        // 00:30 local the following day. The override must have stopped applying.
        expect(await at('2026-09-27T21:30:00Z')).toMatchObject({ reason: 'WEEKLY_PATTERN' });
      });
    });

    it('falls back to the weekly pattern, and treats zero windows as closed', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        await c.query(
          `INSERT INTO core.seller_availability (id, seller_id, weekday, opens_at, closes_at)
           SELECT gen_random_uuid(), $1, d, '09:00', '18:00' FROM generate_series(1,6) d`,
          [SELLER],
        );
        const at = async (iso: string) => {
          const { rows } = await c.query(
            `SELECT * FROM core.fn_seller_availability_state($1, $2::timestamptz)`,
            [SELLER, iso],
          );
          return rows[0];
        };
        // Monday 10:00 local — open.
        expect(await at('2026-09-28T07:00:00Z')).toMatchObject({ is_open: true });
        // Monday 23:00 local — outside the window.
        expect(await at('2026-09-28T20:00:00Z')).toMatchObject({ is_open: false });
        // Sunday — no weekday-7 row at all. "Zero windows is valid and means closed."
        expect(await at('2026-10-04T07:00:00Z')).toMatchObject({
          is_open: false,
          reason: 'WEEKLY_PATTERN',
        });
      });
    });
  });

  // =========================================================================
  describe('fulfilment and operators (sections 13.0, 6.11 — R13, F6)', () => {
    /** "No fee column exists, deliberately." PRD section 25 leaves it open. */
    it('has no fee column on the fulfilment method', async () => {
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='core' AND table_name='seller_fulfilment_method'
            AND (column_name ~ '(fee|price|amount|cost|minor)')`,
      );
      expect(rows).toEqual([]);
    });

    it('records an operator grant as a relationship, never an account type', async () => {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM information_schema.tables
          WHERE table_schema='core' AND table_name IN ('operator','operator_account')`,
      );
      expect(rows[0].n).toBe(0);
    });

    it('revokes an operator grant without deleting the row', async () => {
      await tx(async (c) => {
        await seedSeller(c);
        await c.query(
          `INSERT INTO core.operator_grant (id, account_id, role, reason)
           VALUES ('22222222-0000-4000-8000-0000000000e1', $1, 'ADMIN', 'founder')`,
          [ACCOUNT],
        );
        await expect(c.query(`DELETE FROM core.operator_grant`)).rejects.toThrow(
          /append-only; DELETE is not permitted/,
        );
        await expect(
          c.query(`UPDATE core.operator_grant SET revoked_at = now()`),
        ).rejects.toThrow(/append-only; UPDATE is not permitted/);
      });
    });
  });

  // =========================================================================
  describe('the permission catalogue (section 6.9a, ADU-AUTH-01 v2.2 s15.1/16.3)', () => {
    it('holds exactly the 42 codes of section 15.1', async () => {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM core.permission`);
      expect(rows[0].n).toBe(42);
    });

    /**
     * Both directions, which is what v1.8's Appendix C query lacked in
     * principle as well as in syntax. "A one-directional EXCEPT catches a
     * permission that should not require step-up; it says nothing about one
     * that should and does not — and that is the direction D1 failed in."
     */
    it('marks exactly the eight step-up codes of section 16.3, both directions', async () => {
      const { rows } = await pool.query(
        `SELECT code FROM core.permission WHERE requires_step_up ORDER BY code`,
      );
      expect(rows.map((r) => r.code)).toEqual(STEP_UP_CODES);
    });

    it('gives every step-up permission surfaces = {CONSOLE}, with none reachable from mobile', async () => {
      const { rows } = await pool.query(
        `SELECT code, surfaces FROM core.permission
          WHERE requires_step_up AND 'MOBILE' = ANY(surfaces)`,
      );
      expect(rows).toEqual([]);
    });

    it('gives mobile reach to exactly the twelve codes of section 16.2a', async () => {
      const { rows } = await pool.query(
        `SELECT code FROM core.permission WHERE 'MOBILE' = ANY(surfaces) ORDER BY code`,
      );
      expect(rows.map((r) => r.code)).toEqual(MOBILE_CODES);
    });

    it('never leaves a permission with an empty surface array', async () => {
      const { rows } = await pool.query(
        `SELECT code FROM core.permission WHERE cardinality(surfaces) = 0`,
      );
      expect(rows).toEqual([]);
    });

    /**
     * D1, AND THE WHOLE POINT OF v1.9's REWRITE. v1.8 enumerated six codes
     * inside the CHECK, so a code absent from the list was UNCONSTRAINED. The
     * replacement quantifies over every row, present and future — a permission
     * added in 2027 is covered by a constraint written today.
     *
     * The first case is the one v1.8 could not have caught at all: a code that
     * appears in no list anywhere.
     */
    it('refuses a NEW step-up permission seeded as mobile-reachable', async () => {
      await tx(async (c) => {
        await expect(
          c.query(
            `INSERT INTO core.permission (code, surfaces, requires_step_up)
             VALUES ('seller.future:capability',
                     ARRAY['MOBILE','CONSOLE']::core.session_audience[], true)`,
          ),
        ).rejects.toThrow(/step_up_is_console_only/);
      });
    });

    it.each([
      'seller.ownership:transfer',
      'seller.identity:manage',
      'seller.orders:reissue_instructions',
    ])('refuses widening %s to mobile — the three v1.8 left unconstrained', async (code) => {
      await tx(async (c) => {
        await expect(
          c.query(
            `UPDATE core.permission
                SET surfaces = ARRAY['MOBILE','CONSOLE']::core.session_audience[]
              WHERE code = $1`,
            [code],
          ),
        ).rejects.toThrow(/step_up_is_console_only/);
      });
    });

    it('refuses marking an existing mobile permission as requiring step-up', async () => {
      await tx(async (c) => {
        await expect(
          c.query(
            `UPDATE core.permission SET requires_step_up = true WHERE code='seller.orders:read'`,
          ),
        ).rejects.toThrow(/step_up_is_console_only/);
      });
    });

    it('refuses a role_permission row for a code that does not exist', async () => {
      await tx(async (c) => {
        await expect(
          c.query(
            `INSERT INTO core.role_permission (role, permission_code)
             VALUES ('OWNER', 'seller.instructions:reissue')`,
          ),
        ).rejects.toThrow(/foreign key/i);
      });
    });

    it('denies the application role any write to the catalogue', async () => {
      const { rows } = await pool.query(
        `SELECT
           has_table_privilege('adulis_app','core.permission','SELECT') AS read_perm,
           has_table_privilege('adulis_app','core.permission','INSERT') AS write_perm,
           has_table_privilege('adulis_app','core.role_permission','INSERT') AS write_grants,
           has_table_privilege('adulis_app','core.role_permission','UPDATE') AS update_grants`,
      );
      expect(rows[0]).toEqual({
        read_perm: true,
        write_perm: false,
        write_grants: false,
        update_grants: false,
      });
    });

    /**
     * SEEDED IN FULL from ADU-AUTH-01 v2.3 section 16.2a. The previous revision
     * of this suite asserted this table was EMPTY, because v2.2's matrix
     * arrived with all 252 cells collapsed to one character and a guess would
     * have satisfied every checksum in section 6.9a while still being wrong.
     *
     * The 252 cells themselves are reproduced through fn_has_permission in
     * permission-matrix.spec.ts, against the authority .sql file rather than
     * against this database.
     */
    it('holds the 139 grants of section 16.2, across all six roles', async () => {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n, count(DISTINCT role)::int AS roles
           FROM core.role_permission`,
      );
      expect(rows[0]).toEqual({ n: 139, roles: 6 });
    });
  });
});
