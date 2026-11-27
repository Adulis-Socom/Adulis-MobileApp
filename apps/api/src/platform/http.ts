import { randomUUID } from 'node:crypto';
import { Injectable, type PipeTransform } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IncomingMessage } from 'node:http';
import type { z } from 'zod';
import { AdulisException } from './problem';

export const REQUEST_ID_HEADER = 'x-adulis-request-id';
export const CORRELATION_ID_HEADER = 'x-adulis-correlation-id';
/** OBS-01 S14: bounded length and grammar, no control characters. */
const SAFE_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/** Server-controlled request id (OBS-01 S13); a gateway id is accepted only when trusted AND well formed. */
export function makeGenReqId(trustGateway: boolean): (req: IncomingMessage) => string {
  return (req) => {
    const fromGateway = req.headers['x-request-id'];
    if (trustGateway && typeof fromGateway === 'string' && SAFE_ID.test(fromGateway)) return fromGateway;
    return `req_${randomUUID()}`;
  };
}

/** A client correlation id is linkage only, never authority; invalid ones are replaced, not rejected. */
export function correlationIdFor(req: FastifyRequest): string {
  const supplied = req.headers[CORRELATION_ID_HEADER];
  return typeof supplied === 'string' && SAFE_ID.test(supplied) ? supplied : req.id;
}

export type BrowserAudience = 'CONSOLE' | 'OPERATOR';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    /** Audience implied by an allowed browser Origin; absent for native and server callers. Never authority alone. */
    originAudience?: BrowserAudience;
  }
}

/** First hook: ids exist before anything can fail, so the earliest error envelope already carries them. */
export async function requestIdsHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  req.correlationId = correlationIdFor(req);
  void reply.header(REQUEST_ID_HEADER, req.id);
}

/**
 * Origin boundary (AUTH-02 S32-S33, CSP-01), run as the first global guard. The allow-list is EXACT, never a
 * wildcard or suffix match. An Origin outside it is refused; an allowed Origin records which browser audience
 * it implies, and the auth guard requires the session's audience to match it.
 */
export function checkOrigin(req: FastifyRequest, origins: ReadonlyMap<string, BrowserAudience>): void {
  const origin = req.headers.origin;
  if (origin === undefined) return;
  const audience = origins.get(origin);
  if (audience === undefined) throw new AdulisException('PERMISSION_DENIED'); // the body never says which control fired
  req.originAudience = audience;
}

/** Request validation at the door: every failing path reported at once (CONSOLE-02 S147). */
@Injectable()
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}
  transform(value: unknown): z.infer<S> {
    const parsed = this.schema.safeParse(value);
    if (parsed.success) return parsed.data;
    throw new AdulisException('VALIDATION_FAILED', {
      items: parsed.error.issues.map((i) => ({
        code: 'VALIDATION_FAILED' as const,
        message_key: 'error.request.validation_failed',
        slots: { path: i.path.join('.'), issue: i.code },
      })),
    });
  }
}
