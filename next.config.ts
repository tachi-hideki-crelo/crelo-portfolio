import type { NextConfig } from 'next';

import { securityHeaders } from './security-headers.ts';

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        ...securityHeaders,
        ...(process.env.CONTENT_MODE === 'production'
          ? []
          : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]),
      ],
    }];
  },
};

export default nextConfig;
