# WO-020 -- Security review (mobile frontend)

12 November 2026. An independent, read-only review of `b091de8..29ddbae` on
`mobile/wo-020-seller-companion-foundation`, done by a separate review agent that edited nothing
and ran nothing. **Scope: the mobile frontend only.** Backend enforcement (the API's scoping,
permissions, 403/404 semantics and mark-read authorization) was not reviewed; `apps/api`,
`apps/console` and `apps/storefront` were not read. This is not a backend security certification.

## Result

**No Critical, High or Medium finding.** Two Low findings were fixed (`bc46751`). Two Info items
were fixed with them; three are accepted and recorded.

| ID | Severity | Finding | Outcome |
|---|---|---|---|
| F1 | Low | With one store, a 404 on a store read removed that store's queries, which re-fetched, failed again and called `refused` again: a request loop while the list still named the store | **Fixed.** `refused` no longer removes queries; it releases a chosen store and re-reads list and bootstrap once per failure. Test "F1" bounds the requests and fails on the old code |
| F2 | Low | The store inbox showed protected notices (payout change with bank code and last four digits; new sign-in) as a generic line with Mark as read, so a user could mark them read everywhere (read state syncs to the Seller Console) without seeing them | **Fixed (fail-closed).** A non-suppressible store notice offers no Mark as read and says to read it in the Seller Console; `suppressible` counts only as an explicit true. The wider rule (Buyer inbox too) is a founder decision (W20-16) |
| F3 | Info | The store context was keyed by the bearer string (visible in development tools) | **Fixed.** Key removed: the gate already unmounts the context when the session ends |
| F4 | Info | Notification slots (including `bank_code`, `account_last4`) sit unfiltered in memory (not rendered, not persisted, not logged) | Accepted; a future Seller template must not render them unless intended |
| F5 | Info | The gate trusts a cached bootstrap (5 minutes): a just-revoked Account may still see the Seller shell, never data (the list is re-read each visit; every read is server-scoped; a 404 re-reads the bootstrap) | Accepted |
| F6 | Info | Two stores with the same name, role and status could not be told apart in the chooser | **Fixed.** The chooser shows the @handle |
| F7 | Info | An Order 404 does not release the store (correct: it does not prove revocation) | Accepted |

## Verdicts

| # | Check | Verdict |
|---|---|---|
| 1 | Server-derived availability | PASS: only a signed-in session with `seller_companion.available === true`; diagnostics add only the Courier shell; the active mode is display-only; the store choice is memory-only |
| 2 | MOBILE audience | PASS: the existing MOBILE bearer through the session-bound client; no CONSOLE path or new credential |
| 3 | Relationship validation | PASS: the active store is always a row of the parsed list; UUID checked in the parser and again before sending; no identity from handle, name or route |
| 4 | `X-Adulis-Seller` scoping | PASS: per call (overview, orders, order, store inbox); not on the list, mark-read or any Buyer call |
| 5 | Cross-Seller and stale results | PASS: keys per store; a switch removes the previous store's queries; mark-read writes only into the store it was captured from |
| 6 | Cross-Account | PASS: sign-out and 401 clear the whole cache; requests are session-bound |
| 7 | 401 / 403 / 404 | PASS (after F1) |
| 8 | Cached data, logs, labels | PASS (F4 noted): gcTime 0 for store data, no persister, no new logging, no secret in accessibility labels |
| 9 | Financial and operational controls | PASS: no Seller mutation, read-all, payment, ready, cancel or refund call is reachable; `allowed_actions` and payment submissions are never read |
| 10 | Secrets | Info F3 (fixed) |
| 11 | Other | F1, F2, F6 |

## Also found and fixed during WO-020 (not by the review)

- `verify:deps`: a dependency cycle (session -> ui-store -> modes -> session) introduced by the mode
  hook; the hook moved to `ModeLayout.tsx` (`bc46751`).
- A sub-screen redirect before the store list loaded (W20-08), and the bundle-vocabulary key (W20-11).
