/**
 * api/api-error.ts -- the one error shape every screen handles. Re-exported by
 * api/client.ts, which is where everything imports it from.
 */
import type { AdulisProblem } from '../lib/states';

export class ApiError extends Error {
  constructor(readonly problem: AdulisProblem) {
    super(problem.code);
  }
}
