import "server-only";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

// Photos en base, servies seulement après contrôle d'accès (/api/photos/[id]).
// 4 Mo : une requête Vercel est limitée à 4,5 Mo ; le navigateur réduit les photos avant l'envoi.
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_PHOTOS_PER_PROPERTY = 40;

export const photoUrl = (id: string) => `/api/photos/${id}`;

/** Type réel du fichier d'après ses premiers octets (on ne fait pas confiance au nom ni au type envoyé). */
export function detectImage(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ext: "png" };
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/**
 * Bien que l'utilisateur connecté a le droit de gérer : la gérante (ADMIN) gère tous les biens,
 * un propriétaire seulement les siens. null sinon.
 */
export async function getManageableProperty(propertyId: string) {
  const user = await getSessionUser();
  if (!user || !propertyId) return null;
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  if (user.role !== "ADMIN" && property.ownerId !== user.id) return null;
  return property;
}

export async function listPhotos(propertyId: string) {
  const photos = await db.photo.findMany({
    where: { propertyId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return photos.map((p) => ({ id: p.id, url: photoUrl(p.id) }));
}
