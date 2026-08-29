/**
 * ADU-CON-02 v3.0 section 9 — the typed catalogue.
 *
 * en.ts DEFINES THE KEY UNION. am.ts is `Record<MessageKey, string>`, so a
 * missing Amharic string is a COMPILE ERROR, not a runtime fallback to English.
 *
 * Two rules that are easy to get wrong and expensive to undo:
 *
 * 1. WHOLE SENTENCES WITH NAMED SLOTS, NEVER FRAGMENTS. Word order differs
 *    between English and Amharic, so a sentence assembled from concatenated
 *    fragments cannot be translated correctly — it can only be translated
 *    into English word order.
 *
 * 2. NO FORMATTING IN THE CATALOGUE. All dates, numbers and currency are
 *    formatted client-side with Intl against the market timezone from
 *    /bootstrap. The wire carries {amount_minor, currency} and RFC 3339 UTC
 *    only.
 *
 * TIER 0 — a five-key starter set. The real catalogue grows one entry per
 * screen, and ADU-CON-02 section 14.5 makes both locale entries part of the
 * definition of done for every PR.
 */
export const en = {
  'app.title': 'Adulis Seller Console',
  'health.ok': 'All systems operating normally.',
  'health.degraded': 'Some systems are unavailable. We are looking into it.',
  'common.retry': 'Try again',
  'common.signOut': 'Sign out',

  // ---------------------------------------------------------------------
  // The error catalogue (ADU-API-01 v1.6 sections 7.1-7.3). Keys are
  // DERIVED: error.<group>.<code lower> - the server sends the key, the
  // client renders from here. ops/scripts/verify-error-locale.mjs holds
  // this file and am.ts complete against the API's closed taxonomy, so a
  // new code cannot ship without both strings - which is friction, and
  // the point (7.3). Whole sentences, named slots, no fragments.
  // ---------------------------------------------------------------------
  // auth
  'error.auth.otp_invalid': 'The code you entered is not correct.',
  'error.auth.otp_expired': 'This code is no longer valid. Check your messages for a newer code, or request a new one.',
  'error.auth.otp_attempts_exceeded': 'Too many attempts. Request a new code.',
  'error.auth.otp_purpose_not_permitted': 'This code cannot be used for that action.',
  'error.auth.session_expired': 'Your session has ended. Sign in again.',
  'error.auth.session_revoked': 'This session has been signed out.',
  'error.auth.audience_not_permitted': 'This app cannot perform that action.',
  'error.auth.recovery_required': 'Account recovery is required before signing in.',
  // step_up
  'error.step_up.step_up_required': 'Confirm this action with a fresh verification code.',
  'error.step_up.step_up_expired': 'The verification expired. Confirm again.',
  'error.step_up.step_up_action_mismatch': 'This verification was issued for a different action.',
  // rbac
  'error.rbac.permission_denied': 'You do not have permission to do this.',
  'error.rbac.owner_only': 'Only the store owner can do this.',
  // cart
  'error.cart.cart_empty': 'Your cart is empty.',
  'error.cart.cart_seller_conflict': 'Your cart holds items from another store. One order is for one store.',
  'error.cart.cart_revalidation_failed': 'Some items in your cart changed. Review them before ordering.',
  // cart_line
  'error.cart_line.insufficient_stock': 'Only {available} left. You asked for {requested}.',
  'error.cart_line.sold_out': 'This item has sold out.',
  'error.cart_line.price_changed': 'The price has changed.',
  'error.cart_line.no_longer_published': 'This item is no longer listed.',
  'error.cart_line.variant_withdrawn': 'This option is no longer available.',
  'error.cart_line.seller_unavailable': 'This store is not taking orders right now.',
  'error.cart_line.transaction_cap_exceeded': 'This order is above the store\'s current order limit.',
  // order
  'error.order.illegal_transition': 'This order cannot move from {from_state} to {to_state}.',
  'error.order.order_not_payable': 'This order is not awaiting payment.',
  'error.order.order_already_terminal': 'This order has already ended.',
  'error.order.duplicate_reservation': 'You already hold a reservation for this item.',
  'error.order.buyer_cooldown_active': 'Ordering is paused until {until}.',
  'error.order.order_not_readyable': 'This order is not ready to be marked. Payment must be confirmed first.',
  // payment
  'error.payment.evidence_required': 'A payment screenshot is required.',
  'error.payment.evidence_too_large': 'The file is too large. The limit is {max_bytes} bytes.',
  'error.payment.payment_already_decided': 'This payment has already been decided.',
  'error.payment.not_order_buyer': 'Order not found.',
  // handoff
  'error.handoff.scan_signature_invalid': 'This scan could not be verified.',
  'error.handoff.scan_predates_token': 'This scan is older than its code.',
  'error.handoff.scan_not_order_buyer': 'Order not found.',
  'error.handoff.courier_cannot_scan': 'Only the buyer can scan to complete a handoff.',
  // seller
  'error.seller.publication_blocked': 'This product cannot be published yet. Review the remaining steps.',
  'error.seller.eligibility_not_satisfied': 'Your account does not yet meet the requirements.',
  'error.seller.tier_limit_reached': 'Your current plan does not include this.',
  'error.seller.level_limit_reached': 'Your store level does not include this yet.',
  'error.seller.handle_taken': 'That store address is taken.',
  'error.seller.fulfilment_method_required': 'Add at least one way buyers receive their goods.',
  'error.seller.product_has_active_orders': 'This product has live orders and cannot be deleted.',
  'error.seller.variant_has_active_orders': 'This option has live orders and cannot be deleted.',
  // payout
  'error.payout.payout_locked_recovery': 'Payout changes are locked until {until} after account recovery.',
  'error.payout.payout_change_pending': 'A payout change is already pending.',
  'error.payout.payout_permission_denied': 'You do not have permission to change payout details.',
  // deletion
  'error.deletion.deletion_blocked': 'Deletion is blocked while obligations remain. Review the list.',
  'error.deletion.deletion_owner_only': 'Only the owner can delete this store.',
  // request
  'error.request.validation_failed': 'The request is not valid.',
  'error.request.idempotency_key_missing': 'The request is missing its retry key.',
  'error.request.idempotency_key_reused': 'This retry key was already used for a different request.',
  'error.request.rate_limited': 'Too many requests. Try again in {retry_after_seconds} seconds.',
  'error.request.client_upgrade_required': 'Update the app to continue.',
  'error.request.payload_too_large': 'The request is too large.',
  'error.request.seller_context_required': 'No store was named for this request.',
  'error.request.scope_parameter_required': 'Say whether this request is as buyer or as seller.',
  'error.request.not_found': 'Not found.',
  'error.request.gone': 'This page is gone.',
  'error.request.internal': 'Something went wrong on our side. Try again.',

  // ---------------------------------------------------------------------
  // SMS templates (ADU-AUTH-01 section 4.4). A sign-in code names no
  // action; a step-up code names the action - the second half is the
  // security control: a seller who receives a payout-change code they did
  // not request has been told someone is inside their account.
  // ---------------------------------------------------------------------
  'sms.otp.sign_in': '{code} is your Adulis code.',
  'sms.otp.account_deletion': '{code} - confirm deleting your Adulis account.',
  'sms.otp.step_up.payout_change': '{code} - confirm changing your Adulis payout account.',
  'sms.otp.step_up.reissue_instructions': '{code} - confirm reissuing payment instructions.',
  'sms.otp.step_up.team_change': '{code} - confirm changing your Adulis team.',
  'sms.otp.step_up.subscription_change': '{code} - confirm changing your Adulis subscription.',
  'sms.otp.step_up.seller_deletion': '{code} - confirm deleting your Adulis store.',
  'sms.otp.step_up.revoke_all_sessions': '{code} - confirm signing out your other Adulis sessions.',
  'sms.otp.step_up.identity_change': '{code} - confirm changing your Adulis identity details.',
  'sms.otp.step_up.ownership_transfer': '{code} - confirm transferring your Adulis store.',

  // Deletion blockers and effects (S16.9; ADU-WEB-01 S6.2) - the server
  // sends keys, the client renders sentences.
  'deletion.blocker.non_terminal_reservations': 'Open reservations must be fulfilled or cancelled first.',
  'deletion.blocker.evidence_awaiting_confirmation': 'Submitted payments must be confirmed or rejected first.',
  'deletion.blocker.orders_awaiting_handoff': 'Confirmed orders must be handed off or refunded first.',
  'deletion.blocker.refunds_unresolved': 'Refunds must be reported and acknowledged first.',
  'deletion.blocker.open_claims': 'Open claims must be resolved first.',
  'deletion.blocker.subscription_past_due': 'The outstanding subscription balance must be settled first.',
  'deletion.blocker.buyer_orders_in_payment': 'Orders with payment in progress must settle first.',

  // G1.6 — ownership transfer. Item keys, not catalogue keys: the
  // `error.<group>.<code>` namespace is derived from the closed taxonomy.
  'ownership_transfer.no_eligible_admin':
    'The new owner must already be an Admin on this store. Invite them and make them an Admin first.',
  'ownership_transfer.blocker.payout_change_pending':
    'A payout change is pending. Wait for it to activate, or cancel it first.',
  'ownership_transfer.blocker.open_claims': 'Open claims must be resolved first.',

  'deletion.effect.identity_scrubbed': 'Your identity details are removed.',
  'deletion.effect.records_anonymised': 'Transaction records are kept without your name.',
  'deletion.effect.reviews_anonymised_not_deleted': 'Reviews remain, attributed to no one.',
  'deletion.effect.verification_retained': 'The verification record is retained.',
  'deletion.effect.reservations_released': 'Active reservations are released.',

  // Chat (C7) - the escalation is the one bot utterance with no intent
  // behind it, so it lives here rather than in nlu.answer_template.
  'chat.bot.escalated': 'Your question has been passed to the seller. They will reply here.',
  'notification.chat.escalated': 'A buyer question needs your reply.',

  // ---- Seller console (T7 Phase 5, stages C-1/C-2) ----------------------
  // Whole sentences with named slots, never fragments (S4.5). Every key
  // lands in am.ts in the same change or the build fails -- which is the
  // design (root CLAUDE.md, the three seams).
  'console.a11y.skip_to_content': 'Skip to content',
  'console.a11y.primary_nav': 'Primary',
  'console.nav.home': 'Home',
  'console.nav.orders': 'Orders',
  'console.nav.products': 'Products',
  'console.nav.inbox': 'Inbox',
  'console.nav.more': 'More',
  'console.shell.store': 'Your store',
  'console.shell.notifications': 'Notifications',
  'console.shell.account': 'Account',
  'console.shell.signed_in': 'Signed in',
  'console.signin.phone_label': 'Phone number',
  'console.signin.phone_invalid': 'Enter your phone number with the country code, like +251911234567.',
  'console.signin.remember_label': 'Remember this device',
  'console.signin.remember_help': 'This device stays signed in for a week; anything touching money still asks for a code.',
  'console.signin.request_button': 'Send me a code',
  'console.signin.code_label': 'Code',
  'console.signin.code_help': 'Enter the 6-digit code sent to {phone}. Requesting a new code invalidates this one.',
  'console.signin.code_invalid': 'The code is 6 digits.',
  'console.signin.verify_button': 'Sign in',
  'console.signin.resend_button': 'Resend the code',
  'console.signin.resend_countdown': 'Resend available in {seconds} seconds.',
  'console.signin.change_number': 'Change number',
  'console.signin.help_link': 'Trouble signing in?',
  'console.signin.rate_limited': 'Too many attempts. You can try again in {seconds} seconds.',
  'console.stepup.code_label': 'Code',
  'console.stepup.verify_button': 'Confirm',
  'console.stepup.cancel_button': 'Cancel',
  'console.stepup.prompt.payout_change': 'Enter the code to change your payout account.',
  'console.stepup.prompt.reissue_instructions': 'Enter the code to reissue payment instructions for this order.',
  'console.stepup.prompt.team_change': 'Enter the code to change your team.',
  'console.stepup.prompt.subscription_change': 'Enter the code to change your subscription.',
  'console.stepup.prompt.seller_deletion': 'Enter the code to delete this store.',
  'console.stepup.prompt.revoke_all_sessions': 'Enter the code to sign out every other session.',
  'console.stepup.prompt.identity_change': 'Enter the code to change identity details.',
  'console.stepup.prompt.ownership_transfer': 'Enter the code to transfer ownership of this store.',
  'console.idle.warning': 'You will be signed out at {time} unless you continue.',
  'console.idle.continue': 'Stay signed in',
  'console.validation.summary': 'Fix the following before continuing:',
  'console.error.request_id': 'If you contact support, quote this request id:',
  'console.states.empty_default': 'Nothing here yet.',
  'console.states.stale': 'Updating\u2026',
  'console.states.blocked_default': 'One setup step is missing. Complete it to continue.',
  'console.states.entitlement_control': 'Not included in your plan',
  'console.states.entitlement_unlock': 'Available on a higher tier.',
  'console.states.terminal': 'This item has ended. The history below is read-only.',
  'console.states.upgrade': 'A new version of the console is required.',
  'console.states.upgrade_reload': 'Reload',
  'console.chooser.title': 'Choose a store',
  'console.chooser.gap': 'The contract has no endpoint listing your stores yet (register D-97), so paste the store id you were given.',
  'console.chooser.id_label': 'Store id',
  'console.chooser.open_button': 'Open store',
  'console.demo.title': 'The twelve screen states',
  'console.demo.hint': 'Every screen in this console renders through one of these states, and only these. Pick one to see it.',
  'console.demo.ready_content': 'This is READY: the screen itself.',
  'console.placeholder': 'Screen {screen} is not built yet. It arrives with its build stage.',
} as const;

/** The key union. Every other locale must satisfy exactly this set. */
export type MessageKey = keyof typeof en;

export type Catalogue = Record<MessageKey, string>;
