import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { addMonths, monthStart, toDayString, today } from "@/lib/dates";
import { photoUrl } from "@/lib/photos";
import { EspaceProprietaire, type BienEspace } from "./EspaceProprietaire";

export const metadata: Metadata = { title: "Mes biens" };

export default async function EspacePage() {
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

  // Seule l'initiale du voyageur part vers le navigateur.
  const biens: BienEspace[] = properties.map((p) => ({
    id: p.id,
    nom: p.name,
    ville: p.city,
    photos: p.photos.map((ph) => ({ id: ph.id, url: photoUrl(ph.id) })),
    resas: p.bookings.map((b) => ({
      id: b.id,
      type: b.kind,
      du: toDayString(b.startDate),
      au: toDayString(b.endDate),
      initiale: b.kind === "RESERVED" ? (b.guestName?.trim().charAt(0) || "V").toUpperCase() : null,
      montant: b.kind === "RESERVED" ? b.amount : 0,
      plateforme: b.platform,
    })),
  }));

  return (
    <EspaceProprietaire
      nom={`${user.firstName} ${user.lastName}`}
      aujourdhui={toDayString(now)}
      biens={biens}
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
