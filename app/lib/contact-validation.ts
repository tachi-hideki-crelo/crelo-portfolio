import { INQUIRY_TYPES } from './types.ts';
import type { ContactRequest, InquiryType } from './types.ts';

export const MAX_CONTACT_BODY_BYTES = 16 * 1024;
export const CONTACT_LIMITS = {
  name: 80,
  company: 120,
  email: 254,
  message: 4000,
  turnstileToken: 2048,
  requestId: 100,
} as const;

// Reject controls instead of silently deleting them so validation cannot hide
// header injection or ambiguous audit content.
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Resend uses the request ID as its stable `Idempotency-Key` and D1 uses it
// as the retry identity. Keep caller-supplied IDs UUID-shaped so the public
// response and database key remain unambiguous.
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ContactValidationResult =
  | { ok: true; value: ContactRequest }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function hasControlCharacters(value: string): boolean {
  return CONTROL_CHARACTER_PATTERN.test(value);
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim();
}

function validLength(value: string, max: number): boolean {
  return value.length <= max;
}

function isInquiryType(value: unknown): value is InquiryType {
  return isString(value) && (INQUIRY_TYPES as readonly string[]).includes(value);
}

export function validateContactInput(value: unknown): ContactValidationResult {
  if (!isRecord(value)) return { ok: false, reason: 'body_not_object' };

  const fields = ['name', 'company', 'email', 'inquiryType', 'message', 'consent', 'turnstileToken'];
  for (const field of fields) {
    if (!(field in value)) return { ok: false, reason: `missing_${field}` };
  }

  if (!isString(value.name) || !isString(value.company) || !isString(value.email)) {
    return { ok: false, reason: 'text_field_type' };
  }
  if (!isString(value.message) || !isString(value.turnstileToken)) {
    return { ok: false, reason: 'text_field_type' };
  }
  if (!isInquiryType(value.inquiryType)) return { ok: false, reason: 'inquiry_type' };
  if (value.consent !== true) return { ok: false, reason: 'consent_required' };

  const name = normalizeText(value.name);
  const company = normalizeText(value.company);
  const email = normalizeText(value.email).toLowerCase();
  const message = normalizeText(value.message);
  const turnstileToken = value.turnstileToken.trim();
  const requestId = value.requestId === undefined ? undefined : String(value.requestId).trim();
  const honeypot = value.honeypot === undefined ? undefined : String(value.honeypot);

  const textValues = [name, company, email, message, turnstileToken];
  if (textValues.some(hasControlCharacters)) return { ok: false, reason: 'control_character' };
  if (!validLength(name, CONTACT_LIMITS.name)) return { ok: false, reason: 'name_length' };
  if (!validLength(company, CONTACT_LIMITS.company)) return { ok: false, reason: 'company_length' };
  if (!validLength(email, CONTACT_LIMITS.email) || !EMAIL_PATTERN.test(email)) {
    return { ok: false, reason: 'email_invalid' };
  }
  if (!message || !validLength(message, CONTACT_LIMITS.message)) {
    return { ok: false, reason: 'message_length' };
  }
  if (!turnstileToken || !validLength(turnstileToken, CONTACT_LIMITS.turnstileToken)) {
    return { ok: false, reason: 'turnstile_invalid' };
  }
  if (requestId !== undefined && !REQUEST_ID_PATTERN.test(requestId)) {
    return { ok: false, reason: 'request_id_invalid' };
  }

  return {
    ok: true,
    value: {
      name,
      company,
      email,
      inquiryType: value.inquiryType,
      message,
      consent: true,
      turnstileToken,
      ...(requestId ? { requestId } : {}),
      ...(honeypot !== undefined ? { honeypot } : {}),
    },
  };
}

export function hasHoneypotValue(value: ContactRequest): boolean {
  return typeof value.honeypot === 'string' && value.honeypot.trim().length > 0;
}

export function hasAllowedOrigin(origin: string | null, siteOrigin: string | undefined): boolean {
  if (!origin || !siteOrigin) return false;
  try {
    return new URL(origin).origin === new URL(siteOrigin).origin;
  } catch {
    return false;
  }
}
