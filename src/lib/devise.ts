// Devise d'affichage des montants (demande 2026-11-21) : tout est enregistré en MAD, l'euro n'est qu'une conversion à l'affichage.
export const DEVISES = ["MAD", "EUR"] as const;
export type Devise = (typeof DEVISES)[number];
export const COOKIE_DEVISE = "lyze_devise";
// shortcut: taux fixe indicatif (MAD pour 1 €), réglable par la variable LYZE_TAUX_EUR sur Vercel ; brancher un cours du jour si Lyze le demande
export const TAUX_EUR_DEFAUT = 10.8;

export const estDevise = (v: unknown): v is Devise => v === "MAD" || v === "EUR";

/** Montant en MAD affiché dans la devise choisie (« 1 234 MAD » ou « 114 € »). */
export function formatMontant(mad: number, devise: Devise = "MAD", tauxEur = TAUX_EUR_DEFAUT) {
  // espace insécable classique : l'espace fine (U+202F) n'existe pas dans les polices du site
  const n = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v)).replace(/\u202f/g, "\u00a0");
  return devise === "EUR" ? `${n(mad / tauxEur)}\u00a0€` : `${n(mad)}\u00a0DH`;
}
