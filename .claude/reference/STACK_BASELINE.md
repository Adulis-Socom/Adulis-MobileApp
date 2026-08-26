# Current engineering stack baseline

Derived from ADU-CON-02 v3.0. Verify exact package versions from the repository lockfile/package manifests before editing.

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
- Mobile: React Native + Expo
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
