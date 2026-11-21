import "server-only";
import { cookies } from "next/headers";
import { COOKIE_LANGUE, estLangue, type Langue } from "@/lib/langue";
import { COOKIE_DEVISE, TAUX_EUR_DEFAUT, estDevise, type Devise } from "@/lib/devise";

/** Langue de l'espace propriétaire : ?lang= (lien depuis une page du site en langue étrangère), sinon cookie, sinon français. */
export async function langueCourante(param?: string | string[]): Promise<Langue> {
  const p = Array.isArray(param) ? param[0] : param;
  if (estLangue(p)) return p;
  const c = (await cookies()).get(COOKIE_LANGUE)?.value;
  return estLangue(c) ? c : "fr";
}

/** Devise d'affichage choisie (cookie), MAD par défaut, et taux de conversion (MAD pour 1 €). */
export async function deviseCourante(): Promise<{ devise: Devise; tauxEur: number }> {
  const c = (await cookies()).get(COOKIE_DEVISE)?.value;
  const taux = Number(process.env.LYZE_TAUX_EUR);
  return { devise: estDevise(c) ? c : "MAD", tauxEur: taux > 0 ? taux : TAUX_EUR_DEFAUT };
}
