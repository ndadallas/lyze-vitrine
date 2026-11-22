import type { Metadata } from "next";
import { SCRIPT_ECHELLE } from "@/lib/echelle";
import { langueCourante } from "@/lib/langue-serveur";

export const metadata: Metadata = {
  title: { default: "Espace propriétaire — Lyze", template: "%s — Espace propriétaire Lyze" },
  robots: { index: false, follow: false },
};

// Connexion + espace propriétaire : mêmes polices et mêmes feuilles de style que le site vitrine (public/).
export default async function ProprioLayout({ children }: { children: React.ReactNode }) {
  const langue = await langueCourante();
  return (
    <html lang={langue} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ECHELLE }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Antonio:wght@300;400&family=Gloock&family=Instrument+Sans:wght@400;500;600&family=Pinyon+Script&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/assets/css/style.css?v=64" />
        <link rel="stylesheet" href="/assets/css/espace.css?v=33" />
      </head>
      <body>{children}</body>
    </html>
  );
}
