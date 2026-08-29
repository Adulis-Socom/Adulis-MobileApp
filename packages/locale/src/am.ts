import type { Catalogue } from './en';

/**
 * Amharic catalogue.
 *
 * The `Catalogue` annotation is the gate: it is `Record<MessageKey, string>`, so
 * deleting a key here or adding one to en.ts without adding it here FAILS THE
 * BUILD. See test/am-completeness.test-d.ts for the negative case.
 *
 * ---------------------------------------------------------------------------
 * THESE ARE MACHINE-TRANSLATION PLACEHOLDERS. NOT HUMAN-TRANSLATED COPY.
 *
 * ADU-CON-02 v3.0 section 9 separates two gates and this file passes only the
 * first:
 *   PRESENCE gate      — satisfied by machine translation. The type check.
 *   HUMAN-TRANSLATION  — NOT satisfied. Until it is, AM_ENABLED hides the
 *   gate                 language switcher, so no seller sees these strings.
 *
 * Do not ship the switcher on the strength of this file compiling.
 * ---------------------------------------------------------------------------
 *
 * Rendering note (ADU-PROJ-01 section 12 makes it a release gate): the mixed
 * Latin/Ethiopic render is verified with Inter + Noto Sans Ethiopic, self-hosted,
 * with per-family unicode-range — an Ethiopic-only family drops every Latin
 * glyph, so a page with one English product name renders half-blank without it.
 */
export const am: Catalogue = {
  'app.title': 'የአዱሊስ ሻጭ ኮንሶል',
  'health.ok': 'ሁሉም ሲስተሞች በመደበኛ ሁኔታ እየሠሩ ናቸው።',
  'health.degraded': 'አንዳንድ ሲስተሞች አይገኙም። እየተመለከትነው ነው።',
  'common.retry': 'እንደገና ይሞክሩ',
  'common.signOut': 'ውጣ',

  // the error catalogue - machine-translation placeholders (presence gate only)
  // auth
  'error.auth.otp_invalid': 'ያስገቡት ኮድ ትክክል አይደለም።',
  'error.auth.otp_expired': 'ይህ ኮድ አሁን አይሠራም። ለአዲስ ኮድ መልዕክቶችዎን ይመልከቱ፣ ወይም አዲስ ይጠይቁ።',
  'error.auth.otp_attempts_exceeded': 'በጣም ብዙ ሙከራዎች። አዲስ ኮድ ይጠይቁ።',
  'error.auth.otp_purpose_not_permitted': 'ይህ ኮድ ለዚያ ተግባር መጠቀም አይቻልም።',
  'error.auth.session_expired': 'ክፍለ ጊዜዎ አብቅቷል። እንደገና ይግቡ።',
  'error.auth.session_revoked': 'ይህ ክፍለ ጊዜ ተዘግቷል።',
  'error.auth.audience_not_permitted': 'ይህ መተግበሪያ ያንን ተግባር ማከናወን አይችልም።',
  'error.auth.recovery_required': 'ከመግባትዎ በፊት መለያ መልሶ ማግኘት ያስፈልጋል።',
  // step_up
  'error.step_up.step_up_required': 'ይህን ተግባር በአዲስ ማረጋገጫ ኮድ ያረጋግጡ።',
  'error.step_up.step_up_expired': 'ማረጋገጫው ጊዜው አልፎበታል። እንደገና ያረጋግጡ።',
  'error.step_up.step_up_action_mismatch': 'ይህ ማረጋገጫ ለሌላ ተግባር የተሰጠ ነው።',
  // rbac
  'error.rbac.permission_denied': 'ይህን ለማድረግ ፈቃድ የለዎትም።',
  'error.rbac.owner_only': 'ይህን ማድረግ የሚችለው የመደብሩ ባለቤት ብቻ ነው።',
  // cart
  'error.cart.cart_empty': 'ጋሪዎ ባዶ ነው።',
  'error.cart.cart_seller_conflict': 'ጋሪዎ ከሌላ መደብር ዕቃዎችን ይዟል። አንድ ትዕዛዝ ለአንድ መደብር ነው።',
  'error.cart.cart_revalidation_failed': 'በጋሪዎ ውስጥ ያሉ አንዳንድ ዕቃዎች ተቀይረዋል። ከማዘዝዎ በፊት ይመልከቷቸው።',
  // cart_line
  'error.cart_line.insufficient_stock': 'የቀረው {available} ብቻ ነው። የጠየቁት {requested} ነው።',
  'error.cart_line.sold_out': 'ይህ ዕቃ ተሽጦ አልቋል።',
  'error.cart_line.price_changed': 'ዋጋው ተቀይሯል።',
  'error.cart_line.no_longer_published': 'ይህ ዕቃ ከአሁን በኋላ አልተዘረዘረም።',
  'error.cart_line.variant_withdrawn': 'ይህ አማራጭ ከአሁን በኋላ አይገኝም።',
  'error.cart_line.seller_unavailable': 'ይህ መደብር አሁን ትዕዛዝ እየተቀበለ አይደለም።',
  'error.cart_line.transaction_cap_exceeded': 'ይህ ትዕዛዝ ከመደብሩ የአሁኑ የትዕዛዝ ገደብ በላይ ነው።',
  // order
  'error.order.illegal_transition': 'ይህ ትዕዛዝ ከ{from_state} ወደ {to_state} መሸጋገር አይችልም።',
  'error.order.order_not_payable': 'ይህ ትዕዛዝ ክፍያ እየጠበቀ አይደለም።',
  'error.order.order_already_terminal': 'ይህ ትዕዛዝ አስቀድሞ ተጠናቋል።',
  'error.order.duplicate_reservation': 'ለዚህ ዕቃ አስቀድመው ማስያዣ ይዘዋል።',
  'error.order.buyer_cooldown_active': 'ማዘዝ እስከ {until} ድረስ ቆሟል።',
  'error.order.order_not_readyable': 'ይህ ትዕዛዝ ገና ዝግጁ ሊደረግ አይችልም። መጀመሪያ ክፍያ መረጋገጥ አለበት።',
  // payment
  'error.payment.evidence_required': 'የክፍያ ቅጽበታዊ ገጽ እይታ ያስፈልጋል።',
  'error.payment.evidence_too_large': 'ፋይሉ በጣም ትልቅ ነው። ገደቡ {max_bytes} ባይት ነው።',
  'error.payment.payment_already_decided': 'ይህ ክፍያ አስቀድሞ ተወስኗል።',
  'error.payment.not_order_buyer': 'ትዕዛዙ አልተገኘም።',
  // handoff
  'error.handoff.scan_signature_invalid': 'ይህ ስካን ማረጋገጥ አልተቻለም።',
  'error.handoff.scan_predates_token': 'ይህ ስካን ከኮዱ በፊት የተደረገ ነው።',
  'error.handoff.scan_not_order_buyer': 'ትዕዛዙ አልተገኘም።',
  'error.handoff.courier_cannot_scan': 'ርክክብ ለማጠናቀቅ መስካን የሚችለው ገዢው ብቻ ነው።',
  // seller
  'error.seller.publication_blocked': 'ይህ ምርት ገና ሊታተም አይችልም። የቀሩትን ደረጃዎች ይመልከቱ።',
  'error.seller.eligibility_not_satisfied': 'መለያዎ ገና መስፈርቶቹን አያሟላም።',
  'error.seller.tier_limit_reached': 'የአሁኑ እቅድዎ ይህን አያካትትም።',
  'error.seller.level_limit_reached': 'የመደብርዎ ደረጃ ይህን ገና አያካትትም።',
  'error.seller.handle_taken': 'ያ የመደብር አድራሻ ተይዟል።',
  'error.seller.fulfilment_method_required': 'ገዢዎች ዕቃቸውን የሚያገኙበትን ቢያንስ አንድ መንገድ ያክሉ።',
  'error.seller.product_has_active_orders': 'ይህ ምርት ንቁ ትዕዛዞች ስላሉት ሊሰረዝ አይችልም።',
  'error.seller.variant_has_active_orders': 'ይህ አማራጭ ንቁ ትዕዛዞች ስላሉት ሊሰረዝ አይችልም።',
  // payout
  'error.payout.payout_locked_recovery': 'ከመለያ መልሶ ማግኘት በኋላ የክፍያ ለውጦች እስከ {until} ድረስ ተቆልፈዋል።',
  'error.payout.payout_change_pending': 'የክፍያ ለውጥ አስቀድሞ በመጠባበቅ ላይ ነው።',
  'error.payout.payout_permission_denied': 'የክፍያ ዝርዝሮችን ለመቀየር ፈቃድ የለዎትም።',
  // deletion
  'error.deletion.deletion_blocked': 'ግዴታዎች እስካሉ ድረስ መሰረዝ ታግዷል። ዝርዝሩን ይመልከቱ።',
  'error.deletion.deletion_owner_only': 'ይህን መደብር መሰረዝ የሚችለው ባለቤቱ ብቻ ነው።',
  // request
  'error.request.validation_failed': 'ጥያቄው ትክክል አይደለም።',
  'error.request.idempotency_key_missing': 'ጥያቄው የድጋሚ ሙከራ ቁልፉ ይጎድለዋል።',
  'error.request.idempotency_key_reused': 'ይህ የድጋሚ ሙከራ ቁልፍ ለሌላ ጥያቄ አስቀድሞ ተጠቅሟል።',
  'error.request.rate_limited': 'በጣም ብዙ ጥያቄዎች። በ{retry_after_seconds} ሰከንድ ውስጥ እንደገና ይሞክሩ።',
  'error.request.client_upgrade_required': 'ለመቀጠል መተግበሪያውን ያዘምኑ።',
  'error.request.payload_too_large': 'ጥያቄው በጣም ትልቅ ነው።',
  'error.request.seller_context_required': 'ለዚህ ጥያቄ ምንም መደብር አልተጠቀሰም።',
  'error.request.scope_parameter_required': 'ይህ ጥያቄ እንደ ገዢ ወይም እንደ ሻጭ መሆኑን ይግለጹ።',
  'error.request.not_found': 'አልተገኘም።',
  'error.request.gone': 'ይህ ገጽ ከእንግዲህ የለም።',
  'error.request.internal': 'በእኛ በኩል የሆነ ችግር ተፈጥሯል። እንደገና ይሞክሩ።',

  'sms.otp.sign_in': '{code} የአዱሊስ ኮድዎ ነው።',
  'sms.otp.account_deletion': '{code} - የአዱሊስ መለያዎን መሰረዝ ያረጋግጡ።',
  'sms.otp.step_up.payout_change': '{code} - የክፍያ ሁሴታዎን መቀየር ያረጋግጡ።',
  'sms.otp.step_up.reissue_instructions': '{code} - የክፍያ መመሪያዎን እንደገና መስጠት ያረጋግጡ።',
  'sms.otp.step_up.team_change': '{code} - የቡድን ለውጥ ያረጋግጡ።',
  'sms.otp.step_up.subscription_change': '{code} - የደንበኝነት ለውጥ ያረጋግጡ።',
  'sms.otp.step_up.seller_deletion': '{code} - ሁቅዎን መሰረዝ ያረጋግጡ።',
  'sms.otp.step_up.revoke_all_sessions': '{code} - ሌሎች ክፍለ-ጊዜያት መዝጋት ያረጋግጡ።',
  'sms.otp.step_up.identity_change': '{code} - የማንነት ዝርዝሮች ለውጥ ያረጋግጡ።',
  'sms.otp.step_up.ownership_transfer': '{code} - የሁቅ ባለቤትነት ማስተላለፍ ያረጋግጡ።',
  'deletion.blocker.non_terminal_reservations': 'ክፍት የሆኑ መያዝ መትቶች መጀመሪያ መጨነቅ አለባቸው።',
  'deletion.blocker.evidence_awaiting_confirmation': 'የቀረቡ ክፍያዎች መጀመሪያ መረጋገጥ አለባቸው።',
  'deletion.blocker.orders_awaiting_handoff': 'የተረጋገጡ ትእዛዞች መጀመሪያ መጠናቀቅ አለባቸው።',
  'deletion.blocker.refunds_unresolved': 'ተመላቶች መጀመሪያ መጨነቅ አለባቸው።',
  'deletion.blocker.open_claims': 'ክፍት የሆኑ ቅሬቶች መጀመሪያ መፈታት አለባቸው።',
  'deletion.blocker.subscription_past_due': 'ያልተከፈለ የደንበኝነት ሂሳብ መጀመሪያ መከፈል አለበት።',
  'deletion.blocker.buyer_orders_in_payment': 'ክፍያ በሂደት ላይ ያሉ ትእዛዞች መጀመሪያ መጠናቀቅ አለባቸው።',

  'ownership_transfer.no_eligible_admin':
    'አዲሱ ባለቤት አስቀድሞ የዚህ መደብር አድሚን መሆን አለበት። መጀመሪያ ይጋብዙት እና አድሚን ያድርጉት።',
  'ownership_transfer.blocker.payout_change_pending':
    'የክፍያ መቀበያ ለውጥ በመጠባበቅ ላይ ነው። እስኪጸና ይጠብቁ ወይም መጀመሪያ ይሰርዙት።',
  'ownership_transfer.blocker.open_claims': 'ክፍት የሆኑ ቅሬታዎች መጀመሪያ መፈታት አለባቸው።',

  'deletion.effect.identity_scrubbed': 'የማንነት ዝርዝሮችዎ ይሰረዛሉ።',
  'deletion.effect.records_anonymised': 'የግብይት መዝገቦች ያለ ስምዎ ይቀመጣሉ።',
  'deletion.effect.reviews_anonymised_not_deleted': 'ግምገማዎች ያለ ስም ይቀስሉ።',
  'deletion.effect.verification_retained': 'የማረጋገጥ መዝገብ ይቀመጣል።',
  'deletion.effect.reservations_released': 'ነቃ የሆኑ መያዟዎች ይለቀቃሉ።',

  'chat.bot.escalated': 'ጥያቄዎ ለሻጭ ተላልፏል። እዚህ ይመልሱልዎታል።',
  'notification.chat.escalated': 'የገዢ ጥያቄ ምላሽዎን ይፈልጋል።',

};
