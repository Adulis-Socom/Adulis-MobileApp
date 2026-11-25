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
import { ConsumerError, EventConsumerRunner } from '../src/worker/consumer';
import { queueHealth } from '../src/worker/health';
import { EVENTS_QUEUE, jobIdFor, OutboxRelay } from '../src/worker/relay';
import { freshReplacementDatabase, requireEnv, withClient, type TestDb } from './support';

/**
 * ARC-BE-04 behaviour proofs with SYNTHETIC handlers only: no business job exists before its domain.
 * Effects are counted in a non-unique table, so a second effect would show as a second row; only the
 * processed-event marker can keep the count at one.
 */
const log = createLogger({ service: 'test', level: 'fatal', release: 'test' });
const SYNTHETIC: EventDefinition = { type: 'test.synthetic_happened', version: 1, scopes: ['GLOBAL'], payload: z.strictObject({ n: z.int() }) };
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
const registry = new EventRegistry([SYNTHETIC], [recorder]);
const newEvent = (n: number): NewEvent => ({
  event_type: SYNTHETIC.type,
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
  const delivery = (eventId: string) =>
    withClient(tdb.superuser, async (c) => (await c.query(`select state, enqueue_attempts, last_error_code from platform.event_delivery where event_id = $1`, [eventId])).rows[0]);
  const append = (n: number) => apiDb.transaction((tx) => appendEvent(tx, registry, newEvent(n)));
  const relay = (q: Pick<Queue, 'add'> = queue, owner = 'relay-a') => new OutboxRelay(workerDb, q, registry, { owner, batchSize: 10, leaseMs: 30_000 }, log);
  const jobFor = (eventId: string, attemptsMade = 0) => ({
    data: {
      logical_job_id: jobIdFor(recorder.name, eventId),
      job_type: recorder.name,
      job_version: 1,
      priority_class: 'P2',
      criticality: 'IMPORTANT',
      correlation_id: 'corr-000000',
      source_event_id: eventId,
      actor_context: { actor_type: 'SYSTEM', trusted_service_ref: 'adulis-worker.outbox-relay' },
      payload: {},
    },
    attemptsMade,
    opts: { attempts: 3 },
  });

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
    expect(await queue.getJob(jobIdFor(recorder.name, id))).toBeDefined();
    expect(await count(`select count(*)::int as n from platform.event_outbox where event_id = '${id}' and dispatched_at is not null`)).toBe(1);
  });

  it('Valkey unavailable: the event stays durable and is published once Valkey returns', async () => {
    // A real client to a port nothing listens on, with reconnection off: Valkey is simply not there.
    const dead = new Redis('redis://127.0.0.1:1', { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, retryStrategy: () => null });
    dead.on('error', () => undefined);
    const deadQueue = new Queue(EVENTS_QUEUE, { connection: dead });
    const id = await append(4);
    const r1 = await relay(deadQueue, 'relay-down').runOnce();
    expect(r1.dispatched).toBe(0);
    expect(await delivery(id)).toMatchObject({ state: 'ENQUEUE_UNKNOWN', last_error_code: 'ENQUEUE_FAILED' });
    expect(await count(`select count(*)::int as n from platform.event_outbox where event_id = '${id}' and dispatched_at is null`)).toBe(1);
    await deadQueue.close();
    dead.disconnect();
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
    // event undispatched, lease expired. (Done as the migrator: the owner may move relay columns too.)
    await withClient(tdb.superuser, async (c) => {
      await c.query(`update platform.event_delivery set state = 'ENQUEUE_UNKNOWN' where event_id = $1`, [id]);
      await c.query(`alter table platform.event_outbox disable trigger event_outbox_immutable`);
      await c.query(`update platform.event_outbox set dispatched_at = null, relay_owner = 'crashed', lease_expires_at = now() - interval '1 second' where event_id = $1`, [id]);
      await c.query(`alter table platform.event_outbox enable trigger event_outbox_immutable`);
    });
    await relay(queue, 'relay-c').runOnce();
    const jobs = (await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed'])).filter((j) => j?.id === jobIdFor(recorder.name, id));
    expect(jobs).toHaveLength(1);
    const runner = new EventConsumerRunner(workerDb, registry, log);
    expect(await runner.process(jobFor(id))).toBe('SUCCEEDED');
    expect(await runner.process(jobFor(id))).toBe('DUPLICATE');
    expect(await effects(id)).toBe(1);
  });

  it('a retried job applies its effect exactly once', async () => {
    const id = await append(6);
    await relay().runOnce();
    const runner = new EventConsumerRunner(workerDb, registry, log);
    failNext = 1;
    await expect(runner.process(jobFor(id, 0))).rejects.toThrow('synthetic transient failure');
    expect(await effects(id)).toBe(0); // the failed attempt rolled back its effect and its marker
    expect(await count(`select count(*)::int as n from platform.async_dead_letter where source_event_id = '${id}'`)).toBe(0);
    expect(await runner.process(jobFor(id, 1))).toBe('SUCCEEDED');
    expect(await effects(id)).toBe(1);
    expect(await delivery(id)).toMatchObject({ state: 'SUCCEEDED' });
  });

  it('the same event delivered twice, even concurrently, has one effect', async () => {
    const id = await append(7);
    await relay().runOnce();
    const runner = new EventConsumerRunner(workerDb, registry, log);
    const outcomes = await Promise.all([runner.process(jobFor(id)), runner.process(jobFor(id))]);
    expect(outcomes.sort()).toEqual(['DUPLICATE', 'SUCCEEDED']);
    expect(await runner.process(jobFor(id))).toBe('DUPLICATE');
    expect(await effects(id)).toBe(1);
  });

  it('exhausted and permanent failures become sanitized dead letters', async () => {
    const id = await append(8);
    await relay().runOnce();
    const runner = new EventConsumerRunner(workerDb, registry, log);
    failNext = 5;
    await expect(runner.process(jobFor(id, 2))).rejects.toThrow(); // third of three attempts
    const dl = await withClient(tdb.superuser, async (c) => (await c.query(`select * from platform.async_dead_letter where source_event_id = $1`, [id])).rows[0]);
    expect(dl).toMatchObject({ failure_class: 'TRANSIENT', attempt_count: 3, resolution_status: 'UNRESOLVED', effect_may_have_happened: false });
    expect(dl.sanitized_summary).not.toContain('synthetic transient failure');
    expect(await delivery(id)).toMatchObject({ state: 'DEAD_LETTERED' });

    const id2 = await append(9);
    await relay().runOnce();
    failPermanently = true;
    await expect(runner.process(jobFor(id2, 0))).rejects.toThrow('PERMANENT_VALIDATION');
    expect(await count(`select count(*)::int as n from platform.async_dead_letter where source_event_id = '${id2}' and failure_class = 'PERMANENT_VALIDATION'`)).toBe(1);
  });

  it('a malformed or unknown-version job is refused, never coerced', async () => {
    const runner = new EventConsumerRunner(workerDb, registry, log);
    await expect(runner.process({ data: { nonsense: true }, attemptsMade: 0, opts: { attempts: 3 } })).rejects.toThrow('POISON_PAYLOAD');
    const id = await append(10);
    const job = jobFor(id);
    await expect(runner.process({ ...job, data: { ...job.data, job_version: 2 } })).rejects.toThrow('UNSUPPORTED_VERSION');
    expect(await effects(id)).toBe(0);
  });

  it('end to end through a real BullMQ worker, with graceful close', async () => {
    const runner = new EventConsumerRunner(workerDb, registry, log);
    const connection = queueWorkerConnection(requireEnv('QUEUE_VALKEY_URL'), log);
    const events = new QueueEvents(EVENTS_QUEUE, { connection: queueWorkerConnection(requireEnv('QUEUE_VALKEY_URL'), log) });
    await events.waitUntilReady();
    const worker = new Worker(EVENTS_QUEUE, (job: Job) => runner.process(job), { connection, concurrency: 1 });
    const id = await append(11);
    await relay().runOnce();
    const job = await queue.getJob(jobIdFor(recorder.name, id));
    expect(job).toBeDefined();
    await job?.waitUntilFinished(events, 20_000);
    expect(await effects(id)).toBe(1);
    expect(await delivery(id)).toMatchObject({ state: 'SUCCEEDED' });
    const health = await queueHealth(workerDb, queue);
    expect(health.unresolvedDeadLetters).toBeGreaterThanOrEqual(1); // from the dead-letter case above: visible, not hidden
    await worker.close();
    await events.close();
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
