import type { SellerAccess } from '../contracts/gap-sc';
import { asTransportError, type Transport, type TransportError } from '../transport/port';
import { runScoped } from './scoped';

/**
 * An authorization answer is only ever valid for the account, the Seller and the navigation it was asked for.
 * `generation` names that triple; anything stamped with a different one is treated as if it had never arrived, so a
 * grant that was true for the previous screen cannot let the next screen mount or fetch while the new question is open.
 */
export type Outcome =
  | { readonly generation: string; readonly access: SellerAccess }
  | { readonly generation: string; readonly failure: TransportError };

export function generationOf(accountId: string, sellerId: string, path: string): string {
  return JSON.stringify([accountId, sellerId, path]);
}

export function grantFor(outcome: Outcome | null, generation: string): SellerAccess | null {
  return outcome && outcome.generation === generation && 'access' in outcome ? outcome.access : null;
}

export function failureFor(outcome: Outcome | null, generation: string): TransportError | null {
  return outcome && outcome.generation === generation && 'failure' in outcome ? outcome.failure : null;
}

/**
 * Ask the server what this account may do at this Seller. `live()` is false once the scope was torn down (another
 * Seller, sign-out, expiry, a newer navigation): a late answer, success or failure, is then dropped and cannot
 * restore a grant or undo an expiry. Fails closed: any failure is an outcome that carries no access.
 */
export function authorize(args: {
  transport: Transport;
  sellerId: string;
  generation: string;
  live: () => boolean;
  apply: (outcome: Outcome) => void;
  expire: () => void;
}): void {
  const { transport, sellerId, generation, live, apply, expire } = args;
  runScoped(transport, 'seller.access.get', sellerId, {})
    .then((access) => {
      if (live()) apply({ generation, access });
    })
    .catch((error: unknown) => {
      if (!live()) return;
      const failure = asTransportError(error);
      if (failure.code === 'AUTHENTICATION_REQUIRED') expire();
      else apply({ generation, failure });
    });
}
