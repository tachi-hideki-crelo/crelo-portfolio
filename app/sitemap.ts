import type { MetadataRoute } from 'next';

import { caseStudies } from './lib/content.ts';
import { getPublicOrigin } from './seo-config.ts';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicOrigin();
  if (!origin) return [];

  const urls = [new URL('/', origin).toString(), new URL('/privacy', origin).toString()];
  const seen = new Set(urls);
  for (const caseStudy of caseStudies) {
    if (!caseStudy.approved) continue;
    const url = new URL(`/work/${caseStudy.slug}`, origin).toString();
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls.map((url) => ({ url }));
}
