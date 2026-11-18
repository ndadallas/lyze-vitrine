import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { photoUrl } from "@/lib/photos";
import { toDayString, today } from "@/lib/dates";

/**
 * Biens affichés sur le site (case « Afficher ce bien sur le site » de la fiche).
 * GET /api/biens        → liste pour le carrousel de l'accueil
 * GET /api/biens?id=…   → un bien + ses dates indisponibles, pour logement.html
 * Données publiques uniquement : jamais l'adresse, le wifi, les consignes, les notes ni le propriétaire.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  const biens = await db.property.findMany({
    where: { published: true, ...(id ? { id } : {}) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      city: true,
      kind: true,
      bedrooms: true,
      capacity: true,
      surface: true,
      equipment: true,
      description: true,
      price: true,
      photos: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } },
      bookings: { where: { endDate: { gt: today() } }, select: { startDate: true, endDate: true } },
    },
  });
  if (id && !biens.length) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const donnees = biens.map(({ photos, bookings, ...b }) => ({
    ...b,
    photos: photos.map((p) => photoUrl(p.id)),
    // seulement les dates, sans nom ni plateforme ; inutile pour la liste de l'accueil
    ...(id ? { indispo: bookings.map((r) => `${toDayString(r.startDate)}/${toDayString(r.endDate)}`) } : {}),
  }));
  return NextResponse.json(id ? donnees[0] : donnees, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60" } });
}
