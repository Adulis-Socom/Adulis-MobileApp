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
 *
 * SPLIT BY AUDIENCE (WO-001A, founder decision D2): THIS FILE holds the SHARED
 * strings - safe for every client, and the whole of `@adulis/locale/mobile`. NEVER
 * add software-subscription copy here (plans, tiers sold as upgrades, pricing,
 * billing periods, how to pay, Adulis subscription instructions): it goes in
 * en.console.ts, which must never reach a mobile bundle (ADU-PRD-01 S3, ADU-API-01
 * S4.1). Marketplace commerce copy - prices, order payment, store levels - is fine
 * here. catalogue.ts composes both parts into the full catalogue the root export
 * serves. Held by test/mobile.test-d.ts and test/mobile-boundary.mjs.
 */
export const enCommon = {
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
  'error.auth.age_declaration_required': 'To create an account, please confirm that you are over 18.',
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
  'error.seller.level_limit_reached': 'Your store level does not include this yet.',
  'error.seller.handle_taken': 'That store address is taken.',
  'error.seller.fulfilment_method_required': 'Add at least one way buyers receive their goods.',
  'error.seller.product_has_active_orders': 'This product has live orders and cannot be deleted.',
  'error.seller.variant_has_active_orders': 'This option has live orders and cannot be deleted.',
  // payout -- ONE cause-neutral code (ADU-API-01 v1.9 S15.0c / D-224.6); the
  // cause is a `reason` slot (RECOVERY_COOLING | NEW_DEVICE | NO_TIMING_CONFIG)
  // and only the sentence differs, so it is the locale's job, not a second
  // code. The generic key is the taxonomy fallback; the console renders the
  // reason-specific line -- the same line SC-24's proactive panel draws from
  // GET /v1/seller/payout's reason. The former PAYOUT_LOCKED_RECOVERY said
  // "after account recovery" even on a new-device lock.
  'error.payout.payout_locked': 'Payout changes are locked right now.',
  'error.payout.payout_locked_recovery_cooling':
    'Payout changes are locked for seven days after an account recovery.',
  'error.payout.payout_locked_new_device':
    'Payout changes are locked for twenty-four hours after a sign-in from a device we have not seen. If that was not you, review your active sessions.',
  'error.payout.payout_locked_no_timing_config': 'Payout changes are temporarily unavailable.',
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
  // Obligations (ADU-API-01 v1.10 S12.12b). The server sends the KIND and a
  // consequence_key derived from it (S7.2-style); the console renders these
  // sentences and composes nothing. The consequence is what makes Home teach
  // rather than nag -- and every sentence below states what the DATABASE
  // actually does, not what a spec table hoped (D-235): the payment lapse is
  // fn_confirmation_window_lapse verbatim; the claim deadline is the
  // operator's review horizon; nothing expires an unready confirmed order,
  // so that sentence names the claim exposure instead.
  // ---------------------------------------------------------------------
  'obligation.payment_awaiting_confirmation.title': 'A payment is waiting for your confirmation',
  'obligation.payment_awaiting_confirmation.consequence':
    'Confirm or reject before the deadline, or a claim opens against you automatically and the missed window is shown on your public store page.',
  'obligation.payment_awaiting_confirmation.consequence_lapsed':
    'The window was missed: a claim has opened and the miss is shown on your public store page. The payment still needs your decision.',
  'obligation.claim_awaiting_seller.title': 'A claim is waiting for your response',
  'obligation.claim_awaiting_seller.consequence':
    'After the deadline the claim can be decided without your side of it.',
  'obligation.order_not_ready.title': 'A paid order is not marked ready',
  'obligation.order_not_ready.consequence':
    'The buyer has already paid and is waiting. An order left unready invites a goods-not-received claim.',

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

  'common.loading': 'Loading',

  // Buyer shell (WO-002; ADU-MOB-02 v4.3 S11). Structure only: every "coming
  // update" line stands where a domain arrives later, and never claims the
  // Buyer has nothing (no "You have no orders" before Orders can be read).
  'buyer.wordmark': 'Adulis',
  'buyer.tab.home': 'Home',
  'buyer.tab.shop': 'Shop',
  'buyer.tab.saved': 'Saved',
  'buyer.tab.orders': 'Orders',
  'buyer.tab.you': 'You',
  'buyer.home.channels': 'Home channels',
  'buyer.home.channel.for_you': 'For You',
  'buyer.home.channel.following': 'Following',
  'buyer.home.channel.nearby': 'Nearby',
  'buyer.home.channel.discounts': 'Discounts',
  // Market-configured wording later (MOB-02 S11); this is the default label.
  'buyer.home.channel.locally_made': 'Locally Made',
  'buyer.home.for_you.coming': 'Scenes from Sellers will appear here in a coming update.',
  'buyer.home.following.coming': 'Scenes from Sellers you follow will appear here in a coming update.',
  'buyer.home.nearby.coming': 'Discovery near you will appear here in a coming update.',
  'buyer.home.discounts.coming': 'Current offers will appear here in a coming update.',
  'buyer.home.locally_made.coming': 'Locally made Products will appear here in a coming update.',
  'buyer.search': 'Search',
  'buyer.search.coming': 'Search for Products, Sellers and Scenes arrives in a coming update.',
  'buyer.notifications': 'Notifications',
  'buyer.notifications.coming': 'Your notifications will appear here in a coming update.',
  'buyer.notifications.signed_out': 'Sign in to see notifications.',
  'buyer.shop.coming': 'Shopping by category arrives in a coming update.',
  'buyer.saved.coming': 'Your saved Products and Scenes will appear here in a coming update.',
  'buyer.saved.signed_out': 'Sign in to save.',
  'buyer.orders.coming': 'Your orders will appear here in a coming update.',
  'buyer.orders.signed_out': 'Sign in to start ordering and track your orders.',
  'buyer.you.signed_out': 'Sign in to see your profile.',
  'buyer.sign_in.coming': 'Signing in arrives in a coming update.',
  'buyer.you.appearance': 'Appearance',
  'buyer.you.appearance.system': 'System',
  'buyer.you.appearance.light': 'Light',
  'buyer.you.appearance.dark': 'Dark',
  'buyer.you.account': 'Account',
  'buyer.you.more_coming':
    'Profile, purchases, notification settings, privacy, help and account deletion arrive in a coming update.',
} as const;

export type CommonMessageKey = keyof typeof enCommon;
