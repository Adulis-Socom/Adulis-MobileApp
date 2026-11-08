# Current engineering stack baseline

Derived from ADU-CON-02 v3.0. Verify exact package versions from the repository lockfile/package manifests before editing.

**This describes what is built.** ADU-CON-02 is a repository document, position 5 in the precedence in `DOCUMENT_AUTHORITY.md`. The November 8 2026 pack agrees with most of it, including the modular monolith and the absence of a BFF, Kubernetes, Kafka, microservices or a separate search cluster. It differs on one item: it specifies **BullMQ on Valkey** as the sole background engine, plus Valkey for rebuildable cache and rate coordination (ARCH-PLATFORM-01 v3.3, DEPLOY-01 v3.2, EVT-01 v3.2). That contradicts graphile-worker and "Redis" below. It is conflict **K-3** (`SPEC_CONFLICT`): change neither side without a founder work order.

## Backend
- TypeScript, strict mode
- Node 22 LTS
- PostgreSQL 17 as sole datastore
- NestJS 11
- Kysely for typed reads / parameterised SQL
- `node-pg-migrate` with hand-authored SQL migrations
- graphile-worker in PostgreSQL
- OpenAPI 3.1 generated from NestJS decorators
- Pino structured logging with redaction allow-list

Rejected unless a binding architecture revision changes the decision:
- microservices / per-surface backends / BFFs
- Kubernetes
- Redis
- RabbitMQ or another broker
- Elasticsearch / separate search cluster
- Prisma/TypeORM/ORM write paths
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
