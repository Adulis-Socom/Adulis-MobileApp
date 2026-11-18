import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiExtension } from '@nestjs/swagger';

export type GateSurface = 'MOBILE' | 'CONSOLE';

export interface GateOptions {
  /**
   * Every one of these permissions is checked for the Seller named by X-Adulis-Seller
   * (core.fn_has_permission). Omitted where the route refuses a session by its audience in code instead.
   */
  permission?: readonly string[];
  /** The session surfaces the gate can admit: the surfaces all of the permissions are granted on. */
  surfaces: readonly GateSurface[];
}

/**
 * Declares, in the generated contract, what a route's authorization gate admits.
 *
 * `security` says how a caller authenticates: a bearer token (a MOBILE session) or the session cookie (a CONSOLE
 * session), and the AuthGuard accepts either. It does not say what the session may do, and a gate that no MOBILE
 * session can pass would make "bearer works" a false statement. So a gate whose surfaces exclude MOBILE narrows the
 * operation to the cookie, and the permission and surfaces are stated as extensions for clients that need them.
 *
 * Documentation only (swagger metadata): the gate itself is enforced where the code calls core.fn_has_permission
 * or checks the audience, and a spec holds this declaration to those checks and to the permission seed.
 */
export const ApiGate = ({ permission, surfaces }: GateOptions): MethodDecorator =>
  applyDecorators(
    ...(permission ? [ApiExtension('x-adulis-permission', [...permission])] : []),
    ApiExtension('x-adulis-surfaces', [...surfaces]),
    ...(surfaces.includes('MOBILE') ? [] : [ApiCookieAuth('cookie')]),
  );
