import type { Metadata } from "next";
import { Gloock, Instrument_Sans, Pinyon_Script } from "next/font/google";
import "./globals.css";

// Mêmes polices que le site vitrine et l'espace propriétaire.
const gloock = Gloock({ variable: "--font-gloock", subsets: ["latin"], weight: "400" });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], weight: ["400", "500", "600"] });
const pinyon = Pinyon_Script({ variable: "--font-pinyon", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: {
    default: "Lyze Conciergerie",
    template: "%s · Lyze Conciergerie",
  },
  description: "Conciergerie et gestion locative à El Jadida, Casablanca et Marrakech.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${gloock.variable} ${instrument.variable} ${pinyon.variable}`}>
      <body>{children}</body>
    </html>
  );
}
