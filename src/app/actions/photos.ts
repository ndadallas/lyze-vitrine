"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getEditableProperty, listPhotos } from "@/lib/photos";

type PhotoList = { id: string; url: string }[];
type Result = { photos?: PhotoList; error?: string };

/** Nouvel ordre des photos d'un bien (la première devient la couverture). */
export async function reorderPhotos(propertyId: string, orderedIds: string[]): Promise<Result> {
  const property = await getEditableProperty(propertyId);
  if (!property) return { error: "Accès refusé." };

  const current = await db.photo.findMany({ where: { propertyId }, select: { id: true } });
  const known = new Set(current.map((p) => p.id));
  if (orderedIds.length !== known.size || !orderedIds.every((id) => known.has(id))) {
    return { error: "La liste des photos a changé, rechargez la page.", photos: await listPhotos(propertyId) };
  }

  await db.$transaction(
    orderedIds.map((id, position) => db.photo.update({ where: { id }, data: { position } })),
  );
  revalidatePath("/espace", "layout");
  revalidatePath(`/admin/clients/${property.ownerId}`, "layout");
  return { photos: await listPhotos(propertyId) };
}

export async function deletePhoto(photoId: string): Promise<Result> {
  const photo = await db.photo.findUnique({ where: { id: photoId }, select: { propertyId: true } });
  if (!photo) return { error: "Photo introuvable." };
  const property = await getEditableProperty(photo.propertyId);
  if (!property) return { error: "Accès refusé." };

  await db.photo.delete({ where: { id: photoId }, select: { id: true } });

  revalidatePath("/espace", "layout");
  revalidatePath(`/admin/clients/${property.ownerId}`, "layout");
  return { photos: await listPhotos(photo.propertyId) };
}
