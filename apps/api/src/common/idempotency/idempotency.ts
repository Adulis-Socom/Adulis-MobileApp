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
 *    a bug, and silently serving the old response would hide it. The hash
 *    covers the selected seller, so another store is a different hash;
 *  - records expire after 24 hours (the purge job's predicate). An expired
 *    record not yet purged is 409 IDEMPOTENCY_KEY_REUSED, never a replay.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Idempotency-Key header, checked before anything reaches the database:
 * `key` is a uuid column, and a malformed value used to surface as a 500
 * telling the client to retry a request that can never succeed.
 */
export function idempotencyKey(header: unknown): string {
  if (typeof header !== 'string' || header === '') {
    throw new AdulisException('IDEMPOTENCY_KEY_MISSING');
  }
  if (!UUID_RE.test(header)) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'Idempotency-Key' } });
  }
  return header;
}

/**
 * `sellerId` is the selected seller (X-Adulis-Seller) and part of what the
 * request means: the same body under another store is another request, so
 * reusing its key is IDEMPOTENCY_KEY_REUSED rather than a replay. Without a
 * seller the hash is byte-identical to the one stored before the seller was
 * added (JSON.stringify never emits a raw newline, so the suffix cannot
 * collide with a body).
 */
export function hashRequest(
  method: string,
  path: string,
  body: unknown,
  sellerId: string | null,
): Buffer {
  const h = createHash('sha256')
    .update(method)
    .update('\n')
    .update(path)
    .update('\n')
    .update(JSON.stringify(body ?? null));
  if (sellerId) h.update('\n').update(sellerId);
  return h.digest();
}

interface RecordRow {
  request_hash: Buffer;
  response_status: number;
  response_body: unknown;
  live: boolean;
}

/**
 * The stored response, or the refusal. An EXPIRED record is never served:
 * it keeps the unique slot until the purge job deletes it, and adulis_app
 * may not replace it (SELECT and INSERT only), so until then the key is
 * refused rather than run into a collision that rolls the work back.
 */
function replayOf(row: RecordRow, requestHash: Buffer): StoredResponse {
  if (!row.live || !requestHash.equals(row.request_hash)) {
    throw new AdulisException('IDEMPOTENCY_KEY_REUSED');
  }
  return { status: row.response_status, body: row.response_body };
}

@Injectable()
export class IdempotencyService {
  constructor(@Inject(APP_DATABASE) private readonly db: Kysely<Database>) {}

  /**
   * The pre-handler check. Returns the stored response on an identical
   * replay; raises on a reused or expired key; null means run the handler.
   *
   * `standingSeller` (a seller-context request): the replay is served only
   * while the account still stands in that seller -- its Owner, or a team
   * member neither suspended nor revoked, the predicate fn_has_permission
   * reads. Otherwise null: the handler runs and its own fn_has_permission
   * answers 403 or 404; were it to pass, the existing record still refuses a
   * second commit (the unique-collision path).
   */
  async check(
    key: string,
    actor: IdempotencyActor,
    endpoint: string,
    requestHash: Buffer,
    standingSeller: string | null = null,
  ): Promise<StoredResponse | null> {
    const r = await sql<RecordRow & { standing: boolean }>`
      SELECT r.request_hash, r.response_status, r.response_body,
             r.expires_at > now() AS live,
             (${standingSeller}::uuid IS NULL
              OR EXISTS (SELECT 1 FROM core.seller s
                          WHERE s.id = ${standingSeller}::uuid
                            AND s.owner_account_id = ${actor.id}::uuid)
              OR EXISTS (SELECT 1 FROM core.seller_team_member tm
                          WHERE tm.seller_id = ${standingSeller}::uuid
                            AND tm.account_id = ${actor.id}::uuid
                            AND tm.suspended_at IS NULL
                            AND tm.revoked_at IS NULL)) AS standing
        FROM core.idempotency_record r
       WHERE r.key = ${key} AND r.actor_kind = ${actor.kind}
         AND r.actor_id = ${actor.id} AND r.endpoint = ${endpoint}`.execute(this.db);

    const row = r.rows[0];
    if (!row || !row.standing) return null;
    return replayOf(row, requestHash);
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

  /**
   * After losing the commit race: the winner's response, which now exists,
   * served only if it answers THIS request (same hash, not expired).
   */
  async readWinner(
    key: string,
    actor: IdempotencyActor,
    endpoint: string,
    requestHash: Buffer,
  ): Promise<StoredResponse | null> {
    const r = await sql<RecordRow>`
      SELECT request_hash, response_status, response_body,
             expires_at > now() AS live
        FROM core.idempotency_record
       WHERE key = ${key} AND actor_kind = ${actor.kind}
         AND actor_id = ${actor.id} AND endpoint = ${endpoint}`.execute(this.db);
    const row = r.rows[0];
    return row ? replayOf(row, requestHash) : null;
  }
}
