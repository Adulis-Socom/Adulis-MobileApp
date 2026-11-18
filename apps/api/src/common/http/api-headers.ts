import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

/**
 * Request headers that several controllers declare in the generated contract. Documentation only (swagger
 * metadata): what each header does is decided where the code reads it, and the contract specs hold the
 * declarations to that code.
 */

export const DEVICE_HEADER = {
  name: 'X-Adulis-Device',
  required: false,
  description: 'App clients: the registered device id. Browsers are identified by cookie instead.',
  schema: { type: 'string', format: 'uuid' },
} as const;

export const CLIENT_HEADER = {
  name: 'X-Adulis-Client',
  required: false,
  description: '<surface>/<version>, e.g. android/1.0.0 or web/1.0.0.',
} as const;

/**
 * The two headers that tell an anonymous or app request which device it speaks for (requestingDevice): the
 * Market of a request nobody is signed in on is the device's, and a keyed anonymous POST is keyed by the device.
 * Optional in the contract because a signed-in request, and a browser, do not need them.
 */
export const ApiDeviceHeaders = (): MethodDecorator => applyDecorators(ApiHeader(DEVICE_HEADER), ApiHeader(CLIENT_HEADER));

/**
 * `X-Adulis-Seller` on a route that is also a Buyer route: optional, because the Seller context only selects the
 * side the caller acts on. (On the /v1/seller routes the AuthGuard demands it and the generator declares it.)
 */
export const ApiOptionalSellerHeader = (description: string): MethodDecorator =>
  ApiHeader({ name: 'X-Adulis-Seller', required: false, description, schema: { type: 'string', format: 'uuid' } });
