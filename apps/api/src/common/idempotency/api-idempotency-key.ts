import { ApiHeader } from '@nestjs/swagger';

/**
 * Declares the Idempotency-Key header of a route in the generated contract.
 *
 * Documentation only: the requirement itself is enforced where the route calls
 * HandlerTransaction.runIdempotent (or checks the key by hand), which answers
 * 400 IDEMPOTENCY_KEY_MISSING without one. Put it on exactly those routes, and
 * keep it identical to the header the older routes declare inline.
 */
export const ApiIdempotencyKey = (): MethodDecorator =>
  ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } });
