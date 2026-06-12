import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Firebase Storage URLs are already CDN-hosted; bypass Vercel Image Optimization
    // to avoid 402 errors when the optimization quota is exceeded.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/v0/b/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
