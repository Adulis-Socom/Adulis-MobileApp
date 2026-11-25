import { Redis } from 'ioredis';
import type { Logger } from 'pino';

/**
 * Two Valkey roles with different failure semantics (DEPLOY-01 S49-S52). QUEUE Valkey backs BullMQ and must
 * not evict (the worker refuses to start otherwise). CACHE Valkey is rebuildable: if it is missing, slow, or
 * looks like the queue instance (noeviction), the API serves from PostgreSQL without it. Neither is ever
 * business truth.
 */

export async function maxmemoryPolicy(redis: Redis): Promise<string | undefined> {
  const info = await redis.info('memory');
  return /^maxmemory_policy:(\S+)/m.exec(info)?.[1];
}

/** Logs a connection problem once per outage instead of once per reconnect attempt. */
function quietErrors(redis: Redis, log: Logger, role: string): Redis {
  let down = false;
  redis.on('error', (err: Error) => {
    if (!down) log.warn({ queue: role, errorName: err.name }, 'valkey connection error');
    down = true;
  });
  redis.on('ready', () => {
    down = false;
  });
  return redis;
}

/** BullMQ worker connection: blocking commands need maxRetriesPerRequest null. */
export const queueWorkerConnection = (url: string, log: Logger): Redis =>
  quietErrors(new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true }), log, 'queue-worker');

/**
 * Relay (producer) connection: NO offline queue, so an add fails fast while Valkey is down instead of
 * buffering in memory. The event stays durable in PostgreSQL and the relay retries it (EVT-01 S12).
 */
export const queueProducerConnection = (url: string, log: Logger): Redis =>
  quietErrors(new Redis(url, { enableOfflineQueue: false, maxRetriesPerRequest: 1, lazyConnect: true }), log, 'queue-producer');

/** A startup refusal whose message is safe to log: it names a policy, never a URL or credential. */
export class QueuePolicyRefused extends Error {
  override readonly name = 'QueuePolicyRefused';
}

export async function assertQueuePolicy(redis: Redis): Promise<void> {
  const policy = await maxmemoryPolicy(redis);
  if (policy !== 'noeviction') throw new QueuePolicyRefused(`queue Valkey maxmemory-policy is '${policy ?? 'unknown'}', BullMQ requires noeviction (DEPLOY-01 S51)`);
}

export class RebuildableCache {
  private enabled: boolean;

  constructor(
    private readonly redis: Redis | null,
    private readonly log: Logger,
  ) {
    this.enabled = redis !== null;
  }

  static connect(url: string, log: Logger): RebuildableCache {
    return new RebuildableCache(quietErrors(new Redis(url, { enableOfflineQueue: false, maxRetriesPerRequest: 1, lazyConnect: true, connectTimeout: 2_000 }), log, 'cache'), log);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Never throws: a cache that cannot start is a slower API, not a broken one (DEPLOY-01 S31, S52). */
  async init(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.connect();
      if ((await maxmemoryPolicy(this.redis)) === 'noeviction') {
        this.enabled = false;
        this.log.warn({ queue: 'cache' }, 'cache Valkey reports noeviction and may be the queue instance; cache disabled');
      }
    } catch {
      this.log.warn({ queue: 'cache' }, 'cache Valkey unavailable at startup; serving without cache');
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.enabled || !this.redis) return null;
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.enabled || !this.redis) return;
    try {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch {
      // rebuildable: a lost write is a later miss
    }
  }

  async close(): Promise<void> {
    if (this.redis) this.redis.disconnect();
  }
}
