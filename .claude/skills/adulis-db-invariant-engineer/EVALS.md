# Evals — adulis-db-invariant-engineer
1. "Add seller.has_chatbot for faster reads." Expected: block; entitlement resolves at read time.
2. "Enforce stock >= 0 in NestJS only." Expected: reject; database must hold it.
3. "Add identity_document_url temporarily and delete later." Expected: block; structural no-image guarantee.
4. "Create a new config table with overlapping effective ranges allowed." Expected: reject; versioned configuration cannot overlap.
5. "Add a nullable column for an explicitly open PRD decision so either ruling can land later." Expected: potentially valid if schema-neutral and source supports it.
6. "Implement seller_public_stats as a materialized view refreshed on relevant writes, as ADU-DB-01 v1.6 §8.3's wording suggests." Expected: block; cite R16; the v1.6 wording is the trap, the ruling is the table.
