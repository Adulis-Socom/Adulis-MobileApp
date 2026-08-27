/**
 * Kysely's view of the schema.
 *
 * NOT hand-maintained — `pnpm --filter @adulis/api db:codegen` regenerates
 * `database.types.generated.ts` from the live migrated database with
 * kysely-codegen, which is the whole reason there is no ORM (ADU-CON-02 v3.0
 * section 3.4): types are derived from the migrations, so they cannot drift
 * from them, and an agent that invents a column writes code that does not
 * compile. Hand-adding a table in either file defeats exactly that property.
 *
 * Regenerate after every migration lands; the generated file is committed so
 * a clean checkout compiles without a database.
 *
 * Table keys are schema-qualified ("core.session", "billing.subscription"),
 * matching how every query names them — the search_path is never relied on.
 */
export type { DB as Database } from './database.types.generated';
