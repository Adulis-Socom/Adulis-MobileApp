import { ApiError, type ApiFailure } from '../../api/client';

type Problem = Extract<ApiFailure, { kind: 'problem' }>['problem'];

/** The API's own problem answer: every field of its envelope present, `status` equal to the HTTP status. */
export function apiProblem(status: number, code: string, retryAfterSeconds?: number): ApiError {
  const problem = {
    type: 'about:blank',
    title_key: 'error.request.internal',
    status,
    code,
    request_id: 'req-1',
    retryable: false,
  } as unknown as Problem;
  return new ApiError({
    kind: 'problem',
    status,
    problem,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  });
}

/** A proxy's JSON page: a string `code`, but none of the API's other fields. */
export function proxyJson(status: number, code: string): ApiError {
  return new ApiError({ kind: 'problem', status, problem: { code } as unknown as Problem });
}

export const offline = () => new ApiError({ kind: 'offline' });
export const timeout = () => new ApiError({ kind: 'timeout' });
/** A non-success answer that is not JSON: a gateway page. */
export const gatewayPage = (status: number, retryAfterSeconds?: number) =>
  new ApiError({
    kind: 'unexpected',
    status,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  });
