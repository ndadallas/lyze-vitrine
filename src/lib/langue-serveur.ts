import "server-only";
import { cookies } from "next/headers";
import { COOKIE_LANGUE, estLangue, type Langue } from "@/lib/langue";

/** Langue de l'espace propriétaire : ?lang= (lien depuis une page du site en langue étrangère), sinon cookie, sinon français. */
export async function langueCourante(param?: string | string[]): Promise<Langue> {
  const p = Array.isArray(param) ? param[0] : param;
  if (estLangue(p)) return p;
  const c = (await cookies()).get(COOKIE_LANGUE)?.value;
  return estLangue(c) ? c : "fr";
}
