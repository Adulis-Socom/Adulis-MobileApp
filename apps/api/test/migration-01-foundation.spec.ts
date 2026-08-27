import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

/**
 * ONE fixture, shared with Appendix C check 16. The transcription of Appendix A
 * lives at db/checks/fixtures/appendix-a.json and is read by both the check
 * harness and this suite, because two copies of the catalogue is precisely the
 * defect D6 was reaching for and D1 actually was.
 */
const catalogue = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../db/checks/fixtures/appendix-a.json'), 'utf8'),
) as { types: Record<string, string[]> };

/**
 * Migration 01 — foundation. Integration tests against REAL PostgreSQL.
 *
 * ADU-CON-02 v3.0 section 16 requires integration tests against a Postgres
 * service container because "constraints, triggers, RLS and EXCLUDE cannot be
 * mocked". Roles and grants cannot either: a mocked repository would report a
 * boundary that does not exist.
 *
 * THE FIXTURE IS THE SPECIFICATION, NOT THE SCHEMA. `enum-catalogue.json` is
 * transcribed from ADU-DB-01 v1.8 Appendix A, so the assertions compare the live
 * database against the document. Work order T1 section 6 makes the same point
 * about the permission seed: "a test that reads the thing it is testing proves
 * nothing." The load-bearing types are additionally typed out by hand below, so
 * that a defect in the transcription would have to survive being written twice.
 */

// The privileged credential, deliberately: these suites write fixtures into
// configuration tables and assert grants from the outside, neither of which
// adulis_app (the runtime DATABASE_URL from Tier 3) may do.
const CONNECTION_STRING = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const ROLES = [
  'adulis_app',
  'adulis_verification',
  'adulis_financial',
  'adulis_jobs',
  'adulis_migrate',
  'adulis_readonly',
];

const SCHEMAS = [
  'core',
  'verification',
  'financial',
  'chat',
  'nlu',
  'billing',
  'ledger',
  'analytics',
  'jobs',
  'waitlist',
];

describe('migration 01 — foundation', () => {
  let pool: Pool;
  const q = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    (await pool.query(text, params)).rows as T[];

  beforeAll(() => {
    if (!CONNECTION_STRING) {
      throw new Error(
        'DATABASE_URL is not set. Roles, grants and enum types cannot be tested without PostgreSQL.\n' +
          'Run:  docker compose up -d  &&  cp .env.example .env  &&  pnpm db:migrate',
      );
    }
    pool = new Pool({ connectionString: CONNECTION_STRING, max: 2 });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('extensions (section 3.1)', () => {
    it('has all four, without which two specified mechanisms have no implementation', async () => {
      const rows = await q<{ extname: string }>(
        `SELECT extname FROM pg_extension WHERE extname = ANY($1::text[]) ORDER BY 1`,
        [['btree_gist', 'pg_trgm', 'pgcrypto', 'vector']],
      );
      expect(rows.map((r) => r.extname)).toEqual(['btree_gist', 'pg_trgm', 'pgcrypto', 'vector']);
    });
  });

  describe('roles (section 3)', () => {
    it('creates all six', async () => {
      const rows = await q<{ rolname: string }>(
        `SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[]) ORDER BY 1`,
        [ROLES],
      );
      expect(rows.map((r) => r.rolname).sort()).toEqual([...ROLES].sort());
    });

    /**
     * The one that makes every other boundary test in this repository mean
     * something. A superuser bypasses all privilege checks, so if adulis_app
     * were one, `verification` would be directly readable and the tests below
     * would pass while proving nothing.
     */
    it('adulis_app is NOT a superuser', async () => {
      const [row] = await q<{ rolsuper: boolean }>(
        `SELECT rolsuper FROM pg_roles WHERE rolname = 'adulis_app'`,
      );
      expect(row?.rolsuper).toBe(false);
    });

    it('adulis_app cannot create roles or databases either', async () => {
      const [row] = await q<{ rolcreaterole: boolean; rolcreatedb: boolean }>(
        `SELECT rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = 'adulis_app'`,
      );
      expect(row?.rolcreaterole).toBe(false);
      expect(row?.rolcreatedb).toBe(false);
    });
  });

  describe('schemas (section 3)', () => {
    it('creates all ten', async () => {
      const rows = await q<{ nspname: string }>(
        `SELECT nspname FROM pg_namespace WHERE nspname = ANY($1::text[]) ORDER BY 1`,
        [SCHEMAS],
      );
      expect(rows.map((r) => r.nspname).sort()).toEqual([...SCHEMAS].sort());
    });

    it('owns verification and financial by their own roles, so SECURITY DEFINER runs as them', async () => {
      const rows = await q<{ nspname: string; owner: string }>(
        `SELECT nspname, pg_get_userbyid(nspowner) AS owner
           FROM pg_namespace WHERE nspname IN ('verification','financial') ORDER BY 1`,
      );
      expect(rows).toEqual([
        { nspname: 'financial', owner: 'adulis_financial' },
        { nspname: 'verification', owner: 'adulis_verification' },
      ]);
    });

    /**
     * Appendix C check 10. USAGE is granted in migration 4 because PostgreSQL
     * requires it before any role may CALL a function in a schema; it conveys no
     * data access. What must never appear is a privilege on a TABLE.
     */
    it('grants adulis_app no table privilege inside either boundary schema', async () => {
      const rows = await q(
        `SELECT n.nspname, c.relname, p.priv
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           CROSS JOIN LATERAL (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) AS p(priv)
          WHERE n.nspname IN ('verification','financial')
            AND c.relkind IN ('r','v','m','p')
            AND has_table_privilege('adulis_app', c.oid, p.priv)`,
      );
      expect(rows).toEqual([]);
    });
  });

  describe('domains (section 4)', () => {
    it('e164 accepts a valid Ethiopian number and rejects a malformed one', async () => {
      const [good] = await q<{ v: string }>(`SELECT '+251911284763'::core.e164 AS v`);
      expect(good?.v).toBe('+251911284763');
      await expect(pool.query(`SELECT '0911284763'::core.e164`)).rejects.toThrow();
      await expect(pool.query(`SELECT '+0911284763'::core.e164`)).rejects.toThrow();
    });

    it('currency_code rejects anything that is not three upper-case letters', async () => {
      const [good] = await q<{ v: string }>(`SELECT 'ETB'::core.currency_code AS v`);
      expect(good?.v).toBe('ETB');
      await expect(pool.query(`SELECT 'etb'::core.currency_code`)).rejects.toThrow();
      await expect(pool.query(`SELECT 'ET'::core.currency_code`)).rejects.toThrow();
    });

    it('locale_code admits exactly en and am', async () => {
      await expect(pool.query(`SELECT 'en'::core.locale_code`)).resolves.toBeDefined();
      await expect(pool.query(`SELECT 'am'::core.locale_code`)).resolves.toBeDefined();
      await expect(pool.query(`SELECT 'fr'::core.locale_code`)).rejects.toThrow();
    });
  });

  describe('enum catalogue (Appendix A)', () => {
    const expected = catalogue.types;

    it('creates every type in Appendix A and no others', async () => {
      const rows = await q<{ name: string }>(
        `SELECT n.nspname || '.' || t.typname AS name
           FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typtype = 'e' ORDER BY 1`,
      );
      expect(rows.map((r) => r.name).sort()).toEqual(Object.keys(expected).sort());
    });

    it('gives every type exactly Appendix A values, in order', async () => {
      const rows = await q<{ name: string; values: string[] }>(
        `SELECT n.nspname || '.' || t.typname AS name,
                array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS values
           FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
           JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typtype = 'e' GROUP BY 1`,
      );
      const actual = Object.fromEntries(rows.map((r) => [r.name, r.values]));
      for (const [name, values] of Object.entries(expected)) {
        expect({ [name]: actual[name] }).toEqual({ [name]: values });
      }
    });

    /**
     * The load-bearing types, typed by hand from the document so that a defect
     * in the generated fixture would have to survive being written twice.
     */
    const byHand: Record<string, string[]> = {
      // R2 — two audiences, not three. SELLER_WEB renamed, COURIER_WEB removed.
      'core.session_audience': ['MOBILE', 'CONSOLE'],
      // C2 — two state machines. REFUNDED exists only at reservation level.
      'core.order_state': [
        'CREATED', 'NOTIFIED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', 'HANDED_OFF',
        'COMPLETED', 'CANCELLED_BY_BUYER', 'CANCELLED_BY_SELLER', 'EXPIRED_UNCLAIMED',
      ],
      'core.reservation_state': [
        'ACTIVE', 'FULFILLED', 'CANCELLED_BY_BUYER', 'CANCELLED_BY_SELLER', 'REFUNDED', 'EXPIRED',
      ],
      // Section 16 seeds a grant for each of these six.
      'core.team_role': [
        'OWNER', 'ADMIN', 'SALES_SUPPORT', 'INVENTORY', 'ANALYST', 'CAMPAIGN_MANAGER',
      ],
      // F6 — the operator model. Names reconciled in AUTH-01 v2.1 section 20.1.
      'core.operator_role': [
        'SUPPORT', 'MODERATOR', 'CLAIM_REVIEWER', 'IDENTITY_REVIEWER', 'ADMIN',
      ],
      // R13 — at least one active method required before publication.
      'core.fulfilment_method': ['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY'],
      // Level is never set manually and never purchasable.
      'core.trust_level': ['NEW', 'ESTABLISHED', 'TRUSTED'],
    };

    it.each(Object.entries(byHand))('%s has exactly its documented values', async (name, values) => {
      const [schema, typname] = name.split('.');
      const rows = await q<{ v: string[] }>(
        `SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS v
           FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
           JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE n.nspname = $1 AND t.typname = $2`,
        [schema, typname],
      );
      expect(rows[0]?.v).toEqual(values);
    });

    it('has no SELLER_WEB or COURIER_WEB anywhere — R2 is a rename, not an addition', async () => {
      const rows = await q(
        `SELECT 1 FROM pg_enum WHERE enumlabel IN ('SELLER_WEB','COURIER_WEB')`,
      );
      expect(rows).toEqual([]);
    });
  });

  describe('shared trigger functions (section 4)', () => {
    it('defines core.fn_forbid_mutation, the append-only mechanism', async () => {
      const rows = await q(
        `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'core' AND p.proname = 'fn_forbid_mutation'`,
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe('R16 — the forbidden shape', () => {
    it('has no materialized view in any Adulis schema', async () => {
      const rows = await q(
        `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'm' AND n.nspname = ANY($1::text[])`,
        [SCHEMAS],
      );
      expect(rows).toEqual([]);
    });
  });
});
