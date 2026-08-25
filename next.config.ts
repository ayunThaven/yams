import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empêche Next de remonter vers un package-lock parent hors du projet.
  outputFileTracingRoot: process.cwd(),

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
