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
  'error.auth.age_declaration_required': 'To create an account, please confirm that you are over 18.',
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


  // ---- Seller console (T7 Phase 5) -- MACHINE-TRANSLATION PLACEHOLDERS.
  // Every key here is listed in packages/locale/MT-KEYS.md; AM_ENABLED
  // stays off until the human pass replaces them (T7 S7.4).
  'console.a11y.loading': '\u12a5\u12eb\u1320\u1290 \u1290\u12cd', // MT
  'console.a11y.skip_to_content': 'ወደ ይዘቱ ዝለል',
  'console.a11y.primary_nav': 'ዋና ማውጫ',
  'console.nav.home': 'መነሻ',
  'console.nav.orders': 'ትዕዛዞች',
  'console.nav.products': 'ምርቶች',
  'console.nav.inbox': 'መልዕክቶች',
  'console.nav.more': 'ተጨማሪ',
  'console.shell.store': 'መደብርዎ',
  'console.shell.notifications': 'ማሳወቂያዎች',
  'console.shell.account': 'መለያ',
  'console.shell.signed_in': 'ገብተዋል',
  'console.signin.phone_label': 'ስልክ ቁጥር',
  'console.signin.phone_invalid': 'ስልክ ቁጥርዎን ከአገር ኮድ ጋር ያስገቡ፣ ለምሳሌ +251911234567።',
  /**
   * DELIBERATELY NOT TRANSLATED, and deliberately not machine-translated.
   *
   * ADU-RUL-03 S4: "a machine-translated placeholder is not acceptable for a
   * string a person is legally bound by ... an attestation whose wording was
   * never verified is not evidence of anything." Every other string in this
   * file ships MT and improves later; these two do not.
   *
   * The English stands here until a human translator supplies Amharic. A
   * person reading a sentence in a language they may not prefer is a worse
   * experience and an honest one; an unverified Amharic attestation would be
   * a better experience and evidence of nothing. AM_ENABLED is off, so no
   * seller sees either today.
   */
  'console.signin.age_declaration': 'I confirm that I am 18 years of age or older.', // HUMAN-REQUIRED
  'console.signin.age_refused':
    'Adulis is available to people aged 18 and over. You cannot create an account at this time.', // HUMAN-REQUIRED
  'console.signin.remember_label': 'ይህን መሣሪያ አስታውስ',
  'console.signin.remember_help': 'ይህ መሣሪያ ለአንድ ሳምንት ገብቶ ይቆያል፤ ገንዘብ የሚነካ ማንኛውም ነገር አሁንም ኮድ ይጠይቃል።',
  'console.signin.request_button': 'ኮድ ላክልኝ',
  'console.signin.code_label': 'ኮድ',
  'console.signin.code_help': 'ወደ {phone} የተላከውን ባለ 6 አሃዝ ኮድ ያስገቡ። አዲስ ኮድ መጠየቅ ይህን ኮድ ያሰርዛል።',
  'console.signin.code_invalid': 'ኮዱ 6 አሃዝ ነው።',
  'console.signin.verify_button': 'ግባ',
  'console.signin.resend_button': 'ኮዱን እንደገና ላክ',
  'console.signin.resend_countdown': 'እንደገና መላክ በ{seconds} ሰከንድ ውስጥ ይቻላል።',
  'console.signin.change_number': 'ቁጥር ቀይር',
  'console.signin.help_link': 'መግባት ተቸግረዋል?',
  'console.signin.rate_limited': 'በጣም ብዙ ሙከራዎች። በ{seconds} ሰከንድ ውስጥ እንደገና መሞከር ይችላሉ።',
  'console.stepup.code_label': 'ኮድ',
  'console.stepup.verify_button': 'አረጋግጥ',
  'console.stepup.cancel_button': 'ሰርዝ',
  'console.stepup.prompt.payout_change': 'የክፍያ መቀበያ መለያዎን ለመቀየር ኮዱን ያስገቡ።',
  'console.stepup.prompt.reissue_instructions': 'ለዚህ ትዕዛዝ የክፍያ መመሪያ እንደገና ለመስጠት ኮዱን ያስገቡ።',
  'console.stepup.prompt.team_change': 'ቡድንዎን ለመቀየር ኮዱን ያስገቡ።',
  'console.stepup.prompt.subscription_change': 'የደንበኝነት ምዝገባዎን ለመቀየር ኮዱን ያስገቡ።',
  'console.stepup.prompt.seller_deletion': 'ይህን መደብር ለመሰረዝ ኮዱን ያስገቡ።',
  'console.stepup.prompt.revoke_all_sessions': 'ሌሎች ክፍለ ጊዜዎችን ሁሉ ለማውጣት ኮዱን ያስገቡ።',
  'console.stepup.prompt.identity_change': 'የማንነት ዝርዝሮችን ለመቀየር ኮዱን ያስገቡ።',
  'console.stepup.prompt.ownership_transfer': 'የመደብሩን ባለቤትነት ለማዛወር ኮዱን ያስገቡ።',
  'console.idle.warning': 'ካልቀጠሉ በ{time} ይወጣሉ።',
  'console.idle.continue': 'ገብቼ ልቆይ',
  'console.validation.summary': 'ከመቀጠልዎ በፊት የሚከተሉትን ያስተካክሉ፦',
  'console.error.request_id': 'ድጋፍን ካገኙ ይህን የጥያቄ መለያ ይጥቀሱ፦',
  'console.states.empty_default': 'እስካሁን ምንም የለም።',
  'console.states.stale': 'በመዘመን ላይ…',
  'console.states.blocked_default': 'አንድ የማዋቀር ደረጃ ይጎድላል። ለመቀጠል ያጠናቅቁት።',
  'console.states.entitlement_control': 'በዕቅድዎ ውስጥ አልተካተተም',
  'console.states.entitlement_unlock': 'በከፍተኛ እርከን ላይ ይገኛል።',
  'console.states.terminal': 'ይህ ጉዳይ ተጠናቅቋል። ከታች ያለው ታሪክ ለንባብ ብቻ ነው።',
  'console.states.upgrade': 'አዲስ የመተግበሪያ ስሪት ያስፈልጋል።',
  'console.states.upgrade_reload': 'እንደገና ጫን',
  'console.chooser.title': 'መደብር ይምረጡ',
  'console.chooser.gap': 'መደብሮችዎን የሚዘረዝር የውል ነጥብ ገና የለም (መዝገብ D-97)፤ የተሰጠዎትን የመደብር መለያ ይለጥፉ።',
  'console.chooser.id_label': 'የመደብር መለያ',
  'console.chooser.open_button': 'መደብር ክፈት',
  'console.demo.title': 'አሥራ ሁለቱ የማያ ገጽ ሁኔታዎች',
  'console.demo.hint': 'በዚህ መተግበሪያ ያለ እያንዳንዱ ማያ ገጽ ከእነዚህ ሁኔታዎች በአንዱ በኩል ይታያል፤ በእነዚህ ብቻ። ለማየት አንዱን ይምረጡ።',
  'console.demo.ready_content': 'ይህ READY ነው፦ ማያ ገጹ ራሱ።',
  // C-3's keys carry the ENGLISH, and are NOT machine translations.
  // They are untranslated: this agent cannot produce Amharic it can
  // verify, and unverifiable text in a seller's own language is worse
  // than text they can see is untranslated. No HUMAN-REQUIRED marker --
  // that class is a legal one (ADU-RUL-03 S4) and these are ordinary
  // strings awaiting the translation pass. MT-KEYS.md lists them (D-144).
  'console.home.title': 'Home',
  'console.home.readiness_title': 'What is left before you can publish',
  'console.home.progress': '{done} of {total} done.',
  'console.home.not_a_wizard': 'Do these in any order, over as many days as you need. Nothing is lost when you leave this page.',
  'console.home.resolve': 'Complete this',
  'console.home.item_done': 'done',
  'console.home.item_todo': 'still to do',
  'console.home.no_items': 'Your store has no setup steps outstanding.',
  'console.home.brief_title': 'Today',
  'console.home.brief_pending': 'The daily brief arrives with the orders screens.',
  'console.home.item.account_created': 'Account created',
  'console.home.item.seller_type_declared': 'Seller type declared',
  'console.home.item.eligibility_satisfied': 'Eligibility satisfied',
  'console.home.item.identity_verified': 'Identity verified',
  'console.home.item.company_details': 'Company details',
  'console.home.item.store_profile': 'Store profile',
  'console.home.item.payout_details': 'Payout details',
  'console.home.item.fulfilment_config': 'Fulfilment configuration',
  'console.home.item.at_least_one_product': 'At least one product',
  'console.become.title': 'Become a seller',
  'console.become.type_legend': 'Are you selling as an individual or as a company?',
  'console.become.type_individual': 'An individual',
  'console.become.type_company': 'A company',
  'console.become.choose_prompt': 'Choose one to see what it means for the rest of your setup.',
  'console.become.company_adds_item': 'Selling as a company adds one more setup step: your company details.',
  'console.become.company_identity_meaning': 'It also changes what identity verification means. The attestation is about a named individual who represents the company, not about the business itself.',
  'console.become.individual_identity_meaning': 'Identity verification will be an attestation about you.',
  'console.become.not_reversible': 'This choice cannot be changed later without contacting support.',
  'console.become.store_name_label': 'Store name',
  'console.become.handle_label': 'Store address',
  'console.become.handle_hint': 'Lowercase letters, numbers and hyphens, 3 to 40 characters. Buyers will see it in your store web address.',
  'console.become.submit': 'Create my store',
  'console.placeholder': 'ማያ ገጽ {screen} ገና አልተገነባም። ከግንባታ ደረጃው ጋር ይመጣል።',
  // -------------------------------------------------------------------
  // C-4, group B -- Trade (SC-03..SC-06). ADU-CON-03 v1.1 S7.
  //
  // Three of these are load-bearing and are transcribed rather than
  // written: `payment.confirm` is "Confirm Payment Received" VERBATIM and
  // is never "Accept Payment"; `payment.verify_first` is the sentence that
  // must sit adjacent to both decisions, always visible, never behind a
  // disclosure; and `payment.reject_consequence` states in full what the
  // seller is agreeing to, because rejection is a two-step confirmation
  // and step two is where the consequence belongs.
  // -------------------------------------------------------------------
  'console.trade.clock.reservation': 'Reservation window',
  'console.trade.clock.confirmation': 'Time left to confirm this payment',
  'console.trade.clock.remaining': '{hours}h {minutes}m left',
  'console.trade.clock.elapsed': 'This time has passed. Checking with the server.',

  'console.trade.state.created': 'New',
  'console.trade.state.notified': 'Buyer notified',
  'console.trade.state.payment_submitted': 'Payment submitted',
  'console.trade.state.payment_confirmed': 'Payment confirmed',
  'console.trade.state.handed_off': 'Handed off',
  'console.trade.state.completed': 'Completed',
  'console.trade.state.cancelled_by_buyer': 'Cancelled by the buyer',
  'console.trade.state.cancelled_by_seller': 'Cancelled by you',
  'console.trade.state.expired_unclaimed': 'Expired unclaimed',

  'console.trade.orders.title': 'Orders',
  'console.trade.orders.empty': 'You have no orders yet. Buyers reserve from your storefront.',
  'console.trade.orders.none_in_filter': 'None of the orders loaded so far are in this group.',
  'console.trade.orders.line_count': '{count} items',
  'console.trade.orders.review_payment': 'Review payment',
  'console.trade.orders.load_more': 'Load more orders',
  'console.trade.orders.no_buyer_name': 'Buyer names are not shown here. Adulis does not store a name for a buyer account, so there is none to display, and showing a phone number instead is not permitted where a conversation exists.',
  'console.trade.orders.filter_is_local': 'These groups filter the orders loaded on this page. Orders you have not loaded yet are not counted in any of them.',
  'console.trade.filter.legend': 'Filter orders',
  'console.trade.filter.all': 'All',
  'console.trade.filter.needs_action': 'Needs action',
  'console.trade.filter.active': 'Active',
  'console.trade.filter.completed': 'Completed',
  'console.trade.filter.cancelled': 'Cancelled',

  'console.trade.line.active': 'Reserved',
  'console.trade.line.fulfilled': 'Fulfilled',
  'console.trade.line.cancelled_by_buyer': 'Cancelled by the buyer',
  'console.trade.line.cancelled_by_seller': 'Cancelled by you',
  'console.trade.line.refunded': 'Refunded',
  'console.trade.line.expired': 'Expired',
  'console.trade.payment.verify_first': 'Verify the payment in your own bank or payment account before confirming.',
  'console.trade.payment.confirm': 'Confirm Payment Received',
  'console.trade.payment.reject': 'Payment Not Received',
  'console.trade.payment.reject_heading': 'Say that this payment was not received',
  'console.trade.payment.reject_consequence': 'The order goes back to awaiting payment and the clock keeps running. The buyer may send new evidence once. If you say the payment was not received a second time, the order ends.',
  'console.trade.payment.reject_reason_label': 'What did you check, and what was missing?',
  'console.trade.payment.reject_final': 'Payment Not Received',
  'console.trade.payment.reject_back': 'Go back',

  'console.trade.evidence.title': 'Payment evidence',
  'console.trade.evidence.alt': 'The payment evidence the buyer submitted.',
  'console.trade.evidence.none': 'There is no payment evidence to show for this order.',
  'console.trade.evidence.no_time': 'The submission time is not available.',
  'console.trade.evidence.close': 'Close',

  'console.trade.qr.title': 'Handoff code',
  'console.trade.qr.alt': 'A QR code for the buyer to scan.',
  'console.trade.qr.explain': 'The buyer scans this code. Scanning it completes the order and lets them leave a review.',
  'console.trade.qr.offline': 'This code needs a connection. The Adulis app can show a handoff code offline; this console cannot.',
  'console.trade.qr.close': 'Close',

  'console.trade.detail.title': 'Order',
  'console.trade.detail.back': 'Back to orders',
  'console.trade.detail.state_heading': 'State',
  'console.trade.detail.buyer_heading': 'Buyer',
  'console.trade.detail.no_buyer_name': 'Adulis does not store a name for a buyer account, so there is no name to show here.',
  'console.trade.detail.contact_buyer': 'Message the buyer',
  'console.trade.detail.lines_heading': 'Items',
  'console.trade.detail.quantity': 'Quantity {count}',
  'console.trade.detail.cant_fulfil': "Can't Fulfil",
  'console.trade.detail.payment_heading': 'Payment',
  'console.trade.detail.no_submission': 'The buyer has not submitted a payment for this order.',
  'console.trade.detail.view_evidence': 'View evidence',
  'console.trade.detail.handoff_heading': 'Handoff',
  'console.trade.detail.handoff_locked': 'Handoff opens once the payment is confirmed.',
  'console.trade.detail.marked_ready': 'Marked ready at {time}',
  'console.trade.detail.mark_ready': 'Mark Ready',
  'console.trade.detail.assign_courier': 'Assign a courier',
  'console.trade.detail.custody_transfer': 'Hand to the courier',
  'console.trade.detail.show_qr': 'Show QR',
  'console.trade.detail.no_courier_ids': 'Assigning a courier is not available yet. Adulis can list the couriers you have invited, but not in a form this screen can assign from.',
  'console.trade.detail.reissue': 'Reissue payment instructions',
  'console.trade.detail.reissue_hint': 'Sends the buyer the payment instructions again, with your current payout details. You will be asked for a code.',
  'console.trade.detail.history_heading': 'History',
  'console.trade.detail.no_history': 'Nothing has happened to this order yet.',
  'console.trade.detail.history_entry': 'Became: {state}',
  "console.catalogue.filter.label": "Filter by status",
  "console.catalogue.filter.all": "All",
  "console.catalogue.filter.published": "Published",
  "console.catalogue.filter.draft": "Draft",
  "console.catalogue.filter.unpublished": "Unpublished",
  "console.catalogue.products.heading": "Products",
  "console.catalogue.products.new": "New product",
  "console.catalogue.products.empty": "No products yet. Products you create appear here, ready to add variants, stock and images before you publish.",
  "console.catalogue.products.cap_unreported": "Your product limit is set by the server from your tier and level together, and this list does not report it yet. You can still add a product; the server will say if a limit is reached.",
  "console.catalogue.products.filter_note": "These tabs filter the products already loaded. A product on a later page may not appear until you load more.",
  "console.catalogue.new.heading": "New product",
  "console.catalogue.new.base_price": "Starting price",
  "console.catalogue.new.base_price_hint": "This seeds the price of the first variant. Each variant carries its own price after that, so this number is only a starting point.",
  "console.catalogue.new.create": "Create product",
  "console.catalogue.editor.name": "Name",
  "console.catalogue.editor.description": "Description",
  "console.catalogue.editor.save": "Save details",
  "console.catalogue.editor.attributes_owed": "Structured attributes (material, care, size guides) are edited from the category attribute list, which this screen does not carry yet.",
  "console.catalogue.editor.publish_heading": "Publication",
  "console.catalogue.editor.publish": "Publish",
  "console.catalogue.editor.unpublish": "Unpublish",
  "console.catalogue.editor.publish_blocked": "This product cannot be published until each of these is resolved:",
  "console.catalogue.variants.heading": "Variants",
  "console.catalogue.variants.empty": "No variants yet. Add sizes, colours or options, each with its own price and stock.",
  "console.catalogue.variants.active": "Active",
  "console.catalogue.variants.withdrawn": "Withdrawn",
  "console.catalogue.variants.in_stock": "{n} in stock",
  "console.catalogue.variants.manage_stock": "Manage stock",
  "console.catalogue.variants.withdraw": "Withdraw",
  "console.catalogue.variants.new_key": "Variant (for example: Size L)",
  "console.catalogue.variants.new_price": "Price",
  "console.catalogue.variants.add": "Add variant",
  "console.catalogue.media.heading": "Images and video",
  "console.catalogue.media.empty": "No images yet. The first image you add becomes the storefront thumbnail.",
  "console.catalogue.media.thumbnail": "Storefront thumbnail",
  "console.catalogue.media.position": "Image {n}",
  "console.catalogue.media.up": "Move up",
  "console.catalogue.media.down": "Move down",
  "console.catalogue.media.remove": "Remove",
  "console.catalogue.media.upload_owed": "Adding an image resizes it in your browser and uploads three sizes. That upload step is not on this screen yet.",
  "console.catalogue.media.video_present": "One video is attached.",
  "console.catalogue.media.remove_video": "Remove video",
  "console.catalogue.media.no_video": "No video attached.",
  "console.catalogue.stock.count_label": "Stock count",
  "console.catalogue.stock.set": "Set count",
  "console.catalogue.stock.confirm": "Confirm stock is accurate",
  "console.catalogue.stock.confirmed_at": "Confirmed accurate at {time}.",
  "console.catalogue.stock.never_confirmed": "This stock has not been confirmed as accurate yet.",
  "console.catalogue.stock.history_heading": "Stock history",
  "console.catalogue.stock.history_empty": "No stock changes yet. Setting a count or reconciling stock appears here.",
  "console.catalogue.products.load_more": "Load more products",
  "console.catalogue.products.row_summary_owed": "Stock, variants and images for each product are shown inside the product, not on this list yet.",
  "console.catalogue.products.filter_empty": "No loaded products match this filter. Load more, or choose another filter.",
  "console.catalogue.variants.labels_owed": "Variants are shown by their key for now; named options such as size and colour appear once the server lists them.",
  "console.catalogue.variants.key_required": "Enter a variant name before adding it.",
  "console.catalogue.variants.price_required": "Enter a price before saving. A blank price is not zero.",
  "console.catalogue.variants.edit_price": "New price",
  "console.catalogue.variants.save_price": "Save price",
  "console.catalogue.stock.count_required": "Enter a stock count before setting it. A blank count is not zero.",
  "console.catalogue.stock.confidence_owed": "How fresh this stock looks to buyers is worked out by the server and is not shown here yet.",
  "console.catalogue.stock.screen_heading": "Stock for",
  "console.catalogue.stock.back_to_product": "Back to the product",
  "console.catalogue.new.name_price_required": "Enter a name and a starting price. A blank price is not zero.",
  "console.catalogue.media.no_thumbnail": "No image holds the thumbnail slot right now; moving any image re-numbers them and fills it.",
};
