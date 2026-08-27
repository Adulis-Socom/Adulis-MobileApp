import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { createLogger } from './common/logging';

/**
 * Process 1 of 2 — the HTTP API (ADU-CON-02 v3.0 section 1).
 *
 * TIER 3 — the section 5 pipeline is live. The express-level stages
 * (request id, body limit, CORS + Origin, locale) are wired by
 * configureApp — one wiring, shared with every e2e test; the Nest-level
 * stages (authenticate, seller context, handler transaction, error
 * mapper) are app.module.ts's.
 */
async function bootstrap(): Promise<void> {
  const log = createLogger();
  const app = await NestFactory.create(AppModule, { logger: false });

  await configureApp(app, process.env['CONSOLE_ORIGIN'] ?? '');

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  log.info({ msg: 'api listening', route: '/healthz', statusCode: 200 });
}

void bootstrap();
