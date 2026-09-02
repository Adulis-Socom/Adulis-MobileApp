import { sql, type Transaction } from 'kysely';
import type { Database } from '../db/database.types';
import type { AuthedRequest } from './auth.guard';

/**
 * The RENDERING-HINT half of authorization -- `allowed_actions` (ADU-API-01
 * v1.9, D-155). One query resolves the caller's grant set for a seller:
 * role (owner, else live unsuspended membership) joined to role_permission,
 * filtered by the calling surface.
 *
 * THIS NEVER AUTHORIZES ANYTHING. Every write still opens with
 * `assertPermission` -> `core.fn_has_permission`, which raises; this
 * returns a set and raises nothing, because an empty hint is a rendering
 * fact, not a refusal. The two share their SOURCE tables (permission,
 * role_permission -- adulis_app keeps SELECT on both for exactly this,
 * ADU-DB-01 S6.9a E5) but not their code path: the authority path is the
 * database function, and this must never be "improved" into a substitute
 * for it.
 *
 * The role resolution mirrors fn_has_permission's steps 1-2 deliberately
 * and READ-ONLY: owner wins, else the live membership row (unique under
 * seller_team_member_live). No standing -> empty set -- the endpoint's own
 * assertPermission has already decided 403-vs-404 before this runs.
 */
export async function grantSet(
  trx: Transaction<Database>,
  req: AuthedRequest,
): Promise<ReadonlySet<string>> {
  const accountId = req.ctx?.accountId;
  const sellerId = req.ctx?.sellerId;
  const audience = req.auth?.audience;
  if (!accountId || !sellerId || !audience) return new Set();

  const r = await sql<{ code: string }>`
    WITH role AS (
      SELECT role FROM (
        SELECT 1 AS pri, 'OWNER'::core.team_role AS role
          FROM core.seller s
         WHERE s.id = ${sellerId} AND s.owner_account_id = ${accountId}
        UNION ALL
        SELECT 2, tm.role
          FROM core.seller_team_member tm
         WHERE tm.seller_id = ${sellerId}
           AND tm.account_id = ${accountId}
           AND tm.suspended_at IS NULL
           AND tm.revoked_at IS NULL
      ) x
      ORDER BY pri
      LIMIT 1
    )
    SELECT rp.permission_code AS code
      FROM role
      JOIN core.role_permission rp ON rp.role = role.role
      JOIN core.permission p ON p.code = rp.permission_code
     WHERE ${audience}::core.session_audience = ANY(p.surfaces)`.execute(trx);
  return new Set(r.rows.map((row) => row.code));
}

/**
 * `allowed_actions` for one object: the caller's grants INTERSECTED with
 * the actions the object's CURRENT STATE admits. The state predicates are
 * supplied by the calling service -- the one place that already knows the
 * object -- as (permission code -> does the state admit it). The result is
 * permission codes, verbatim (v1.9: "per object, named by permission
 * code"), and the console renders a control iff its code is present. It
 * never unions this with anything it worked out itself.
 */
export function allowedActions(
  grants: ReadonlySet<string>,
  candidates: Readonly<Record<string, boolean>>,
): string[] {
  return Object.entries(candidates)
    .filter(([code, stateAdmits]) => stateAdmits && grants.has(code))
    .map(([code]) => code)
    .sort();
}
