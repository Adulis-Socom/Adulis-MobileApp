import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../src/common/auth/auth.guard';
import type { SessionContext, SessionService } from '../src/common/auth/session.service';
import { AdulisException } from '../src/common/errors/adulis-exception';
import { SESSION_COOKIE } from '../src/common/http/cookies';
import { loadContract, scanRoutes, type Route } from './contract-support';
import { SELLER_SIDE_ONLY, deriveGate, permissionSurfaces, routeLabel, scanGates } from './gate-support';

/**
 * The authorization the contract states, held to the gates the code enforces.
 *
 * `security` says how a caller authenticates (a bearer token or the session cookie); it cannot say what the session
 * may then do. Where a route's gate admits only a CONSOLE session, the contract therefore offers the cookie alone
 * and states the permission and surfaces as `x-adulis-permission` / `x-adulis-surfaces`. This spec re-derives that
 * from the code (the permissions each handler's code checks, the SQL functions it calls, a code check of the session
 * audience) and from the surfaces in the permission seed, and fails when a route's declared carrier or gate no longer
 * matches what its gates admit: a permission moved to another surface, a handler that starts checking another
 * permission, a new route nobody classified. Read from the source; needs no database and no running API.
 */

const contract = loadContract();
const COMMERCE_MODULES = new Set(['billing', 'claims', 'couriers', 'financial', 'handoff', 'obligations', 'orders', 'reviews']);
const routes = scanRoutes().filter((r) => !COMMERCE_MODULES.has(r.module));
const protectedRoutes = routes.filter((r) => !r.isPublic);
const gates = scanGates();
const surfaces = permissionSurfaces();

const label = routeLabel;
const derive = deriveGate;
const gateOf = (r: Route) => {
  const g = gates.get(`${r.controller}.${r.handler}`);
  if (!g) throw new Error(`${label(r)}: no controller method ${r.controller}.${r.handler} found in the source`);
  return g;
};
const operation = (r: Route) => {
  const o = contract.paths[r.path]?.[r.http];
  if (!o) throw new Error(`${label(r)} is not in the contract`);
  return o as typeof o & Record<string, unknown>;
};
const sameSet = (a: readonly string[], b: readonly string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/**
 * Protected routes with no permission and no audience check in their code, reviewed one by one: they authenticate
 * and act on the caller's own data. A new protected route that appears neither here nor with a gate fails the spec,
 * so a gate the scan cannot see is never read as "no gate".
 */
const AUTHENTICATED_ONLY = new Set([
  'POST /v1/events',
  'POST /v1/auth/logout',
  'GET /v1/auth/sessions',
  'DELETE /v1/auth/remembered-devices/{id}',
  'POST /v1/auth/step-up/verify',
  'PATCH /v1/devices/{id}',
  'POST /v1/conversations',
  'GET /v1/collections',
  'POST /v1/collections',
  'GET /v1/collections/saves',
  'POST /v1/collections/saved-state:batch',
  'GET /v1/collections/{collectionRef}',
  'PATCH /v1/collections/{collectionRef}',
  'DELETE /v1/collections/{collectionRef}',
  'POST /v1/collections/{collectionRef}/items',
  'DELETE /v1/collections/{collectionRef}/items/{itemRef}',
  'POST /v1/notifications/{id}/read',
  'POST /v1/notifications/read-all',
  'POST /v1/seller',
  'GET /v1/seller/list',
  // Gated by the operator grant inside verification.write_attestation, not by a seller permission.
  'POST /v1/seller/identity-verification',
  // Gated by the caller's party in the transfer, inside the SQL function.
  'GET /v1/seller/ownership-transfer',
  'DELETE /v1/seller/ownership-transfer',
  'POST /v1/reports',
  'GET /v1/reports/mine',
]);

describe('the carrier is bound to the session audience (what makes "cookie only" mean "Console only")', () => {
  const MOBILE: SessionContext = { sessionId: 's', accountId: 'a', audience: 'MOBILE', deviceId: null, marketId: 'm' };
  const CONSOLE: SessionContext = { ...MOBILE, audience: 'CONSOLE' };
  class Controller {
    handler(): void {}
  }
  const verdict = async (session: SessionContext, headers: Record<string, string>) => {
    const guard = new AuthGuard(new Reflector(), { authenticate: () => Promise.resolve(session) } as unknown as SessionService);
    const context = {
      getHandler: () => Controller.prototype.handler,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => ({ headers, path: '/v1/anything', method: 'GET' }) }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context).then(
      () => 'admitted',
      (e: unknown) => (e instanceof AdulisException ? e.code : 'error'),
    );
  };

  it('admits a console session by cookie and a mobile session by bearer', async () => {
    expect(await verdict(CONSOLE, { cookie: `${SESSION_COOKIE}=t` })).toBe('admitted');
    expect(await verdict(MOBILE, { authorization: 'Bearer t' })).toBe('admitted');
  });

  it('refuses a mobile session presented as a cookie and a console session presented as a bearer token', async () => {
    expect(await verdict(MOBILE, { cookie: `${SESSION_COOKIE}=t` })).toBe('AUDIENCE_NOT_PERMITTED');
    expect(await verdict(CONSOLE, { authorization: 'Bearer t' })).toBe('AUDIENCE_NOT_PERMITTED');
  });
});

describe('the permission seed the gates are read from', () => {
  it('reproduces the surface of the permissions the contract names (written out, not read back from the code under test)', () => {
    expect(surfaces.get('seller.products:read')).toEqual(['CONSOLE']);
    expect(surfaces.get('seller.messages:read')).toEqual(['MOBILE', 'CONSOLE']);
    expect(surfaces.get('seller.analytics.basic:read')).toEqual(['MOBILE', 'CONSOLE']);
    expect(surfaces.get('seller.analytics.full:read')).toEqual(['CONSOLE']);
  });
});

describe('contracts/openapi.json states the authorization the gates enforce', () => {
  it('resolves every protected route: it has a gate the scan found, or it is reviewed as authenticated-only', () => {
    const unresolved = protectedRoutes
      .filter((r) => {
        const g = gateOf(r);
        return g.permissions.length === 0 && !g.consoleCheck && !AUTHENTICATED_ONLY.has(label(r));
      })
      .map(label);
    expect(unresolved).toEqual([]);
  });

  it('does not list as authenticated-only a route that has a gate, or a route that no longer exists', () => {
    const known = new Set(protectedRoutes.map(label));
    const stale = [...AUTHENTICATED_ONLY].filter((op) => !known.has(op) || derive(protectedRoutes.find((r) => label(r) === op) as Route).routeWide);
    expect(stale).toEqual([]);
  });

  it('offers the cookie alone exactly where every gate on the route admits only a Console session', () => {
    const wrong = protectedRoutes.flatMap((r) => {
      const d = derive(r);
      const security = JSON.stringify(operation(r).security);
      if (!d.admits.includes('MOBILE')) {
        return security === JSON.stringify([{ cookie: [] }]) ? [] : [`${label(r)} is Console-only (${d.permissions.join(', ') || 'audience check'}) and declares ${security}`];
      }
      return security.includes('"bearer"') ? [] : [`${label(r)} admits a mobile session and does not offer the bearer token (${security})`];
    });
    expect(wrong).toEqual([]);
  });

  it('keeps the seller-side permission of chat and notifications mobile-capable, so both carriers stay true', () => {
    const wrong = protectedRoutes
      .filter((r) => SELLER_SIDE_ONLY.has(label(r)))
      .filter((r) => gateOf(r).permissions.length === 0 || !derive(r).admits.includes('MOBILE'))
      .map(label);
    expect(wrong).toEqual([]);
  });

  it('states the permission and surfaces of every route-wide gate, and of no other route', () => {
    const wrong = routes.flatMap((r) => {
      const o = operation(r);
      const declaredPermission = o['x-adulis-permission'] as string[] | undefined;
      const declaredSurfaces = o['x-adulis-surfaces'] as string[] | undefined;
      const d = r.isPublic ? undefined : derive(r);
      if (!d?.routeWide) {
        return declaredPermission || declaredSurfaces ? [`${label(r)} states a gate it does not have`] : [];
      }
      const problems: string[] = [];
      if (d.permissions.length > 0 && !(declaredPermission && sameSet(declaredPermission, d.permissions))) {
        problems.push(`${label(r)} checks ${d.permissions.join(', ')} and declares x-adulis-permission ${JSON.stringify(declaredPermission)}`);
      }
      if (d.permissions.length === 0 && declaredPermission) problems.push(`${label(r)} checks no permission and declares x-adulis-permission`);
      if (!(declaredSurfaces && sameSet(declaredSurfaces, d.admits))) {
        problems.push(`${label(r)} admits ${d.admits.join('+')} and declares x-adulis-surfaces ${JSON.stringify(declaredSurfaces)}`);
      }
      return problems;
    });
    expect(wrong).toEqual([]);
  });

  it('says the same thing in the description of every operation that states a gate', () => {
    const wrong = routes.flatMap((r) => {
      const o = operation(r);
      const permission = o['x-adulis-permission'] as string[] | undefined;
      const declaredSurfaces = o['x-adulis-surfaces'] as string[] | undefined;
      if (!declaredSurfaces) return [];
      const text = o.description ?? '';
      const mentionsAll = (permission ?? []).every((p) => text.includes(`\`${p}\``));
      const consoleOnly = !declaredSurfaces.includes('MOBILE');
      const says = consoleOnly ? text.includes('Console (cookie) sessions only') : text.includes('A mobile (bearer) or a Console (cookie) session can hold it');
      return mentionsAll && says ? [] : [`${label(r)}: the description does not state the gate`];
    });
    expect(wrong).toEqual([]);
  });

  it('pins the sizes of the three groups, so a silent change of a whole group is visible', () => {
    const consoleOnly = protectedRoutes.filter((r) => !derive(r).admits.includes('MOBILE')).length;
    const gatedOnBoth = protectedRoutes.filter((r) => derive(r).routeWide && derive(r).admits.length === 2).length;
    expect({ consoleOnly, gatedOnBoth }).toEqual({ consoleOnly: 50, gatedOnBoth: 3 });
  });
});
