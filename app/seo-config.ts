const PRODUCTION_MODE = 'production';

export function parsePublicOrigin(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  try {
    const origin = new URL(value);
    if (origin.protocol !== 'https:') return null;
    const hostname = origin.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return null;
    if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return null;
    return origin;
  } catch {
    return null;
  }
}

/**
 * A public origin is intentionally unavailable in preview builds. This keeps
 * canonical, sitemap, and robots URLs from leaking a guessed domain.
 */
export function getPublicOrigin(): URL | null {
  if (process.env.CONTENT_MODE !== PRODUCTION_MODE) return null;
  return parsePublicOrigin(process.env.SITE_ORIGIN);
}

export function isPublicBuild(): boolean {
  return getPublicOrigin() !== null;
}
