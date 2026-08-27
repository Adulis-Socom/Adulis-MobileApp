import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

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
async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Adulis API')
    .setVersion('1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

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
