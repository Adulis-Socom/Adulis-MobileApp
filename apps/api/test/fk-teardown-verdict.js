'use strict';
/**
 * The verdict of the foreign-key teardown (INF-03), kept pure so a failed audit can be proven never to
 * pass a run: ops/scripts/fk-teardown-verdict.test.mjs covers every case without a database.
 *
 * A pass needs ALL of: exit status 0, the audit's banner ("Foreign-key audit -- "), and its PASS line.
 * Status 1 with the banner is orphaned rows (or a known leak over its limit). Anything else -- another
 * status, a signal, a spawn error, no banner -- is an audit that did not run to its verdict.
 */
function teardownVerdict({ status, signal, error, stdout }) {
  const out = typeof stdout === 'string' ? stdout : '';
  const audited = out.includes('Foreign-key audit -- ');
  if (status === 1 && audited)
    return {
      ok: false,
      reason: 'orphans',
      message:
        '[fk-audit] the suites left orphaned rows beyond the known test leaks, or more rows on a known leak than it may leave (listed above)',
    };
  if (status !== 0 || !audited)
    return {
      ok: false,
      reason: 'did-not-run',
      message: `[fk-audit] the foreign-key audit did not run to its verdict (status ${status}, signal ${signal}, ${error && error.message ? error.message : 'see above'})`,
    };
  if (!/^PASS {2}all \d+ foreign keys hold/m.test(out))
    return {
      ok: false,
      reason: 'no-pass-line',
      message: '[fk-audit] the foreign-key audit exited 0 without its PASS line',
    };
  return { ok: true, reason: 'pass', message: '' };
}

module.exports = { teardownVerdict };
