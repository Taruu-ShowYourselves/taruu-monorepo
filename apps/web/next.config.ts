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
  // Keep the locally previewed interface visually identical to production.
  devIndicators: false,

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@vladmandic/human$': HUMAN_ESM,
    };
    return config;
  },

  turbopack: {
    // Monorepo root - stops Turbopack inferring ~/package-lock.json as root.
    root: path.resolve(__dirname, '../..'),
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

  async rewrites() {
    return [
      // Conventional JWKS path. Supabase is registered against this URL as a
      // third-party auth issuer (RLS-01); the handler lives at /api/jwks
      // because Next's router does not serve dot-prefixed app directories.
      {
        source: '/.well-known/jwks.json',
        destination: '/api/jwks',
      },
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
// CI/sandbox previews do not expose a writable Wrangler registry. Keep the
// production-equivalent shim by default, with an explicit local escape hatch
// for rendering the Next UI without Workers bindings.
if (process.env.SKIP_CLOUDFLARE_DEV_SHIM !== '1') {
  initOpenNextCloudflareForDev();
}
