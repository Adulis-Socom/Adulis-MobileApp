// Reserved-identifier refusal for the LIVE transport (GOV-06 S2). Identifier fields only: scanning every string would
// refuse a Buyer who types "fx_rate" into Search, so the fields come from OP_SPECS.refFields and free text is never listed.
import { OP_SPECS } from '../contracts/ops';
import type { MobileOpId } from '../contracts/gap-mob-session';

export const RESERVED_ID_PREFIX = 'fx_';

export function isReservedId(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(RESERVED_ID_PREFIX);
}

function pick(input: unknown, path: readonly string[]): unknown {
  let node: unknown = input;
  for (const part of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** True when any identifier field of the operation carries a reserved (fixture) identifier. */
export function carriesReservedId(op: MobileOpId, input: unknown): boolean {
  // A field may hold one identifier or a list of them (a batch read): either way, one reserved member refuses the call.
  return OP_SPECS[op].refFields.some((path) => {
    const value = pick(input, path);
    return Array.isArray(value) ? value.some(isReservedId) : isReservedId(value);
  });
}
