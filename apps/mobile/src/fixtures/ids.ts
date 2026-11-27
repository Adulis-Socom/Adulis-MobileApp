// DEVELOPMENT ONLY (GOV-06). Markers and reserved identifiers. Every value here is present in src/fixtures and absent from
// every release export: scripts/verify-release.mjs scans for each of them and for the reserved `fx_` pattern in general.
export const FIXTURE_MODULE_MARKER = 'ADULIS_MOBILE_FIXTURE_MODULE_MARKER_5b2e';
export const FIXTURE_VERSION = 'mob-fixture-world-1'; // bumped on any fixture shape change
export const FIXTURE_BANNER = 'Demonstration data. Nothing here is real.';
export const FIXTURE_REFUSAL = 'FIXTURE_BLOCKED';
export const FIXTURE_TEST_HANDLE = '__ADULIS_FIXTURE__';
export const FIXTURE_DEMO_PHONE = '+251900000001';
export const FIXTURE_DEMO_CODE = '246810';
export const FIXTURE_CHALLENGE_PREFIX = 'fx_otp_demo';
export const FIXTURE_CREDENTIAL_PREFIX = 'fx_cred_demo';

export const FIXTURE_IDS = {
  account: 'fx_acct_demo_owner',
  device: 'fx_device_demo_one',
  market: 'fx_market_ethiopia',
  seller: 'fx_seller_demo_alem',
} as const;
