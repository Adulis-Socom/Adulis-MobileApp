/**
 * common/env.ts -- NODE_ENV is asserted at a boundary, never consulted at a
 * call site (ADU-RUL-03 S1.2).
 *
 * The defect this closes: `ops/render.yaml` does not exist (D-80), so nothing
 * in this repository sets NODE_ENV=production -- which made every
 * `NODE_ENV === 'production'` check a no-op, including WORK ORDER T7 S3.2's
 * own rule that each fake adapter must refuse to run in production. The rules
 * were true as written and false in effect, because the environment they
 * tested was never set.
 *
 * A service that cannot determine its environment must not pick the
 * permissive default. Here the permissive default was "print OTP codes", and
 * that is the general shape: the unset case always resolves to whichever
 * branch was written second.
 */

/**
 * THE CLOSED SET. `staging` joined it in T23 Phase 4, and adding a value here
 * is not a one-line change: EVERY GUARD THAT ASKS `=== 'production'` TAKES ITS
 * PERMISSIVE BRANCH FOR THE NEW VALUE, silently, on the day it is added. That
 * is the exact failure this file was written to prevent, so the audit is
 * recorded here rather than left to be repeated.
 *
 * Every site that reads this value, and what staging does at each:
 *
 *   assertFakeIsPermitted()      refuses only in production. STAGING PERMITS
 *     common/adapters/fake-guard  FAKES, deliberately: there is no SMS vendor
 *                                 contract yet (O-5b is open), so a staging
 *                                 that refused fakes could not sign anyone in.
 *
 *   FakeSmsAdapter               development writes the code to a 0600 file;
 *     modules/auth/sms.adapter    STAGING WRITES IT TO THE LOGGER, which is the
 *                                 boundary the founder stated for T23: "staging
 *                                 is a real server on the internet with no
 *                                 confidentiality -- anyone who can read its
 *                                 logs can sign in as anyone. It is
 *                                 invite-only, it carries no real seller, and
 *                                 it is not publicly linked." The branch is
 *                                 keyed on `=== 'staging'` EXACTLY, never on
 *                                 `!== 'production'`: a negated guard admits
 *                                 every value added after it, which is how this
 *                                 defect class propagates.
 *
 *   ops/scripts/seed.mjs         refuses production. Staging IS seeded -- it
 *                                 carries no real seller, and a market that was
 *                                 never seeded is a staging server nobody can
 *                                 sign in to.
 *
 *   ops/scripts/gates.mjs        keys off `development`; unaffected.
 *
 * The console build is NOT in this set and must never be. `NODE_ENV=staging`
 * reaching Vite ships React's development build, which the `production-react`
 * gate fails on. The console learns its environment from `/v1/bootstrap`, at
 * runtime, from the API it is actually talking to -- which is also the only
 * source that cannot disagree with reality.
 */
export const NODE_ENVS = ['development', 'test', 'staging', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

let resolved: NodeEnv | null = null;

/**
 * Read, validate and memoise NODE_ENV. Throws if it is unset or outside the
 * closed set -- the process must refuse to start rather than guess.
 */
export function assertNodeEnv(): NodeEnv {
  const raw = process.env['NODE_ENV'];
  if (raw === undefined || raw === '') {
    throw new Error(
      'NODE_ENV is not set. This process refuses to start rather than assume an ' +
        `environment: set it to one of ${NODE_ENVS.join(', ')}. (ADU-RUL-03 S1.2 -- ` +
        'a guard on an environment nobody sets is not a guard.)',
    );
  }
  if (!(NODE_ENVS as readonly string[]).includes(raw)) {
    throw new Error(
      `NODE_ENV is '${raw}', which is not one of ${NODE_ENVS.join(', ')}. ` +
        'An unrecognised environment is refused for the same reason an unset one is: ' +
        'every guard downstream would take its permissive branch.',
    );
  }
  resolved = raw as NodeEnv;
  return resolved;
}

/**
 * The validated environment. Call sites consult THIS, never process.env, so
 * that the unset case is impossible here rather than handled here.
 */
export function nodeEnv(): NodeEnv {
  return resolved ?? assertNodeEnv();
}

/** Test seam: forget the memoised value so a spec can assert both branches. */
export function resetNodeEnvForTests(): void {
  resolved = null;
}
