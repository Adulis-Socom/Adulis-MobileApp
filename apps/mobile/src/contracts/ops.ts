// The gap list as data (GOV-06 S2), in the spirit of the archived REAL_ADAPTER_GAPS: every operation is declared once, with
// its gap id, who may call it and how the fixture treats it. A Record over MobileOpId makes a missing entry a compile error.
// PROVISIONAL: not a final API contract.
import type { MobileOpId } from './gap-mob-session';

/** PUBLIC never carries the bearer; OPTIONAL_AUTH carries it when there is one; AUTHENTICATED needs one. */
export type OpAccess = 'PUBLIC' | 'OPTIONAL_AUTH' | 'AUTHENTICATED';
export interface OpSpec {
  readonly gap: 'GAP-L2-01';
  readonly access: OpAccess;
  /** Input paths that hold IDENTIFIERS (refused by the live guard when reserved). Free text is never listed. */
  readonly refFields: readonly (readonly string[])[];
  /** BLOCKED is the fixture's deny-list backstop. */
  readonly fixture: 'SERVED_READ' | 'SERVED_WRITE' | 'BLOCKED';
  /** The named work order that authorises a fixture write (GOV-06 S2 Writes). */
  readonly writeAuthorisedBy: string | null;
}

export const OP_SPECS: Readonly<Record<MobileOpId, OpSpec>> = {
  'device.register': { gap: 'GAP-L2-01', access: 'PUBLIC', refFields: [['deviceId']], fixture: 'SERVED_WRITE', writeAuthorisedBy: 'MOB-FE-01' },
  'bootstrap.get': { gap: 'GAP-L2-01', access: 'OPTIONAL_AUTH', refFields: [], fixture: 'SERVED_READ', writeAuthorisedBy: null },
  'session.requestCode': { gap: 'GAP-L2-01', access: 'PUBLIC', refFields: [], fixture: 'SERVED_WRITE', writeAuthorisedBy: 'MOB-FE-01' },
  'session.verifyCode': { gap: 'GAP-L2-01', access: 'PUBLIC', refFields: [['challengeRef']], fixture: 'SERVED_WRITE', writeAuthorisedBy: 'MOB-FE-01' },
  'session.signOut': { gap: 'GAP-L2-01', access: 'AUTHENTICATED', refFields: [], fixture: 'SERVED_WRITE', writeAuthorisedBy: 'MOB-FE-01' },
};
