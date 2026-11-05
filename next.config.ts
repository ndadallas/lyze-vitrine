import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le site vitrine est en HTML statique dans public/ ; l'accueil est servi à la racine.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/ar", destination: "/ar/index.html" },
        { source: "/en", destination: "/en/index.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  // Anciennes adresses de la démo (site GitHub Pages).
  async redirects() {
    return [
      { source: "/connexion.html", destination: "/connexion", permanent: true },
      { source: "/espace.html", destination: "/espace", permanent: true },
    ];
  },
};

export default nextConfig;
