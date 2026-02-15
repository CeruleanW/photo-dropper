import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: '/api/**',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.google.com',
      },
      {
        protocol: 'https',
        hostname: '*.ggpht.com',
      },
      {
         protocol: 'https',
         hostname: '*.picsum.photos',
      },
      {
         protocol: 'https',
         hostname: 'picsum.photos',
      },
    ],
  },
};

export default nextConfig;
