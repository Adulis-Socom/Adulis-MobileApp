import { createTableBlocks, ok, bad } from './_lib.mjs';

/**
 * Appendix C check 11 — `account_ciphertext` exists only in `financial`.
 *
 * Guards ADU-DB-01 v1.8 section 13.6. `core.payout_details` holds `bank_code` and
 * `account_last4` and nothing more, so every seller, team, support and admin
 * surface reads a masked value BECAUSE THAT IS THE ONLY VALUE PRESENT — not
 * because it remembered to mask. The masking invariant holds by structure.
 *
 * "Cheaper to check than a revoked grant: it fails loudly if a future migration
 * reintroduces the column for convenience."
 *
 * IMPLEMENTATION NOTE. Appendix C writes this as `grep -c "account_ciphertext"
 * core migrations` = 0, but the column legitimately exists in
 * `financial.payout_credential` (migration 10), so a whole-tree grep for the word
 * would fail at Tier 2 on correct DDL. This check parses `CREATE TABLE` blocks
 * and asserts the column appears in no table whose schema is `core` — which is
 * what "core migrations" means, done so that it stays true when `financial`
 * lands.
 */
export default {
  id: 11,
  title: 'No account_ciphertext on any core table',
  source: 'ADU-DB-01 v1.8 section 13.6',
  kind: 'grep',
  liveAtTier: 1,
  expected: '0 in schema core',
  run({ migrations }) {
    const coreTables = createTableBlocks(migrations).filter((b) => b.schema === 'core');
    const offenders = coreTables.filter((b) => /account_ciphertext/i.test(b.body));
    return offenders.length === 0
      ? ok(`0 in schema core (${coreTables.length} core table(s) inspected)`)
      : bad(`present on core.${offenders.map((o) => o.table).join(', core.')}`);
  },
};
