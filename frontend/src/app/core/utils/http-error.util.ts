import { HttpErrorResponse } from '@angular/common/http';

export function extraerMensajeError(
  err: HttpErrorResponse,
  fallback: string,
): string {
  const message = err?.error?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.length > 0) {
    return String(message[0]);
  }
  return fallback;
}
