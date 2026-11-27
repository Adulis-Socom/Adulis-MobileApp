// PROVISIONAL strings, request SR-L2M01-LOC-01 (shared locale ownership is the root coordinator's, RB27-D04).
//
// The shared mobile catalogue (@adulis/locale/mobile) carries 6 keys today. Every key below is the key this app WANTS
// there, named as it should be named, with its English sentence, and is listed one-for-one in the shared-resource
// request register. This file is the visible, countable stand-in: when the root coordinator adds a key to the shared
// catalogue, `t()` already prefers the shared text, and the entry is deleted here. It is not a second catalogue: no
// Amharic, no key that is not requested, and no string that bypasses the register.
// Rules carried from the shared catalogue: one whole sentence per key, named {slots}, ASCII, no formatting.
export const provisionalEn = {
  'mobile.gate.loading': 'Loading Adulis.',
  'mobile.gate.offline_notice': 'You are offline. What you see may be out of date.',
  'mobile.gate.unavailable_notice': 'Adulis cannot be reached right now. What you see may be out of date.',
  'mobile.gate.init_failed.title': 'Adulis could not start.',
  'mobile.gate.init_failed.body': 'This installation is not set up correctly. Please update or reinstall the app.',
  'mobile.gate.upgrade.title': 'Please update Adulis.',
  'mobile.gate.upgrade.body': 'This version of Adulis is no longer supported. Update the app to continue.',
  'mobile.gate.upgrade.recommended': 'A newer version of Adulis is available.',
  'mobile.gate.upgrade.check_again': 'Check again',
  'mobile.gate.upgrade.checking': 'Checking.',

  'mobile.state.loading': 'Loading.',
  'mobile.state.empty': 'Nothing here yet.',
  'mobile.state.offline': 'You are offline. Check your connection and try again.',
  'mobile.state.unauthorized': 'This is not available for your account.',
  'mobile.state.retry': 'Try again',
  'mobile.state.go_home': 'Go to Home',
  'mobile.state.later': 'This section is not available yet.',

  'mobile.tab.home': 'Home',
  'mobile.tab.shop': 'Shop',
  'mobile.tab.saved': 'Saved',
  'mobile.tab.orders': 'Orders',
  'mobile.tab.account': 'You',

  'mobile.home.title': 'Home',
  'mobile.home.later': 'The feed arrives in a later release.',

  'mobile.auth.sign_in': 'Sign in',
  'mobile.auth.sign_in.title': 'Sign in to Adulis',
  'mobile.auth.phone.label': 'Phone number',
  'mobile.auth.send_code': 'Send code',
  'mobile.auth.sending': 'Sending your code.',
  'mobile.auth.verify.title': 'Enter your code',
  'mobile.auth.code.label': 'Code',
  'mobile.auth.verify': 'Verify',
  'mobile.auth.verifying': 'Checking your code.',
  'mobile.auth.use_other_number': 'Use a different number',
  'mobile.auth.recovery': 'Cannot sign in? Account recovery is not available in the app yet.',
  'mobile.auth.refused.generic': 'We could not sign you in. Please try again.',
  'mobile.auth.refused.otp_invalid': 'That code is not right. Check it and try again.',
  'mobile.auth.refused.otp_expired': 'That code has expired. Request a new one.',
  'mobile.auth.refused.rate_limited': 'Too many tries. Please wait and try again later.',
  'mobile.auth.refused.network': 'We could not reach Adulis. Check your connection and try again.',

  'mobile.session.ended.expired': 'Your session ended. Sign in again to continue.',
  'mobile.session.ended.revoked': 'You were signed out of this device. Sign in again to continue.',
  'mobile.session.ended.deleted': 'Your account was deleted.',
  'mobile.session.signout_not_durable': 'This device could not finish signing out, and Adulis could not be told. Your sign-in may come back when the app restarts. Try again while connected.',
  'mobile.session.signout_incomplete': 'You are signed out, but this device could not clear its saved sign-in. Restart the app before handing this device to anyone.',

  'mobile.account.title': 'You',
  'mobile.account.signed_in': 'You are signed in.',
  'mobile.account.guest': 'You are browsing as a guest.',
  'mobile.account.sign_out': 'Sign out',
  'mobile.account.switch': 'Sign in with a different account',
  'mobile.account.modes': 'Modes',

  'mobile.mode.buyer': 'Buyer',
  'mobile.mode.seller_companion': 'Seller Companion',
  'mobile.mode.courier': 'Courier',
  'mobile.mode.current': 'Current mode',
  'mobile.mode.switch_to': 'Switch to {mode}',
  'mobile.mode.pending': 'This is waiting for approval.',
  'mobile.mode.restricted': 'This is limited for now.',
  'mobile.mode.checking': 'Checking your access.',
  'mobile.mode.ended_notice': 'Your access to {mode} has ended.',
  'mobile.mode.back_to_buyer': 'Back to Buyer',
  'mobile.companion.later': 'Seller Companion tools arrive in a later release.',
  'mobile.courier.later': 'Courier tools arrive in a later release.',
} as const;

export type ProvisionalKey = keyof typeof provisionalEn;
