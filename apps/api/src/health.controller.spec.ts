import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from './health.controller';
import { DatabaseModule } from './common/db/database.module';

/**
 * GET /healthz — the only route at Tier 0.
 *
 * `db` reflects a real SELECT 1 against DATABASE_URL, so this runs against the
 * live local database like the settings test does. A green /healthz that never
 * touched Postgres would be the exact lie ADU-CON-02 section 20.2 relies on this
 * endpoint not telling.
 */
describe('GET /healthz', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!process.env['DATABASE_URL']) {
      throw new Error(
        'DATABASE_URL is not set. /healthz reports real database reachability.\n' +
          'Run:  docker compose up -d  &&  cp .env.example .env',
      );
    }
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      controllers: [HealthController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 and db up when the database is reachable, and reports the worker', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    // 200 regardless of the WORKER's state: section 18 makes a 503 here the
    // signal that removes an instance from traffic, and a dead worker must
    // not take the API down with it (T4 register E-5). The worker's health
    // is reported in the body, which is what the uptime check reads.
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('up');
    expect(['up', 'stale', 'never_started']).toContain(res.body.worker);
    expect(res.body.status).toBe(res.body.worker === 'up' ? 'ok' : 'degraded');
  });

  it('reports db state as a literal up/down value, never a free-text message', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(['up', 'down']).toContain(res.body.db);
    expect(['ok', 'degraded']).toContain(res.body.status);
  });
});
