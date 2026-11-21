// Langues de l'espace propriétaire (mêmes que la vitrine). Le texte français sert de clé :
// t("Mes biens") → traduction si elle existe dans TRADUCTIONS, sinon le français.
import { TRADUCTIONS } from "@/lib/traductions";

export const LANGUES = ["fr", "en", "ar", "it", "es", "de"] as const;
export type Langue = (typeof LANGUES)[number];
export const COOKIE_LANGUE = "lyze_langue";

export const NOMS_LANGUES: Record<Langue, string> = {
  fr: "Français",
  en: "English",
  ar: "العربية",
  it: "Italiano",
  es: "Español",
  de: "Deutsch",
};
export const LOCALES: Record<Langue, string> = { fr: "fr-FR", en: "en-GB", ar: "ar-MA", it: "it-IT", es: "es-ES", de: "de-DE" };
const INDEX: Record<Exclude<Langue, "fr">, number> = { en: 0, ar: 1, it: 2, es: 3, de: 4 };

export const estLangue = (v: unknown): v is Langue => typeof v === "string" && (LANGUES as readonly string[]).includes(v);

/** Traduit un texte français ; {nom} est remplacé par vars.nom. */
export function traduire(langue: Langue, fr: string, vars?: Record<string, string | number>) {
  const texte = langue === "fr" ? fr : (TRADUCTIONS[fr]?.[INDEX[langue]] ?? fr);
  return vars ? texte.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : texte;
}
