import { ApiError, problemCode } from '../../api/client';
import { keyConflict, keyUsable, waitBeforeRetryMs } from '../../api/mutation';

/**
 * The 409 codes a cart add is known to answer BEFORE it stores anything. Only these are a definite
 * refusal. Any other 409 stays unknown: a refusal is not recorded for replay today, but a server
 * that did record one would make "could not be added" false.
 */
export const KNOWN_CART_CONFLICT_CODES: readonly string[] = ['CART_SELLER_CONFLICT'];

export type AddJudgement =
  | Readonly<{ outcome: 'refused'; reload: boolean; code: string | null; holdMs: number | null }>
  | Readonly<{ outcome: 'unknown'; replay: boolean; holdMs: number | null }>;

/**
 * Whether the failure is the API's OWN problem answer: its fields are all there and its status is the
 * HTTP status. The client reads any JSON body with a string `code` as a problem, so a proxy's error
 * page that happens to carry one must not count as the server refusing the request.
 */
function apiOwnProblem(failure: unknown): { status: number; code: string | null } | null {
  if (!(failure instanceof ApiError) || failure.failure.kind !== 'problem') return null;
  const { problem, status } = failure.failure;
  const p = problem as { title_key?: unknown; request_id?: unknown; retryable?: unknown; status?: unknown };
  const whole =
    typeof p.title_key === 'string' && typeof p.request_id === 'string' && typeof p.retryable === 'boolean' && p.status === status;
  return whole ? { status, code: problemCode(failure) } : null;
}

/**
 * Judge one failed attempt of a cart add, at `now`, for the intent that began at `intent.startedAt`.
 *
 * Only the API's own 4xx problem proves the request was rejected before anything was stored. A 5xx
 * proves nothing (the connection can drop after the commit), nor does a rate limit, a proxy's page,
 * an unreadable answer, a lost connection or a 409 that is not a known refusal; a key conflict says
 * the key was already used, so the first attempt may be stored. All of those leave the outcome unknown,
 * and sending the same request again under the SAME key is then safe while the key is surely inside
 * the server's record life. `attempts` counts the requests already sent under the key: on a replay
 * some refusals say nothing about the first request, so only a 400, 404 or 413 still proves it.
 */
export function judgeAdd(
  failure: unknown,
  intent: { startedAt: number; attempts: number } | null,
  now: number,
): AddJudgement {
  const holdMs = waitBeforeRetryMs(failure);
  if (keyConflict(failure)) return { outcome: 'unknown', replay: false, holdMs };
  const own = apiOwnProblem(failure);
  if (own !== null) {
    const { status, code } = own;
    if (status === 409 && code !== null && KNOWN_CART_CONFLICT_CODES.includes(code)) {
      return { outcome: 'refused', reload: true, code, holdMs };
    }
    if (status >= 400 && status < 500 && status !== 409 && status !== 429) {
      const attempts = intent?.attempts ?? 1;
      if (attempts < 2 || status === 400 || status === 404 || status === 413) {
        return { outcome: 'refused', reload: false, code, holdMs };
      }
    }
  }
  return { outcome: 'unknown', replay: intent !== null && keyUsable(intent, now), holdMs };
}
