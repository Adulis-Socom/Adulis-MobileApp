import { hostname } from 'node:os';
import type { LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';

/**
 * Structured, redacted logging (OBS-01 S10-S12, ARCH-PLATFORM-01 S16). ALLOW-LIST, carried from the legacy
 * pattern: a field reaches a log line BECAUSE it is named here; anything unnamed is dropped, including fields
 * nobody has thought of yet. NEVER_LOG is the second line of defence and the reviewer's reference.
 */
export const LOG_FIELDS: readonly string[] = [
  'msg', 'module', 'requestId', 'correlationId', 'method', 'route', 'statusCode', 'durationMs',
  'errorCode', 'errorName', 'sqlstate', 'stack',
  // worker and relay: compile-time names and counts only
  'consumer', 'eventType', 'eventVersion', 'jobId', 'attempt', 'outcome', 'count', 'queue',
  'waiting', 'active', 'delayed', 'failed', 'undispatched', 'oldestUndispatchedSeconds', 'unresolvedDeadLetters',
];

/** OBS-01 S11: never in broad telemetry. Removed even if a caller bypasses the allow-list. */
export const NEVER_LOG: readonly string[] = [
  'authorization', 'cookie', 'otp', 'otpCode', 'phone', 'phoneNumber', 'sessionToken', 'token', 'password',
  'payload', 'body', 'headers', 'url', 'query',
];

export function allowListed(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of LOG_FIELDS) if (Object.hasOwn(record, key)) out[key] = record[key];
  return out;
}

export function createLogger(opts: { service: string; level: string; release: string; destination?: pino.DestinationStream }): Logger {
  const options: pino.LoggerOptions = {
    level: opts.level,
    base: { service: opts.service, release: opts.release, pid: process.pid, hostname: hostname() },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { log: allowListed },
    redact: { paths: [...NEVER_LOG], remove: true },
  };
  return opts.destination ? pino(options, opts.destination) : pino(options);
}

/** Error facts safe to log: a class name, a SQLSTATE, and a stack only outside production. */
export function errorFields(err: unknown, production: boolean): Record<string, unknown> {
  if (!(err instanceof Error)) return { errorName: typeof err };
  const code = (err as { code?: unknown }).code;
  return {
    errorName: err.name,
    ...(typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? { sqlstate: code } : {}),
    ...(production ? {} : { stack: err.stack }),
  };
}

/** Routes Nest's own framework messages into the same pino stream. */
export class NestPinoLogger implements LoggerService {
  constructor(private readonly pinoLogger: Logger) {}
  private write(level: 'info' | 'error' | 'warn' | 'debug' | 'fatal', message: unknown, rest: unknown[]): void {
    const context = rest.length > 0 && typeof rest[rest.length - 1] === 'string' ? (rest[rest.length - 1] as string) : undefined;
    this.pinoLogger[level]({ module: context }, typeof message === 'string' ? message : String(message));
  }
  log(message: unknown, ...rest: unknown[]): void { this.write('info', message, rest); }
  error(message: unknown, ...rest: unknown[]): void { this.write('error', message, rest); }
  warn(message: unknown, ...rest: unknown[]): void { this.write('warn', message, rest); }
  debug(message: unknown, ...rest: unknown[]): void { this.write('debug', message, rest); }
  verbose(message: unknown, ...rest: unknown[]): void { this.write('debug', message, rest); }
  fatal(message: unknown, ...rest: unknown[]): void { this.write('fatal', message, rest); }
}
