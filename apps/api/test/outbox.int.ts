import { Queue, QueueEvents, Worker, type Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createDb, createPool, type Db } from '../src/db/client';
import { appendEvent, type NewEvent } from '../src/events/outbox';
import { EventRegistry, type ConsumerDefinition, type EventDefinition } from '../src/events/registry';
import { createLogger } from '../src/platform/logging';
import { assertQueuePolicy, queueProducerConnection, queueWorkerConnection, RebuildableCache } from '../src/platform/valkey';
import { ConsumerError, EventConsumerRunner, type JobLike } from '../src/worker/consumer';
import { queueHealth } from '../src/worker/health';
import { OutboxReconciler, type ReconcileOptions } from '../src/worker/reconcile';
import { EVENTS_QUEUE, jobIdFor, OutboxRelay } from '../src/worker/relay';
import { freshReplacementDatabase, requireEnv, withClient, type TestDb } from './support';

/**
 * ARC-BE-04 / RBL-05-CLOSE behaviour proofs with SYNTHETIC handlers only: no business job exists before its
 * domain. Effects are counted in a non-unique table, so a second effect would show as a second row; only the
 * processed-event marker can keep the count at one.
 */
const log = createLogger({ service: 'test', level: 'fatal', release: 'test' });
const SYNTHETIC: EventDefinition = { type: 'test.synthetic_happened', version: 1, scopes: ['GLOBAL'], payload: z.strictObject({ n: z.int() }) };
const OTHER: EventDefinition = { type: 'test.other_happened', version: 1, scopes: ['GLOBAL'], payload: z.strictObject({ n: z.int() }) };
let failNext = 0;
let failPermanently = false;
const recorder: ConsumerDefinition = {
  name: 'test.synthetic-recorder',
  eventType: SYNTHETIC.type,
  eventVersion: 1,
  jobVersion: 1,
  priorityClass: 'P2',
  criticality: 'IMPORTANT',
  attempts: 3,
  async handle(tx, event) {
    await tx.execute(sql`insert into synthetic.effect (event_id) values (${event.eventId})`);
    if (failPermanently) throw new ConsumerError('PERMANENT_VALIDATION', 'synthetic-permanent');
    if (failNext > 0) {
      failNext -= 1;
      throw new Error('synthetic transient failure'); // rolls back the effect AND the marker
    }
    return 'SUCCEEDED';
  },
};
const registry = new EventRegistry([SYNTHETIC, OTHER], [recorder]);
const newEvent = (n: number, type = SYNTHETIC.type): NewEvent => ({
  event_type: type,
  event_version: 1,
  scope: 'GLOBAL',
  aggregate_type: 'synthetic',
  aggregate_id: `agg-${n}`,
  aggregate_revision: n,
  logical_effect_id: `effect-${n}`,
  actor: { actor_type: 'SYSTEM', trusted_service_ref: 'test-suite' },
  correlation_id: `corr-${String(n).padStart(6, '0')}`,
  payload: { n },
});
const jid = (eventId: string) => jobIdFor(recorder.name, eventId);

describe('transactional outbox, relay and idempotent consumers (ARC-BE-04)', () => {
  let tdb: TestDb;
  let apiPool: Pool;
  let workerPool: Pool;
  let apiDb: Db;
  let workerDb: Db;
  let producer: Redis;
  let queue: Queue;

  const count = async (q: string) => withClient(tdb.superuser, async (c) => (await c.query(q)).rows[0].n as number);
  const effects = (eventId: string) => count(`select count(*)::int as n from synthetic.effect where event_id = '${eventId}'`);
  const deadLetters = (where: string) => count(`select count(*)::int as n from platform.async_dead_letter where ${where}`);
  const delivery = (eventId: string) =>
    withClient(tdb.superuser, async (c) =>
      (await c.query(`select state, enqueue_attempts, reconcile_attempts, last_error_code from platform.event_delivery where event_id = $1`, [eventId])).rows[0],
    );
  const append = (n: number, type = SYNTHETIC.type) => apiDb.transaction((tx) => appendEvent(tx, registry, newEvent(n, type)));
  const relay = (q: Pick<Queue, 'add'> = queue, owner = 'relay-a', reg = registry) => new OutboxRelay(workerDb, q, reg, { owner, batchSize: 50, leaseMs: 30_000 }, log);
  const runner = () => new EventConsumerRunner(workerDb, registry, log);
  const reconciler = (opts: Partial<ReconcileOptions> = {}, q: Pick<Queue, 'add' | 'getJob'> = queue) =>
    new OutboxReconciler(workerDb, q, registry, { batchSize: 100, staleMs: 60_000, maxRematerializations: 5, ...opts }, log);
  /** The job exactly as the relay put it in Valkey: the only honest input to the consumer. */
  const jobFor = async (eventId: string, attemptsMade = 0): Promise<JobLike & { id: string; data: Record<string, unknown> }> => {
    const job = await queue.getJob(jid(eventId));
    if (!job?.id) throw new Error(`no queued job for ${eventId}`);
    return { id: job.id, data: job.data as Record<string, unknown>, attemptsMade, opts: { attempts: 3 } };
  };
  /** Valkey lost the job (eviction, flush, failover) after PostgreSQL recorded QUEUED. */
  const loseJob = async (eventId: string) => {
    await (await queue.getJob(jid(eventId)))?.remove();
    expect(await queue.getJob(jid(eventId))).toBeUndefined();
  };
  /** Makes one delivery old enough, and unchecked, for the reconciler (staleMs 60 s) without waiting. */
  const age = (eventId: string) =>
    withClient(tdb.superuser, (c) => c.query(`update platform.event_delivery set updated_at = now() - interval '1 hour', reconcile_checked_at = null where event_id = $1`, [eventId]));
  const jobsWithId = async (eventId: string) =>
    (await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed', 'prioritized'])).filter((j) => j?.id === jid(eventId));

  beforeAll(async () => {
    tdb = await freshReplacementDatabase('outbox');
    await withClient(tdb.migrator, (c) =>
      c.query(`create schema synthetic;
               create table synthetic.effect (id bigserial primary key, event_id uuid not null);
               grant usage on schema synthetic to adulis_worker;
               grant select, insert on synthetic.effect to adulis_worker;
               grant usage on sequence synthetic.effect_id_seq to adulis_worker;`),
    );
    apiPool = createPool(tdb.api, 'test-api', 4);
    workerPool = createPool(tdb.worker, 'test-worker', 4);
    apiDb = createDb(apiPool);
    workerDb = createDb(workerPool);
    producer = queueProducerConnection(requireEnv('QUEUE_VALKEY_URL'), log);
    await producer.connect();
    queue = new Queue(EVENTS_QUEUE, { connection: producer });
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await queue.close();
    producer.disconnect();
    await apiPool.end();
    await workerPool.end();
  });

  beforeEach(() => {
    failNext = 0;
    failPermanently = false;
  });

  it('a rolled-back transaction leaves no event behind', async () => {
    const before = await count('select count(*)::int as n from platform.event_outbox');
    await expect(
      apiDb.transaction(async (tx) => {
        await appendEvent(tx, registry, newEvent(1));
        throw new Error('domain mutation failed');
      }),
    ).rejects.toThrow('domain mutation failed');
    expect(await count('select count(*)::int as n from platform.event_outbox')).toBe(before);
  });

  it('an unregistered event or disallowed scope is refused at append', async () => {
    await expect(apiDb.transaction((tx) => appendEvent(tx, registry, { ...newEvent(2), event_type: 'test.unknown_happened' }))).rejects.toThrow(/not registered/);
    await expect(apiDb.transaction((tx) => appendEvent(tx, registry, { ...newEvent(2), payload: { n: 'two' } }))).rejects.toThrow();
  });

  it('an event committed before the process stopped is published by a later relay', async () => {
    const id = await append(3); // committed; no relay ran (the "crash")
    const result = await relay(queue, 'relay-after-restart').runOnce();
    expect(result.claimed).toBeGreaterThanOrEqual(1);
    expect(await delivery(id)).toMatchObject({ state: 'QUEUED', enqueue_attempts: 1 });
    expect(await queue.getJob(jid(id))).toBeDefined();
    expect(await count(`select count(*)::int as n from platform.event_outbox where event_id = '${id}' and dispatched_at is not null`)).toBe(1);
  });

  it('Valkey unavailable: the event stays durable and is published once Valkey returns', async () => {
    // A real client to a port nothing listens on, with reconnection off: Valkey is simply not there.
    const dead = new Redis('redis://127.0.0.1:1', { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, retryStrategy: () => null });
    dead.on('error', () => undefined);
    const deadQueue = new Queue(EVENTS_QUEUE, { connection: dead });
    deadQueue.on('error', () => undefined);
    const id = await append(4);
    const r1 = await relay(deadQueue, 'relay-down').runOnce();
    expect(r1.dispatched).toBe(0);
    expect(await delivery(id)).toMatchObject({ state: 'ENQUEUE_UNKNOWN', last_error_code: 'ENQUEUE_FAILED' });
    expect(await count(`select count(*)::int as n from platform.event_outbox where event_id = '${id}' and dispatched_at is null`)).toBe(1);
    // Never await close() on a queue whose connection never opened: it can wait for a ready that never comes.
    dead.disconnect();
    void deadQueue.close().catch(() => undefined);
    // The lease stops a second relay grabbing it early; after expiry a healthy relay finishes the job.
    expect((await relay(queue, 'relay-b').runOnce()).claimed).toBe(0);
    await withClient(tdb.worker, (c) => c.query(`update platform.event_outbox set lease_expires_at = now() - interval '1 second' where event_id = $1`, [id]));
    await relay(queue, 'relay-b').runOnce();
    expect(await delivery(id)).toMatchObject({ state: 'QUEUED', enqueue_attempts: 2, last_error_code: null });
  });

  it('enqueue accepted but acknowledgement lost: re-publication is the same physical job and one effect', async () => {
    const id = await append(5);
    await relay().runOnce();
    // Simulate the crash between BullMQ accepting and the relay recording it: state back to ENQUEUE_UNKNOWN,
    // event undispatched, lease expired.
    await withClient(tdb.superuser, async (c) => {
      await c.query(`update platform.event_delivery set state = 'ENQUEUE_UNKNOWN' where event_id = $1`, [id]);
      await c.query(`alter table platform.event_outbox disable trigger event_outbox_immutable`);
      await c.query(`update platform.event_outbox set dispatched_at = null, relay_owner = 'crashed', lease_expires_at = now() - interval '1 second' where event_id = $1`, [id]);
      await c.query(`alter table platform.event_outbox enable trigger event_outbox_immutable`);
    });
    await relay(queue, 'relay-c').runOnce();
    expect(await jobsWithId(id)).toHaveLength(1);
    const r = runner();
    expect(await r.process(await jobFor(id))).toBe('SUCCEEDED');
    expect(await r.process(await jobFor(id))).toBe('DUPLICATE');
    expect(await effects(id)).toBe(1);
  });

  it('a retried job applies its effect exactly once', async () => {
    const id = await append(6);
    await relay().runOnce();
    const r = runner();
    failNext = 1;
    // The rethrown error carries a class name only: BullMQ would otherwise keep the original text in Valkey.
    const thrown = await r.process(await jobFor(id, 0)).then(() => undefined, (e: unknown) => e as Error);
    expect(thrown?.message).toBe('Error');
    expect(await effects(id)).toBe(0); // the failed attempt rolled back its effect and its marker
    expect(await deadLetters(`source_event_id = '${id}'`)).toBe(0);
    expect(await r.process(await jobFor(id, 1))).toBe('SUCCEEDED');
    expect(await effects(id)).toBe(1);
    expect(await delivery(id)).toMatchObject({ state: 'SUCCEEDED' });
  });

  it('the same event delivered twice, even concurrently, has one effect', async () => {
    const id = await append(7);
    await relay().runOnce();
    const r = runner();
    const job = await jobFor(id);
    const outcomes = await Promise.all([r.process(job), r.process(job)]);
    expect(outcomes.sort()).toEqual(['DUPLICATE', 'SUCCEEDED']);
    expect(await r.process(job)).toBe('DUPLICATE');
    expect(await effects(id)).toBe(1);
  });

  it('exhausted and permanent failures become sanitized dead letters', async () => {
    const id = await append(8);
    await relay().runOnce();
    const r = runner();
    failNext = 5;
    await expect(r.process(await jobFor(id, 2))).rejects.toThrow(); // third of three attempts
    const dl = await withClient(tdb.superuser, async (c) => (await c.query(`select * from platform.async_dead_letter where source_event_id = $1`, [id])).rows[0]);
    expect(dl).toMatchObject({ logical_job_id: jid(id), failure_class: 'TRANSIENT', attempt_count: 3, resolution_status: 'UNRESOLVED', effect_may_have_happened: false });
    expect(dl.sanitized_summary).not.toContain('synthetic transient failure');
    expect(await delivery(id)).toMatchObject({ state: 'DEAD_LETTERED' });

    const id2 = await append(9);
    await relay().runOnce();
    failPermanently = true;
    await expect(r.process(await jobFor(id2, 0))).rejects.toThrow('PERMANENT_VALIDATION');
    expect(await deadLetters(`source_event_id = '${id2}' and failure_class = 'PERMANENT_VALIDATION'`)).toBe(1);
  });

  it('a job for an event that does not exist is quarantined once, not retried', async () => {
    const ghost = '00000000-0000-4000-8000-00000000dead';
    const real = await append(14);
    await relay().runOnce();
    const job = await jobFor(real);
    const forged = { ...job, id: 'forged-ghost', data: { ...job.data, source_event_id: ghost, logical_job_id: jid(ghost) } };
    await expect(runner().process(forged)).rejects.toThrow('PERMANENT_VALIDATION');
    expect(await deadLetters(`logical_job_id = 'quarantine.forged-ghost' and failure_fingerprint = 'event-missing' and source_event_id is null`)).toBe(1);
    expect(await deadLetters(`logical_job_id = '${jid(ghost)}'`)).toBe(0);
  });

  it('the fallback dead letter never overwrites the precise one written by process()', async () => {
    const id = await append(12);
    await relay().runOnce();
    const r = runner();
    const job = await jobFor(id, 0);
    failPermanently = true;
    await expect(r.process(job)).rejects.toThrow('PERMANENT_VALIDATION');
    await r.recordFinalFailure(job);
    expect(await deadLetters(`source_event_id = '${id}'`)).toBe(1);
    expect(await deadLetters(`source_event_id = '${id}' and failure_class = 'PERMANENT_VALIDATION'`)).toBe(1);
  });

  it('the consumer transaction carries the SYSTEM context', async () => {
    let seen: string | undefined;
    const probe: ConsumerDefinition = {
      ...recorder,
      name: 'test.context-probe',
      async handle(tx) {
        seen = (await tx.execute<{ v: string }>(sql`select current_setting('adulis.actor_role', true) as v`)).rows[0]?.v;
        return 'SUCCEEDED';
      },
    };
    const probeRegistry = new EventRegistry([SYNTHETIC], [probe]);
    const id = await append(13);
    await relay(queue, 'relay-probe', probeRegistry).runOnce(); // materialises the probe's own delivery
    const job = await queue.getJob(jobIdFor(probe.name, id));
    expect(await new EventConsumerRunner(workerDb, probeRegistry, log).process({ id: job?.id, data: job?.data, attemptsMade: 0, opts: { attempts: 1 } })).toBe('SUCCEEDED');
    expect(seen).toBe('SYSTEM');
  });

  it('a malformed or unknown-version job is refused, never coerced', async () => {
    const r = runner();
    await expect(r.process({ id: 'malformed', data: { nonsense: true }, attemptsMade: 0, opts: { attempts: 3 } })).rejects.toThrow('POISON_PAYLOAD');
    const id = await append(10);
    await relay().runOnce();
    const job = await jobFor(id);
    await expect(r.process({ ...job, data: { ...job.data, job_version: 2 } })).rejects.toThrow('UNSUPPORTED_VERSION');
    expect(await effects(id)).toBe(0);
    expect(await delivery(id)).toMatchObject({ state: 'QUEUED' }); // an unverified job never touches the delivery
  });

  describe('durable delivery verification (RBL-05-CLOSE B)', () => {
    it('a job with no durable delivery row is quarantined and never executed', async () => {
      const id = await append(30);
      await relay().runOnce();
      const forged = await jobFor(id); // exactly the relay's job; only the durable delivery row is then removed
      await withClient(tdb.superuser, (c) => c.query(`delete from platform.event_delivery where event_id = $1`, [id]));
      await expect(runner().process(forged)).rejects.toThrow('SECURITY_FAILURE');
      expect(await effects(id)).toBe(0);
      expect(await deadLetters(`logical_job_id = 'quarantine.${jid(id)}' and failure_fingerprint = 'delivery-missing'`)).toBe(1);
      expect(await delivery(id)).toBeUndefined(); // nothing was created on the job's say-so
    });

    it('a mismatched job identity cannot touch, or dead-letter, another valid delivery', async () => {
      const a = await append(32);
      const b = await append(33);
      await relay().runOnce();
      const jobA = await jobFor(a);
      const r = runner();
      // Logical id of A, event of B.
      await expect(r.process({ ...jobA, data: { ...jobA.data, source_event_id: b } })).rejects.toThrow('SECURITY_FAILURE');
      // Correct data, but a physical job id that is not the delivery's.
      await expect(r.process({ ...jobA, id: 'someone-else.physical' })).rejects.toThrow('SECURITY_FAILURE');
      // The fallback path verifies the same way.
      await r.recordFinalFailure({ ...jobA, data: { ...jobA.data, source_event_id: b } });
      for (const id of [a, b]) {
        expect(await delivery(id)).toMatchObject({ state: 'QUEUED' });
        expect(await effects(id)).toBe(0);
        expect(await deadLetters(`logical_job_id = '${jid(id)}' or source_event_id = '${id}'`)).toBe(0);
      }
      expect(await deadLetters(`logical_job_id like 'quarantine.%' and failure_fingerprint = 'job-identity-mismatch'`)).toBeGreaterThanOrEqual(1);
      // The real job still works afterwards.
      expect(await r.process(jobA)).toBe('SUCCEEDED');
    });

    it('a wrong event type or version is refused before any effect', async () => {
      const other = await append(34, OTHER.type); // an event of a type the recorder does not consume
      const id = await append(35);
      await relay().runOnce();
      const job = await jobFor(id);
      await expect(runner().process({ ...job, data: { ...job.data, source_event_id: other, logical_job_id: jid(other) } })).rejects.toThrow('UNSUPPORTED_VERSION');
      expect(await deadLetters(`failure_fingerprint = 'event-mismatch' and source_event_id is null`)).toBeGreaterThanOrEqual(1);
      expect(await effects(other)).toBe(0);
    });

    it('queue-supplied market, aggregate, actor, trace or payload metadata that disagrees with the event is refused', async () => {
      const id = await append(36);
      await relay().runOnce();
      const job = await jobFor(id);
      const r = runner();
      const variants: Record<string, unknown>[] = [
        { market_id: '00000000-0000-4000-8000-0000000000aa' },
        { aggregate_id: 'agg-999' },
        { aggregate_type: 'other' },
        { correlation_id: 'corr-999999' },
        { causation_id: 'not-the-event' },
        { actor_context: { actor_type: 'ORDINARY_ACCOUNT', ordinary_account_id: '00000000-0000-4000-8000-000000000001' } },
        { actor_context: { actor_type: 'SYSTEM', trusted_service_ref: 'somebody-else' } },
        { payload: { n: 36 } },
      ];
      for (const v of variants) await expect(r.process({ ...job, data: { ...job.data, ...v } })).rejects.toThrow('SECURITY_FAILURE');
      expect(await effects(id)).toBe(0);
      expect(await delivery(id)).toMatchObject({ state: 'QUEUED' });
      expect(await deadLetters(`logical_job_id = '${jid(id)}'`)).toBe(0);
      expect(await r.process(job)).toBe('SUCCEEDED');
    });
  });

  describe('reconcile_outbox (EVT-01 S23, RBL-05-CLOSE A)', () => {
    it('a job lost after QUEUED is rematerialised under the same id and applies its effect once', async () => {
      const id = await append(40);
      await relay().runOnce();
      expect(await delivery(id)).toMatchObject({ state: 'QUEUED' });
      await loseJob(id);
      await age(id);
      expect((await reconciler().runOnce()).REMATERIALIZED).toBeGreaterThanOrEqual(1);
      expect(await delivery(id)).toMatchObject({ state: 'QUEUED', reconcile_attempts: 1 });
      const job = await jobFor(id);
      expect(job.id).toBe(jid(id));
      const r = runner();
      expect(await r.process(job)).toBe('SUCCEEDED');
      expect(await r.process(job)).toBe('DUPLICATE');
      expect(await effects(id)).toBe(1);
    });

    it('concurrent reconcilers rematerialise once and the effect still happens once', async () => {
      const id = await append(41);
      await relay().runOnce();
      await loseJob(id);
      await age(id);
      await Promise.all([reconciler().runOnce(), reconciler().runOnce(), reconciler().runOnce()]);
      expect(await delivery(id)).toMatchObject({ state: 'QUEUED', reconcile_attempts: 1 });
      expect(await jobsWithId(id)).toHaveLength(1);
      const r = runner();
      const job = await jobFor(id);
      expect((await Promise.all([r.process(job), r.process(job)])).sort()).toEqual(['DUPLICATE', 'SUCCEEDED']);
      expect(await effects(id)).toBe(1);
    });

    it('a live job is never recreated; a lost acknowledgement is recorded without a new job', async () => {
      const id = await append(42);
      await relay().runOnce();
      const before = await queue.getJob(jid(id));
      await age(id);
      await reconciler().runOnce();
      expect(await delivery(id)).toMatchObject({ state: 'QUEUED', reconcile_attempts: 0 });
      expect((await queue.getJob(jid(id)))?.timestamp).toBe(before?.timestamp);

      // A delayed (retrying) job is alive too.
      const delayedId = await append(43);
      await relay().runOnce();
      await loseJob(delayedId);
      const added = await queue.add(recorder.name, (await jobFor(id)).data, { jobId: jid(delayedId), delay: 600_000 });
      expect(await added.getState()).toBe('delayed');
      await age(delayedId);
      await reconciler().runOnce();
      expect(await delivery(delayedId)).toMatchObject({ state: 'QUEUED', reconcile_attempts: 0 });
      expect(await (await queue.getJob(jid(delayedId)))?.getState()).toBe('delayed');
      await added.remove();

      // BullMQ has the job but PostgreSQL never recorded QUEUED.
      await withClient(tdb.superuser, (c) => c.query(`update platform.event_delivery set state = 'ENQUEUE_UNKNOWN' where event_id = $1`, [id]));
      await age(id);
      expect((await reconciler().runOnce()).ACK_RECOVERED).toBeGreaterThanOrEqual(1);
      expect(await delivery(id)).toMatchObject({ state: 'QUEUED', reconcile_attempts: 0 });
      expect(await jobsWithId(id)).toHaveLength(1);
    });

    it('terminal deliveries are never reactivated, by the reconciler or by a stray job', async () => {
      const done = await append(44);
      const dead = await append(45);
      await relay().runOnce();
      const r = runner();
      expect(await r.process(await jobFor(done))).toBe('SUCCEEDED');
      const deadJob = await jobFor(dead);
      failPermanently = true;
      await expect(r.process(deadJob)).rejects.toThrow('PERMANENT_VALIDATION');
      failPermanently = false;
      for (const id of [done, dead]) {
        await loseJob(id);
        await age(id);
      }
      await reconciler().runOnce();
      expect(await delivery(done)).toMatchObject({ state: 'SUCCEEDED', reconcile_attempts: 0 });
      expect(await delivery(dead)).toMatchObject({ state: 'DEAD_LETTERED', reconcile_attempts: 0 });
      expect(await queue.getJob(jid(done))).toBeUndefined();
      expect(await queue.getJob(jid(dead))).toBeUndefined();
      // A stray copy of the dead-lettered job does nothing: replay is an operator action (S22).
      expect(await r.process(deadJob)).toBe('TERMINAL');
      expect(await effects(dead)).toBe(0);
    });

    it('a Valkey outage costs no attempt, and reconciliation recovers when Valkey returns', async () => {
      const id = await append(46);
      await relay().runOnce();
      await loseJob(id);
      await age(id);
      const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' });
      const down: Pick<Queue, 'add' | 'getJob'> = {
        getJob: async () => Promise.reject(refused),
        add: async () => Promise.reject(refused),
      };
      expect((await reconciler({}, down).runOnce()).QUEUE_UNAVAILABLE).toBeGreaterThanOrEqual(1);
      expect(await delivery(id)).toMatchObject({ state: 'QUEUED', reconcile_attempts: 0 });
      await age(id);
      await reconciler().runOnce();
      expect(await delivery(id)).toMatchObject({ state: 'QUEUED', reconcile_attempts: 1 });
      expect(await runner().process(await jobFor(id))).toBe('SUCCEEDED');
      expect(await effects(id)).toBe(1);
    });

    it('a job that keeps getting lost ends as one dead letter, not an endless loop', async () => {
      const id = await append(47);
      await relay().runOnce();
      for (let pass = 0; pass < 5; pass += 1) {
        await (await queue.getJob(jid(id)))?.remove();
        await age(id);
        await reconciler({ maxRematerializations: 2 }).runOnce();
      }
      expect(await delivery(id)).toMatchObject({ state: 'DEAD_LETTERED', reconcile_attempts: 2, last_error_code: 'reconcile-exhausted' });
      expect(await deadLetters(`logical_job_id = '${jid(id)}' and failure_fingerprint = 'reconcile-exhausted' and failure_class = 'DEPENDENCY_UNAVAILABLE'`)).toBe(1);
      expect(await queue.getJob(jid(id))).toBeUndefined();
      expect(await effects(id)).toBe(0);
    });

    it('looking does not hide a stuck delivery from the staleDeliveries gauge', async () => {
      const id = await append(49);
      await relay().runOnce();
      await withClient(tdb.superuser, (c) => c.query(`update platform.event_delivery set updated_at = now() - interval '1 hour' where event_id = $1`, [id]));
      expect((await reconciler().runOnce()).PRESENT).toBeGreaterThanOrEqual(1); // the job is alive: left alone
      expect((await queueHealth(workerDb, queue)).staleDeliveries).toBeGreaterThanOrEqual(1);
      // ...and the reconciler's own lease stops a second pass re-examining it at once.
      expect((await reconciler().runOnce()).PRESENT).toBe(0);
    });

    it('a refused re-enqueue gives its attempt back; an orphaned job hash is dead-lettered, not "repaired"', async () => {
      const id = await append(50);
      await relay().runOnce();
      await loseJob(id);
      await age(id);
      const writeRefused: Pick<Queue, 'add' | 'getJob'> = {
        getJob: async () => undefined, // reads work...
        add: async () => Promise.reject(Object.assign(new Error('OOM command not allowed'), { name: 'ReplyError' })), // ...writes refused
      };
      expect((await reconciler({}, writeRefused).runOnce()).QUEUE_UNAVAILABLE).toBeGreaterThanOrEqual(1);
      expect(await delivery(id)).toMatchObject({ state: 'ENQUEUE_UNKNOWN', reconcile_attempts: 0, last_error_code: 'ENQUEUE_FAILED' });

      const orphan = await append(51);
      await relay().runOnce();
      await age(orphan);
      const unknownState = { getState: async () => 'unknown' };
      const hashOnly: Pick<Queue, 'add' | 'getJob'> = {
        getJob: async (jobId: string) => (jobId === jid(orphan) ? (unknownState as never) : queue.getJob(jobId)),
        add: async () => Promise.reject(new Error('add must not be called for an orphaned hash')),
      };
      await reconciler({}, hashOnly).runOnce();
      expect(await delivery(orphan)).toMatchObject({ state: 'DEAD_LETTERED', reconcile_attempts: 0, last_error_code: 'reconcile-unknown-without-outcome' });
      expect(await deadLetters(`logical_job_id = '${jid(orphan)}' and failure_class = 'STATE_CONFLICT'`)).toBe(1);
    });

    it('a marker without a closed delivery is closed as SUCCEEDED, never re-run', async () => {
      const id = await append(48);
      await relay().runOnce();
      expect(await runner().process(await jobFor(id))).toBe('SUCCEEDED');
      await withClient(tdb.superuser, (c) => c.query(`update platform.event_delivery set state = 'QUEUED' where event_id = $1`, [id]));
      await loseJob(id);
      await age(id);
      expect((await reconciler().runOnce()).ALREADY_PROCESSED).toBeGreaterThanOrEqual(1);
      expect(await delivery(id)).toMatchObject({ state: 'SUCCEEDED', reconcile_attempts: 0 });
      expect(await queue.getJob(jid(id))).toBeUndefined();
      expect(await effects(id)).toBe(1);
    });
  });

  it('end to end through a real BullMQ worker, with graceful close', async () => {
    const r = runner();
    // BullMQ never closes a connection the caller passes in: the test owns and disconnects both.
    const connection = queueWorkerConnection(requireEnv('QUEUE_VALKEY_URL'), log);
    const eventsConnection = queueWorkerConnection(requireEnv('QUEUE_VALKEY_URL'), log);
    const events = new QueueEvents(EVENTS_QUEUE, { connection: eventsConnection });
    await events.waitUntilReady();
    const worker = new Worker(EVENTS_QUEUE, (job: Job) => r.process(job), { connection, concurrency: 1 });
    const id = await append(11);
    await relay().runOnce();
    const job = await queue.getJob(jid(id));
    expect(job).toBeDefined();
    await job?.waitUntilFinished(events, 20_000);
    expect(await effects(id)).toBe(1);
    expect(await delivery(id)).toMatchObject({ state: 'SUCCEEDED' });
    const health = await queueHealth(workerDb, queue);
    expect(health.unresolvedDeadLetters).toBeGreaterThanOrEqual(1); // from the dead-letter cases above: visible, not hidden
    await worker.close();
    await events.close();
    connection.disconnect();
    eventsConnection.disconnect();
  });
});

describe('queue and cache Valkey separation (DEPLOY-01 S50-S52)', () => {
  it('the queue instance does not evict; the cache instance is refused as a queue', async () => {
    const q = queueProducerConnection(requireEnv('QUEUE_VALKEY_URL'), log);
    const c = queueProducerConnection(requireEnv('CACHE_VALKEY_URL'), log);
    await q.connect();
    await c.connect();
    try {
      await expect(assertQueuePolicy(q)).resolves.toBeUndefined();
      await expect(assertQueuePolicy(c)).rejects.toThrow(/noeviction/);
    } finally {
      q.disconnect();
      c.disconnect();
    }
  });

  it('the cache serves from the cache instance and disables itself on the queue instance', async () => {
    const good = RebuildableCache.connect(requireEnv('CACHE_VALKEY_URL'), log);
    await good.init();
    expect(good.isEnabled).toBe(true);
    await good.set('adulis:test:k', 'v', 30);
    expect(await good.get('adulis:test:k')).toBe('v');
    await good.close();
    const wrong = RebuildableCache.connect(requireEnv('QUEUE_VALKEY_URL'), log);
    await wrong.init();
    expect(wrong.isEnabled).toBe(false);
    await wrong.close();
  });
});
