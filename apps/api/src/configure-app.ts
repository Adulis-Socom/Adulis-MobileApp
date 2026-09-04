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

  /**
   * TRUSTED_PROXY_HOPS -- how many reverse proxies sit in front of this
   * process (T23 Phase 4). Express default is 0, and 0 is what a process
   * with no proxy must keep.
   *
   * WHAT IT DOES: with N hops, `req.ip` becomes the Nth-from-the-right entry
   * of X-Forwarded-For instead of the socket address. On a platform that
   * terminates TLS and forwards (Render adds exactly one hop), 1 makes
   * `req.ip` the caller; 0 makes it the load balancer's address, IDENTICAL
   * FOR EVERY REQUEST ON THE PLATFORM.
   *
   * WHAT IT DOES NOT DO, AND THIS IS THE HALF THAT MATTERS: it does not
   * re-enable the IP limiter. ADU-AUTH-01 v2.6 S15 REMOVED that control
   * rather than relaxing it, and S15.1 lists what must be documented and
   * tested before an IP limit may exist AT ALL -- trusted hops, forwarding
   * header, and spoofed-header behaviour. This value is the FIRST of those
   * three and is not the set. Anyone reintroducing a per-IP control on the
   * strength of this line has done one third of the work S15.1 requires.
   *
   * A NUMBER IS THE ONLY SAFE FORM. Express also accepts `true`, which means
   * "trust every proxy in the chain" -- and every entry of X-Forwarded-For a
   * caller may write themselves. A client that sends `X-Forwarded-For:
   * 1.2.3.4` then IS 1.2.3.4 as far as the application is concerned. So this
   * refuses anything that is not a non-negative integer rather than falling
   * back to a default, for the same reason NODE_ENV refuses to be unset: the
   * permissive branch is the one nobody chose.
   */
  const rawHops = process.env['TRUSTED_PROXY_HOPS'] ?? '0';
  if (!/^\d+$/.test(rawHops)) {
    throw new Error(
      `TRUSTED_PROXY_HOPS is '${rawHops}', which is not a non-negative integer. ` +
        'It is a COUNT of proxies, never a boolean: `true` trusts every ' +
        'X-Forwarded-For entry a caller can write, which makes the client the ' +
        'author of its own address. Set 0 for no proxy, 1 behind one (Render).',
    );
  }
  app.getHttpAdapter().getInstance().set('trust proxy', Number(rawHops));

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
