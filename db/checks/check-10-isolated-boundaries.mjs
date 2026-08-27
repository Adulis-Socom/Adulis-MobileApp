import { ok, bad } from './_lib.mjs';

/**
 * Appendix C check 10 — the two isolated boundaries are readable only through
 * their logging functions.
 *
 * Guards ADU-DB-01 v1.8 sections 7.3 and 13.6. `verification` and `financial` are
 * owned by roles that are used by nothing at runtime; `adulis_app` reaches them
 * only through `SECURITY DEFINER` functions that write the access log in the same
 * transaction. "You cannot read the evidence without logging the read, because
 * there is no other way to read it."
 *
 * These are the two schemas whose unlogged disclosure would be a reportable event
 * under Proclamation 1321/2024 rather than an internal defect (section 3).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A PRIVILEGE QUERY AND NOT APPENDIX C'S LITERAL GREP
 *
 * Appendix C writes check 10 as:
 *     grep -E "GRANT .* ON SCHEMA (verification|financial) .* adulis_app"  = 0
 *
 * That is unsatisfiable by a working system, and it was verified rather than
 * assumed. PostgreSQL requires USAGE on a schema before any role may reference
 * ANY object in it, including calling a function. With section 7.3's DDL exactly
 * as written — REVOKE ALL ON SCHEMA, then GRANT EXECUTE ON FUNCTION — a call to
 * `verification.read_attestation` from `adulis_app` raises
 * `insufficient_privilege`. The boundary function is uncallable, so the
 * verification path does not work at all.
 *
 * Adding `GRANT USAGE ON SCHEMA verification TO adulis_app` makes the call
 * succeed and, tested in the same transaction, leaves a direct
 * `SELECT ... FROM verification.identity_attestation` still denied. USAGE conveys
 * namespace visibility and no data access whatsoever.
 *
 * So the invariant is not "no GRANT on the schema". It is: **`adulis_app` holds
 * no privilege on any TABLE in those schemas, and no EXECUTE on any routine there
 * other than the named boundary functions.** That is what this checks, and it is
 * strictly stronger than the grep — it catches a grant made by any route,
 * including one made outside a migration.
 *
 * Recorded for amendment in ADU-DB-01 v1.9. See db/checks/README.md.
 * ---------------------------------------------------------------------------
 */
const BOUNDARY_SCHEMAS = ['verification', 'financial'];

/** The only routines `adulis_app` may execute inside a boundary schema. */
const PERMITTED_FUNCTIONS = [
  'verification.read_attestation',
  'verification.write_attestation',
  'verification.id_hash_matches',
  // The existence probe (migration 0018): one boolean, no name, no id type,
  // nothing logged because nothing is disclosed - same doctrine as
  // id_hash_matches. Eligibility (S7.4) and readiness (S9.4) both need
  // exactly this; reads that disclose still go only through
  // read_attestation and its access log.
  'verification.has_attestation',
  'financial.read_payment_evidence',
  'financial.render_payment_instructions',
  // Register D-16: the boundary's WRITE path. The document prints only the
  // readers; a read-only boundary with no commit path would force app table
  // grants in financial - the exact hole section 13 exists to close. The
  // narrow definer (insert + log, nothing else) is app-callable; the
  // retention marker is NOT (triggers and jobs reach it as adulis_migrate).
  'financial.write_payment_evidence',
  // The payout credential's writer (migration 0022) - D-16's argument on
  // the payout side: ciphertext in, nothing out, upsert on details id.
  // The app supplies ciphertext it encrypted with a key Postgres never
  // held; a read stays impossible outside render_payment_instructions.
  'financial.write_payout_credential',
  // The purge (migration 0023, S16.9 "Payout details: Purged"): ids in,
  // a row count out, DELETE and nothing else. Deletion's one crossing of
  // the boundary discloses nothing - ciphertext goes away, none returns.
  'financial.purge_payout_credential',
];

export default {
  id: 10,
  title: 'adulis_app holds no table privilege in verification/financial',
  source: 'ADU-DB-01 v1.8 sections 7.3, 13.6',
  kind: 'database',
  liveAtTier: 1,
  expected: '0 table privileges; EXECUTE only on the named boundary functions',
  async run({ sql }) {
    const roleExists = await sql(`SELECT 1 FROM pg_roles WHERE rolname = 'adulis_app'`);
    if (roleExists.length === 0) {
      return ok('vacuously true — role adulis_app does not exist yet');
    }

    // 1. No privilege of any kind on any relation in either schema.
    const tables = await sql(
      `SELECT n.nspname || '.' || c.relname AS t, p.priv
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         CROSS JOIN LATERAL (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
                                    ('TRUNCATE'),('REFERENCES'),('TRIGGER')) AS p(priv)
        WHERE n.nspname = ANY($1::text[])
          AND c.relkind IN ('r','v','m','p','f')
          AND has_table_privilege('adulis_app', c.oid, p.priv)`,
      [BOUNDARY_SCHEMAS],
    );

    // 2. EXECUTE only on the named boundary functions.
    const routines = await sql(
      `SELECT n.nspname || '.' || p.proname AS f
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = ANY($1::text[])
          AND has_function_privilege('adulis_app', p.oid, 'EXECUTE')`,
      [BOUNDARY_SCHEMAS],
    );
    const stray = [...new Set(routines.map((r) => r.f))].filter(
      (f) => !PERMITTED_FUNCTIONS.includes(f),
    );

    if (tables.length === 0 && stray.length === 0) {
      const n = new Set(routines.map((r) => r.f)).size;
      return ok(`0 table privileges; EXECUTE on ${n} named boundary function(s)`);
    }
    return bad(
      (tables.length
        ? `TABLE PRIVILEGE LEAK: ${tables.map((r) => `${r.t}:${r.priv}`).slice(0, 5).join(', ')}`
        : '') + (stray.length ? ` | unnamed executable routine(s): ${stray.join(', ')}` : ''),
    );
  },
};
