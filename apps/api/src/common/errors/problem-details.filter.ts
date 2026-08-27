import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { Logger } from 'pino';
import { AdulisException, type ProblemEnvelope } from './adulis-exception';
import { messageKeyFor, typeUriFor } from './error-catalogue';
import { isPgError, isPrivilegeDefect, translatePgError } from './pg-error-translator';

/**
 * The last stage of the section 5 pipeline: everything thrown anywhere
 * becomes ONE envelope — RFC 9457 Problem Details plus items[] (ADU-API-01
 * v1.6 section 7). No other code path writes an error body.
 *
 * INVARIANT — no error body contains rendered prose in any language, and no
 * database error leaks to the wire. The pg message text and the stack stay
 * in the log, correlated by request_id; the wire carries keys and typed
 * slots the client renders from its own catalogue.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly log: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId ?? 'unassigned';

    const adulis = this.toAdulisException(exception, requestId);

    const envelope: ProblemEnvelope = {
      type: typeUriFor(adulis.code),
      title_key: messageKeyFor(adulis.code),
      status: adulis.status,
      code: adulis.code,
      request_id: requestId,
      retryable: adulis.retryable,
      ...(adulis.slots ? { slots: adulis.slots } : {}),
      ...(adulis.items ? { items: adulis.items } : {}),
    };

    if (adulis.status === 429 || adulis.status === 503) {
      const retryAfter = (adulis.slots?.['retry_after_seconds'] as number) ?? 30;
      res.setHeader('Retry-After', String(retryAfter));
    }
    res.status(adulis.status).contentType('application/problem+json').json(envelope);
  }

  private toAdulisException(exception: unknown, requestId: string): AdulisException {
    if (exception instanceof AdulisException) {
      return exception;
    }

    // Zod at the door (section 3.8): a malformed body is 400 with every
    // failing path reported at once — the items[] completeness rule applied
    // to validation.
    if (exception instanceof ZodError) {
      return new AdulisException('VALIDATION_FAILED', {
        items: exception.issues.map((i) => ({
          code: 'VALIDATION_FAILED',
          message_key: messageKeyFor('VALIDATION_FAILED'),
          slots: { path: i.path.join('.'), issue: i.code },
        })),
      });
    }

    if (isPgError(exception)) {
      // 42501 — a deliberate denial and a misconfigured grant never share a
      // code (R29). This is OUR defect: logged at fatal so it pages, served
      // as a generic 500 so it never reads as a clean denial.
      if (isPrivilegeDefect(exception)) {
        this.log.fatal(
          { requestId, sqlstate: '42501', message: exception.message },
          'privilege misconfiguration: a grant is wrong',
        );
        return new AdulisException('INTERNAL');
      }
      // The database being unreachable is planned-for unavailability, not a
      // defect: 503 with Retry-After (section 7's status list), retryable.
      if (
        exception.code !== undefined &&
        ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', '57P01', '57P02', '57P03', '53300'].includes(
          exception.code,
        )
      ) {
        this.log.error({ requestId, code: exception.code }, 'database unavailable');
        return new AdulisException('INTERNAL', {
          status: 503,
          retryable: true,
          slots: { retry_after_seconds: 5 },
        });
      }

      const translated = translatePgError(exception);
      if (translated) return translated;

      // The redaction allow-list keeps unknown fields out of log lines, so
      // the diagnostic identifiers ride in msg: SQLSTATE and constraint are
      // codes, not data.
      this.log.error(
        { requestId },
        `unmapped database refusal [${exception.code}] ${exception.constraint ?? ''}`,
      );
      return new AdulisException('INTERNAL');
    }

    // Express's body-parser speaks before any handler: the 256 KB limit
    // (media never transits the API) raises PayloadTooLargeError, malformed
    // JSON a SyntaxError - both carry statusCode and neither is a Nest
    // HttpException.
    if (typeof exception === 'object' && exception !== null && 'statusCode' in exception) {
      const sc = (exception as { statusCode?: number }).statusCode;
      if (sc === 413) return new AdulisException('PAYLOAD_TOO_LARGE');
      if (sc === 400) return new AdulisException('VALIDATION_FAILED');
    }

    // Nest's own exceptions (404 on unknown route, method not allowed...)
    // still leave in the one envelope.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === 404) return new AdulisException('NOT_FOUND');
      if (status === 413) return new AdulisException('PAYLOAD_TOO_LARGE');
      return new AdulisException('INTERNAL', { status, retryable: status >= 500 });
    }

    this.log.error(
      {
        requestId,
        error: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      },
      'unhandled exception',
    );
    return new AdulisException('INTERNAL');
  }
}
