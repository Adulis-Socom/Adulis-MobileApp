import { Inject, Injectable } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';
import type { Response } from 'express';
import { APP_DATABASE } from './database.module';
import type { Database } from './database.types';
import { withRequestContext } from './request-context';
import type { LocalizedRequest } from '../http/locale.middleware';
import { AdulisException } from '../errors/adulis-exception';
import {
  IdempotencyService,
  hashRequest,
  type IdempotencyActor,
  type StoredResponse,
} from '../idempotency/idempotency';

/**
 * The handler stage of the section 5 pipeline: TRANSACTION, SETTINGS, ONE
 * FUNCTION CALL — and for a state-changing POST, the idempotency record in
 * the same transaction.
 *
 * Every handler in every module runs its database work through one of these
 * two methods. That is what makes the two non-negotiables structural
 * rather than disciplinary:
 *
 *  - `set_config(..., true)` — transaction-local, always — happens in
 *    exactly one audited place (withRequestContext), and nothing else in
 *    the codebase touches set_config;
 *  - a state-changing POST cannot forget its idempotency record, because
 *    the method that gives it a transaction is the method that writes one.
 */

@Injectable()
export class HandlerTransaction {
  constructor(
    @Inject(APP_DATABASE) private readonly db: Kysely<Database>,
    private readonly idempotency: IdempotencyService,
  ) {}

  /** A read, or a naturally idempotent PATCH/DELETE (section 8). */
  async run<T>(
    req: LocalizedRequest,
    fn: (trx: Transaction<Database>) => Promise<T>,
  ): Promise<T> {
    const ctx = req.ctx ?? { accountId: null, actorRole: '', sellerId: null };
    return withRequestContext(this.db, ctx, fn);
  }

  /**
   * A state-changing POST. Demands the Idempotency-Key header (400 without
   * one), serves an identical replay from the store, refuses a reused key,
   * and writes the record inside the handler's own transaction.
   *
   * The handler's return value is the response body; `status` is what a
   * fresh execution serves (and what the store replays).
   */
  async runIdempotent<T>(
    req: LocalizedRequest,
    res: Response,
    status: number,
    fn: (trx: Transaction<Database>) => Promise<T>,
  ): Promise<T> {
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key === '') {
      throw new AdulisException('IDEMPOTENCY_KEY_MISSING');
    }

    const actor = this.actorFor(req);
    const endpoint = `${req.method} ${req.path}`;
    const requestHash = hashRequest(req.method, req.path, req.body);

    const replay = await this.idempotency.check(key, actor, endpoint, requestHash);
    if (replay) {
      res.setHeader('X-Adulis-Idempotent-Replay', 'true');
      res.status(replay.status);
      return replay.body as T;
    }

    const ctx = req.ctx ?? { accountId: null, actorRole: '', sellerId: null };
    try {
      const result = await withRequestContext(this.db, ctx, async (trx) => {
        const body = await fn(trx);
        await this.idempotency.record(trx, key, actor, endpoint, requestHash, {
          status,
          body,
        });
        return body;
      });
      res.status(status);
      return result;
    } catch (e) {
      // Losing the UNIQUE race to a concurrent twin: our effects rolled
      // back with the transaction; the winner's stored response is the
      // truthful answer to "did my request succeed?".
      if (
        typeof e === 'object' &&
        e !== null &&
        (e as { code?: string }).code === '23505' &&
        (e as { constraint?: string }).constraint ===
          'idempotency_record_key_actor_kind_actor_id_endpoint_key'
      ) {
        const winner = await this.idempotency.readWinner(key, actor, endpoint);
        if (winner) {
          res.setHeader('X-Adulis-Idempotent-Replay', 'true');
          res.status(winner.status);
          return winner.body as T;
        }
      }
      throw e;
    }
  }

  /**
   * DEVICE actors exist because cart and device registration are reachable
   * before an account does (C6) — the scheme must protect the
   * pre-identity endpoints or it protects nothing on the worst
   * connections.
   */
  private actorFor(req: LocalizedRequest): IdempotencyActor {
    if (req.ctx?.accountId) return { kind: 'ACCOUNT', id: req.ctx.accountId };
    const device = req.headers['x-adulis-device'];
    if (typeof device === 'string' && device !== '') {
      return { kind: 'DEVICE', id: device };
    }
    throw new AdulisException('IDEMPOTENCY_KEY_MISSING', {
      slots: { path: 'X-Adulis-Device' },
    });
  }
}

/** The stored-response passthrough type, re-exported for handler signatures. */
export type { StoredResponse };
