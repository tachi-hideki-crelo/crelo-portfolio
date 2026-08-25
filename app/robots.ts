import type { MetadataRoute } from 'next';

import { getPublicOrigin } from './seo-config.ts';

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicOrigin();
  if (!origin) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: new URL('/sitemap.xml', origin).toString(),
  };
}
