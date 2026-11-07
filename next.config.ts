import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le site vitrine est en HTML statique dans public/ ; l'accueil est servi à la racine.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
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
      // /en et /ar : redirection (et non réécriture), sinon les liens relatifs des pages partent vers les pages françaises.
      { source: "/en", destination: "/en/index.html", permanent: false },
      { source: "/ar", destination: "/ar/index.html", permanent: false },
    ];
  },
};

export default nextConfig;
