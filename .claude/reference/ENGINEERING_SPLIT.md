# Engineering ownership split

## CEO — backend / infrastructure / database
Owns PostgreSQL, SQL migrations, database functions/constraints/RLS, NestJS API, worker/jobs, authentication and authorization authority, OpenAPI publication, infrastructure, Cloudflare/Render/R2 operational configuration, observability platform, backup/restore, and backend security.

## COO/CTO — frontend / UI/UX
Owns the public website and storefront UI, seller PWA, mobile Buyer Mode, Seller Companion, design system, UI/UX, accessibility, client-side localisation, app-store UI compliance, and generated API-client consumption.

## Shared boundary
`ADU-API-01` is a contract between the two developers. Any breaking or semantics-changing API contract change requires explicit coordination. The front end must not reconstruct business state from raw inputs; the backend must not return rendered English prose where the contract requires localisable message keys.
