/**
 * PROVISIONAL fixture contract GAP-SC-21: account-level security, preferences, invitations and privacy (SC-FE-11). NOT the API contract.
 * These operations belong to the signed-in Account, not to a Seller: they carry no Seller id.
 * Sources: AUTH-02 v3.3 S31-S52, S118-S119, S140 (opaque sessions; self-service session list and revocation; purpose-bound, one-use step-up);
 * CONSOLE-02 v4.3 S20-S21, S118-S121, S132; NOTIF-01 S45 (security notices are not suppressible); PRV-01 v3.3 S27-S31, S47-S48, S55, S57, S71
 * (request lifecycle; deletion is destructive and needs fresh proof; the grace period is OPEN pending legal review); RB25-D11 (deletion never
 * depends on an unavailable payment mechanism). No Government ID is asked for anywhere (ONB 24 November amendment).
 *
 * Durations are the server's: step-up and session lifetimes and the deletion grace period are not defined, so none is shown as a number.
 */
export type StepUpPurpose = 'TRANSFER_OWNERSHIP' | 'CLOSE_SELLER' | 'REVOKE_OTHER_SESSIONS' | 'EXPORT_DATA' | 'DELETE_ACCOUNT';
export interface StepUpChallenge {
  readonly challenge_id: string;
  readonly purpose: StepUpPurpose;
  /** What is being authorized, named by the server ("Alem Textiles", "your account"), so the person knows exactly what the code is for. */
  readonly target_label: string;
  /** TRANSFER_OWNERSHIP only: the one recipient this code authorizes, named by the server (FE12-03). Null for every other purpose. */
  readonly recipient_label: string | null;
  readonly expires_at: string;
}

export interface AccountSession {
  readonly session_id: string;
  readonly current: boolean;
  readonly audience: 'CONSOLE' | 'MOBILE';
  readonly device_label: string;
  readonly last_used_at: string;
  readonly approx_location: string | null;
}
export interface SessionsView {
  readonly sessions: readonly AccountSession[];
}

export interface SecurityView {
  readonly phone_masked: string;
  readonly username: string;
}

export interface PreferenceCategory {
  readonly code: string;
  readonly enabled: boolean;
  /** False for security notices: they cannot be turned off (CONSOLE S120, NOTIF S45). */
  readonly suppressible: boolean;
}
export interface PreferencesView {
  /** The category list is not defined by the designs: these are provisional demonstration categories. */
  readonly provisional: true;
  readonly categories: readonly PreferenceCategory[];
}

export interface MyInvitation {
  readonly invitation_id: string;
  readonly seller_label: string;
  readonly roles: readonly string[];
  /**
   * Null when it can be accepted now; SLOT_OCCUPIED while another team membership holds the one slot (AUTH S59, S146); SELLER_UNAVAILABLE
   * while the Seller cannot take new members (suspended, or closure requested). Acceptance re-checks all of it on the server (FE12-05).
   */
  readonly blocked: 'SLOT_OCCUPIED' | 'SELLER_UNAVAILABLE' | null;
}
export interface MyInvitationsView {
  readonly items: readonly MyInvitation[];
}

/** PRV S29 vocabulary, the subset this release can reach. COMPLETED is never served: nothing is deleted in this release. */
export type DeletionState = 'NONE' | 'WAITING_BLOCKER' | 'WAITING_HOLD' | 'CANCELLED';
export interface PrivacyView {
  readonly export_state: 'NONE' | 'PREPARING';
  readonly deletion: {
    readonly state: DeletionState;
    readonly requested_at: string | null;
    /** WAITING_HOLD: why processing waits (POLICY_NOT_APPROVED: the grace period still needs legal review, PRV S71). */
    readonly hold_reason: string | null;
    readonly consequences: readonly string[];
    readonly retained: readonly string[];
    readonly blockers: readonly { readonly code: string; readonly count: number }[];
    readonly can_cancel: boolean;
  };
}

export interface AccountOperations {
  /** TRANSFER_OWNERSHIP must name the recipient membership; no other purpose may (FE12-03). */
  readonly 'account.stepup.start': { in: { purpose: StepUpPurpose; seller_id: string | null; recipient_membership_id?: string }; out: StepUpChallenge };
  /** A correct code returns a short-lived grant usable ONCE, for this purpose and target only (AUTH S45-S48; FE12-02). */
  readonly 'account.stepup.verify': { in: { challenge_id: string; code: string }; out: { grant: string } };
  readonly 'account.sessions.get': { in: Record<string, never>; out: SessionsView };
  readonly 'account.sessions.revoke': { in: { session_id: string }; out: SessionsView };
  readonly 'account.sessions.revoke_others': { in: { step_up_grant: string }; out: SessionsView };
  readonly 'account.security.get': { in: Record<string, never>; out: SecurityView };
  readonly 'account.preferences.get': { in: Record<string, never>; out: PreferencesView };
  readonly 'account.preferences.set': { in: { code: string; enabled: boolean }; out: PreferencesView };
  readonly 'account.invitations.get': { in: Record<string, never>; out: MyInvitationsView };
  readonly 'account.invitations.accept': { in: { invitation_id: string }; out: MyInvitationsView };
  readonly 'privacy.get': { in: Record<string, never>; out: PrivacyView };
  readonly 'privacy.export.request': { in: { step_up_grant: string }; out: PrivacyView };
  /** Fresh proof, the consequences seen, and the word DELETE typed. Records a request; nothing is deleted in this release. */
  readonly 'privacy.deletion.request': { in: { step_up_grant: string; typed_confirmation: string }; out: PrivacyView };
  readonly 'privacy.deletion.cancel': { in: Record<string, never>; out: PrivacyView };
}
