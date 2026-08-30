import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Response } from 'express';
import { APP_DATABASE } from './database.module';
import type { Database } from './database.types';
import { withRequestContext, type RequestContext } from './request-context';
import type { LocalizedRequest } from '../http/locale.middleware';
import { AdulisException } from '../errors/adulis-exception';
import {
  IdempotencyService,
  hashRequest,
  type IdempotencyActor,
  type StoredResponse,
} from '../idempotency/idempotency';
import { BROWSER_DEVICE_COOKIE, clientSurface, readCookie } from '../http/cookies';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 *
 * G1.6 adds a third: a DUE OWNERSHIP TRANSFER ACTIVATES ON THE NEXT REQUEST
 * TO THAT STORE, whoever makes it. See `activateDueOwnership` below.
 */

@Injectable()
export class HandlerTransaction {
  constructor(
    @Inject(APP_DATABASE) private readonly db: Kysely<Database>,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * G1.6 / AMENDMENT A1.1 — a due ownership transfer activates HERE, at the
   * top of every seller-scoped transaction, before the handler runs.
   *
   * A1.1 requires that "a live session held by the outgoing owner across the
   * activation boundary must lose those capabilities on its next request,
   * with no re-authentication." That is only true if something activates on
   * that request. The payout precedent (`core.fn_activate_due_payout`, 0022)
   * is lazy on GET /v1/seller/payout, which would leave the outgoing owner
   * as Owner indefinitely if nobody happened to read the transfer — and the
   * S24 job set is closed at twenty names, so a sweeper is not available
   * either.
   *
   * This is the one place every seller-scoped handler passes through, and it
   * is already inside the transaction, so the cost is one statement rather
   * than a round trip. In the common case it is a single lookup on a partial
   * index over an almost-always-empty table.
   *
   * `fn_activate_due_ownership_transfer` NEVER RAISES for an ordinary
   * outcome — a blocked transfer cancels itself and returns false — because
   * a raise here would 500 every request to that store.
   */
  private async activateDueOwnership(
    trx: Transaction<Database>,
    sellerId: string | null,
  ): Promise<void> {
    if (!sellerId) return;
    await sql`SELECT core.fn_activate_due_ownership_transfer(${sellerId})`.execute(trx);
  }

  /**
   * ...AND AGAIN, ON ITS OWN, WHEN THE HANDLER FAILED.
   *
   * Found by A1.1's own test, which is why A1.1 asks for it. The outgoing
   * owner's next request activates the transfer and is THEN judged by what
   * the activation did — so it raises U0002 and 404s, correctly — and the
   * raise rolls the transaction back, taking the activation with it. The
   * store would never move: every one of that owner's requests would 404
   * while `owner_account_id` stayed exactly where it was, and the
   * notifications would never send.
   *
   * A rollback-safe activation cannot live in the handler's transaction, and
   * a second transaction on every request is a cost paid for a case that
   * almost never happens. So: in the transaction while it succeeds — free —
   * and once more on its own when it did not.
   */
  private async activateDueOwnershipAfterFailure(ctx: RequestContext): Promise<void> {
    if (!ctx.sellerId) return;
    const sellerId = ctx.sellerId;
    try {
      await withRequestContext(this.db, ctx, async (trx) => {
        await sql`SELECT core.fn_activate_due_ownership_transfer(${sellerId})`.execute(trx);
      });
    } catch {
      // Never mask the handler's own error with this one. The function does
      // not raise for an ordinary outcome; if it raised here, the next
      // request tries again.
    }
  }

  /** A read, or a naturally idempotent PATCH/DELETE (section 8). */
  async run<T>(
    req: LocalizedRequest,
    fn: (trx: Transaction<Database>) => Promise<T>,
  ): Promise<T> {
    const ctx = req.ctx ?? { accountId: null, actorRole: '', sellerId: null };
    try {
      return await withRequestContext(this.db, ctx, async (trx) => {
        await this.activateDueOwnership(trx, ctx.sellerId);
        return fn(trx);
      });
    } catch (e) {
      await this.activateDueOwnershipAfterFailure(ctx);
      throw e;
    }
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
        await this.activateDueOwnership(trx, ctx.sellerId);
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
      await this.activateDueOwnershipAfterFailure(ctx);
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
    // A BROWSER HAS NO SUCH HEADER, and after ADU-RUL-03 S2 it must not: its
    // device identity is the httpOnly cookie /v1/bootstrap minted, which
    // JavaScript cannot read and therefore cannot put in a header. Without
    // this branch every anonymous console POST -- including the first step of
    // sign-in -- answered 400 naming a header the ruling forbids the console
    // to send, which is both a break and an instruction to re-open the arm
    // the ruling closes.
    // VALIDATED, because actor_id is a uuid column and this value is
    // attacker-supplied. Taking it verbatim answered 500 to any anonymous
    // caller on any @Public idempotent endpoint -- the same defect that was
    // just fixed at otp/verify, re-opened one door along, and invisible
    // because the test for it only covered the door that was fixed.
    const browser = readCookie(req.headers.cookie, BROWSER_DEVICE_COOKIE);
    if (browser && UUID_RE.test(browser)) return { kind: 'DEVICE', id: browser };
    // Name what THIS surface can actually supply: a browser has no
    // X-Adulis-Device to send and never will.
    const web = clientSurface(req.headers['x-adulis-client']) === 'web';
    throw new AdulisException('IDEMPOTENCY_KEY_MISSING', {
      slots: { path: web ? 'bootstrap' : 'X-Adulis-Device' },
    });
  }
}

/** The stored-response passthrough type, re-exported for handler signatures. */
export type { StoredResponse };
