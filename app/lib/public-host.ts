/** Only the configured HTTPS origin is eligible for search indexing. */
export function isCanonicalRequest(requestUrl: string, siteOrigin: string | undefined): boolean {
  if (!siteOrigin) return false;
  try {
    const expected = new URL(siteOrigin);
    const incoming = new URL(requestUrl);
    return expected.protocol === 'https:' && incoming.origin === expected.origin;
  } catch {
    return false;
  }
}

/** Preserve bodyless HTTP responses while marking the fallback host as non-indexable. */
export function withNoindexHeader(response: Response): Response {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  const bodyless = response.status === 204 || response.status === 205 || response.status === 304;
  return new Response(bodyless ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
