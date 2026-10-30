import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_PROPERTY, detectImage, getManageableProperty, listPhotos } from "@/lib/photos";

/**
 * Ajout de photos à un bien (glisser-déposer ou « parcourir »).
 * FormData : propertyId + un ou plusieurs champs "photos".
 * Route handler plutôt que server action : les actions sont limitées à 1 Mo par requête.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Envoi invalide." }, { status: 400 });

  const property = await getManageableProperty(String(form.get("propertyId") ?? ""));
  if (!property) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "Aucune photo reçue." }, { status: 400 });

  const existing = await db.photo.count({ where: { propertyId: property.id } });
  const room = MAX_PHOTOS_PER_PROPERTY - existing;
  if (room <= 0) {
    return NextResponse.json({ error: `Maximum ${MAX_PHOTOS_PER_PROPERTY} photos par bien.` }, { status: 400 });
  }

  const last = await db.photo.findFirst({
    where: { propertyId: property.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  let position = (last?.position ?? -1) + 1;

  const refused: string[] = [];
  for (const file of files.slice(0, room)) {
    if (file.size > MAX_PHOTO_BYTES) {
      refused.push(`${file.name} (plus de 4 Mo)`);
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const type = detectImage(buf);
    if (!type) {
      refused.push(`${file.name} (format non accepté : JPG, PNG ou WebP)`);
      continue;
    }
    await db.photo.create({
      data: { propertyId: property.id, data: new Uint8Array(buf), mimeType: type.mime, position: position++ },
      select: { id: true },
    });
  }
  if (files.length > room) refused.push(`${files.length - room} photo(s) au-delà de la limite de ${MAX_PHOTOS_PER_PROPERTY}`);

  revalidatePath("/espace");
  revalidatePath(`/admin/clients/${property.ownerId}`);
  return NextResponse.json({ photos: await listPhotos(property.id), refused });
}
