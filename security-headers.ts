// Single source for the site's security headers. next.config.ts serves them
// from the worker, and public/_headers (written by `npm run sync:headers`)
// applies the same set to static assets on Cloudflare.

type HeaderEntry = { key: string; value: string };

export const contentSecurityPolicy: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'", 'data:'],
  'style-src': ["'self'", "'unsafe-inline'"],
  // Turnstile, plus the Cloudflare Web Analytics beacon Cloudflare injects.
  'script-src': ["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com', 'https://static.cloudflareinsights.com'],
  'frame-src': ['https://challenges.cloudflare.com'],
  'connect-src': ["'self'", 'https://challenges.cloudflare.com', 'https://cloudflareinsights.com'],
};

export function serializeContentSecurityPolicy(policy: Readonly<Record<string, readonly string[]>>): string {
  return Object.entries(policy).map(([directive, sources]) => [directive, ...sources].join(' ')).join('; ');
}

export const securityHeaders: readonly HeaderEntry[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: serializeContentSecurityPolicy(contentSecurityPolicy) },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

export function renderHeadersFile(headers: readonly HeaderEntry[] = securityHeaders): string {
  return `/*\n${headers.map(({ key, value }) => `  ${key}: ${value}`).join('\n')}\n`;
}
