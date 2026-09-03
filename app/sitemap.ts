import type { MetadataRoute } from 'next';

import { getPublicOrigin } from './seo-config.ts';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicOrigin();
  if (!origin) return [];

  const urls = [new URL('/', origin).toString(), new URL('/privacy', origin).toString()];
  return urls.map((url) => ({ url }));
}
