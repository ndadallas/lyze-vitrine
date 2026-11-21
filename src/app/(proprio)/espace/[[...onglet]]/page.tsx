import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { LangueProvider } from "@/components/Langue";
import { langueCourante } from "@/lib/langue-serveur";
import { chargerEspace } from "@/lib/donnees-espace";
import { EspaceProprietaire } from "../EspaceProprietaire";
import { ONGLETS } from "../onglets";

const libelle = (onglet?: string[]) => ONGLETS.find(([id]) => id === (onglet?.[0] ?? "biens"))?.[1];

export async function generateMetadata({ params }: PageProps<"/espace/[[...onglet]]">): Promise<Metadata> {
  return { title: libelle((await params).onglet) ?? "Mes biens" };
}

/** Espace du propriétaire : consultation seulement (demande 2026-11-18), Lyze modifie depuis /admin/clients/<id>. */
export default async function EspacePage({ params }: PageProps<"/espace/[[...onglet]]">) {
  const { onglet } = await params;
  if ((onglet?.length ?? 0) > 1 || onglet?.[0] === "biens" || !libelle(onglet)) notFound();
  const user = await requireOwner();
  const langue = await langueCourante();
  return (
    <LangueProvider langue={langue}>
      <EspaceProprietaire {...await chargerEspace(user, false)} />
    </LangueProvider>
  );
}
