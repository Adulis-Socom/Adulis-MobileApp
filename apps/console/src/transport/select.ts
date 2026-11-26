import { liveTransport } from './live';
import type { FixtureUi, Transport } from './port';

export interface Selected {
  readonly transport: Transport;
  readonly fixtureUi: FixtureUi | null;
}

/**
 * The ONLY file that may import the fixture module (eslint no-restricted-imports + the dependency rules). The
 * import sits behind the build-time constant `__FIXTURES__`, so a build that may not carry fixtures folds this
 * branch away and never emits the fixture chunk. There is no runtime switch and no fallback in either direction:
 * fixture mode never reaches the live transport, and live mode never reaches a fixture (GOV-06 F2).
 */
export async function selectTransport(): Promise<Selected> {
  if (__FIXTURES__) {
    const fixtures = await import('../fixtures');
    return { transport: fixtures.fixtureTransport, fixtureUi: fixtures.fixtureUi };
  }
  return { transport: liveTransport, fixtureUi: null };
}
