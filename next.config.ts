import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mode standalone pour Docker (optimise la taille de l'image)
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  
  // Désactiver la vérification TypeScript pendant le build Docker
  // (en production, on suppose que le code a déjà été vérifié localement)
  // Désactiver aussi ESLint pendant le build pour gagner du temps
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
