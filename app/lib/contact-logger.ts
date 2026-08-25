import type { ContactErrorCode } from './types.ts';

/**
 * Deliberately small event vocabulary for contact observability. A log entry
 * contains only a public request id and a public error code; it never carries
 * form data, hashes, tokens, provider responses, or secrets.
 */
export type ContactLogEntry = {
  event:
    | 'contact.service_unavailable'
    | 'contact.turnstile_rejected'
    | 'contact.turnstile_upstream_failure'
    | 'contact.store_reserve_failure'
    | 'contact.delivery_failure'
    | 'contact.store_update_failure';
  stage: 'config' | 'turnstile' | 'store.reserve' | 'resend' | 'store.updateStatus';
  requestId?: string;
  errorCode: ContactErrorCode;
};

export type ContactLogger = (entry: Readonly<ContactLogEntry>) => void;

export function emitContactLog(logger: ContactLogger | undefined, entry: ContactLogEntry): void {
  if (!logger) return;
  try {
    logger(entry);
  } catch {
    // Logging must never turn a safe public response into an internal error.
  }
}

/**
 * The route injects this logger in the worker runtime. Keep the serialized
 * shape explicit so an accidental future field cannot include private input.
 */
export function createDefaultContactLogger(): ContactLogger {
  return (entry) => {
    console.error(JSON.stringify({
      event: entry.event,
      stage: entry.stage,
      ...(entry.requestId ? { requestId: entry.requestId } : {}),
      errorCode: entry.errorCode,
    }));
  };
}
