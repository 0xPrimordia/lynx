import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // Increase body size limit if needed for larger payloads
    }
  }
};

export default nextConfig;
