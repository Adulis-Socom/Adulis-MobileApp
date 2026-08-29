import { Test } from '@nestjs/testing';
import { Module, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import pino from 'pino';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { startWorker, WORKER_CONCURRENCY, cronItemsForTest } from '../src/jobs/runtime';
import { S24_JOBS } from '../src/jobs/registry';
import { makeHeartbeatJob, HEARTBEAT_STALE_AFTER_SECONDS } from '../src/jobs/heartbeat';
import { createJobHarness, type Harness } from './jobs-harness';

/**
 * The worker runtime, and the heartbeat that makes its death visible.
 *
 * ADU-CON-02 S20.2 is the whole point: "a dead worker is discovered by us,
 * not by 48-hour-old unexpired orders." So the test that matters here is
 * not that the worker starts — it is that /healthz says something different
 * when it stops.
 *
 * T6 PHASE C — THE APP IS BUILT FROM THE REAL AppModule NOW, and that is the
 * whole of register D-79. This block used to compile a standalone module
 * (DatabaseModule plus HealthController), where the APP_GUARD-global
 * AuthGuard does not exist. In the assembled application it does, and
 * /healthz answered 401 SESSION_EXPIRED — Render polls it with no
 * Authorization header to decide whether an instance may take traffic, so
 * every instance would have been marked unhealthy and no deploy would ever
 * have gone live. D-51's careful 200-versus-503 decision was being tested
 * against a route that could not be reached.
 *
 * A controller tested only in a standalone module is a controller whose
 * global guards, filters and interceptors are untested.
 *
 * The heartbeat table is a SINGLETON — one row by construction (id boolean
 * PK with a CHECK) — so exactly one suite may own it. This one does. Phase
 * C's other four decisions live in t6-parked-decisions.spec.ts; D-51's live
 * here, beside the heartbeat, because two suites racing on one row is a
 * flake that reads as a real failure.
 */

@Module({ imports: [AppModule] })
class WorkerRuntimeAppModule {}

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

describe('the worker runtime', () => {
  let admin: Pool;
  let h: Harness;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    h = createJobHarness(new Date());
  });

  afterAll(async () => {
    await h.close();
    await admin.query(`DELETE FROM jobs.worker_heartbeat`);
    await admin.end();
  });

  it('schedules every job on a cron, with backfill disabled', () => {
    const items = cronItemsForTest();
    expect(items).toHaveLength(S24_JOBS.length);
    for (const item of items) {
      expect(item.match).toBeTruthy();
      // A worker down for an hour must not wake and run sixty expiry
      // sweeps: the next tick finds everything the missed ones would have.
      expect(item.options?.backfillPeriod).toBe(0);
    }
    expect(WORKER_CONCURRENCY).toBe(10);
  });

  it('the heartbeat writes ONE row however many times it beats', async () => {
    const beat = makeHeartbeatJob('test-worker', S24_JOBS.length);
    await beat.run(h.ctx);
    await beat.run(h.ctx);
    await beat.run(h.ctx);
    const rows = await admin.query(`SELECT worker_id, jobs_registered FROM jobs.worker_heartbeat`);
    // A heartbeat table that can hold two rows is a heartbeat that reads
    // green because SOME worker beat recently.
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ worker_id: 'test-worker', jobs_registered: 20 });
  });

  describe('/healthz reflects the worker, and never 503s because of it', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [WorkerRuntimeAppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await configureApp(app, 'http://localhost:5173');
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('answers AT ALL without a credential (D-79)', async () => {
      // The assertion that was missing. Public means AUTH-OPTIONAL, never
      // auth-ignored: a caller presenting a dead token is still refused.
      // Render presents none, which is exactly the case that was broken.
      const res = await request(app.getHttpServer()).get('/healthz');
      expect(res.status).not.toBe(401);
      expect(res.body.code).toBeUndefined();
      expect(res.body.db).toBe('up');
    });

    it('is ok while the heartbeat is fresh and degraded once it goes stale', async () => {
      const beat = makeHeartbeatJob('test-worker', S24_JOBS.length);
      h.clock.set(new Date());
      await beat.run(h.ctx);

      const fresh = await request(app.getHttpServer()).get('/healthz').expect(200);
      expect(fresh.body).toMatchObject({ status: 'ok', db: 'up', worker: 'up' });

      // Stop the worker: no new beat. Age the last one past the threshold —
      // the same thing a dead worker does, without waiting fifteen minutes.
      await admin.query(
        `UPDATE jobs.worker_heartbeat
            SET beat_at = now() - make_interval(secs => $1)`,
        [HEARTBEAT_STALE_AFTER_SECONDS + 60],
      );
      const stale = await request(app.getHttpServer()).get('/healthz').expect(200);
      expect(stale.body).toMatchObject({ status: 'degraded', worker: 'stale' });
      // Still 200: a dead WORKER must not pull healthy API instances out of
      // traffic (register D-51). The body is what the uptime check reads.
      expect(stale.body.db).toBe('up');
    });

    it('reports never_started when no worker has ever beaten', async () => {
      await admin.query(`DELETE FROM jobs.worker_heartbeat`);
      const res = await request(app.getHttpServer()).get('/healthz').expect(200);
      expect(res.body).toMatchObject({ status: 'degraded', worker: 'never_started' });
    });
  });

  it('boots, registers 21 tasks, ACTUALLY RUNS one through the queue, and stops cleanly', async () => {
    const log = pino({ level: 'silent' });
    await admin.query(`DELETE FROM jobs.worker_heartbeat`);
    const handle = await startWorker(log);
    try {
      // Twenty from S24 plus the heartbeat (ADU-CON-02 S20.2).
      expect(handle.jobNames).toHaveLength(21);
      expect(handle.jobNames).toContain('order.expire_sweep');
      expect(handle.jobNames).toContain('worker.heartbeat');

      // THE ASSERTION THAT EARNS ITS KEEP. Registration alone proved
      // nothing: the first version of this passed while the worker could
      // not insert a task at all (graphile-worker puts ROW-LEVEL SECURITY
      // on its own tables, and the role did not own them). The process
      // booted, logged healthy, and would have done no work forever —
      // which is precisely the silent failure this whole phase exists to
      // remove. So: enqueue a real job and wait for its EFFECT.
      await handle.runner.addJob('worker.heartbeat', {});
      const deadline = Date.now() + 20_000;
      let beats = 0;
      while (Date.now() < deadline && beats === 0) {
        const r = await admin.query(`SELECT count(*)::int AS n FROM jobs.worker_heartbeat`);
        beats = r.rows[0].n;
        if (beats === 0) await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(beats).toBe(1);
    } finally {
      await handle.stop();
    }
  }, 60000);
});
