// DEVELOPMENT ONLY. Nothing outside src/transport/select.ts and the tests may import this module (GOV-06 S1).
//
// This is the isolation SPIKE's fixture, not the fixture world: it carries exactly the markers the release scan looks
// for (GOV-06 S4 RN-1) and a transport that opens no network and refuses everything. The fixture world, personas and
// the banner component belong to MOB-FE-01 and later work orders and replace this file's data, never its rules.
//
// Rules this file keeps: reserved `fx_` identifiers; no network (no fetch, XMLHttpRequest, WebSocket, no live
// transport import: ESLint refuses them in this directory); nothing is stored; no secret.
import { TransportError, type FixtureUi, type MobileTransport } from '../transport/port';

export const FIXTURE_MODULE_MARKER = 'ADULIS_MOBILE_FIXTURE_MODULE_MARKER_5b2e';
export const FIXTURE_BANNER = 'Demonstration data. Nothing here is real.';
export const FIXTURE_REFUSAL = 'FIXTURE_BLOCKED';
export const FIXTURE_TEST_HANDLE = '__ADULIS_FIXTURE__';
export const FIXTURE_DEMO_PHONE = '+251900000001';
export const FIXTURE_DEMO_CODE = '246810';
export const FIXTURE_IDS = {
  account: 'fx_acct_demo_owner',
  device: 'fx_device_demo_one',
  market: 'fx_market_ethiopia',
  seller: 'fx_seller_demo_alem',
} as const;

export const fixtureUi: FixtureUi = { bannerText: FIXTURE_BANNER };

export const fixtureTransport: MobileTransport = {
  kind: 'fixture',
  // Fails closed: no operation is served yet, and a refusal carries a catalogue key, not the marker text.
  request: () => Promise.reject(new TransportError('REFUSED', 'error.rbac.permission_denied')),
};
