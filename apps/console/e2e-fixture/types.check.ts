/**
 * Compile-time conformance (SC-FE-01): what the fixture serves must be assignable to what the
 * screen reads. Run by `pnpm typecheck` (tsconfig.e2e.json); it is not a test and runs nothing.
 */
import type { ProductRow } from '../src/features/catalogue/types';
import type { FixtureProductRow } from '../src/api/fixtures/data';

export type FixtureRowIsAScreenRow = FixtureProductRow extends ProductRow ? true : never;
export const proof: FixtureRowIsAScreenRow = true;
