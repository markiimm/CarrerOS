import type { z } from 'zod';

/** FormData → objeto. Campos com nome terminado em `[]` viram lista (checkbox em grupo). */
export function formToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    if (key.endsWith('[]')) out[key.slice(0, -2)] = form.getAll(key);
    else out[key] = form.get(key);
  }
  return out;
}

/** Primeiro erro de cada campo, na forma { campo: mensagem }. */
export function issuesToErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '_form');
    out[field] ??= issue.message;
  }
  return out;
}
