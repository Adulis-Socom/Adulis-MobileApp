import type { Type } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { PUBLIC_KEY } from '../auth/auth.guard';

/**
 * The credentials the AuthGuard accepts: a Bearer token (mobile) or the
 * session cookie (console). Either one authenticates; the guard then checks
 * that the carrier matches the session's audience.
 */
export const GUARD_SECURITY: readonly Record<string, string[]>[] = [{ cookie: [] }, { bearer: [] }];

/**
 * Controllers whose operations keep the metadata they declare today. The
 * legacy commerce routes are left exactly as documented until their contract
 * is corrected on its own; every other controller, including one added later,
 * is covered by the derivation.
 */
export const LEGACY_COMMERCE_CONTROLLERS: ReadonlySet<string> = new Set([
  'BillingController',
  'ClaimsController',
  'CouriersController',
  'FinancialController',
  'HandoffController',
  'ObligationsController',
  'OrdersController',
  'ReviewsController',
]);

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** The AuthGuard's reading of @Public: the handler's value, else the controller's. */
export function isPublicRoute(handler: object, controller: object): boolean {
  const own: unknown = Reflect.getMetadata(PUBLIC_KEY, handler);
  return (own ?? Reflect.getMetadata(PUBLIC_KEY, controller)) === true;
}

/**
 * Declares `security` on every operation the default-deny AuthGuard protects,
 * derived from the same @Public metadata the guard reads, so a route cannot be
 * documented as anonymous while it demands a session, or the reverse.
 *
 * An operation that already declares its own `security` keeps it. An operation
 * the derivation cannot attribute to a controller method is an error, never a
 * silent skip: it would be left undocumented without anyone noticing.
 */
export function applyGuardSecurity(
  document: OpenAPIObject,
  controllers: readonly Type[],
  skip: ReadonlySet<string> = new Set(),
): void {
  const handlers = new Map<string, { handler: object; controller: Type }>();
  for (const controller of controllers) {
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      if (name === 'constructor') continue;
      const handler: unknown = (controller.prototype as Record<string, unknown>)[name];
      if (typeof handler === 'function') {
        handlers.set(`${controller.name}_${name}`, { handler, controller });
      }
    }
  }
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (!operation) continue;
      const route = handlers.get(operation.operationId ?? '');
      if (!route) throw new Error(`${method.toUpperCase()} ${path}: operationId ${operation.operationId} matches no controller method`);
      if (skip.has(route.controller.name) || operation.security) continue;
      if (!isPublicRoute(route.handler, route.controller)) {
        operation.security = GUARD_SECURITY.map((requirement) => ({ ...requirement }));
      }
    }
  }
}
