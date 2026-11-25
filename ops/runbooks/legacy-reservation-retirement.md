# Legacy Reservation retirement -- a database that refuses migration 0063

Migration `0063_retire_legacy_reservation_model.sql` removes the legacy Reservation model and the order,
payment, refund, handoff, payout-change and subscription-purchase functions built on it (founder pre-launch
architectural authorization, 25 November 2026). It **refuses to run** on a database that still holds any
`core.reservation`, `core."order"` or `core.refund` row, or an open `billing.purchase_intent`, because dropping
those structures would destroy that history or strand stock a Reservation still holds. It also refuses an
open `billing.collection_record` or a `PENDING` `core.payout_details` change, because it drops the only functions
that could resolve them. It deletes no commerce, stock or audit row (it removes 13 permission catalogue entries
and their role grants, which are configuration).

If `pnpm db:migrate` stops with `legacy commerce rows present (...)`, decide which case you are in. Do not
work around the guard, and do not delete rows to make it pass.

## 1. Establish what the database is

Before anything else, record:

- the exact host, port and database name (`SELECT current_database(), inet_server_addr(), inet_server_port();`);
- whether it holds only synthetic or replaceable development data (the seed's `5eed0000-...` ids) or anything
  else: founder, business, financial or uploaded user records;
- whether another environment, person or service depends on it;
- whether it can be rebuilt reproducibly (`pnpm db:reset` + `pnpm db:seed`).

**A database whose contents or purpose are unknown is not disposable.** Stop and ask the owner.

## 2a. Verified disposable (local development or test, synthetic data only)

Rebuild it. `bash ops/scripts/test-db.sh down && bash ops/scripts/test-db.sh up` for the test database, or
`pnpm db:reset -- --confirm-target=<database>@<host>:<port>` then `pnpm db:migrate` and `pnpm db:seed` for a
local development database (both refuse a target they cannot name as local). The current seed creates no Order or Reservation, so 0063 applies.

## 2b. Anything else: preserve first, with the owner's approval

1. Take a full backup (`pg_dump -Fc`) and verify it restores into a scratch database.
2. Export the legacy commerce rows for the record, for example:
   `\copy (SELECT * FROM core.reservation) TO 'reservation.csv' CSV HEADER` -- and likewise `core."order"`,
   `core.refund`, `core.stock_event WHERE reservation_id IS NOT NULL`, open `billing.purchase_intent` and
   `billing.collection_record` rows, and `PENDING` `core.payout_details` rows.
3. For each `ACTIVE` Reservation, decide with the owner how the held stock is returned (a reviewed
   `RECONCILIATION` stock event per Variant) -- never by editing `stock_count`, which only the ledger writes.
4. Only then remove the legacy rows, in a reviewed, recorded operation, and apply 0063.

None of section 2b is automated, by design: it is a persistent-data operation and needs a named decision.
