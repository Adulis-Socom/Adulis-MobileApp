/**
 * PROVISIONAL fixture contract GAP-SC-20: Seller team, ownership transfer and Seller closure (SC-FE-11). NOT the API contract.
 * Sources: AUTH-02 v3.3 S58-S80, S85-S92, S113-S118 (Owner derived and never assignable; non-Owner role union; no zero-role ACTIVE membership;
 * one ACTIVE or SUSPENDED team slot per Account; invitations bind an EXISTING Account by username, resolved by the server); CONSOLE-02 v4.3
 * S17, S20-S21, S114-S118, S131; ONB-01 S180 (closure Owner-only, Console-only, step-up); PRV-01 S32-S33; RB25-D11 (debt-free MVP: no payment,
 * debt or collection condition on closure).
 *
 * Gaps carried, not filled: invitation states beyond PENDING and their expiry duration; a decline action; the ownership-transfer API and what
 * the former Owner keeps; closure states and any reopen window (the fixture records a request and processes nothing). Nothing here deletes.
 */
export type AssignableRole = 'ADMIN' | 'SALES_SUPPORT' | 'INVENTORY' | 'ANALYST' | 'CAMPAIGN_MANAGER';
export const ASSIGNABLE_ROLES: readonly AssignableRole[] = ['ADMIN', 'SALES_SUPPORT', 'INVENTORY', 'ANALYST', 'CAMPAIGN_MANAGER'];
export type MemberStanding = 'ACTIVE' | 'SUSPENDED';
export type MemberAction = 'CHANGE_ROLES' | 'SUSPEND' | 'REINSTATE' | 'REMOVE';

export interface TeamMember {
  readonly membership_id: string;
  readonly display_name: string;
  /** OWNER is derived from ownership and carries no assignable role (AUTH S58, S67). */
  readonly relationship: 'OWNER' | 'TEAM';
  readonly roles: readonly AssignableRole[];
  readonly standing: MemberStanding;
  readonly version: number;
  readonly is_you: boolean;
  readonly allowed_actions: readonly MemberAction[];
}

/** AUTH S129: another Seller learns only eligibility, never which Seller the person already works for. */
export type InviteEligibility = 'ELIGIBLE' | 'IN_ANOTHER_TEAM';
export interface TeamInvitation {
  readonly invitation_id: string;
  readonly target_label: string;
  readonly roles: readonly AssignableRole[];
  readonly state: 'PENDING';
  readonly created_at: string;
  readonly eligibility: InviteEligibility;
}

export interface TeamSession {
  readonly session_id: string;
  readonly member_label: string;
  readonly device_label: string;
  readonly last_used_at: string;
}

export interface OwnershipTransfer {
  readonly state: 'PENDING';
  readonly target_label: string;
  /** False when the recipient is no longer an active Admin (or no longer on the team): the transfer cannot complete and stays cancellable (FE12-06). */
  readonly target_eligible: boolean;
  readonly requested_at: string;
  /** The 24-hour delay of CONSOLE S117, set by the server. */
  readonly activates_at: string;
}

export type TeamAction = 'INVITE' | 'TRANSFER_OWNERSHIP' | 'REVOKE_SESSIONS';
export interface TeamView {
  readonly seller_id: string;
  readonly members: readonly TeamMember[];
  readonly invitations: readonly TeamInvitation[];
  /** Null without seller.sessions:read: the section is absent, not empty. */
  readonly sessions: readonly TeamSession[] | null;
  readonly transfer: OwnershipTransfer | null;
  readonly allowed_actions: readonly TeamAction[];
}

export type ClosureState = 'OPEN' | 'CLOSURE_REQUESTED';
export interface ClosureView {
  readonly seller_id: string;
  readonly seller_name: string;
  readonly state: ClosureState;
  readonly requested_at: string | null;
  /** What closing does, as codes the Console words (PRV S32). */
  readonly consequences: readonly string[];
  /** What prevents closing now. Never a payment or debt (RB25-D11). */
  readonly blockers: readonly string[];
  readonly allowed_actions: readonly ('REQUEST' | 'CANCEL')[];
}

export interface TeamOperations {
  readonly 'team.get': { in: Record<string, never>; out: TeamView };
  /** Idempotent. Binds the EXISTING Account the server resolves from the username (no phone, no unregistered recruit). */
  readonly 'team.invite': { in: { username: string; roles: readonly AssignableRole[] }; out: TeamView };
  readonly 'team.invitation.withdraw': { in: { invitation_id: string }; out: TeamView };
  /** The complete desired non-Owner role set, at least one role, version-checked (AUTH S69, S116). */
  readonly 'team.roles.set': { in: { membership_id: string; version: number; roles: readonly AssignableRole[] }; out: TeamView };
  readonly 'team.member.suspend': { in: { membership_id: string; version: number }; out: TeamView };
  readonly 'team.member.reinstate': { in: { membership_id: string; version: number }; out: TeamView };
  readonly 'team.member.remove': { in: { membership_id: string; version: number }; out: TeamView };
  readonly 'team.session.revoke': { in: { session_id: string }; out: TeamView };
  /** Owner only, to an ACTIVE Admin, with a one-use step-up grant for this purpose and this Seller. */
  readonly 'ownership.transfer.start': { in: { membership_id: string; step_up_grant: string }; out: TeamView };
  readonly 'ownership.transfer.cancel': { in: Record<string, never>; out: TeamView };
  readonly 'seller.closure.get': { in: Record<string, never>; out: ClosureView };
  /** Owner only, step-up, and the Seller's name typed exactly. Records the request; nothing is unpublished or deleted by the fixture. */
  readonly 'seller.closure.request': { in: { step_up_grant: string; typed_name: string }; out: ClosureView };
  readonly 'seller.closure.cancel': { in: Record<string, never>; out: ClosureView };
}
