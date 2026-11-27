// DEVELOPMENT ONLY. Nothing outside src/transport/select.ts and the tests may import this module (GOV-06 S1).
//
// The fixture world for the Mobile app. Rules this directory keeps: reserved `fx_` identifiers; no network (no fetch,
// XMLHttpRequest, WebSocket, no live transport import: ESLint refuses them here); nothing is stored (a fixture session
// lives in memory and is lost on restart by design); no secret; no fixture string in packages/locale.
import type { FixtureEnvironment, FixtureUi } from '../transport/port';
import { FIXTURE_BANNER, FIXTURE_IDS, FIXTURE_TEST_HANDLE } from './ids';
import { createFixtureTransport } from './transport';

export * from './ids';
export { PERSONAS, type Persona, type Scenario } from './personas';
export { createFixtureTransport, type FixtureHandle, type OpLogEntry, type ClientScenario } from './transport';

const world = createFixtureTransport();

export const fixtureUi: FixtureUi = { bannerText: FIXTURE_BANNER };
export const fixtureEnv: FixtureEnvironment = { deviceId: FIXTURE_IDS.device };
export const fixtureTransport = world.transport;
export const fixtureHandle = world.handle;

// The test handle, so end-to-end and device walkthroughs can read the operation log and drive late responses.
(globalThis as Record<string, unknown>)[FIXTURE_TEST_HANDLE] = world.handle;
