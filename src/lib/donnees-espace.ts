import "server-only";

import { db } from "@/lib/db";
import { addMonths, monthStart, toDayString, today } from "@/lib/dates";
import { photoUrl } from "@/lib/photos";
import { INCLURE_AVIS, SELECT_DOCUMENT, ficheDepuis, versAvisItem, versDemandeItem, versDepenseItem, versDocumentItem } from "@/lib/espace";
import type { BienEspace } from "@/app/(proprio)/espace/EspaceProprietaire";
import type { User } from "@/generated/prisma/client";

/**
 * Données de l'espace d'un propriétaire, pour son espace (/espace) et pour la vue gérante (/admin/clients/<id>).
 * `gerante` : le nom complet du voyageur est envoyé (sinon seulement l'initiale).
 */
export async function chargerEspace(user: User, gerante: boolean) {
  const now = today();
  const month = monthStart(now.getUTCFullYear(), now.getUTCMonth());
  // Fenêtre consultable dans le calendrier : 12 mois en arrière, 18 mois en avant.
  const from = addMonths(month, -12);
  const to = addMonths(month, 18);

  const [properties, documents, demandes, depenses, avis] = await Promise.all([
    db.property.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        bookings: { where: { endDate: { gt: from }, startDate: { lt: to } }, orderBy: { startDate: "asc" } },
        photos: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } },
      },
    }),
    db.document.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, select: SELECT_DOCUMENT }),
    db.ownerRequest.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { property: { select: { name: true } } },
    }),
    db.expense.findMany({ where: { property: { ownerId: user.id }, date: { gte: from } }, orderBy: { date: "desc" } }),
    db.ownerNotice.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: INCLURE_AVIS }),
  ]);

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
      initiale: b.kind !== "BLOCKED" ? (b.guestName?.trim().charAt(0) || "V").toUpperCase() : null,
      ...(gerante ? { voyageur: b.guestName } : {}),
      montant: b.kind !== "BLOCKED" ? b.amount : 0,
      frais: b.kind !== "BLOCKED" ? b.fees : 0,
      plateforme: b.platform,
      plateformeAutre: b.platformOther,
      note: b.note,
      attente: b.pending,
    })),
  }));

  return {
    nom: `${user.firstName} ${user.lastName}`,
    salutation: [{ M: "M.", MME: "Mme" }[user.civility ?? ""], user.firstName, user.lastName].filter(Boolean).join(" "),
    avis: avis.map(versAvisItem),
    aujourdhui: toDayString(now),
    biens,
    documents: documents.map(versDocumentItem),
    demandes: demandes.map(versDemandeItem),
    depenses: depenses.map(versDepenseItem),
    // « Contacter Lyze » = mail uniquement ; LYZE_CONTACT_EMAIL pour changer l'adresse
    contact: `mailto:${process.env.LYZE_CONTACT_EMAIL || "contact@lyze.com"}`,
    compte: {
      identifiant: user.username,
      phone: user.phone ?? "",
      email: user.email ?? "",
      address: user.address ?? "",
      country: user.country ?? "",
      contactPreference: user.contactPreference ?? "",
    },
  };
}
