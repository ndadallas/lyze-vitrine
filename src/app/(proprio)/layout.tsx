import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Espace propriétaire — Lyze", template: "%s — Espace propriétaire Lyze" },
  robots: { index: false, follow: false },
};

// Connexion + espace propriétaire : mêmes polices et mêmes feuilles de style que le site vitrine (public/).
export default function ProprioLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Antonio:wght@300;400&family=Gloock&family=Instrument+Sans:wght@400;500;600&family=Pinyon+Script&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/assets/css/style.css?v=26" />
        <link rel="stylesheet" href="/assets/css/espace.css?v=23" />
      </head>
      <body>{children}</body>
    </html>
  );
}
