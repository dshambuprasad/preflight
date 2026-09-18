// The one place that touches the network. Typed client from @preflight/api-types (16 §2.6).
import { createApiClient, type Problem } from '@preflight/api-types';

export const api = createApiClient();

export class ApiError extends Error {
  constructor(readonly problem: Problem, readonly status: number) {
    super(problem.title);
    this.name = 'ApiError';
  }
  get errorType(): string {
    return this.problem.type.replace('https://preflight.dev/errors/', '');
  }
}

/** Turn an openapi-fetch result into data-or-throw. */
export function unwrap<T>(r: { data?: T; error?: unknown; response: Response }): T {
  if (r.error !== undefined && r.error !== null) {
    const p = r.error as Problem;
    throw new ApiError(p.title ? p : { type: 'https://preflight.dev/errors/internal', title: 'Request failed', status: r.response.status, instance: r.response.url, requestId: r.response.headers.get('x-request-id') ?? '' }, r.response.status);
  }
  if (!r.response.ok) {
    throw new ApiError({ type: 'https://preflight.dev/errors/internal', title: 'Request failed', status: r.response.status, instance: r.response.url, requestId: r.response.headers.get('x-request-id') ?? '' }, r.response.status);
  }
  return r.data as T;
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
