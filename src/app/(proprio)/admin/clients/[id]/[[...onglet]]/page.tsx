import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { chargerEspace } from "@/lib/donnees-espace";
import { EspaceProprietaire } from "@/app/(proprio)/espace/EspaceProprietaire";
import { ONGLETS } from "@/app/(proprio)/espace/onglets";
import { LangueProvider } from "@/components/Langue";
import { deviseCourante } from "@/lib/langue-serveur";

export const metadata: Metadata = { title: "Fiche client" };

const derniere = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Casablanca" });

/**
 * Vue gérante d'un client (demande 2026-11-18) : exactement l'espace que voit le client, mais tout y est modifiable.
 * Rangée dans (proprio) pour reprendre la mise en page et les feuilles de style de l'espace ; l'adresse reste /admin/clients/<id>.
 */
export default async function ClientPage({ params }: PageProps<"/admin/clients/[id]/[[...onglet]]">) {
  await requireAdmin();
  const { id, onglet } = await params;
  if ((onglet?.length ?? 0) > 1 || onglet?.[0] === "biens" || (onglet && !ONGLETS.some(([o]) => o === onglet[0]))) notFound();

  const owner = await db.user.findFirst({ where: { id, role: "OWNER" } });
  if (!owner) notFound();
  const clients = await db.user.findMany({
    where: { role: "OWNER" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const { devise, tauxEur } = await deviseCourante();
  return (
    <LangueProvider langue="fr" devise={devise} tauxEur={tauxEur}>
    <EspaceProprietaire
      {...await chargerEspace(owner, true)}
      admin={{
        clientId: owner.id,
        clients: clients.map((c) => ({ id: c.id, nom: `${c.firstName} ${c.lastName}` })),
        compte: {
          id: owner.id,
          civility: owner.civility ?? "",
          firstName: owner.firstName,
          lastName: owner.lastName,
          username: owner.username,
          phone: owner.phone ?? "",
          email: owner.email ?? "",
          adresse: [owner.address, owner.country].filter(Boolean).join(" — "),
          contactPreference: owner.contactPreference ?? "",
          derniereConnexion: owner.lastLoginAt ? derniere.format(owner.lastLoginAt) : "Jamais connecté",
          mdpChange: owner.passwordChangedAt ? derniere.format(owner.passwordChangedAt) : "",
          active: owner.active,
        },
      }}
    />
    </LangueProvider>
  );
}
