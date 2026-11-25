/**
 * Compile-time conformance (SC-FE-01): what the fixture serves must be assignable to what the
 * screen reads. Run by `pnpm typecheck` (tsconfig.e2e.json); it is not a test and runs nothing.
 */
import type { OrderRow } from '../src/features/trade/types';
import type { FixtureOrderRow } from '../src/api/fixtures/data';

export type FixtureRowIsAScreenRow = FixtureOrderRow extends OrderRow ? true : never;
export const proof: FixtureRowIsAScreenRow = true;
