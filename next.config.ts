import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // Increase body size limit if needed for larger payloads
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd1grbdlekdv9wn.cloudfront.net',
        port: '',
        pathname: '/icons/tokens/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        port: '',
        pathname: '/coins/images/**',
      },
    ],
  },
};

export default nextConfig;
