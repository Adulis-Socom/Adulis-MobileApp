import { Catch, HttpException, Inject, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import { errorFields } from './logging';

/**
 * ONE error envelope: RFC 9457 Problem Details plus items[] (carried from ADU-API-01 v1.6 S7 per GOV-03 B-03;
 * CONSOLE-02 S146). No body contains rendered prose: a message key plus typed slots, rendered by the client.
 * The catalogue is CLOSED; legacy codes of retired flows are not carried. AUTHENTICATION_REQUIRED is the one
 * foundation addition (AUTH-02 names no code for an absent session; confirm in SC-BE-02).
 */
export const ERROR_CATALOGUE = {
  AUTHENTICATION_REQUIRED: { group: 'auth', status: 401, retryable: false },
  PERMISSION_DENIED: { group: 'rbac', status: 403, retryable: false },
  VALIDATION_FAILED: { group: 'request', status: 400, retryable: false },
  NOT_FOUND: { group: 'request', status: 404, retryable: false },
  PAYLOAD_TOO_LARGE: { group: 'request', status: 413, retryable: false },
  INTERNAL: { group: 'request', status: 500, retryable: true },
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOGUE;

export const messageKeyFor = (code: ErrorCode): string => `error.${ERROR_CATALOGUE[code].group}.${code.toLowerCase()}`;
export const typeUriFor = (code: ErrorCode): string => `https://adulis.example/errors/${code.toLowerCase().replace(/_/g, '-')}`;

export interface ProblemItem {
  readonly code: ErrorCode;
  readonly message_key: string;
  readonly slots?: Readonly<Record<string, string | number | boolean>>;
}

export interface ProblemEnvelope {
  readonly type: string;
  readonly title_key: string;
  readonly status: number;
  readonly code: ErrorCode;
  readonly request_id: string;
  readonly retryable: boolean;
  readonly slots?: Readonly<Record<string, string | number | boolean>>;
  readonly items?: readonly ProblemItem[];
}

export class AdulisException extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(
    readonly code: ErrorCode,
    readonly extra: { status?: number; retryable?: boolean; slots?: ProblemEnvelope['slots']; items?: readonly ProblemItem[] } = {},
  ) {
    super(code);
    this.status = extra.status ?? ERROR_CATALOGUE[code].status;
    this.retryable = extra.retryable ?? ERROR_CATALOGUE[code].retryable;
  }
}

export const LOGGER = Symbol('LOGGER');
export const IS_PRODUCTION = Symbol('IS_PRODUCTION');

const DB_UNAVAILABLE = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', '57P01', '57P02', '57P03', '53300']);

export function toAdulisException(err: unknown): AdulisException {
  if (err instanceof AdulisException) return err;
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && DB_UNAVAILABLE.has(code)) {
    return new AdulisException('INTERNAL', { status: 503, retryable: true, slots: { retry_after_seconds: 5 } });
  }
  // Fastify's own errors (body limit, bad JSON, content type) carry statusCode and are not HttpExceptions.
  const status = err instanceof HttpException ? err.getStatus() : (err as { statusCode?: unknown } | null)?.statusCode;
  if (status === 401) return new AdulisException('AUTHENTICATION_REQUIRED');
  if (status === 403) return new AdulisException('PERMISSION_DENIED');
  if (status === 404 || status === 405) return new AdulisException('NOT_FOUND', { status });
  if (status === 413) return new AdulisException('PAYLOAD_TOO_LARGE');
  // Any other client error stays a client error with its real status (RB-B01-18), mapped onto the closed
  // catalogue: never a 500, and never the framework's own text.
  // shortcut: 408 and 429 have no catalogue code of their own (RATE_LIMITED is a spec GAP, RB-B02A-02); they are at
  // least retryable, so a client backs off instead of asking the person to fix their input.
  if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 500) {
    return new AdulisException('VALIDATION_FAILED', { status, retryable: status === 408 || status === 429 });
  }
  return new AdulisException('INTERNAL');
}

export function envelopeFor(ex: AdulisException, requestId: string): ProblemEnvelope {
  return {
    type: typeUriFor(ex.code),
    title_key: messageKeyFor(ex.code),
    status: ex.status,
    code: ex.code,
    request_id: requestId,
    retryable: ex.retryable,
    ...(ex.extra.slots ? { slots: ex.extra.slots } : {}),
    ...(ex.extra.items ? { items: ex.extra.items } : {}),
  };
}

@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(
    @Inject(LOGGER) private readonly log: Logger,
    @Inject(IS_PRODUCTION) private readonly production: boolean,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<FastifyRequest>();
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const ex = toAdulisException(exception);
    if (ex.status >= 500) {
      // pg's message can carry row values; only the class, SQLSTATE and (non-production) stack are logged.
      this.log.error({ requestId: req.id, errorCode: ex.code, ...errorFields(exception, this.production) }, 'request failed');
    }
    if (ex.status === 503) void reply.header('retry-after', String(ex.extra.slots?.['retry_after_seconds'] ?? 5));
    void reply.status(ex.status).header('content-type', 'application/problem+json').send(envelopeFor(ex, req.id));
  }
}
