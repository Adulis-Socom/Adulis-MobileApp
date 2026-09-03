#!/usr/bin/env node
/**
 * `pnpm verify:trust-before-open-signup` -- WORK ORDER T18 Phase 5.
 *
 * RULING (T18 S5): "A hand-picked beta of twenty sellers is verified by the
 * founder, not the system. That is correct for the cohort. What is not correct
 * is `false` surviving by inertia. `audience_required` or `identity_required`
 * must be TRUE before open signup."
 *
 * THE GATE, IN ONE SENTENCE: a market may not be open to public SELLER
 * registration while it measures nothing about the sellers it admits.
 *
 * It fails when, for the same market, ALL of these hold:
 *   core.market.seller_registration_enabled  = true   (anyone may sign up)
 *   core.market.registration_enabled         = true   (registration is on at all)
 *   core.eligibility_config.audience_required = false (no audience measured)
 *   core.identity_config.identity_required    = false (no identity measured)
 *
 * WHY THIS AND NOT A SEVENTEENTH db/checks FILE. `ops/scripts/db-check.mjs`
 * exits 2 on any count but sixteen, "sixteen checks" is written into TWO
 * governed ASCII specifications (ADU-DB-01 v1.16 Appendix C and ADU-REPO-01
 * v1.3), and gates.mjs has already ruled on exactly this: "NOT a seventeenth
 * db/checks file ... a governed set". Appendix C is closed; the gate list is
 * not. This is a gate.
 *
 * WHY IT IS GREEN TODAY, AND WHAT THAT COSTS. The seed sets
 * seller_registration_enabled = false, because the beta IS invite-only. So the
 * gate passes now and turns red the day someone opens seller signup without
 * having raised a trust flag -- which is the "gate, not a memory" the ruling
 * asked for. D-93 is the reason it must not be red from birth: console
 * build-output gates that went red on every backend-only PR taught people that
 * "the gate lies", and a gate people learn to skip is worse than no gate.
 *
 * SAY PLAINLY WHAT THE FLAG DOES AND DOES NOT DO. NOTHING IN THE CODEBASE
 * READS seller_registration_enabled -- this gate is its FIRST reader. Setting
 * it false makes the flag HONEST ABOUT INTENT; it ENFORCES NOTHING. The beta
 * is invite-only because the founder controls who gets a link, not because any
 * code refuses anyone. That is fine for a beta and it must be written down,
 * because the day someone assumes the flag is enforcing is the day it isn't.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK. Not buyer registration: a buyer is not
 * a seller and nothing about a buyer is measured by these two flags. Not
 * activation_state: a market can be ACTIVE for OTP delivery while seller
 * signup stays shut, and conflating the two would fail markets that are doing
 * the right thing.
 *
 * FAIL-CLOSED ON A MISSING CONFIG ROW, matching 0018's own rule. An absent
 * identity_config means "identity required" everywhere else in this system
 * (`coalesce(v_idreq, true)`), so an absent row is NOT a reason to fail this
 * gate -- it means identity IS required, which is the safe side. An absent
 * eligibility_config is read the same way. The gate only fires when both are
 * present and both say false.
 */

import pg from 'pg';

const CONNECTION = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;
if (!CONNECTION) {
  console.error('FAIL  DATABASE_URL_MIGRATE / DATABASE_URL is not set.');
  process.exit(2);
}

const client = new pg.Client({ connectionString: CONNECTION });
await client.connect();

try {
  const { rows } = await client.query(`
    SELECT m.code,
           m.seller_registration_enabled,
           m.registration_enabled,
           -- coalesce to TRUE: an absent config row means the requirement
           -- HOLDS, which is how 0018's readiness rule reads it too.
           coalesce(ec.audience_required, true)  AS audience_required,
           coalesce(ic.identity_required, true)  AS identity_required
      FROM core.market m
      LEFT JOIN core.eligibility_config ec
        ON ec.market_id = m.id AND ec.effective @> now()
      LEFT JOIN core.identity_config ic
        ON ic.market_id = m.id AND ic.effective @> now()
     ORDER BY m.code`);

  const open = rows.filter(
    (r) =>
      r.seller_registration_enabled === true &&
      r.registration_enabled === true &&
      r.audience_required === false &&
      r.identity_required === false,
  );

  for (const r of rows) {
    const measured = [
      r.audience_required ? 'audience' : null,
      r.identity_required ? 'identity' : null,
    ].filter(Boolean);
    console.log(
      `  ${r.code.padEnd(8)} seller signup ${r.seller_registration_enabled ? 'OPEN  ' : 'closed'}` +
        `   measures: ${measured.length ? measured.join(' + ') : 'NOTHING'}`,
    );
  }

  if (open.length === 0) {
    console.log('\nPASS  no market is open to public seller signup while measuring nothing.');
    process.exit(0);
  }

  console.error(
    `\nFAIL  ${open.length} market(s) open to public SELLER registration with ` +
      'neither audience nor identity required:\n' +
      open.map((r) => `        ${r.code}`).join('\n') +
      '\n\n      The product\'s entire claim is that trust is measurable. Open ' +
      'signup\n      with nothing measured would falsify it on day one, and it ' +
      'would do so\n      SILENTLY, because nothing else raises.\n\n' +
      '      Either set core.eligibility_config.audience_required = true, or set\n' +
      '      core.identity_config.identity_required = true, or keep seller signup\n' +
      '      closed while the cohort is hand-picked (T18 S5, register D-237).',
  );
  process.exit(1);
} finally {
  await client.end();
}
