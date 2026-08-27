import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from '../auth/auth.guard';

/**
 * First stage of the section 5 pipeline. Every response carries
 * X-Adulis-Request-Id (ADU-API-01 section 3.2) so a client report can be
 * correlated to a server log line — the id is assigned before anything can
 * fail, which is the point: the envelope of the earliest possible error
 * already carries it.
 *
 * The id is an opaque UUID; the contract is presence and uniqueness, and
 * nothing anywhere parses it.
 */
export function requestIdMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const id = randomUUID();
  req.requestId = id;
  res.setHeader('X-Adulis-Request-Id', id);
  next();
}
