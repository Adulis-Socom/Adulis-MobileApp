#!/usr/bin/env node
// Seed stub. ADU-CON-02 v3.0 section 12 wants db/seed to hold one market, the
// configuration rows and a test seller. All three are Tier 1+ work: they need
// migrations 1 and 2 (extensions/roles/schemas/enums, then markets and config),
// which do not exist yet. Tier 0 creates no migrations and no tables.
console.log('no seed until Tier 1');
