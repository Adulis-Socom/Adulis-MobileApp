import 'reflect-metadata';
// MUST precede the app.module import: it declares this build's NODE_ENV
// before app.module.ts constructs its adapters at module load. See the file.
import './build-tool-env';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Type } from '@nestjs/common';
import { ModulesContainer, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ProblemDto } from './common/errors/problem.dto';
import { applyProblemResponses, applySellerHeader } from './common/http/openapi-derived';
import { LEGACY_COMMERCE_CONTROLLERS, applyGuardSecurity } from './common/http/openapi-security';


/**
 * The producer of contracts/openapi.json — the one seam between the backend
 * and every client (root CLAUDE.md: tracked in git, CI its only author; a
 * human-authored diff fails the build).
 *
 * ADU-REPO-01 v1.2 S5.1 — /v1 MUST APPEAR IN THE PATH KEYS.
 * setGlobalPrefix prefixes the ROUTES and leaves the Swagger document keys
 * unprefixed: a spec that serves correctly from the real API and 404s
 * against every mocked path, which is the worst shape available because
 * nothing looks broken until a front end uses the seam. Prism serves what
 * the path keys say and ignores servers[].url. So the keys are prefixed
 * HERE, explicitly, and `pnpm verify:contract` asserts it from the outside.
 *
 * /healthz is excluded from the contract deliberately: it is the platform's
 * probe endpoint (Render, uptime ping), not part of the client seam.
 *
 * Determinism: the document is serialised with sorted path keys so that
 * regeneration on an unchanged tree is byte-identical — which is what lets
 * CI regenerate and `git diff --exit-code` as the hand-edit tripwire.
 */
/** The cross-cutting behaviour no single operation carries: said once, here, instead of on every operation. */
const API_DESCRIPTION = [
  'Every response carries `X-Adulis-Request-Id` and `Content-Language` (`en` or `am`, resolved from the optional',
  '`Accept-Language` request header; the API sends message keys, never rendered text). A replayed keyed request',
  'answers with the stored response and `X-Adulis-Idempotent-Replay: true`. `Retry-After` accompanies a 429 and a 503.',
  'A browser write that carries the session cookie must also send the console `Origin` header; without it the',
  'answer is 403 PERMISSION_DENIED. A mobile app authenticates with its bearer token and sends no `Origin`.',
].join(' ');

/**
 * APP.MODULE IS IMPORTED DYNAMICALLY, and that is the fix rather than a
 * flourish (#25 review, corrected by #26's).
 *
 * app.module constructs its adapters at MODULE LOAD, so the declaration in
 * ./build-tool-env only works if it runs first. The previous attempt asserted
 * that ordering by checking NODE_ENV afterwards, which cannot detect the
 * failure it names: with the imports reordered, app.module throws during its
 * own evaluation and the assertion never runs; with an ambient NODE_ENV it
 * passes in either order. It was a check that could not fail -- the family
 * ADU-RUL-03 S5.2 is about.
 *
 * A dynamic import makes the order a matter of control flow instead, which no
 * formatter or bundler reorders.
 */
async function generate(): Promise<void> {
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Adulis API')
    .setVersion('1')
    .setDescription(API_DESCRIPTION)
    // Opaque random credentials, not JWTs (AUTH-02 v3.3 S43; register API-2).
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'opaque' }, 'bearer')
    .addCookieAuth('__Host-adulis_session', { type: 'apiKey', in: 'cookie' }, 'cookie')
    .build();

  // ProblemDto is registered here as well as by the controllers that decorate it, so the problem
  // response applyProblemResponses adds to every other operation always resolves.
  const document = SwaggerModule.createDocument(app, config, { extraModels: [ProblemDto] });

  // Security comes from the guard's own @Public metadata, not from per-route decorators.
  const controllers = [...app.get(ModulesContainer).values()].flatMap((m) =>
    [...m.controllers.values()].map((w) => w.metatype).filter((t): t is Type => typeof t === 'function'),
  );
  applyGuardSecurity(document, controllers, LEGACY_COMMERCE_CONTROLLERS);
  applySellerHeader(document, controllers, LEGACY_COMMERCE_CONTROLLERS);
  applyProblemResponses(document, controllers, LEGACY_COMMERCE_CONTROLLERS);

  const paths: Record<string, unknown> = {};
  for (const key of Object.keys(document.paths).sort()) {
    if (key === '/healthz') continue;
    const prefixed = key.startsWith('/v1') ? key : `/v1${key}`;
    paths[prefixed] = document.paths[key];
  }
  document.paths = paths as never;

  const out = resolve(__dirname, '..', '..', '..', 'contracts', 'openapi.json');
  writeFileSync(out, JSON.stringify(document, null, 2) + '\n');
  console.log(`wrote ${out} (${Object.keys(paths).length} path keys)`);
  await app.close();
  process.exit(0);
}

void generate();
