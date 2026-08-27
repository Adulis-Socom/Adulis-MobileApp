import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type Transaction } from 'kysely';
import { APP_DATABASE } from '../db/database.module';
import type { Database } from '../db/database.types';
import { AdulisException } from '../errors/adulis-exception';

/**
 * ADU-API-01 v1.6 section 8 / ADU-CON-02 v3.0 section 7 — idempotency.
 *
 * Every state-changing POST requires an Idempotency-Key, because the
 * failure it prevents — a duplicate order on a retried request — is
 * silent, expensive, and hits the buyers on the worst connections hardest.
 * The retry is the NORMAL case on the binding low-end-Android constraint,
 * not the exception.
 *
 * Mechanics, exactly as ruled:
 *  - key: client-minted UUID, scoped to (actor, endpoint);
 *  - first use: response stored WITH the request hash;
 *  - identical replay: the STORED response, unchanged, with
 *    X-Adulis-Idempotent-Replay: true — the API is answering "did my
 *    request succeed?", and it did;
 *  - same key + different hash: 409 IDEMPOTENCY_KEY_REUSED. The client has
 *    a bug, and silently serving the old response would hide it;
 *  - records expire after 24 hours (the purge job's predicate).
 *
 * The record is written INSIDE the handler's transaction, at the end: a
 * crash mid-handler leaves no claim, so the retry is a first use; a
 * concurrent duplicate loses the UNIQUE race at commit, rolls its own
 * effects back, and is served the winner's stored response.
 */

export interface IdempotencyActor {
  readonly kind: 'ACCOUNT' | 'DEVICE';
  readonly id: string;
}

export interface StoredResponse {
  readonly status: number;
  readonly body: unknown;
}

export function hashRequest(method: string, path: string, body: unknown): Buffer {
  return createHash('sha256')
    .update(method)
    .update('\n')
    .update(path)
    .update('\n')
    .update(JSON.stringify(body ?? null))
    .digest();
}

@Injectable()
export class IdempotencyService {
  constructor(@Inject(APP_DATABASE) private readonly db: Kysely<Database>) {}

  /**
   * The pre-handler check. Returns the stored response on an identical
   * replay; raises on a reused key; null means first use — run the handler.
   */
  async check(
    key: string,
    actor: IdempotencyActor,
    endpoint: string,
    requestHash: Buffer,
  ): Promise<StoredResponse | null> {
    const r = await sql<{
      request_hash: Buffer;
      response_status: number;
      response_body: unknown;
    }>`
      SELECT request_hash, response_status, response_body
        FROM core.idempotency_record
       WHERE key = ${key} AND actor_kind = ${actor.kind}
         AND actor_id = ${actor.id} AND endpoint = ${endpoint}
         AND expires_at > now()`.execute(this.db);

    const row = r.rows[0];
    if (!row) return null;
    if (!requestHash.equals(row.request_hash)) {
      throw new AdulisException('IDEMPOTENCY_KEY_REUSED');
    }
    return { status: row.response_status, body: row.response_body };
  }

  /** The end-of-transaction record. Unique collision = a concurrent twin won. */
  async record(
    trx: Transaction<Database>,
    key: string,
    actor: IdempotencyActor,
    endpoint: string,
    requestHash: Buffer,
    response: StoredResponse,
  ): Promise<void> {
    await sql`
      INSERT INTO core.idempotency_record
        (id, key, actor_kind, actor_id, endpoint, request_hash,
         response_status, response_body, expires_at)
      VALUES (gen_random_uuid(), ${key}, ${actor.kind}, ${actor.id},
              ${endpoint}, ${requestHash}, ${response.status},
              ${JSON.stringify(response.body)}::jsonb,
              now() + interval '24 hours')`.execute(trx);
  }

  /** After losing the commit race: the winner's response, which now exists. */
  async readWinner(
    key: string,
    actor: IdempotencyActor,
    endpoint: string,
  ): Promise<StoredResponse | null> {
    const r = await sql<{ response_status: number; response_body: unknown }>`
      SELECT response_status, response_body
        FROM core.idempotency_record
       WHERE key = ${key} AND actor_kind = ${actor.kind}
         AND actor_id = ${actor.id} AND endpoint = ${endpoint}`.execute(this.db);
    const row = r.rows[0];
    return row ? { status: row.response_status, body: row.response_body } : null;
  }
}
