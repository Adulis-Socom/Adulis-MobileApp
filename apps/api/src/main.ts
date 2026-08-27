import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createLogger } from './common/logging';

/**
 * Process 1 of 2 — the HTTP API (ADU-CON-02 v3.0 section 1).
 *
 * TIER 0 scope. The request pipeline of section 5 (request id, body limit,
 * CORS + Origin, locale, authenticate, seller context, rate limit, idempotency,
 * error mapper) is TIER 3 and is deliberately absent: every stage of it depends
 * on tables that do not exist until migrations 1-5, and on ADU-AUTH-01 v2.1 for
 * the remembered-device session values (R17), which has not been reissued.
 */
async function bootstrap(): Promise<void> {
  const log = createLogger();
  const app = await NestFactory.create(AppModule, { logger: false });

  // 256 KB. Media never transits the API (section 8.1), so nothing legitimate is
  // near this: the client PUTs derivatives straight to R2 via signed URLs.
  const { json, urlencoded } = await import('express');
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ limit: '256kb', extended: true }));

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  log.info({ msg: 'api listening', route: '/healthz', statusCode: 200 });
}

void bootstrap();
