import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { INFERENCE_ADAPTER, type InferenceAdapter } from './inference.adapter';

/**
 * C7 — chat (ADU-API-01 v1.6 section 12.7; ADU-PRD-01 S15).
 *
 * R10 — the scope parameter has no default: one account holds buyer and
 * seller simultaneously, and an unscoped list interleaves a seller's
 * business with their own shopping.
 *
 * The bot: layers of S15.1 that are implementable today — chips (1) and
 * exact/keyword match (2) — run inline; the metered layers ride the
 * inference adapter (Null until the integration lands); anything else
 * ESCALATES, delivered as a notification, because ordinary messages are
 * not (S15). The model never generates a response; a bot message's body
 * is a template resource or a catalogue key, never assembled prose.
 *
 * A template whose slots[] is non-empty cannot be filled — a conversation
 * carries no product context to fill it from (registered) — so it is
 * treated as unanswerable and escalates rather than shipping a sentence
 * with holes in it.
 */

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

interface ConversationRow {
  id: string;
  seller_id: string;
  buyer_account_id: string;
  market_id: string;
}

@Injectable()
export class ChatService {
  constructor(
    @Inject(INFERENCE_ADAPTER) private readonly inference: InferenceAdapter,
  ) {}

  /** POST /v1/conversations — create-or-return the unique pair row.
   *  Not in 12.7's table (registered — the catalogue omits how a
   *  conversation begins, as v1.1 once omitted claims). */
  async openConversation(
    trx: Transaction<Database>,
    req: AuthedRequest,
    sellerId: string,
  ): Promise<unknown> {
    const buyer = req.ctx?.accountId as string;
    const seller = await sql<{ id: string; market_id: string; status: string }>`
      SELECT id, market_id, status FROM core.seller
       WHERE id = ${sellerId}`.execute(trx);
    const s = first(seller.rows);
    // A store that is not publicly live is not chattable; saying which of
    // those it is would be an oracle. 404 for both.
    if (!s || (s.status !== 'ACTIVE' && s.status !== 'CLOSING')) {
      throw new AdulisException('NOT_FOUND');
    }
    const r = await sql<{ id: string }>`
      INSERT INTO chat.conversation (id, seller_id, buyer_account_id, market_id)
      VALUES (${randomUUID()}, ${sellerId}, ${buyer}, ${s.market_id})
      ON CONFLICT (seller_id, buyer_account_id, market_id)
      DO UPDATE SET last_message_at = chat.conversation.last_message_at
      RETURNING id`.execute(trx);
    return { conversation_id: first(r.rows)?.id };
  }

  /** GET /v1/conversations?as=buyer | as=seller&seller_id= (R10). */
  async list(
    trx: Transaction<Database>,
    req: AuthedRequest,
    scope: string | undefined,
    sellerParam: string | undefined,
    cursor: string | undefined,
  ): Promise<unknown> {
    const accountId = req.ctx?.accountId as string;
    if (scope !== 'buyer' && scope !== 'seller') {
      throw new AdulisException('SCOPE_PARAMETER_REQUIRED');
    }
    const limit = 25;

    if (scope === 'buyer') {
      const r = await sql<Record<string, unknown>>`
        SELECT c.id, c.seller_id, s.store_name, s.handle,
               c.started_at, c.last_message_at
          FROM chat.conversation c
          JOIN core.seller s ON s.id = c.seller_id
         WHERE c.buyer_account_id = ${accountId}
           AND (${cursor ?? null}::timestamptz IS NULL
                OR c.last_message_at < ${cursor ?? null}::timestamptz)
         ORDER BY c.last_message_at DESC
         LIMIT ${limit + 1}`.execute(trx);
      return page(r.rows, limit);
    }

    // as=seller additionally requires the header to MATCH seller_id (R10).
    const sellerId = req.ctx?.sellerId as string | null;
    if (!sellerParam || sellerParam !== sellerId) {
      throw new AdulisException('SCOPE_PARAMETER_REQUIRED');
    }
    await sql`
      SELECT core.fn_has_permission(${accountId}, ${sellerId},
        'seller.messages:read',
        ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
    const r = await sql<Record<string, unknown>>`
      SELECT c.id, c.buyer_account_id, c.started_at, c.last_message_at
        FROM chat.conversation c
       WHERE c.seller_id = ${sellerId}
         AND (${cursor ?? null}::timestamptz IS NULL
              OR c.last_message_at < ${cursor ?? null}::timestamptz)
       ORDER BY c.last_message_at DESC
       LIMIT ${limit + 1}`.execute(trx);
    return page(r.rows, limit);
  }

  /** The conversation, from whichever side the caller stands on — or 404. */
  private async membership(
    trx: Transaction<Database>,
    req: AuthedRequest,
    conversationId: string,
  ): Promise<{ conv: ConversationRow; side: 'BUYER' | 'SELLER' }> {
    const accountId = req.ctx?.accountId as string;
    const r = await sql<ConversationRow>`
      SELECT id, seller_id, buyer_account_id, market_id
        FROM chat.conversation WHERE id = ${conversationId}`.execute(trx);
    const conv = first(r.rows);
    if (!conv) throw new AdulisException('NOT_FOUND');
    if (conv.buyer_account_id === accountId && req.ctx?.sellerId !== conv.seller_id) {
      return { conv, side: 'BUYER' };
    }
    // The seller side proves itself through the permission function — a
    // stranger gets its U0002, indistinguishable from no conversation.
    if (req.ctx?.sellerId === conv.seller_id) {
      await sql`
        SELECT core.fn_has_permission(${accountId}, ${conv.seller_id},
          'seller.messages:read',
          ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
      return { conv, side: 'SELLER' };
    }
    throw new AdulisException('NOT_FOUND');
  }

  /** GET /v1/conversations/{id}/messages. */
  async messages(
    trx: Transaction<Database>,
    req: AuthedRequest,
    conversationId: string,
    cursor: string | undefined,
  ): Promise<unknown> {
    await this.membership(trx, req, conversationId);
    const limit = 50;
    const r = await sql<Record<string, unknown>>`
      SELECT m.id, m.sender_kind, m.body, m.locale, m.sent_at, m.read_at,
             bt.resolution_path, bt.intent_id, bt.escalated
        FROM chat.message m
        LEFT JOIN chat.bot_turn bt ON bt.message_id = m.id
       WHERE m.conversation_id = ${conversationId}
         AND (${cursor ?? null}::timestamptz IS NULL
              OR m.sent_at < ${cursor ?? null}::timestamptz)
       ORDER BY m.sent_at DESC
       LIMIT ${limit + 1}`.execute(trx);
    const rows = r.rows.map((m) =>
      m['sender_kind'] === 'BOT'
        ? {
            id: m['id'],
            sender_kind: 'BOT',
            // Template key and slots, never assembled prose (12.7, S7).
            template_key: m['body'],
            slots: {},
            resolution_path: m['resolution_path'],
            sent_at: m['sent_at'],
          }
        : {
            id: m['id'],
            sender_kind: m['sender_kind'],
            body: m['body'],
            locale: m['locale'],
            sent_at: m['sent_at'],
            read_at: m['read_at'],
          },
    );
    return page(rows, limit, (x) => String((x as { sent_at: Date }).sent_at?.toISOString?.() ?? ''));
  }

  /** POST /v1/conversations/{id}/messages — text or chip, then the cascade. */
  async postMessage(
    trx: Transaction<Database>,
    req: AuthedRequest,
    conversationId: string,
    body: { text?: string | undefined; chip_id?: string | undefined },
    locale: string,
  ): Promise<unknown> {
    const accountId = req.ctx?.accountId as string;
    const { conv, side } = await this.membership(trx, req, conversationId);

    if (side === 'SELLER') {
      await sql`
        SELECT core.fn_has_permission(${accountId}, ${conv.seller_id},
          'seller.messages:send',
          ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
    }

    // A chip IS its intent: the tap carries the intent id, no
    // interpretation happens, and the text shown came from the intent's
    // own catalogue entry.
    let text = body.text ?? null;
    let chipIntent: string | null = null;
    if (body.chip_id) {
      const intent = await sql<{ id: string; code: string }>`
        SELECT id, code FROM nlu.intent
         WHERE id = ${body.chip_id} AND retired_at IS NULL`.execute(trx);
      const row = first(intent.rows);
      if (!row) throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'chip_id' } });
      chipIntent = row.id;
      text = row.code;
    }
    if (!text) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'text' } });
    }

    const senderKind =
      side === 'BUYER'
        ? 'BUYER'
        : (
            await sql<{ n: number }>`
              SELECT count(*)::int AS n FROM core.seller
               WHERE id = ${conv.seller_id} AND owner_account_id = ${accountId}`.execute(trx)
          ).rows[0]?.n
          ? 'SELLER'
          : 'TEAM_MEMBER';

    const messageId = randomUUID();
    await sql`
      INSERT INTO chat.message (id, conversation_id, sender_kind, sender_account_id, body, locale)
      VALUES (${messageId}, ${conversationId}, ${senderKind}::chat.message_sender_kind,
              ${accountId}, ${text}, ${locale})`.execute(trx);

    // The cascade runs for BUYER messages on a seller whose tier includes
    // the chatbot. Human messaging stays free either way (S15).
    let bot: unknown = null;
    if (side === 'BUYER') {
      bot = await this.cascade(trx, conv, messageId, chipIntent, body.text ?? null, locale);
    }
    return { message_id: messageId, bot };
  }

  /** POST /v1/conversations/{id}/escalate — free, layer 5 by request. */
  async escalate(
    trx: Transaction<Database>,
    req: AuthedRequest,
    conversationId: string,
  ): Promise<unknown> {
    const { conv, side } = await this.membership(trx, req, conversationId);
    if (side !== 'BUYER') throw new AdulisException('NOT_FOUND');
    const botMessageId = await this.escalateTurn(trx, conv, 0);
    return { escalated: true, bot_message_id: botMessageId };
  }

  private async cascade(
    trx: Transaction<Database>,
    conv: ConversationRow,
    _buyerMessageId: string,
    chipIntent: string | null,
    freeText: string | null,
    locale: string,
  ): Promise<unknown> {
    const entitled = await sql<{ limit: { allowed: boolean } }>`
      SELECT billing.fn_effective_limit(${conv.seller_id}, 'CHATBOT_SCOPE') AS "limit"`.execute(trx);
    if (!first(entitled.rows)?.limit?.allowed) return null;

    // Layer 1 — the chip carries its intent.
    if (chipIntent) {
      return this.answerWith(trx, conv, chipIntent, 'CHIP', locale);
    }
    if (!freeText) return null;

    // Layer 2 — exact and keyword match against the intent library.
    const match = await sql<{ intent_id: string }>`
      SELECT p.intent_id FROM nlu.intent_phrase p
       JOIN nlu.intent i ON i.id = p.intent_id AND i.retired_at IS NULL
       WHERE p.locale = ${locale} AND lower(p.text) = lower(${freeText})
       LIMIT 1`.execute(trx);
    const hit = first(match.rows);
    if (hit) {
      return this.answerWith(trx, conv, hit.intent_id, 'KEYWORD', locale);
    }

    // Layers 3-4 — the adapter. Null until the integration lands.
    const inferred = await this.inference.classify(freeText, locale);
    if (inferred) {
      return this.answerWith(trx, conv, inferred.intentId, inferred.path, locale, inferred);
    }

    // Layer 5 — escalate with full context; delivered as a notification
    // because ordinary messages are not (S15).
    const botMessageId = await this.escalateTurn(trx, conv, 0);
    return { resolution_path: 'ESCALATED', bot_message_id: botMessageId };
  }

  private async answerWith(
    trx: Transaction<Database>,
    conv: ConversationRow,
    intentId: string,
    path: 'CHIP' | 'KEYWORD' | 'EMBEDDING' | 'CLASSIFIER',
    locale: string,
    inferred?: { confidence: number; modelId: string; tokensIn: number; tokensOut: number },
  ): Promise<unknown> {
    // Seller-specific answer first, the global default second (S15.1 —
    // intents are global; answers are per-seller).
    const template = await sql<{ template: string; slots: string[] }>`
      SELECT template, slots FROM nlu.answer_template
       WHERE intent_id = ${intentId} AND locale = ${locale}
         AND (seller_id = ${conv.seller_id} OR seller_id IS NULL)
       ORDER BY seller_id NULLS LAST
       LIMIT 1`.execute(trx);
    const t = first(template.rows);
    // No template, or a template whose slots this surface cannot fill:
    // unanswerable — escalate rather than reply with holes (registered).
    if (!t || (t.slots?.length ?? 0) > 0) {
      const botMessageId = await this.escalateTurn(trx, conv, 0);
      return { resolution_path: 'ESCALATED', bot_message_id: botMessageId };
    }

    const botMessageId = randomUUID();
    await sql`
      INSERT INTO chat.message (id, conversation_id, sender_kind, sender_account_id, body, locale)
      VALUES (${botMessageId}, ${conv.id}, 'BOT', NULL, ${t.template}, ${locale})`.execute(trx);
    await sql`
      INSERT INTO chat.bot_turn
        (id, message_id, turn_index, resolution_path, intent_id, confidence,
         model_id, tokens_in, tokens_out, escalated)
      VALUES (${randomUUID()}, ${botMessageId}, 0,
              ${path}::chat.resolution_path, ${intentId},
              ${inferred?.confidence ?? null}, ${inferred?.modelId ?? null},
              ${inferred?.tokensIn ?? 0}, ${inferred?.tokensOut ?? 0}, false)`.execute(trx);
    return {
      resolution_path: path,
      bot_message_id: botMessageId,
      template_key: t.template,
      slots: {},
    };
  }

  private async escalateTurn(
    trx: Transaction<Database>,
    conv: ConversationRow,
    turnIndex: number,
  ): Promise<string> {
    const botMessageId = randomUUID();
    // The body is a catalogue KEY (chat.bot.escalated), rendered by the
    // client from packages/locale — not prose, and not model output.
    await sql`
      INSERT INTO chat.message (id, conversation_id, sender_kind, sender_account_id, body, locale)
      SELECT ${botMessageId}, ${conv.id}, 'BOT', NULL, 'chat.bot.escalated',
             m.default_locale
        FROM core.market m WHERE m.id = ${conv.market_id}`.execute(trx);
    await sql`
      INSERT INTO chat.bot_turn (id, message_id, turn_index, resolution_path, escalated)
      VALUES (${randomUUID()}, ${botMessageId}, ${turnIndex}, 'ESCALATED', true)`.execute(trx);
    // Escalations are delivered as notifications; ordinary messages are
    // not (S15). To the owner — team routing is console UI, not delivery.
    await sql`
      INSERT INTO core.notification
        (recipient_account_id, channel, template_key, locale, slots, suppressible)
      SELECT s.owner_account_id, 'PUSH', 'notification.chat.escalated',
             m.default_locale,
             jsonb_build_object('conversation_id', ${conv.id}::text), true
        FROM core.seller s JOIN core.market m ON m.id = s.market_id
       WHERE s.id = ${conv.seller_id}`.execute(trx);
    return botMessageId;
  }
}

function page(
  rows: readonly unknown[],
  limit: number,
  cursorOf: (row: unknown) => string = (row) =>
    String((row as { last_message_at: Date }).last_message_at?.toISOString?.() ?? ''),
): unknown {
  const data = rows.slice(0, limit);
  return {
    data,
    next_cursor: rows.length > limit ? cursorOf(data[data.length - 1]) : null,
  };
}
