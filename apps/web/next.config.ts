import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * @vladmandic/human's exports map keys are not "./"-prefixed, so bundlers
 * refuse every subpath, and its root `node` condition drags @tensorflow/
 * tfjs-node into the SSR compile. Alias the bare specifier straight to the
 * browser ESM bundle (the face pipeline is client-only anyway).
 */
const HUMAN_ESM = path.resolve(
  __dirname,
  'node_modules/@vladmandic/human/dist/human.esm.js'
);

const nextConfig: NextConfig = {
  reactStrictMode: true,

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@vladmandic/human$': HUMAN_ESM,
    };
    return config;
  },

  turbopack: {
    resolveAlias: {
      '@vladmandic/human': HUMAN_ESM,
    },
  },

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
