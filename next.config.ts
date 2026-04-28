import type { NextConfig } from 'next';

/**
 * APEX QUANTUM v6.1 - Production Next.js Configuration
 * Optimized for performance, security, and scalability
 */

const nextConfig: NextConfig = {
  // ============================================================
  // TURBOPACK CONFIGURATION (Next.js 16)
  // ============================================================

  turbopack: {
    root: process.cwd(),
  },

  // ============================================================
  // PERFORMANCE OPTIMIZATIONS
  // ============================================================

  // React strict mode for development
  reactStrictMode: true,

  // Compiler optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
    // Emotion/styled-components support
    styledComponents: true,
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [320, 640, 750, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // ============================================================
  // SECURITY HEADERS
  // ============================================================

  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=()',
          },
        ],
      },
    ];
  },

  // ============================================================
  // REDIRECTS & REWRITES
  // ============================================================

  redirects: async () => {
    return [];
  },

  rewrites: async () => {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };
  },

  // ============================================================
  // BUILD & EXPORT SETTINGS
  // ============================================================

  productionBrowserSourceMaps: process.env.ENABLE_SOURCE_MAPS === 'true',

  // ============================================================
  // ENVIRONMENT VARIABLES
  // ============================================================

  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
  },

  // ============================================================
  // WEBPACK CUSTOMIZATION
  // ============================================================

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
      };
    }
    return config;
  },
};

export default nextConfig;
