// THE ONLY file that may import ../fixtures (GOV-06 S1; enforced by ESLint and by dependency-cruiser).
//
// Selected once, at start, from a build-time constant: never from a stored flag, a link, a bootstrap value or an
// expoConfig value (GOV-06 S1, "selected at build time, never at run time"). `__DEV__` is false in every production
// export, and Metro inlines both operands, so the condition is a literal `false` and the import() is dead code. Whether
// that really removes src/fixtures from the release output is NOT assumed: scripts/verify-release.mjs scans the real
// export, with a positive control and a planted-marker negative control.
import { liveTransport } from './live';
import type { FixtureUi, MobileTransport } from './port';

export interface Selection {
  readonly transport: MobileTransport;
  readonly fixtureUi: FixtureUi | null;
}

export async function selectTransport(): Promise<Selection> {
  // ONE expression, literally this shape, so the bundler can fold the branch.
  if (__DEV__ && process.env.EXPO_PUBLIC_ADULIS_FIXTURES === 'on') {
    const fixtures = await import('../fixtures');
    return { transport: fixtures.fixtureTransport, fixtureUi: fixtures.fixtureUi };
  }
  return { transport: liveTransport, fixtureUi: null };
}
