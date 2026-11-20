import type { Plateforme } from "@/lib/plateformes";

// shortcut: taux indicatifs du simulateur de la vitrine (public/index.html), à confirmer par Lyze ; modifiables à la main sur chaque réservation
export const COMMISSION_LYZE = 20; // % du chiffre d'affaires
export const TAUX_PLATEFORME: Record<Plateforme, number> = { AIRBNB: 18, BOOKING: 20, EXPEDIA: 15, OTHER: 15, LYZE: 0, DIRECT: 0 };

/** Répartition d'une réservation : CA = prix de vente total, frais plateforme, commission Lyze, net propriétaire. */
export function repartition(ca: number, plateforme: Plateforme) {
  const frais = Math.round((ca * TAUX_PLATEFORME[plateforme]) / 100);
  const commission = Math.round((ca * COMMISSION_LYZE) / 100);
  return { frais, commission, net: ca - frais - commission };
}
