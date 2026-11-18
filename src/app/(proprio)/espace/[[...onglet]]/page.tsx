import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { addMonths, monthStart, toDayString, today } from "@/lib/dates";
import { photoUrl } from "@/lib/photos";
import { SELECT_DOCUMENT, ficheDepuis, versAvisItem, versDemandeItem, versDepenseItem, versDocumentItem } from "@/lib/espace";
import { EspaceProprietaire, type BienEspace } from "../EspaceProprietaire";
import { ONGLETS } from "../onglets";

const libelle = (onglet?: string[]) => ONGLETS.find(([id]) => id === (onglet?.[0] ?? "biens"))?.[1];

export async function generateMetadata({ params }: PageProps<"/espace/[[...onglet]]">): Promise<Metadata> {
  return { title: libelle((await params).onglet) ?? "Mes biens" };
}

export default async function EspacePage({ params }: PageProps<"/espace/[[...onglet]]">) {
  const { onglet } = await params;
  if ((onglet?.length ?? 0) > 1 || onglet?.[0] === "biens" || !libelle(onglet)) notFound();
  const user = await requireOwner();
  if (!user.onboardedAt) redirect("/espace/bienvenue"); // fiche de première connexion
  const now = today();
  const month = monthStart(now.getUTCFullYear(), now.getUTCMonth());
  // Fenêtre consultable dans le calendrier : 12 mois en arrière, 18 mois en avant.
  const from = addMonths(month, -12);
  const to = addMonths(month, 18);

  const properties = await db.property.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      bookings: {
        where: { endDate: { gt: from }, startDate: { lt: to } },
        orderBy: { startDate: "asc" },
      },
      photos: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } },
    },
  });

  const [documents, demandes, depenses, avis] = await Promise.all([
    db.document.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, select: SELECT_DOCUMENT }),
    db.ownerRequest.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { property: { select: { name: true } } },
    }),
    db.expense.findMany({
      where: { property: { ownerId: user.id }, date: { gte: from } },
      orderBy: { date: "desc" },
    }),
    db.ownerNotice.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { property: { select: { name: true } } },
    }),
  ]);

  // Seule l'initiale du voyageur part vers le navigateur.
  const biens: BienEspace[] = properties.map((p) => ({
    id: p.id,
    nom: p.name,
    ville: p.city,
    fiche: ficheDepuis(p),
    photos: p.photos.map((ph) => ({ id: ph.id, url: photoUrl(ph.id) })),
    resas: p.bookings.map((b) => ({
      id: b.id,
      type: b.kind,
      du: toDayString(b.startDate),
      au: toDayString(b.endDate),
      initiale: b.kind === "RESERVED" ? (b.guestName?.trim().charAt(0) || "V").toUpperCase() : null,
      montant: b.kind === "RESERVED" ? b.amount : 0,
      plateforme: b.platform,
      note: b.note,
      attente: b.pending,
    })),
  }));

  return (
    <EspaceProprietaire
      nom={`${user.firstName} ${user.lastName}`}
      salutation={[{ M: "M.", MME: "Mme" }[user.civility ?? ""], user.firstName, user.lastName].filter(Boolean).join(" ")}
      avis={avis.map(versAvisItem)}
      aujourdhui={toDayString(now)}
      biens={biens}
      documents={documents.map(versDocumentItem)}
      demandes={demandes.map(versDemandeItem)}
      depenses={depenses.map(versDepenseItem)}
      // « Contacter Lyze » = mail uniquement (plus de numéro affiché) ; LYZE_CONTACT_EMAIL pour changer l'adresse
      contact={`mailto:${process.env.LYZE_CONTACT_EMAIL || "contact@lyze.com"}`}
      compte={{
        identifiant: user.username,
        phone: user.phone ?? "",
        email: user.email ?? "",
        address: user.address ?? "",
        country: user.country ?? "",
        contactPreference: user.contactPreference ?? "",
      }}
    />
  );
}
