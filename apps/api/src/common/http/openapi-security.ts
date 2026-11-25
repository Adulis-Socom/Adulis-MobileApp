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
 * What a @Public route accepts: no credential at all, or either credential. The
 * guard still authenticates a presented credential on a public route and
 * refuses a dead one, so the credential is optional but never ignored.
 * `{}` is OpenAPI's way to say an anonymous request satisfies the operation.
 */
export const OPTIONAL_SECURITY: readonly Record<string, string[]>[] = [{}, { cookie: [] }, { bearer: [] }];

/**
 * Controllers whose operations keep the metadata they declare today. The
 * legacy commerce routes are left exactly as documented until their contract
 * is corrected on its own; every other controller, including one added later,
 * is covered by the derivation.
 */
export const LEGACY_COMMERCE_CONTROLLERS: ReadonlySet<string> = new Set([
  'BillingController',
  'CouriersController',
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

type HttpMethod = (typeof HTTP_METHODS)[number];
export type OperationObject = NonNullable<OpenAPIObject['paths'][string]['get']>;

export interface OperationRoute {
  /** The key in `document.paths` (before the /v1 prefix the generator adds). */
  path: string;
  method: HttpMethod;
  operation: OperationObject;
  handler: object;
  controller: Type;
}

/**
 * Every operation of the document with the controller method that produces it.
 * An operation the derivation cannot attribute to a controller method is an
 * error, never a silent skip: it would be left undocumented without anyone
 * noticing. Controllers named in `skip` are left out of the result.
 */
export function operationRoutes(
  document: OpenAPIObject,
  controllers: readonly Type[],
  skip: ReadonlySet<string> = new Set(),
): OperationRoute[] {
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
  const routes: OperationRoute[] = [];
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (!operation) continue;
      const route = handlers.get(operation.operationId ?? '');
      if (!route) throw new Error(`${method.toUpperCase()} ${path}: operationId ${operation.operationId} matches no controller method`);
      if (!skip.has(route.controller.name)) routes.push({ path, method, operation, ...route });
    }
  }
  return routes;
}

/**
 * Declares `security` on every operation, derived from the same @Public
 * metadata the AuthGuard reads, so a route cannot be documented as anonymous
 * while it demands a session, or the reverse: a protected route takes either
 * credential, a public one takes either or none.
 *
 * An operation that already declares its own `security` keeps it.
 */
export function applyGuardSecurity(
  document: OpenAPIObject,
  controllers: readonly Type[],
  skip: ReadonlySet<string> = new Set(),
): void {
  for (const { operation, handler, controller } of operationRoutes(document, controllers, skip)) {
    if (operation.security) continue;
    const requirements = isPublicRoute(handler, controller) ? OPTIONAL_SECURITY : GUARD_SECURITY;
    operation.security = requirements.map((requirement) => ({ ...requirement }));
  }
}
