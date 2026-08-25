import {
  buildContactFingerprint,
  getClientIp,
  hasSufficientContactHashSecret,
  hmacSha256,
} from './contact-crypto.ts';
import {
  hasAllowedOrigin,
  hasHoneypotValue,
  MAX_CONTACT_BODY_BYTES,
  validateContactInput,
} from './contact-validation.ts';
import { emitContactLog, type ContactLogger } from './contact-logger.ts';
import type { ContactStore } from '../../db/contact-store.ts';
import type { ContactErrorCode, ContactRequest, ContactResponse, InquiryType } from './types.ts';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const TURNSTILE_TOKEN_WINDOW_MS = 5 * 60 * 1000;

export type ContactRuntimeEnv = {
  SITE_ORIGIN?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
  RESEND_API_KEY?: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  CONTACT_HASH_SECRET?: string;
};

export type ContactHandlerDependencies = {
  env: ContactRuntimeEnv;
  store?: ContactStore;
  fetchImpl?: typeof fetch;
  now?: () => number;
  idFactory?: () => string;
  logger?: ContactLogger;
};

type BodyReadResult =
  | { ok: true; text: string }
  | { ok: false; code: 'BODY_TOO_LARGE' | 'BODY_READ_FAILED' };

const INQUIRY_LABELS: Record<InquiryType, string> = {
  project: 'プロジェクト相談',
  'ai-workflow': 'AI活用・業務設計',
  'software-delivery': 'ソフトウェア開発・導入',
  other: 'その他',
};

function jsonResponse(payload: ContactResponse, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function errorResponse(code: ContactErrorCode, status: number, requestId?: string): Response {
  return jsonResponse({ ok: false, ...(requestId ? { requestId } : {}), errorCode: code }, status);
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]';
}

function isValidRuntimeEmail(value: string | undefined): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requiredRuntimeConfig(env: ContactRuntimeEnv): boolean {
  if (
    !env.SITE_ORIGIN ||
    !env.CONTACT_TO_EMAIL ||
    !env.CONTACT_FROM_EMAIL ||
    !env.RESEND_API_KEY ||
    !env.TURNSTILE_SECRET_KEY ||
    !isValidRuntimeEmail(env.CONTACT_TO_EMAIL) ||
    !isValidRuntimeEmail(env.CONTACT_FROM_EMAIL) ||
    !hasSufficientContactHashSecret(env.CONTACT_HASH_SECRET)
  ) {
    return false;
  }
  try {
    const origin = new URL(env.SITE_ORIGIN);
    if (
      !origin.hostname ||
      (origin.protocol !== 'http:' && origin.protocol !== 'https:') ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash ||
      (origin.protocol !== 'https:' && !isLocalHostname(origin.hostname))
    ) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

async function readBodyLimited(request: Request): Promise<BodyReadResult> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      return { ok: false, code: 'BODY_READ_FAILED' };
    }
    if (contentLength > MAX_CONTACT_BODY_BYTES) return { ok: false, code: 'BODY_TOO_LARGE' };
  }

  if (!request.body) {
    const text = await request.text();
    return new TextEncoder().encode(text).byteLength > MAX_CONTACT_BODY_BYTES
      ? { ok: false, code: 'BODY_TOO_LARGE' }
      : { ok: true, text };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_CONTACT_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, code: 'BODY_TOO_LARGE' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, code: 'BODY_READ_FAILED' };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp: string,
  expectedHostname: string,
  nowMs: number,
  fetchImpl: typeof fetch,
): Promise<{ ok: true } | { ok: false; reason: 'rejected' | 'upstream' }> {
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp !== 'unknown') form.set('remoteip', remoteIp);
  try {
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!response.ok) return { ok: false, reason: 'upstream' };
    const result = (await response.json()) as {
      success?: unknown;
      challenge_ts?: unknown;
      hostname?: unknown;
      action?: unknown;
    };
    if (result.success !== true || result.hostname !== expectedHostname || result.action !== 'contact') {
      return { ok: false, reason: 'rejected' };
    }
    if (typeof result.challenge_ts !== 'string') return { ok: false, reason: 'rejected' };
    const challengeTime = Date.parse(result.challenge_ts);
    if (!Number.isFinite(challengeTime)) return { ok: false, reason: 'rejected' };
    if (challengeTime > nowMs || nowMs - challengeTime > TURNSTILE_TOKEN_WINDOW_MS) {
      return { ok: false, reason: 'rejected' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'upstream' };
  }
}

async function sendResendEmail(
  value: ContactRequest,
  requestId: string,
  env: ContactRuntimeEnv,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  const body = [
    `相談種別: ${INQUIRY_LABELS[value.inquiryType]}`,
    `氏名: ${value.name}`,
    `会社名: ${value.company || '未入力'}`,
    `返信先: ${value.email}`,
    '',
    '相談内容:',
    value.message,
  ].join('\n');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY ?? ''}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': requestId,
        },
        body: JSON.stringify({
          from: env.CONTACT_FROM_EMAIL,
          to: [env.CONTACT_TO_EMAIL],
          reply_to: value.email,
          subject: `[Crelo] ${INQUIRY_LABELS[value.inquiryType]}`,
          text: body,
        }),
      });
      if (response.ok) return true;
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue;
      return false;
    } catch {
      if (attempt === 0) continue;
      return false;
    }
  }
  return false;
}

export async function handleContactRequest(
  request: Request,
  dependencies: ContactHandlerDependencies,
): Promise<Response> {
  const now = dependencies.now ?? (() => Date.now());
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const idFactory = dependencies.idFactory ?? (() => crypto.randomUUID());
  const log = (entry: Parameters<ContactLogger>[0]) => emitContactLog(dependencies.logger, entry);

  if (request.method.toUpperCase() !== 'POST') {
    return errorResponse('INVALID_REQUEST', 405);
  }
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    return errorResponse('CONTENT_TYPE_REQUIRED', 415);
  }
  if (!requiredRuntimeConfig(dependencies.env) || !dependencies.store) {
    log({
      event: 'contact.service_unavailable',
      stage: 'config',
      errorCode: 'SERVICE_UNAVAILABLE',
    });
    return errorResponse('SERVICE_UNAVAILABLE', 503);
  }
  if (!hasAllowedOrigin(request.headers.get('origin'), dependencies.env.SITE_ORIGIN)) {
    return errorResponse('ORIGIN_NOT_ALLOWED', 403);
  }

  const bodyResult = await readBodyLimited(request);
  if (!bodyResult.ok) {
    return errorResponse(bodyResult.code === 'BODY_TOO_LARGE' ? 'BODY_TOO_LARGE' : 'INVALID_REQUEST', bodyResult.code === 'BODY_TOO_LARGE' ? 413 : 400);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyResult.text);
  } catch {
    return errorResponse('INVALID_REQUEST', 400);
  }
  const validation = validateContactInput(parsed);
  if (!validation.ok) return errorResponse('INVALID_REQUEST', 400);
  const value = validation.value;
  const requestId = value.requestId ?? idFactory();

  if (hasHoneypotValue(value)) return errorResponse('BOT_DETECTED', 400, requestId);
  const hashSecret = dependencies.env.CONTACT_HASH_SECRET as string;
  const remoteIp = getClientIp(request);
  const requestNow = now();
  let fingerprintHash: string;
  let emailHash: string;
  let ipHash: string;
  let tokenHash: string;
  try {
    [fingerprintHash, emailHash, ipHash, tokenHash] = await Promise.all([
      buildContactFingerprint(value, hashSecret),
      hmacSha256(value.email, hashSecret),
      hmacSha256(remoteIp, hashSecret),
      hmacSha256(value.turnstileToken, hashSecret),
    ]);
  } catch {
    return errorResponse('SERVICE_UNAVAILABLE', 503, requestId);
  }

  const turnstileResult = await verifyTurnstile(
    value.turnstileToken,
    dependencies.env.TURNSTILE_SECRET_KEY as string,
    remoteIp,
    new URL(dependencies.env.SITE_ORIGIN as string).hostname,
    requestNow,
    fetchImpl,
  );
  if (!turnstileResult.ok) {
    if (turnstileResult.reason === 'upstream') {
      log({
        event: 'contact.turnstile_upstream_failure',
        stage: 'turnstile',
        requestId,
        errorCode: 'SERVICE_UNAVAILABLE',
      });
      return errorResponse('SERVICE_UNAVAILABLE', 503, requestId);
    }
    log({
      event: 'contact.turnstile_rejected',
      stage: 'turnstile',
      requestId,
      errorCode: 'TURNSTILE_REJECTED',
    });
    return errorResponse('TURNSTILE_REJECTED', 403, requestId);
  }

  // Siteverify runs before D1 duplicate/rate checks. This ensures every valid
  // submission is checked by Turnstile, including a replayed request ID or
  // token that the D1 adapter subsequently rejects.
  let reservation: Awaited<ReturnType<NonNullable<ContactStore['reserve']>>>;
  try {
    reservation = await dependencies.store.reserve({
      requestId,
      fingerprintHash,
      emailHash,
      ipHash,
      tokenHash,
      now: requestNow,
    });
  } catch {
    log({
      event: 'contact.store_reserve_failure',
      stage: 'store.reserve',
      requestId,
      errorCode: 'SERVICE_UNAVAILABLE',
    });
    return errorResponse('SERVICE_UNAVAILABLE', 503, requestId);
  }
  if (reservation.kind === 'already_sent') return jsonResponse({ ok: true, requestId }, 200);
  if (reservation.kind === 'duplicate' || reservation.kind === 'token_reused') {
    return errorResponse('REQUEST_DUPLICATE', 409, requestId);
  }
  if (reservation.kind === 'rate_limited') return errorResponse('RATE_LIMITED', 429, requestId);

  const delivered = await sendResendEmail(value, requestId, dependencies.env, fetchImpl);
  if (!delivered) {
    log({
      event: 'contact.delivery_failure',
      stage: 'resend',
      requestId,
      errorCode: 'DELIVERY_FAILED',
    });
    try {
      await dependencies.store.updateStatus(requestId, 'failed', now());
    } catch {
      // Do not expose internal persistence details. Resend retries use the
      // same idempotency key when the caller retries the request.
      log({
        event: 'contact.store_update_failure',
        stage: 'store.updateStatus',
        requestId,
        errorCode: 'DELIVERY_FAILED',
      });
    }
    return errorResponse('DELIVERY_FAILED', 502, requestId);
  }
  try {
    await dependencies.store.updateStatus(requestId, 'sent', now());
  } catch {
    // The email is already protected by Resend's idempotency key. Returning a
    // generic service failure lets a retry reconcile the D1 status safely.
    log({
      event: 'contact.store_update_failure',
      stage: 'store.updateStatus',
      requestId,
      errorCode: 'SERVICE_UNAVAILABLE',
    });
    return errorResponse('SERVICE_UNAVAILABLE', 503, requestId);
  }
  return jsonResponse({ ok: true, requestId }, 200);
}
