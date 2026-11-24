# Approved target vs executable legacy stack

Read CURRENT_MVP_AUTHORITY.md and the controlled migration plan. Target Fastify, Drizzle, BullMQ/Valkey; legacy Express, Kysely, node-pg-migrate, Graphile Worker until authorized migration. Lists below describe legacy executable tooling unless noted. No migration authorized by this reference.

## Backend
- TypeScript, strict mode
- Node 22 LTS
- PostgreSQL 17 as durable datastore; target Valkey rebuildable
- NestJS 11
- Kysely for typed reads / parameterised SQL
- `node-pg-migrate` with hand-authored SQL migrations
- graphile-worker in PostgreSQL
- OpenAPI 3.1 generated from NestJS decorators
- Pino structured logging with redaction allow-list

Rejected unless a binding architecture revision changes the decision:
- microservices / per-surface backends / BFFs
- Kubernetes
- Redis/brokers other than approved, migration-gated Valkey/BullMQ
- Elasticsearch / separate search cluster
- Prisma/TypeORM and ORM writes bypassing SQL invariants
- Firebase/Supabase as backend authority
- JWT for sessions

## Frontend
- Public web: Next.js on Cloudflare Pages
- Seller console: React SPA on Cloudflare Pages
- Mobile: React Native + Expo. One app with Buyer, Seller Companion and Courier modes: Expo Router, TanStack Query, FlashList, Expo Image, SecureStore, SQLite, Camera, Notifications, Updates and a small Zustand store (ADU-MOB-02 v4.3). `apps/mobile` has all of these except Camera, Notifications and Updates, which arrive with the work orders that use them (`apps/mobile/CLAUDE.md`)
- TanStack Query for server state
- React Hook Form + Zod for forms
- `openapi-typescript` + `openapi-fetch` for generated API client
- `vite-plugin-pwa` for console PWA shell

## Infrastructure
- Cloudflare Pro: DNS, TLS, edge cache/rate limiting, Pages, R2
- Render Frankfurt: managed PostgreSQL, API x2, worker x1
- GitHub + Actions
- Docker
- pnpm

Treat provider details as configuration to verify before provisioning; ADU-CON-02 retains explicit provider-verification gates.
