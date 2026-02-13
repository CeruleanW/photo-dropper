import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
         protocol: 'https',
         hostname: '*.picsum.photos',
      },
      {
         protocol: 'https',
         hostname: 'picsum.photos',
      },
       // Add specific photo domains if needed
    ],
  },
};

export default nextConfig;
