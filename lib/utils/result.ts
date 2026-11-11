// Documento 19 §1 — forma fixa do resultado de Server Action.
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; field?: string } };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (code: ErrorCode, message: string, field?: string): ActionResult<never> => ({
  ok: false,
  error: { code, message, ...(field ? { field } : {}) },
});
