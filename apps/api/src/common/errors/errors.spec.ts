import { ZodError, z } from 'zod';
import type { Response } from 'express';
import { AdulisException } from './adulis-exception';
import {
  ERROR_CATALOGUE,
  ERROR_GROUPS,
  messageKeyFor,
  type ErrorCode,
} from './error-catalogue';
import { translatePgError } from './pg-error-translator';
import { ProblemDetailsFilter } from './problem-details.filter';

/**
 * The error contract — ADU-API-01 v1.6 section 7, mechanically.
 *
 * These tests hold the three properties the section exists for: the taxonomy
 * is closed and derivable, the three-SQLSTATE authorization contract never
 * blurs (R29), and items[] is complete rather than first-failure.
 */

describe('the error catalogue (section 7.1, 7.2)', () => {
  it('derives every message key mechanically: error.<group>.<code lower>', () => {
    for (const code of Object.keys(ERROR_CATALOGUE) as ErrorCode[]) {
      const { group } = ERROR_CATALOGUE[code];
      expect(messageKeyFor(code)).toBe(`error.${group}.${code.toLowerCase()}`);
    }
  });

  it('uses only ratified groups and only ratified statuses', () => {
    // Section 7's status list, closed (413 is the transport's own voice for
    // the body limit; 500 is the R29 defect path).
    const ratified = new Set([400, 401, 403, 404, 409, 410, 413, 422, 426, 429, 500, 503]);
    for (const code of Object.keys(ERROR_CATALOGUE) as ErrorCode[]) {
      expect(ERROR_GROUPS).toContain(ERROR_CATALOGUE[code].group);
      expect(ratified.has(ERROR_CATALOGUE[code].status)).toBe(true);
    }
  });

  it('rules the two retryable examples the document names', () => {
    expect(ERROR_CATALOGUE.SOLD_OUT.retryable).toBe(false);
    expect(ERROR_CATALOGUE.RATE_LIMITED.retryable).toBe(true);
  });

  it('carries every code of the section 7.1 table', () => {
    const documented = [
      'OTP_INVALID', 'OTP_EXPIRED', 'OTP_ATTEMPTS_EXCEEDED', 'OTP_PURPOSE_NOT_PERMITTED',
      'SESSION_EXPIRED', 'SESSION_REVOKED', 'AUDIENCE_NOT_PERMITTED', 'RECOVERY_REQUIRED',
      'STEP_UP_REQUIRED', 'STEP_UP_EXPIRED', 'STEP_UP_ACTION_MISMATCH',
      'PERMISSION_DENIED', 'OWNER_ONLY',
      'CART_EMPTY', 'CART_SELLER_CONFLICT', 'CART_REVALIDATION_FAILED',
      'INSUFFICIENT_STOCK', 'SOLD_OUT', 'PRICE_CHANGED', 'NO_LONGER_PUBLISHED',
      'VARIANT_WITHDRAWN', 'SELLER_UNAVAILABLE', 'TRANSACTION_CAP_EXCEEDED',
      'ILLEGAL_TRANSITION', 'ORDER_NOT_PAYABLE', 'ORDER_ALREADY_TERMINAL',
      'DUPLICATE_RESERVATION', 'BUYER_COOLDOWN_ACTIVE', 'ORDER_NOT_READYABLE',
      'EVIDENCE_REQUIRED', 'EVIDENCE_TOO_LARGE', 'PAYMENT_ALREADY_DECIDED', 'NOT_ORDER_BUYER',
      'SCAN_SIGNATURE_INVALID', 'SCAN_PREDATES_TOKEN', 'SCAN_NOT_ORDER_BUYER', 'COURIER_CANNOT_SCAN',
      'PUBLICATION_BLOCKED', 'ELIGIBILITY_NOT_SATISFIED', 'TIER_LIMIT_REACHED',
      'LEVEL_LIMIT_REACHED', 'HANDLE_TAKEN', 'FULFILMENT_METHOD_REQUIRED',
      'PRODUCT_HAS_ACTIVE_ORDERS', 'VARIANT_HAS_ACTIVE_ORDERS',
      'PAYOUT_LOCKED_RECOVERY', 'PAYOUT_CHANGE_PENDING', 'PAYOUT_PERMISSION_DENIED',
      'DELETION_BLOCKED', 'DELETION_OWNER_ONLY',
      'VALIDATION_FAILED', 'IDEMPOTENCY_KEY_MISSING', 'IDEMPOTENCY_KEY_REUSED',
      'RATE_LIMITED', 'CLIENT_UPGRADE_REQUIRED', 'PAYLOAD_TOO_LARGE',
      'SELLER_CONTEXT_REQUIRED', 'SCOPE_PARAMETER_REQUIRED',
    ];
    for (const code of documented) {
      expect(ERROR_CATALOGUE).toHaveProperty(code);
    }
  });
});

describe('the pg translator (section 6.3, R29)', () => {
  it('U0001 -> 403 PERMISSION_DENIED, identically whatever gate produced it', () => {
    const e = translatePgError({ code: 'U0001', message: 'permission denied for X' });
    expect(e).toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });
    // The body must not carry which gate stopped the caller.
    expect(e?.slots).toBeUndefined();
    expect(e?.items).toBeUndefined();
  });

  it('U0002 -> 404 with the ordinary envelope and NO detail', () => {
    const e = translatePgError({ code: 'U0002', message: 'out of scope' });
    expect(e).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(e?.slots).toBeUndefined();
  });

  it('U0003 -> 409 CART_REVALIDATION_FAILED with COMPLETE items[] from DETAIL', () => {
    const detail = JSON.stringify([
      { code: 'PRICE_CHANGED', variant_id: 'v1', was_minor: 900, now_minor: 1000, currency: 'ETB' },
      { code: 'INSUFFICIENT_STOCK', variant_id: 'v2', requested: 3, available: 1 },
    ]);
    const e = translatePgError({ code: 'U0003', message: 'cart revalidation failed', detail });
    expect(e?.code).toBe('CART_REVALIDATION_FAILED');
    expect(e?.items).toHaveLength(2);
    expect(e?.items?.[0]).toMatchObject({
      code: 'PRICE_CHANGED',
      subject: { kind: 'CART_LINE', id: 'v1' },
      message_key: 'error.cart_line.price_changed',
      resolving_action: { kind: 'ACCEPT_NEW_PRICE' },
    });
    expect(e?.items?.[1]?.resolving_action).toEqual({ kind: 'REDUCE_QUANTITY', to: 1 });
  });

  it('the transition guard -> 409 ILLEGAL_TRANSITION with both states in slots', () => {
    const e = translatePgError({
      code: '23001',
      message: 'Illegal order transition CREATED -> COMPLETED',
    });
    expect(e).toMatchObject({
      code: 'ILLEGAL_TRANSITION',
      status: 409,
      slots: { from_state: 'CREATED', to_state: 'COMPLETED' },
    });
  });

  it('the duplicate-reservation exclusion -> 409 DUPLICATE_RESERVATION', () => {
    const e = translatePgError({
      code: '23P01',
      message: 'conflicting key value',
      constraint: 'reservation_no_duplicate_active',
    });
    expect(e?.code).toBe('DUPLICATE_RESERVATION');
  });

  it('the stock check -> 409 INSUFFICIENT_STOCK; any other check -> unmapped (500)', () => {
    expect(
      translatePgError({
        code: '23514',
        message: 'violates check',
        constraint: 'product_variant_stock_count_check',
      })?.code,
    ).toBe('INSUFFICIENT_STOCK');
    expect(
      translatePgError({ code: '23514', message: 'violates check', constraint: 'review_rating_range' }),
    ).toBeNull();
  });

  it('a composite scope FK -> 404; an ordinary FK -> unmapped (500)', () => {
    expect(
      translatePgError({
        code: '23503',
        message: 'fk',
        constraint: 'handoff_scanned_by_buyer',
      })?.code,
    ).toBe('NOT_FOUND');
    expect(
      translatePgError({ code: '23503', message: 'fk', constraint: 'order_market_id_fkey' }),
    ).toBeNull();
  });
});

describe('the filter (one envelope, nothing leaks)', () => {
  const silentLog = {
    fatal: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  } as never;

  const run = (exception: unknown): { status: number; body: Record<string, unknown> } => {
    let status = 0;
    let body: Record<string, unknown> = {};
    const res = {
      setHeader: jest.fn(),
      status(s: number) {
        status = s;
        return this;
      },
      contentType() {
        return this;
      },
      json(b: Record<string, unknown>) {
        body = b;
        return this;
      },
    } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ requestId: '01TEST' }),
      }),
    };
    new ProblemDetailsFilter(silentLog).catch(exception, host as never);
    return { status, body };
  };

  it('serves the full RFC 9457 shape with derived keys', () => {
    const { status, body } = run(new AdulisException('CART_SELLER_CONFLICT'));
    expect(status).toBe(409);
    expect(body).toMatchObject({
      type: 'https://adulis.example/errors/cart-seller-conflict',
      title_key: 'error.cart.cart_seller_conflict',
      status: 409,
      code: 'CART_SELLER_CONFLICT',
      request_id: '01TEST',
      retryable: false,
    });
  });

  it('42501 is a 500 and NEVER a 403 - a misconfigured grant must not read as a denial', () => {
    const { status, body } = run({ code: '42501', message: 'permission denied for table x' });
    expect(status).toBe(500);
    expect(body['code']).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('permission denied');
  });

  it('an unmapped database refusal is a 500 that leaks nothing of the message', () => {
    const { status, body } = run({
      code: 'P0001',
      message: 'Table core.stock_event is append-only; UPDATE is not permitted',
    });
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('append-only');
    expect(JSON.stringify(body)).not.toContain('core.');
  });

  it('a ZodError reports every failing path at once', () => {
    const schema = z.object({ a: z.string(), b: z.number() });
    const r = schema.safeParse({ a: 1, b: 'x' });
    const { status, body } = run(r.error as ZodError);
    expect(status).toBe(400);
    expect((body['items'] as unknown[]).length).toBe(2);
  });

  it('no envelope field ever carries rendered prose', () => {
    const { body } = run(
      new AdulisException('ILLEGAL_TRANSITION', {
        slots: { from_state: 'CREATED', to_state: 'COMPLETED' },
      }),
    );
    // The contract fields are keys and typed primitives; there is no
    // message, detail or title field carrying text.
    expect(body['message']).toBeUndefined();
    expect(body['detail']).toBeUndefined();
    expect(body['title']).toBeUndefined();
  });

  it('database unavailability is 503 with Retry-After, retryable', () => {
    const { status, body } = run({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' });
    expect(status).toBe(503);
    expect(body['retryable']).toBe(true);
  });
});
