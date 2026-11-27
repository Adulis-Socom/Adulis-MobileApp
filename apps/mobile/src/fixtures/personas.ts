// DEVELOPMENT ONLY. Deterministic personas: disjoint tenants (at least two Accounts with unrelated data), approved and revoked
// relationships, and the failure scenarios the app must survive. Phone numbers and the code are demonstration values with no
// meaning outside this module; the sign-in UI must not mask or limit input to their shape (it would leak auth policy).
import { FIXTURE_DEMO_CODE, FIXTURE_DEMO_PHONE, FIXTURE_IDS } from './ids';

export type Scenario = 'NONE' | 'SESSION_EXPIRES' | 'SESSION_REVOKED' | 'NETWORK_DOWN' | 'OPERATOR_ONLY';

export interface Persona {
  readonly key: string;
  readonly accountId: string;
  readonly phone: string;
  readonly code: string;
  readonly scenario: Scenario;
  /** The wire shape the server would send for the gated modes. Anything absent is "no such relationship". */
  readonly modes: Readonly<Record<string, unknown>>;
}

const none = { status: 'NOT_ELIGIBLE' } as const;

export const PERSONAS: readonly Persona[] = [
  // Approved Seller relationship (the same Account, no second sign-in): Seller Companion AVAILABLE, no Courier relationship.
  { key: 'owner', accountId: FIXTURE_IDS.account, phone: FIXTURE_DEMO_PHONE, code: FIXTURE_DEMO_CODE, scenario: 'NONE', modes: { SELLER_COMPANION: { status: 'AVAILABLE' }, COURIER: none } },
  // A second, unrelated tenant: a Courier invitation awaiting acceptance.
  { key: 'second', accountId: 'fx_acct_demo_second', phone: '+251900000002', code: FIXTURE_DEMO_CODE, scenario: 'NONE', modes: { SELLER_COMPANION: none, COURIER: { status: 'PENDING', message: { key: 'mobile.mode.pending' } } } },
  // A Seller relationship that existed and ended.
  { key: 'revoked', accountId: 'fx_acct_demo_revoked', phone: '+251900000003', code: FIXTURE_DEMO_CODE, scenario: 'NONE', modes: { SELLER_COMPANION: { status: 'REVOKED' }, COURIER: none } },
  // A Seller relationship that is present but blocked, with the server's reason.
  { key: 'restricted', accountId: 'fx_acct_demo_restricted', phone: '+251900000004', code: FIXTURE_DEMO_CODE, scenario: 'NONE', modes: { SELLER_COMPANION: { status: 'RESTRICTED', message: { key: 'mobile.mode.restricted' } }, COURIER: none } },
  // Signs in, then the server says the session has expired / was revoked on the next authenticated request.
  { key: 'expired', accountId: 'fx_acct_demo_expired', phone: '+251900000005', code: FIXTURE_DEMO_CODE, scenario: 'SESSION_EXPIRES', modes: {} },
  { key: 'sessionrevoked', accountId: 'fx_acct_demo_sessionrevoked', phone: '+251900000006', code: FIXTURE_DEMO_CODE, scenario: 'SESSION_REVOKED', modes: {} },
  // Signs in, then every authenticated bootstrap fails with a network error.
  { key: 'offline', accountId: 'fx_acct_demo_offline', phone: '+251900000007', code: FIXTURE_DEMO_CODE, scenario: 'NETWORK_DOWN', modes: {} },
  // An Operator identifier typed into ordinary sign-in: the response is not an ordinary MOBILE principal, and the app refuses it.
  { key: 'operator', accountId: 'fx_acct_demo_operator', phone: '+251900000099', code: FIXTURE_DEMO_CODE, scenario: 'OPERATOR_ONLY', modes: {} },
];
