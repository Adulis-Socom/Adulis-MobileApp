import type { INestApplication } from '@nestjs/common';
import { requestIdMiddleware } from './common/http/request-id.middleware';
import { localeMiddleware } from './common/http/locale.middleware';
import { makeOriginMiddleware } from './common/http/origin.middleware';

/**
 * The express-level stages of the section 5 pipeline, in pipeline order —
 * ONE wiring, used by main.ts and by every e2e test, so a test can never
 * pass against a mirror of the pipeline while the pipeline itself differs.
 */
export async function configureApp(
  app: INestApplication,
  consoleOrigin: string,
): Promise<void> {
  app.setGlobalPrefix('v1', { exclude: ['healthz'] });

  app.use(requestIdMiddleware);

  const { json, urlencoded } = await import('express');
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ limit: '256kb', extended: true }));

  app.enableCors({
    origin: consoleOrigin,
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'X-Adulis-Seller',
      'X-Adulis-Client',
      'X-Adulis-Device',
      'X-Adulis-Clock-Offset',
      'Accept-Language',
    ],
    exposedHeaders: ['X-Adulis-Request-Id', 'X-Adulis-Idempotent-Replay', 'Content-Language'],
  });

  app.use(makeOriginMiddleware(consoleOrigin));
  app.use(localeMiddleware);
}
