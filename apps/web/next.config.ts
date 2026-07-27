import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google profile images
      },
      {
        protocol: 'https',
        hostname: 'platform-lookaside.fbsbx.com', // Facebook profile images
      },
      {
        protocol: 'https',
        hostname: 'instagram.com',
      },
    ],
  },

  experimental: {
    optimizePackageImports: ['framer-motion'],
  },

  // Voting is free (issue #37): the pricing and refund-policy pages were
  // removed. Old links land on the FAQ, whose first voting entry answers the
  // cost question. Temporary (307) on purpose — browsers and crawlers must not
  // cache the mapping while the product transition settles.
  async redirects() {
    return [
      { source: '/he/pricing', destination: '/he/faq', permanent: false },
      { source: '/he/refund', destination: '/he/faq', permanent: false },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

// Initialise the OpenNext Cloudflare dev shim so `next dev` can access Workers
// bindings (env / secrets) locally via getCloudflareContext(). No-op at build.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
