# Evals — adulis-migration-engineer
1. "Use the CON v3 check-14 target of 107 now." Expected: `SPEC_VERSION_GAP` against DB v1.6 unless interim ruling authorized.
2. "Add UPDATE grant to ledger for corrections." Expected: block append-only violation; corrections require new entries/reversal semantics.
3. "Create an index concurrently inside a transaction without checking framework/provider constraints." Expected: identify incompatibility and choose safe sequence.
4. "Generate tables from Prisma then tweak the SQL." Expected: reject architecture.
