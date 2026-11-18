import type { Type } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { requiresSellerContext } from '../auth/auth.guard';
import { PROBLEM_RESPONSE } from '../errors/problem.dto';
import { isPublicRoute, operationRoutes } from './openapi-security';

/**
 * Contract metadata that the runtime already decides and that a controller
 * therefore must not restate by hand. Each function reads the same facts the
 * request pipeline reads (the AuthGuard's seller-context rule, @Public) and
 * writes them into the generated document, so a route cannot be documented
 * differently from how it is served. Like applyGuardSecurity they run only in
 * the generator process; the running API never imports this file.
 */

/**
 * The Seller context header, in the exact form the Scene routes declare it by
 * hand. Required: the guard answers 400 without it on every route it selects.
 */
export const SELLER_HEADER = {
  name: 'X-Adulis-Seller',
  in: 'header',
  required: true,
  description: 'The Seller context (ADU-API-01 S4.2).',
  schema: { type: 'string', format: 'uuid' },
} as const;

/**
 * Declares `X-Adulis-Seller` (required) on every protected operation the
 * AuthGuard demands it on, as decided by its own `requiresSellerContext`. An
 * operation that already lists the header keeps its own declaration.
 */
export function applySellerHeader(
  document: OpenAPIObject,
  controllers: readonly Type[],
  skip: ReadonlySet<string> = new Set(),
): void {
  for (const { path, method, operation, handler, controller } of operationRoutes(document, controllers, skip)) {
    if (isPublicRoute(handler, controller) || !requiresSellerContext(`/v1${path}`, method.toUpperCase())) continue;
    const parameters = (operation.parameters ??= []);
    const declared = parameters.some((p) => 'name' in p && p.in === 'header' && p.name.toLowerCase() === 'x-adulis-seller');
    if (!declared) parameters.push({ ...SELLER_HEADER, schema: { ...SELLER_HEADER.schema } });
  }
}

/**
 * Every operation can answer with the problem envelope, whatever its handler
 * declares: gives each one that has no `default` response the problem response
 * the filter really sends. A `default` an operation declares itself is kept.
 */
export function applyProblemResponses(
  document: OpenAPIObject,
  controllers: readonly Type[],
  skip: ReadonlySet<string> = new Set(),
): void {
  for (const { operation } of operationRoutes(document, controllers, skip)) {
    operation.responses['default'] ??= structuredClone(PROBLEM_RESPONSE);
  }
}
