// 06 §1 — RFC 9457 problem details. Every error type lives here; nowhere else builds an error body (16 §4).
export const ERROR_TYPES = {
  validation: 400,
  unauthenticated: 401,
  'forbidden-role': 403,
  'forbidden-self-review': 409,
  'not-found': 404,
  'invalid-transition': 409,
  'blockers-outstanding': 409,
  'blast-radius-approval-required': 409,
  'idempotency-conflict': 409,
  'connector-unavailable': 503,
  'rate-limited': 429,
  internal: 500,
} as const;

export type ErrorType = keyof typeof ERROR_TYPES;

export interface ProblemIssue {
  path: string;
  message: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  requestId: string;
  issues?: ProblemIssue[];
  data?: Record<string, unknown>;
}

const TITLES: Record<ErrorType, string> = {
  validation: 'Request is invalid',
  unauthenticated: 'Authentication required',
  'forbidden-role': 'Your role does not permit this action',
  'forbidden-self-review': 'You authored this version. A different reviewer must approve it.',
  'not-found': 'Not found',
  'invalid-transition': 'This action is not allowed in the current state',
  'blockers-outstanding': 'Blockers are outstanding',
  'blast-radius-approval-required': 'Approver co-sign required',
  'idempotency-conflict': 'Idempotency-Key was already used with a different request body',
  'connector-unavailable': 'Connector unavailable',
  'rate-limited': 'Too many requests',
  internal: 'Internal error',
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly type: ErrorType,
    readonly detail?: string,
    readonly extra: { issues?: ProblemIssue[]; data?: Record<string, unknown> } = {},
  ) {
    super(detail ?? TITLES[type]);
    this.name = 'AppError';
    this.status = ERROR_TYPES[type];
  }

  toProblem(instance: string, requestId: string): Problem {
    const p: Problem = {
      type: `https://preflight.dev/errors/${this.type}`,
      title: TITLES[this.type],
      status: this.status,
      instance,
      requestId,
    };
    if (this.detail) p.detail = this.detail;
    if (this.extra.issues) p.issues = this.extra.issues;
    if (this.extra.data) p.data = this.extra.data;
    return p;
  }
}

export const notFound = (what: string) => new AppError('not-found', `${what} not found`);
export const forbiddenRole = (detail?: string) => new AppError('forbidden-role', detail);
export const invalidTransition = (detail: string) => new AppError('invalid-transition', detail);
export const validation = (issues: ProblemIssue[], detail = 'validation failed') => new AppError('validation', detail, { issues });
