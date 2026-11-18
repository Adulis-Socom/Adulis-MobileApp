import type { Type } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { requiresSellerContext } from '../auth/auth.guard';
import { ERROR_CATALOGUE, type ErrorCode } from '../errors/error-catalogue';
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

/**
 * States, in words, what an operation's `x-adulis-*` gate extensions say, so a person reading the contract is told
 * the same thing as a client reading the extensions. Appended to the operation's own description.
 */
export function applyGateDescriptions(
  document: OpenAPIObject,
  controllers: readonly Type[],
  skip: ReadonlySet<string> = new Set(),
): void {
  for (const { operation } of operationRoutes(document, controllers, skip)) {
    const extensions = operation as unknown as Record<string, unknown>;
    const surfaces = extensions['x-adulis-surfaces'] as readonly string[] | undefined;
    if (!surfaces) continue;
    const permission = extensions['x-adulis-permission'] as readonly string[] | undefined;
    const consoleOnly = !surfaces.includes('MOBILE');
    const requires = permission
      ? `Requires ${permission.map((p) => `\`${p}\``).join(' and ')} in the Seller named by X-Adulis-Seller. `
      : '';
    const who = consoleOnly
      ? 'Console (cookie) sessions only: a mobile (bearer) session cannot perform it.'
      : 'A mobile (bearer) or a Console (cookie) session can hold it.';
    const sentence = requires + who;
    operation.description = operation.description ? `${operation.description}\n\n${sentence}` : sentence;
  }
}

/**
 * Operations whose response keys a client type test pins exactly (logout is `204 | default` in @adulis/api-client);
 * they keep the responses they declare. Keyed by the operation's verb and path, which a rename of the controller
 * or its method does not change; openapi-contract.spec.ts checks that each entry is still an operation of the
 * contract and still declares exactly what the type test pins.
 */
export const PINNED_RESPONSES: ReadonlySet<string> = new Set(['post /auth/logout']);

const problemResponse = (description: string) => ({ ...structuredClone(PROBLEM_RESPONSE), description });
const status = (code: ErrorCode): string => String(ERROR_CATALOGUE[code].status);

/**
 * Declares the refusals that the pipeline itself decides, with the code each one carries, so a client can tell them
 * from the failures the handler adds (those stay under `default`): the AuthGuard (401, 403, and 400 for the seller
 * header), the Origin check on a cookie write (403), the permission function for a route that states a permission
 * (403), the deletion ticket (401) and the idempotency key (400 missing, 409 reused). The status of each is the
 * catalogue's status of the code named, not a number written here. An operation keeps any response it declares.
 */
export function applyGuardErrors(
  document: OpenAPIObject,
  controllers: readonly Type[],
  skip: ReadonlySet<string> = new Set(),
): void {
  for (const { path, method, operation, handler, controller } of operationRoutes(document, controllers, skip)) {
    if (PINNED_RESPONSES.has(`${method} ${path}`)) continue;
    const parameters = operation.parameters ?? [];
    const requiredHeader = (name: string) =>
      parameters.some((p) => 'name' in p && p.in === 'header' && p.name.toLowerCase() === name && p.required === true);
    const ticket = JSON.stringify(operation.security) === JSON.stringify([{ deletionTicket: [] }]);
    const open = isPublicRoute(handler, controller);
    const write = method !== 'get';
    const extensions = operation as unknown as Record<string, unknown>;
    const surfaces = extensions['x-adulis-surfaces'] as readonly string[] | undefined;
    const add = (code: ErrorCode, description: string) => {
      operation.responses[status(code)] ??= problemResponse(description);
    };

    const keyed = requiredHeader('idempotency-key');
    const deviceIndex = parameters.findIndex((p) => 'name' in p && p.in === 'header' && p.name.toLowerCase() === 'x-adulis-device');
    const keyedByDevice = open && keyed && deviceIndex >= 0;

    const refused400: string[] = [];
    if (!open && requiredHeader('x-adulis-seller')) {
      refused400.push('X-Adulis-Seller is missing (SELLER_CONTEXT_REQUIRED) or is not a uuid (VALIDATION_FAILED).');
    }
    if (keyed) refused400.push('The Idempotency-Key header is missing (IDEMPOTENCY_KEY_MISSING).');
    if (keyedByDevice) {
      refused400.push(
        'When nobody is signed in, the caller must be identified by X-Adulis-Device (an app) or by its browser cookie; without either the answer is IDEMPOTENCY_KEY_MISSING naming X-Adulis-Device.',
      );
      // Optional for a signed-in caller and a browser, so never `required` in the schema: say when it is not.
      const device = parameters[deviceIndex] as { description?: string };
      parameters[deviceIndex] = {
        ...device,
        description: `${device.description ?? ''} Needed on this route when nobody is signed in and the caller is an app (see the 400 response).`.trim(),
      } as (typeof parameters)[number];
    }
    if (refused400.length > 0) {
      add(
        'VALIDATION_FAILED',
        `The request is refused with this status, for example when: ${refused400.join(' ')} Other refusals with this status carry their own code.`,
      );
    }

    if (ticket) {
      add('SESSION_EXPIRED', 'The ticket is missing, malformed, expired or not an account-deletion ticket (SESSION_EXPIRED).');
    } else {
      add(
        'SESSION_EXPIRED',
        open
          ? 'A credential was presented and its session is expired or revoked (SESSION_EXPIRED, SESSION_REVOKED); an anonymous request is not refused.'
          : 'No credential, or its session is expired or revoked (SESSION_EXPIRED, SESSION_REVOKED).',
      );
      const reasons = [
        `${open ? 'A credential was presented and is' : 'The credential is'} not the kind its session was issued for (AUDIENCE_NOT_PERMITTED): a mobile session uses the bearer token, a Console session the cookie.`,
      ];
      if (write) reasons.push('A cookie-carried write without the Console Origin header (PERMISSION_DENIED).');
      if (extensions['x-adulis-permission']) {
        reasons.push('A member of the Seller who lacks the permission, or holds it on another surface, is refused (PERMISSION_DENIED).');
      } else if (surfaces && !surfaces.includes('MOBILE')) {
        // Console-only by a check of the session audience in code, not by a permission.
        reasons.push('A session of another surface is refused (PERMISSION_DENIED).');
      }
      add('AUDIENCE_NOT_PERMITTED', reasons.join(' '));
    }

    if (keyed) {
      add(
        'IDEMPOTENCY_KEY_REUSED',
        'The Idempotency-Key was already used for a different request (IDEMPOTENCY_KEY_REUSED). A conflict the operation itself reports is also answered with this status and its own code: the code of the problem tells them apart.',
      );
    }
  }
}
