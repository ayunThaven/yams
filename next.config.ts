import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mode standalone pour Docker (optimise la taille de l'image)
  output: 'standalone',

  serverExternalPackages: ['mjml'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
