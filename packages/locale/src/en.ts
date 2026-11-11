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
  // For You (WO-004A; ADU-MOB-02 S11, ADU-REC-01 S13). No engagement copy: no action
  // has a backend yet, so the card offers none.
  'buyer.for_you.feed': 'For You Scenes',
  'buyer.for_you.loading': 'Loading Scenes',
  'buyer.for_you.empty': 'There are no Scenes to show right now. Pull down to check again.',
  'buyer.for_you.end': 'You have reached the end of this feed. Pull down to refresh.',
  'buyer.for_you.loading_more': 'Loading more Scenes',
  'buyer.for_you.more_failed': 'More Scenes could not be loaded.',
  'buyer.for_you.session_ended': 'This feed has ended. Refresh to start a new one.',
  'buyer.for_you.refresh': 'Refresh',
  'buyer.for_you.card': 'Scene by {store}. {caption}',
  'buyer.for_you.photo': 'Photo from {store}',
  'buyer.for_you.photo_unavailable': 'Photo unavailable',
  'buyer.for_you.products': 'Tagged Products',
  'buyer.for_you.products_more': '+{count} more',
  'buyer.for_you.product_unavailable': 'Currently unavailable',
  // Explore the Scene and the Product read (WO-005; ADU-MOB-02 S11 R-06). Buyer terms are
  // Scene and Product. No engagement, Cart or purchase copy: none has a backend here.
  'buyer.scene.explore': 'Explore the Scene',
  'buyer.scene.loading': 'Loading the Scene',
  'buyer.scene.gone': 'This Scene is no longer available.',
  'buyer.scene.go_back': 'Go back',
  'buyer.scene.seller': 'Scene by {store}',
  'buyer.scene.photo': 'Scene photo from {store}',
  'buyer.scene.photo_unavailable': 'Photo unavailable',
  'buyer.scene.products': 'Products in this Scene',
  'buyer.scene.no_products': 'No Products are tagged in this Scene.',
  'buyer.scene.choose': 'Choose a Product to preview it.',
  'buyer.scene.product': '{position}. {name}, {price}',
  'buyer.scene.product_unavailable': '{position}. {name}, {price}, currently unavailable',
  // A Product with no ACTIVE Variant has no price, and is unavailable.
  'buyer.scene.product_no_price': '{position}. {name}, currently unavailable',
  // The span of a Product's current Variant prices, lowest to highest.
  'buyer.price.range': '{min} – {max}',
  'buyer.product.title': 'Product',
  'buyer.product.view': 'View Product',
  'buyer.product.loading': 'Loading the Product',
  'buyer.product.gone': 'This Product is no longer available.',
  'buyer.product.available': 'Available',
  'buyer.product.unavailable': 'Currently unavailable',
  'buyer.product.seller': 'Sold by {store}',
  'buyer.product.photo': 'Photo {index} of {count} of {name}',
  'buyer.product.description': 'Description',
  'buyer.product.options': 'Options',
  'buyer.product.option': '{option}, {price}, {availability}',
  'buyer.product.details': 'Product details',
  'buyer.product.attribute': '{name}: {value}',
  'buyer.seller.title': 'Seller',
  'buyer.seller.loading': 'Loading the Seller',
  'buyer.seller.gone': 'This Seller is no longer available.',
  'buyer.seller.view': 'View {store}',
  'buyer.seller.tabs': 'Seller sections',
  'buyer.seller.tab.scenes': 'Scenes',
  'buyer.seller.tab.products': 'Products',
  'buyer.seller.tab.reviews': 'Reviews',
  'buyer.seller.tab.about': 'About',
  'buyer.seller.handle': '@{handle}',
  'buyer.seller.trust': 'Trust level: {level}',
  'buyer.seller.trust.NEW': 'New',
  'buyer.seller.trust.ESTABLISHED': 'Established',
  'buyer.seller.trust.TRUSTED': 'Trusted',
  'buyer.seller.handoffs': 'Completed handoffs: {count}',
  'buyer.seller.rating': 'Seller service: {average} out of 5 from {count} reviews',
  'buyer.seller.no_reviews': 'No reviews yet',
  'buyer.seller.scenes.empty': 'No Scenes to show right now.',
  'buyer.seller.scenes.loading': 'Loading Scenes',
  'buyer.seller.scene': 'Scene: {caption}',
  'buyer.seller.products.empty': 'No Products to show right now.',
  'buyer.seller.products.loading': 'Loading Products',
  'buyer.seller.reviews.empty': 'No reviews yet.',
  'buyer.seller.reviews.loading': 'Loading reviews',
  'buyer.seller.reviews.note': 'Reviews rate the Seller\'s service. Product quality is shown on each Product.',
  'buyer.seller.about.description': 'About this Seller',
  'buyer.seller.about.open': 'Open now',
  'buyer.seller.about.closed': 'Closed now',
  'buyer.seller.about.fulfilment': 'How you can receive orders',
  'buyer.seller.about.fulfilment.BUYER_COLLECTION': 'Collect from the Seller',
  'buyer.seller.about.fulfilment.SELLER_DELIVERY': 'Seller delivery',
  'buyer.seller.about.fulfilment.COURIER_DELIVERY': 'Courier delivery',
  'buyer.seller.about.member_since': 'On Adulis since {date}',
  'buyer.seller.about.empty': 'This Seller has not added more details yet.',
  'buyer.review.rating': 'Rated {rating} out of 5',
  'buyer.review.date': 'Reviewed {date}',
  'buyer.review.basis.FINAL_HANDOFF': 'Verified order, received with Adulis Handoff',
  'buyer.review.basis.VERIFIED_ORDER_FAILURE': 'Verified paid order with an upheld Seller fault',
  'buyer.list.loading_more': 'Loading more',
  'buyer.list.more_failed': 'Could not load more.',
  'buyer.list.end': 'That is everything for now.',
  'buyer.search': 'Search',
  'buyer.search.input': 'Search Products, Sellers and Scenes',
  'buyer.search.clear': 'Clear search',
  'buyer.search.hint': 'Find Products, Sellers and Scenes in your Market.',
  'buyer.search.too_short': 'Type at least 2 characters to search.',
  'buyer.search.tabs': 'Result types',
  'buyer.search.tab.top': 'Top',
  'buyer.search.tab.products': 'Products',
  'buyer.search.tab.scenes': 'Scenes',
  'buyer.search.tab.sellers': 'Sellers',
  'buyer.search.results': 'Search results',
  'buyer.search.loading': 'Searching',
  'buyer.search.empty': 'No results for "{query}".',
  'buyer.search.no_market': 'Search could not find your Market. Try again.',
  'buyer.search.go_shop': 'Go to Shop',
  'buyer.search.go_home': 'Go to Home',
  'buyer.search.seller': '{store}, @{handle}',
  'buyer.search.scene_by': 'Scene by {store}',
  'buyer.notifications': 'Notifications',
  'buyer.notifications.coming': 'Your notifications will appear here in a coming update.',
  'buyer.notifications.signed_out': 'Sign in to see notifications.',

  // WO-012 Buyer notification inbox (ADU-NOTIF-01 v3.3 S60-S61, ADU-MOB-02 v4.3 S131-S135):
  // GET /v1/notifications?as=buyer and POST .../{id}/read. A row renders its own sentence only
  // when its template key is a catalogue key; any other template shows the generic sentence
  // (no Buyer template has approved copy yet). A notification is never business truth.
  'buyer.notifications.recent': 'Recent',
  'buyer.notifications.older': 'Older',
  'buyer.notifications.unread': 'Unread',
  'buyer.notifications.read_state': 'Read',
  'buyer.notifications.generic': 'You have a notification from Adulis.',
  'buyer.notifications.about_order': 'It is about one of your orders.',
  'buyer.notifications.received': 'Received {time}',
  'buyer.notifications.mark_read': 'Mark as read',
  'buyer.notifications.mark_read_failed': 'This notification could not be marked as read. Try again.',
  'buyer.notifications.empty': 'You have no notifications.',
  'buyer.notifications.failed': 'Your notifications could not be loaded.',
  'buyer.notifications.load_older': 'Load older notifications',
  'buyer.notifications.refresh': 'Refresh notifications',
  'buyer.shop.order': 'Newest first',
  'buyer.shop.products': 'Products in your Market',
  'buyer.shop.empty': 'No Products to show right now.',
  'buyer.shop.no_market': 'The Shop could not find your Market. Try again.',
  'buyer.shop.loading': 'Loading Products',
  'buyer.saved.private': 'Private to you.',
  'buyer.saved.collections': 'Collections',
  'buyer.saved.default_name': 'Saved',
  'buyer.saved.counts': 'Products: {products}, Scenes: {scenes}',
  'buyer.saved.open': 'Opens {name}',
  'buyer.saved.new': 'New collection',
  'buyer.saved.name': 'Collection name',
  'buyer.saved.name_invalid': 'Enter a name of 1 to 60 characters.',
  'buyer.saved.create': 'Create',
  'buyer.saved.cancel': 'Cancel',
  'buyer.saved.tabs': 'Saved items',
  'buyer.saved.tab.recent': 'Recent',
  'buyer.saved.tab.products': 'Products',
  'buyer.saved.tab.scenes': 'Scenes',
  'buyer.saved.loading': 'Loading your saved items',
  'buyer.saved.empty': 'Nothing saved yet. Tap Save on a Product or a Scene to keep it here.',
  'buyer.saved.collections_failed': 'Your collections could not be loaded.',
  'buyer.saved.product_unavailable': 'This Product is no longer available.',
  'buyer.saved.scene_unavailable': 'This Scene is no longer available.',
  'buyer.collection.tab.all': 'All',
  'buyer.collection.loading': 'Loading the collection',
  'buyer.collection.empty': 'This collection is empty.',
  'buyer.collection.gone': 'This collection is no longer available.',
  'buyer.collection.rename': 'Rename',
  'buyer.collection.save_name': 'Save name',
  'buyer.collection.delete': 'Delete collection',
  'buyer.collection.delete_title': 'Delete {name}?',
  'buyer.collection.delete_body': 'This deletes the collection and its list. The Products and Scenes themselves are not affected.',
  'buyer.collection.delete_confirm': 'Delete',
  'buyer.collection.remove': 'Remove',
  'buyer.collection.remove_label': 'Remove {name} from this collection',
  'buyer.collection.remove_unavailable': 'Remove this unavailable item from this collection',
  'buyer.collection.action_failed': 'Nothing was changed.',
  'buyer.save.save': 'Save',
  'buyer.save.saved': 'Saved',
  'buyer.save.add': 'Add to collection',
  'buyer.save.added': 'Saved.',
  'buyer.save.removed': 'Removed from Saved.',
  'buyer.save.sign_in': 'Sign in to save Products and Scenes to your private collections.',
  'buyer.save.failed': 'Saved was not changed.',
  'buyer.save.picker_title': 'Save to collection',
  'buyer.save.target_gone': 'This item can no longer be saved.',
  'buyer.save.done': 'Done',
  'catalogue.category.fashion': 'Fashion',
  'catalogue.category.cosmetics': 'Cosmetics',
  'catalogue.category.electronics': 'Electronics',
  'buyer.shop.categories': 'Categories',
  'buyer.shop.all': 'All Products',
  'buyer.shop.category_empty': 'No Products in this category yet.',
  'buyer.shop.categories_failed': 'Categories could not be loaded. All Products are still shown.',
  'buyer.save.card.label': 'Save {name}',
  'buyer.save.card.saving': 'Saving {name}',
  'buyer.save.card.removing': 'Removing {name} from Saved',
  'buyer.save.card.retry': 'Could not check whether {name} is saved. Try again.',
  'buyer.save.card.sign_in': 'Sign in to save Products and Scenes to your private collections. This item opens, and once you have signed in it is saved if it is still available.',
  'buyer.saved.signed_out': 'Sign in to save.',
  'buyer.orders.coming': 'Your orders will appear here in a coming update.',
  'buyer.orders.signed_out': 'Sign in to start ordering and track your orders.',
  'buyer.you.signed_out': 'Sign in to see your profile.',
  'auth.sign_in': 'Sign in',
  'buyer.you.appearance': 'Appearance',
  'buyer.you.appearance.system': 'System',
  'buyer.you.appearance.light': 'Light',
  'buyer.you.appearance.dark': 'Dark',
  'buyer.you.account': 'Account',
  'buyer.you.more_coming':
    'Profile, purchases, notification settings and help arrive in a coming update.',

  // WO-011 Buyer Account (ADU-MOB-02 v4.3 S137, R-11): preferences, sessions (ADU-AUTH-02 v3.3
  // S38, S118; the MOBILE subset of GET/DELETE /v1/auth/sessions) and Account deletion on the
  // existing deletion-ticket flow (ADU-API-01 v1.11 S12.18). Every sentence is complete; the
  // server's own deletion.* and error.* keys render its blockers, effects and refusals.
  'buyer.you.signed_in': 'You are signed in to your Adulis Account on this device.',
  'buyer.you.preferences': 'Preferences',
  'buyer.you.language': 'Language',
  'buyer.you.language.en': 'English',
  'buyer.you.language.am': 'Amharic (development preview)',
  'buyer.you.language.english_only': 'Adulis is shown in English.',
  'buyer.you.security': 'Security',
  'buyer.you.sessions': 'Signed-in sessions',
  'buyer.you.sessions.refresh': 'Refresh sessions',
  'buyer.you.sessions.failed': 'Your sessions could not be loaded.',
  'buyer.you.sessions.empty': 'No signed-in sessions were found.',
  'buyer.you.sessions.others':
    'You can sign out of this device here. Signing out of your other sessions is not available in the app.',
  'buyer.you.session.current': 'This device',
  'buyer.you.session.platform.android': 'Android device',
  'buyer.you.session.platform.ios': 'iPhone or iPad',
  'buyer.you.session.platform.web': 'Web browser',
  'buyer.you.session.platform.unknown': 'Unknown device',
  'buyer.you.session.surface.mobile': 'Adulis app',
  'buyer.you.session.surface.console': 'Seller Console',
  'buyer.you.session.first_seen': 'Signed in {time}',
  'buyer.you.session.last_active': 'Last active {time}',
  'buyer.you.session.location': 'Approximate location: {location}',
  'buyer.you.privacy': 'Privacy',
  'buyer.you.delete': 'Delete Account',
  'buyer.delete.intro':
    'Deleting your Adulis Account is permanent. It cannot be undone, and this device will be signed out.',
  'buyer.delete.steps':
    'To continue, confirm your phone number with a code sent by SMS, review what deletion does, and then confirm.',
  'buyer.delete.continue': 'Continue',
  'buyer.delete.cancel': 'Cancel',
  'buyer.delete.phone_intro':
    'Enter the phone number you sign in with. We will send a code by SMS that can only be used to delete the Account registered to that number.',
  'buyer.delete.code_sent': 'We sent a deletion code by SMS to {phone}.',
  'buyer.delete.checking': 'Checking what deletion does',
  'buyer.delete.effects_title': 'What deletion does',
  'buyer.delete.blocked_title': 'Your Account cannot be deleted yet',
  'buyer.delete.preview_incomplete':
    'The deletion details could not be shown in full, so deletion is not available in the app right now.',
  'buyer.delete.ticket_expired': 'Your deletion code has expired. Start again to receive a new code.',
  'buyer.delete.confirm_instruction': 'To confirm that you want to delete your Account permanently, type {word} below.',
  'buyer.delete.confirm_word': 'DELETE',
  'buyer.delete.confirm_label': 'Confirmation',
  'buyer.delete.confirm_mismatch': 'Type {word} exactly to confirm.',
  'buyer.delete.confirm_button': 'Delete my Account permanently',
  'buyer.delete.deleting': 'Deleting your Account',
  'buyer.delete.done': 'The Adulis Account registered to {phone} has been deleted.',
  'buyer.delete.signed_out': 'This device is signed out.',
  'buyer.delete.still_signed_in': 'You are still signed in to the Account on this device.',
  'buyer.delete.for_phone': 'This deletes the Adulis Account registered to {phone}.',
  'buyer.delete.code_unusable': 'This code could not be used to delete an Account. Check the phone number and start again.',
  'buyer.delete.done_home': 'Go to Home',
  'buyer.delete.unconfirmed':
    'We could not confirm whether your Account was deleted. If it was, this device is signed out the next time it reaches Adulis.',

  // Mobile sign-in, bootstrap and connectivity (WO-003; ADU-AUTH-02 v3.3, ADU-MOB-02 v4.3
  // S70-S76, S85). Server errors render from their own error.* keys and slots.
  'common.offline': 'You are offline. Check your connection and try again.',
  'common.timeout': 'The connection timed out. Check your connection and try again.',
  'auth.sign_in.intro': 'Enter your phone number. We will send you a code by SMS.',
  'auth.phone.label': 'Phone number',
  'auth.phone.hint': 'Include the country code, for example +251 911 234 567.',
  'auth.phone.invalid': 'Enter your phone number with the country code, for example +251 911 234 567.',
  'auth.send_code': 'Send code',
  'auth.verify.title': 'Enter code',
  'auth.verify.sent_to': 'We sent a six-digit code by SMS to {phone}.',
  'auth.code.label': 'Six-digit code',
  'auth.code.invalid': 'Enter the six digits from the SMS.',
  'auth.verify': 'Verify',
  'auth.resend': 'Send a new code',
  'auth.code.resent': 'A new code is on its way. The previous code no longer works.',
  'auth.change_number': 'Change number',
  // A statement the person is bound by: the console's wording exactly
  // (console.signin.age_declaration), and HUMAN-REQUIRED in am.ts (ADU-RUL-03 S4).
  'auth.age.declaration': 'I confirm that I am 18 years of age or older.',
  'auth.signed_in': 'You are signed in.',
  'app.upgrade.required.title': 'Update required',
  'app.upgrade.required.body':
    'This version of Adulis is no longer supported. Update Adulis from your app store to continue.',
  'app.upgrade.recommended': 'A newer version of Adulis is available. Update from your app store when you can.',
  'app.upgrade.dismiss': 'Dismiss',
  'app.upgrade.check_again': 'Check again',
} as const;

export type CommonMessageKey = keyof typeof enCommon;
