const textEncoder = new TextEncoder();
export const MIN_CONTACT_HASH_SECRET_LENGTH = 32;

export function hasSufficientContactHashSecret(value: string | undefined): value is string {
  return typeof value === 'string' && value.length >= MIN_CONTACT_HASH_SECRET_LENGTH;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256(value: string, secret: string): Promise<string> {
  if (!hasSufficientContactHashSecret(secret)) {
    throw new Error(`CONTACT_HASH_SECRET must be at least ${MIN_CONTACT_HASH_SECRET_LENGTH} characters`);
  }
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, textEncoder.encode(value)));
}

export function getClientIp(request: Request): string {
  // Cloudflare supplies CF-Connecting-IP. This value is only hashed and never
  // logged or persisted in its original form.
  return request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
}

export async function buildContactFingerprint(
  input: { name: string; company: string; email: string; inquiryType: string; message: string },
  secret: string,
): Promise<string> {
  return hmacSha256(
    [input.name, input.company, input.email, input.inquiryType, input.message].join('\u001f'),
    secret,
  );
}
