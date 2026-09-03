import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool, PoolClient } from 'pg';

/**
 * ADU-AUTH-01 v2.4 §16.2 — the whole role matrix, reproduced through
 * core.fn_has_permission, in both directions.
 *
 * ---------------------------------------------------------------------------
 * WHERE THE EXPECTATION COMES FROM, AND WHY IT MATTERS
 *
 * §24: "The fixture is derived from §16.2a's SQL, not retyped from §16.2's
 * table. A test that reads the same table a human transcribed proves only that
 * both made the same mistake."
 *
 * So this suite parses `docs/amendments/ADU-AUTH-01_v2_4_permission_seed.sql` —
 * the authority copy of the generated seed — and compares the LIVE DATABASE
 * against it. The migration carries its own copy of the same SQL, so what this
 * actually catches is a bad copy-paste into the migration: a defect that would
 * otherwise pass every checksum in §6.9a, because a wrong-but-consistent seed
 * agrees with itself.
 *
 * It never reads core.permission to decide what core.permission should hold.
 *
 * ---------------------------------------------------------------------------
 * WHY THE MATRIX IS EXERCISED THROUGH THE FUNCTION RATHER THAN QUERIED
 *
 * §24 again: "All 139 grants assert true, and every one of the 113 non-grants
 * asserts false. A matrix test that checks only positives passes on a seed that
 * grants everything to everyone."
 *
 * Comparing two tables would prove the seed loaded. Driving fn_has_permission
 * proves the thing the product depends on: that the function resolves a role,
 * applies the grant, applies the surface, and refuses everything else.
 */

// The privileged credential, deliberately: these suites write fixtures into
// configuration tables and assert grants from the outside, neither of which
// adulis_app (the runtime DATABASE_URL from Tier 3) may do.
const CONNECTION_STRING = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const SEED_SQL = path.resolve(
  __dirname,
  '../../../docs/amendments/ADU-AUTH-01_v2_4_permission_seed.sql',
);

const ROLES = [
  'OWNER',
  'ADMIN',
  'SALES_SUPPORT',
  'INVENTORY',
  'ANALYST',
  'CAMPAIGN_MANAGER',
] as const;
type Role = (typeof ROLES)[number];

/** ADU-AUTH-01 v2.4 §16.2, "Per-role totals, as a checksum against the seed". */
const PER_ROLE_TOTAL: Record<Role, number> = {
  OWNER: 42,
  ADMIN: 40,
  SALES_SUPPORT: 19,
  INVENTORY: 16,
  ANALYST: 10,
  CAMPAIGN_MANAGER: 12,
};

/** §16.3 — canonical, and the seed is verified against it rather than the reverse. */
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

// --- parse the authority seed ------------------------------------------------
type Perm = { code: string; surfaces: string[]; requiresStepUp: boolean };

/** Split on a marker that must appear exactly once, or say why not. */
function blockAfter(sql: string, marker: string): string {
  const parts = sql.split(marker);
  if (parts.length !== 2) {
    throw new Error(
      `${SEED_SQL} does not contain exactly one "${marker}" ` +
        `(found ${parts.length - 1}). The authority seed is not the shape this suite expects.`,
    );
  }
  const block = parts[1]?.split(';')[0];
  if (!block) throw new Error(`no statement body after "${marker}" in ${SEED_SQL}`);
  return block;
}

function parseSeed(): { permissions: Perm[]; grants: Set<string> } {
  const sql = readFileSync(SEED_SQL, 'utf8');
  const permBlock = blockAfter(sql, 'INSERT INTO core.permission');
  const grantBlock = blockAfter(sql, 'INSERT INTO core.role_permission');

  const permissions: Perm[] = [];
  const permRe =
    /\('([^']+)',\s*ARRAY\[([^\]]*)\]::core\.session_audience\[\],\s*(true|false)\)/g;
  for (let m = permRe.exec(permBlock); m !== null; m = permRe.exec(permBlock)) {
    const [, code, arr, step] = m;
    if (code === undefined || arr === undefined || step === undefined) continue;
    permissions.push({
      code,
      surfaces: arr.split(',').map((x) => x.trim().replace(/'/g, '')),
      requiresStepUp: step === 'true',
    });
  }

  const grants = new Set<string>();
  const grantRe = /\('([A-Z_]+)',\s*'([^']+)'\)/g;
  for (let m = grantRe.exec(grantBlock); m !== null; m = grantRe.exec(grantBlock)) {
    const [, gRole, gCode] = m;
    if (gRole === undefined || gCode === undefined) continue;
    grants.add(gRole + " " + gCode);
  }
  if (permissions.length === 0 || grants.size === 0) {
    throw new Error('parsed nothing from ' + SEED_SQL + '; the seed format has changed');
  }
  return { permissions, grants };
}

const SEED = parseSeed();

const MARKET = '77777777-0000-4000-8000-000000000001';
const SELLER = '77777777-0000-4000-8000-000000000f01';
const acct = (n: number) => `77777777-0000-4000-8000-00000000010${n}`;
/** Account 7 holds no relationship with the seller at all. */
const STRANGER = acct(7);
const ACCOUNT_FOR: Record<Role, string> = {
  OWNER: acct(1),
  ADMIN: acct(2),
  SALES_SUPPORT: acct(3),
  INVENTORY: acct(4),
  ANALYST: acct(5),
  CAMPAIGN_MANAGER: acct(6),
};

describe('ADU-AUTH-01 v2.4 §16.2 — the role matrix', () => {
  let pool: Pool;
  let client: PoolClient;

  beforeAll(async () => {
    if (!CONNECTION_STRING) throw new Error('DATABASE_URL is not set.');
    pool = new Pool({ connectionString: CONNECTION_STRING, max: 2 });
    client = await pool.connect();
    await client.query('BEGIN');

    // One seller, one Owner on core.seller, five team members, one stranger.
    await client.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'MTX','Matrix','PHASE_1','ETB','Africa/Addis_Ababa','en',false, 'ACTIVE', true, 'AFROMESSAGE')`,
      [MARKET],
    );
    for (let n = 1; n <= 7; n += 1) {
      await client.query(
        `INSERT INTO core.account (id, phone_e164, market_id, status)
         VALUES ($1, $2, $3, 'ACTIVE')`,
        [acct(n), `+25191100200${n}`, MARKET],
      );
    }
    await client.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Matrix Store','matrix-store','ACTIVE')`,
      [SELLER, MARKET, ACCOUNT_FOR.OWNER],
    );
    for (const role of ROLES) {
      if (role === 'OWNER') continue; // A1.3 — the Owner is never a team member
      await client.query(
        `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [SELLER, ACCOUNT_FOR[role], role],
      );
    }
  });

  afterAll(async () => {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  });

  /**
   * Call the function and report what happened. Savepointed, because a raise
   * would otherwise poison the fixture transaction for every later cell.
   */
  const probe = async (
    account: string,
    code: string,
    audience: 'CONSOLE' | 'MOBILE',
  ): Promise<{ allowed: boolean; sqlstate: string | undefined }> => {
    await client.query('SAVEPOINT p');
    try {
      await client.query(`SELECT core.fn_has_permission($1, $2, $3, $4::core.session_audience)`, [
        account,
        SELLER,
        code,
        audience,
      ]);
      await client.query('RELEASE SAVEPOINT p');
      return { allowed: true, sqlstate: undefined };
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT p');
      return { allowed: false, sqlstate: (e as { code?: string }).code };
    }
  };

  const isGranted = (role: Role, code: string) => SEED.grants.has(`${role} ${code}`);

  // ==========================================================================
  describe('the seed matches the authority .sql', () => {
    it('parsed 42 permissions and 139 grants from the document', () => {
      expect(SEED.permissions).toHaveLength(42);
      expect(SEED.grants.size).toBe(139);
    });

    it('core.permission is exactly what the document says, row for row', async () => {
      const { rows } = await client.query(
        `SELECT code, surfaces::text[] AS surfaces, requires_step_up
           FROM core.permission ORDER BY code`,
      );
      // Keyed by code, never compared as two ORDERED lists: PostgreSQL and
      // JavaScript sort '.' against ':' differently, so an ordered comparison
      // would be testing collation rather than data.
      const actual = Object.fromEntries(
        rows.map((r) => [r.code, { surfaces: r.surfaces, requiresStepUp: r.requires_step_up }]),
      );
      const expected = Object.fromEntries(
        SEED.permissions.map((p) => [p.code, { surfaces: p.surfaces, requiresStepUp: p.requiresStepUp }]),
      );
      expect(actual).toEqual(expected);
    });

    it('core.role_permission is exactly what the document says, grant for grant', async () => {
      const { rows } = await client.query(
        `SELECT role::text AS role, permission_code FROM core.role_permission`,
      );
      const actual = new Set(rows.map((r) => `${r.role} ${r.permission_code}`));
      // Symmetric difference, so a failure names the offending grants rather
      // than printing two 139-line arrays and leaving the reader to diff them.
      const missing = [...SEED.grants].filter((g) => !actual.has(g)).sort();
      const extra = [...actual].filter((g) => !SEED.grants.has(g)).sort();
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
      expect(actual.size).toBe(139);
    });

    it.each(ROLES)('%s holds its stated total', async (role) => {
      const { rows } = await client.query(
        `SELECT count(*)::int AS n FROM core.role_permission WHERE role = $1`,
        [role],
      );
      expect(rows[0].n).toBe(PER_ROLE_TOTAL[role]);
    });
  });

  // ==========================================================================
  describe('all 252 cells, through fn_has_permission (A1.5 step 5)', () => {
    /**
     * The whole matrix in one test rather than 252, because the useful failure
     * message is the LIST of disagreeing cells — 252 separate assertions would
     * report the first and hide the shape of the defect.
     */
    it('reproduces every grant and every non-grant on a CONSOLE session', async () => {
      const wrong: string[] = [];
      let passes = 0;
      let refusals = 0;

      for (const role of ROLES) {
        for (const { code } of SEED.permissions) {
          const granted = isGranted(role, code);
          const { allowed, sqlstate } = await probe(ACCOUNT_FOR[role], code, 'CONSOLE');
          if (allowed !== granted) {
            wrong.push(
              `${role} ${code}: document says ${granted ? 'granted' : 'not granted'}, ` +
                `function ${allowed ? 'allowed' : `refused (${sqlstate})`}`,
            );
          }
          if (granted && allowed) passes += 1;
          if (!granted && !allowed) refusals += 1;
        }
      }

      expect(wrong).toEqual([]);
      expect(passes).toBe(139);
      expect(refusals).toBe(113);
    }, 120_000);

    /**
     * §14: "a 403 never distinguishes 'you lack the role' from 'you lack the
     * surface'." One EXISTS covering both makes the function structurally
     * unable to tell them apart — this asserts the shape held.
     */
    it('refuses a role failure and a surface failure with the same SQLSTATE', async () => {
      // ANALYST does not hold products:write — a ROLE failure on CONSOLE.
      const roleFailure = await probe(ACCOUNT_FOR.ANALYST, 'seller.products:write', 'CONSOLE');
      // OWNER holds payout:update, but it is CONSOLE-only — a SURFACE failure.
      const surfaceFailure = await probe(ACCOUNT_FOR.OWNER, 'seller.payout:update', 'MOBILE');

      expect(roleFailure.allowed).toBe(false);
      expect(surfaceFailure.allowed).toBe(false);
      expect(roleFailure.sqlstate).toBe('U0001'); // R29 - a deliberate denial
      expect(surfaceFailure.sqlstate).toBe(roleFailure.sqlstate);
    });

    /**
     * §19 / A1.3 property 2: a scope failure is 404, never 403. "Reporting 'no
     * relationship' as 403 confirms that a seller with that id exists", which
     * turns any endpoint taking an identifier into an enumeration oracle.
     *
     * R29 CLOSES THE CODE QUESTION THE PREVIOUS REVISION RAISED. A1.3 used
     * `no_data_found`, which yields PL/pgSQL's P0002 rather than class 02 —
     * distinct from 42501, but a code PostgreSQL also raises for its own
     * reasons. v1.10 §6.9b gives the deliberate raises their own class:
     *
     *   U0001  fn_has_permission   -> 403
     *   U0002  fn_has_permission   -> 404
     *   42501  PostgreSQL ONLY     -> 500, a defect
     *
     * "One code meaning both 'you may not' and 'our grants are misconfigured'
     *  means a real privilege bug reaches a seller as a clean 403 and is never
     *  investigated."
     */
    it('raises a DIFFERENT code for a stranger than for a denied permission', async () => {
      const stranger = await probe(STRANGER, 'seller.orders:read', 'CONSOLE');
      const denied = await probe(ACCOUNT_FOR.ANALYST, 'seller.products:write', 'CONSOLE');

      expect(stranger.allowed).toBe(false);
      expect(stranger.sqlstate).toBe('U0002'); // -> 404
      expect(denied.sqlstate).toBe('U0001'); // -> 403
      expect(stranger.sqlstate).not.toBe(denied.sqlstate);
    });

    it('refuses a stranger even for a permission every role holds', async () => {
      const { allowed, sqlstate } = await probe(STRANGER, 'seller.orders:read', 'CONSOLE');
      expect({ allowed, sqlstate }).toEqual({ allowed: false, sqlstate: 'U0002' });
    });
  });

  // ==========================================================================
  describe('the negatives that matter most (A1.5 step 6)', () => {
    const stepUp = SEED.permissions.filter((p) => p.requiresStepUp);

    it('marks exactly the eight codes of §16.3', () => {
      expect(stepUp.map((p) => p.code).sort()).toEqual(STEP_UP_CODES);
    });

    /**
     * ADU-ARCH-01 §3.4: no §6.5 action is reachable from the mobile app, "on
     * any screen, by any route". FOR EVERY ROLE INCLUDING OWNER — the Owner
     * holds all 42, so if the surface gate were subordinate to the role gate
     * this is where it would show.
     */
    it('refuses every step-up permission on MOBILE, for every role including OWNER', async () => {
      const leaks: string[] = [];
      for (const role of ROLES) {
        for (const { code } of stepUp) {
          const { allowed } = await probe(ACCOUNT_FOR[role], code, 'MOBILE');
          if (allowed) leaks.push(`${role} reached ${code} from MOBILE`);
        }
      }
      expect(leaks).toEqual([]);
    }, 60_000);

    it('still allows those same eight to OWNER on CONSOLE', async () => {
      for (const { code } of stepUp) {
        const { allowed } = await probe(ACCOUNT_FOR.OWNER, code, 'CONSOLE');
        expect({ code, allowed }).toEqual({ code, allowed: true });
      }
    });

    /**
     * §24: asserted "by iterating the catalogue, not by listing writes by hand,
     * so a write added later is caught without anyone remembering to add a
     * case". A read is an action of `read` or `export`; everything else mutates.
     */
    it('allows ANALYST no write of any kind', async () => {
      const held: string[] = [];
      for (const { code } of SEED.permissions) {
        const action = code.split(':')[1];
        if (action === 'read' || action === 'export') continue;
        const { allowed } = await probe(ACCOUNT_FOR.ANALYST, code, 'CONSOLE');
        if (allowed) held.push(code);
      }
      expect(held).toEqual([]);
    }, 60_000);

    it('gives ANALYST exactly ten permissions, all of them reads', async () => {
      const { rows } = await client.query(
        `SELECT permission_code FROM core.role_permission WHERE role='ANALYST' ORDER BY 1`,
      );
      expect(rows).toHaveLength(10);
      for (const r of rows) {
        expect(['read', 'export']).toContain(r.permission_code.split(':')[1]);
      }
    });

    it('gives OWNER all 42 and ADMIN all but delete and ownership transfer', async () => {
      const held = async (role: Role) =>
        (
          await client.query(
            `SELECT permission_code FROM core.role_permission WHERE role=$1`,
            [role],
          )
        ).rows.map((r) => r.permission_code);
      const owner = new Set(await held('OWNER'));
      const admin = new Set(await held('ADMIN'));
      expect(owner.size).toBe(42);
      expect([...owner].filter((c) => !admin.has(c)).sort()).toEqual([
        'seller.account:delete',
        'seller.ownership:transfer',
      ]);
    });
  });

  // ==========================================================================
  describe('A1.2 — one step_up_action value per step-up permission', () => {
    /**
     * v1.9's Appendix A carried six values against eight step-up permissions,
     * so a challenge for seller.identity:manage or seller.ownership:transfer
     * could not be recorded at all: "the two most dangerous actions in the
     * system are the two that cannot be audited".
     */
    it('core.step_up_action has eight values', async () => {
      const { rows } = await client.query(
        `SELECT e.enumlabel::text AS v
           FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
           JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname='core' AND t.typname='step_up_action'
          ORDER BY e.enumsortorder`,
      );
      expect(rows.map((r) => r.v)).toEqual([
        'PAYOUT_CHANGE',
        'REISSUE_INSTRUCTIONS',
        'TEAM_CHANGE',
        'SUBSCRIPTION_CHANGE',
        'SELLER_DELETION',
        'REVOKE_ALL_SESSIONS',
        'IDENTITY_CHANGE',
        'OWNERSHIP_TRANSFER',
      ]);
    });

    it('has exactly as many values as there are step-up permissions', async () => {
      const { rows } = await client.query(
        `SELECT (SELECT count(*)::int FROM pg_enum e
                   JOIN pg_type t ON t.oid=e.enumtypid
                   JOIN pg_namespace n ON n.oid=t.typnamespace
                  WHERE n.nspname='core' AND t.typname='step_up_action') AS actions,
                (SELECT count(*)::int FROM core.permission WHERE requires_step_up) AS perms`,
      );
      expect(rows[0].actions).toBe(rows[0].perms);
    });

    it('can record a challenge for both permissions that previously had none', async () => {
      await client.query('SAVEPOINT sa');
      for (const action of ['IDENTITY_CHANGE', 'OWNERSHIP_TRANSFER']) {
        const otp = await client.query(
          `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash, expires_at, step_up_action)
           VALUES (gen_random_uuid(),'STEP_UP','+251911002001',decode('00','hex'),
                   now() + interval '5 min', $1::core.step_up_action) RETURNING id`,
          [action],
        );
        await expect(
          client.query(
            `INSERT INTO core.step_up_challenge (id, account_id, action, otp_challenge_id, expires_at)
             VALUES (gen_random_uuid(), $1, $2::core.step_up_action, $3, now() + interval '5 min')`,
            [ACCOUNT_FOR.OWNER, action, otp.rows[0].id],
          ),
        ).resolves.toBeDefined();
      }
      await client.query('ROLLBACK TO SAVEPOINT sa');
    });
  });

  // ==========================================================================
  describe('R28 and A3.3 - the standing gate', () => {
    /**
     * ADU-AUTH-01 v2.4 §14 adds Standing ahead of Role and Surface, and it was
     * "previously missing rather than merely unnamed":
     *
     *   "§18.1 places suspension at authentication - 'team logins are disabled,
     *    not deleted.' DISABLING A LOGIN DOES NOT END A LIVE SESSION. A member
     *    suspended for cause who holds a console session kept every permission
     *    until it expired: up to twelve hours, or SEVEN DAYS on a remembered
     *    device under R17. For an ADMIN that is payout access, staff
     *    administration and identity management for a week after the Owner
     *    suspended them."
     *
     * The previous revision of this repository found and reported this rather
     * than closing it, because what suspension MEANS is a ruling. R28 is that
     * ruling, and these are the tests it asked for.
     */
    it('takes a permission away the moment the member is suspended', async () => {
      const code = 'seller.payout:update'; // an ADMIN power that moves money
      const account = ACCOUNT_FOR.ADMIN;

      const before = await probe(account, code, 'CONSOLE');
      expect(before.allowed).toBe(true);

      await client.query('SAVEPOINT r28');
      await client.query(
        'UPDATE core.seller_team_member SET suspended_at = now()' +
          ' WHERE seller_id = $1 AND account_id = $2',
        [SELLER, account],
      );

      // Immediate, and on the very next call: the predicate is on the row every
      // authorization check already reads, so there is nothing to invalidate.
      const during = await probe(account, code, 'CONSOLE');
      expect(during.allowed).toBe(false);

      await client.query('ROLLBACK TO SAVEPOINT r28');

      const after = await probe(account, code, 'CONSOLE');
      expect(after.allowed).toBe(true);
    });

    /**
     * A3.3 - THE STANDING GATE RAISES U0001, AND THE AMENDMENT RULED THE
     * ENFORCEMENT WRONG RATHER THAN THE PROSE.
     *
     * The previous revision found that ADU-DB-01 v1.10 6.9a's body and
     * ADU-AUTH-01 v2.4 14's gate table disagreed - the body folded standing
     * into the role lookup, so a suspended member matched no row and raised
     * U0002 (404) where the table said U0001 (403). It shipped the enforcement,
     * because v1.10 governs enforcement, and reported the contradiction.
     *
     * A3.3 confirms the contradiction and rules the OTHER way:
     *
     *   "The principle the 404 rests on is DO NOT CONFIRM EXISTENCE TO SOMEONE
     *    WITH NO BUSINESS KNOWING. It exists to defeat enumeration by
     *    strangers. A SUSPENDED ADMIN IS NOT A STRANGER - they worked there,
     *    they know the store exists, and telling them it does not is not
     *    protecting a secret. It is a lie that produces a support ticket and
     *    looks like a bug."
     *
     * So the boundary is "did you EVER have standing", not "do you have it
     * now". Three cases, not two, and these are the three.
     */
    it('raises U0001 for a suspended member - they are not a stranger', async () => {
      await client.query('SAVEPOINT a33a');
      await client.query(
        'UPDATE core.seller_team_member SET suspended_at = now()' +
          ' WHERE seller_id = $1 AND account_id = $2',
        [SELLER, ACCOUNT_FOR.SALES_SUPPORT],
      );
      const r = await probe(ACCOUNT_FOR.SALES_SUPPORT, 'seller.orders:read', 'CONSOLE');
      await client.query('ROLLBACK TO SAVEPOINT a33a');

      expect(r).toEqual({ allowed: false, sqlstate: 'U0001' });
    });

    it('raises U0001 for a revoked member too - standing, not membership', async () => {
      await client.query('SAVEPOINT a33b');
      await client.query(
        'UPDATE core.seller_team_member SET revoked_at = now()' +
          ' WHERE seller_id = $1 AND account_id = $2',
        [SELLER, ACCOUNT_FOR.INVENTORY],
      );
      const r = await probe(ACCOUNT_FOR.INVENTORY, 'seller.products:read', 'CONSOLE');
      await client.query('ROLLBACK TO SAVEPOINT a33b');

      expect(r).toEqual({ allowed: false, sqlstate: 'U0001' });
    });

    /**
     * The pair that carries the whole ruling: the two failures must be
     * DISTINCT, and they must be distinct in this direction. A stranger gets
     * 404 because confirming the seller exists would make any endpoint taking
     * an identifier an enumeration oracle; a suspended member gets 403 because
     * they already know it exists.
     */
    it('holds the two apart: stranger U0002, suspended U0001', async () => {
      await client.query('SAVEPOINT a33c');
      await client.query(
        'UPDATE core.seller_team_member SET suspended_at = now()' +
          ' WHERE seller_id = $1 AND account_id = $2',
        [SELLER, ACCOUNT_FOR.ADMIN],
      );
      const suspended = await probe(ACCOUNT_FOR.ADMIN, 'seller.payout:update', 'CONSOLE');
      await client.query('ROLLBACK TO SAVEPOINT a33c');

      const stranger = await probe(STRANGER, 'seller.payout:update', 'CONSOLE');

      expect(suspended).toEqual({ allowed: false, sqlstate: 'U0001' });
      expect(stranger).toEqual({ allowed: false, sqlstate: 'U0002' });
      expect(suspended.sqlstate).not.toBe(stranger.sqlstate);
    });

    /**
     * THE NON-DETERMINISM A3.3'S BODY WOULD HAVE HAD, and the reason migration
     * 09's ORDER BY is this repository's addition rather than the amendment's.
     *
     * seller_team_member_live is UNIQUE on (seller_id, account_id) only WHERE
     * revoked_at IS NULL, so a member revoked and later re-invited holds
     * SEVERAL rows. A bare SELECT ... INTO over an unfiltered lookup takes an
     * arbitrary one, and picking the stale revoked row denies a member who is
     * currently in good standing. The live row wins.
     */
    it('prefers the live membership when a revoked one also exists', async () => {
      await client.query('SAVEPOINT a33d');
      // An older, revoked membership for an account that also holds a live one.
      await client.query(
        'INSERT INTO core.seller_team_member' +
          ' (id, seller_id, account_id, role, revoked_at, created_at)' +
          ' VALUES (gen_random_uuid(), $1, $2, $3, now(), now() - $4::interval)',
        [SELLER, ACCOUNT_FOR.SALES_SUPPORT, 'ANALYST', '400 days'],
      );
      const r = await probe(ACCOUNT_FOR.SALES_SUPPORT, 'seller.orders:respond', 'CONSOLE');
      await client.query('ROLLBACK TO SAVEPOINT a33d');

      // SALES_SUPPORT holds orders:respond; the revoked ANALYST row does not.
      expect(r.allowed).toBe(true);
    });

    it('takes away EVERY permission, not merely the dangerous ones', async () => {
      await client.query('SAVEPOINT r28c');
      await client.query(
        'UPDATE core.seller_team_member SET suspended_at = now()' +
          ' WHERE seller_id = $1 AND account_id = $2',
        [SELLER, ACCOUNT_FOR.ADMIN],
      );
      const stillAllowed: string[] = [];
      const codes: string[] = [];
      for (const { code } of SEED.permissions) {
        const { allowed, sqlstate } = await probe(ACCOUNT_FOR.ADMIN, code, 'CONSOLE');
        if (allowed) stillAllowed.push(code);
        else if (sqlstate !== undefined) codes.push(sqlstate);
      }
      await client.query('ROLLBACK TO SAVEPOINT r28c');
      expect(stillAllowed).toEqual([]);
      // A3.3: every one of the 42 denials is U0001, never U0002. A suspended
      // Admin must not be told the seller does not exist.
      expect([...new Set(codes)]).toEqual(['U0001']);
    }, 60_000);

    /**
     * The Owner is core.seller.owner_account_id (A1.3) and holds no
     * seller_team_member row, so there is nothing to suspend. Recorded because
     * a reader could expect suspension to reach them, and §16.5's answer is
     * that removing an Owner is ownership transfer, not suspension.
     */
    it('cannot suspend the Owner, because the Owner is not a team member', async () => {
      const { rows } = await client.query(
        'SELECT count(*)::int AS n FROM core.seller_team_member' +
          ' WHERE seller_id = $1 AND account_id = $2',
        [SELLER, ACCOUNT_FOR.OWNER],
      );
      expect(rows[0].n).toBe(0);
      const owner = await probe(ACCOUNT_FOR.OWNER, 'seller.payout:update', 'CONSOLE');
      expect(owner.allowed).toBe(true);
    });
  });

  // ==========================================================================
  describe('the function is not a privilege escalation in its own right', () => {
    /**
     * SECURITY DEFINER runs as the function's OWNER. Applied by a bootstrap
     * superuser, an unowned function would run as one — which is how the
     * verification boundary was nearly made decorative in migration 04.
     */
    it('is owned by adulis_migrate, not by the bootstrap superuser', async () => {
      const { rows } = await client.query(
        `SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.provolatile
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='core' AND p.proname='fn_has_permission'`,
      );
      expect(rows[0]?.owner).toBe('adulis_migrate');
      expect(rows[0]?.prosecdef).toBe(true);
      expect(rows[0]?.provolatile).toBe('s'); // STABLE — it writes nothing
    });

    it('is owned by a role that is not a superuser', async () => {
      const { rows } = await client.query(
        `SELECT rolsuper FROM pg_roles WHERE rolname='adulis_migrate'`,
      );
      expect(rows[0]?.rolsuper).toBe(false);
    });

    it('is not executable by PUBLIC', async () => {
      const { rows } = await client.query(
        `SELECT has_function_privilege('public',
                  'core.fn_has_permission(uuid,uuid,text,core.session_audience)','EXECUTE') AS pub,
                has_function_privilege('adulis_app',
                  'core.fn_has_permission(uuid,uuid,text,core.session_audience)','EXECUTE') AS app`,
      );
      expect(rows[0]).toEqual({ pub: false, app: true });
    });

    it('leaves the catalogue unwritable by the application role', async () => {
      const { rows } = await client.query(
        `SELECT has_table_privilege('adulis_app','core.role_permission','INSERT') AS ins,
                has_table_privilege('adulis_app','core.role_permission','UPDATE') AS upd,
                has_table_privilege('adulis_app','core.role_permission','DELETE') AS del`,
      );
      expect(rows[0]).toEqual({ ins: false, upd: false, del: false });
    });
  });
});
