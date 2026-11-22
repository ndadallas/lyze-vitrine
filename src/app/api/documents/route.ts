import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/lib/db";
import { CODES_CATEGORIES, MAX_DOC_BYTES, MAX_DOCS_PAR_CLIENT } from "@/lib/espace";
import { detectImage } from "@/lib/photos";
import { getSessionUser } from "@/lib/session";

/** Type réel du fichier : PDF ou image (on ne fait pas confiance au nom ni au type envoyé). */
function detecterDocument(buf: Buffer) {
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return { mime: "application/pdf" };
  return detectImage(buf);
}

const Champs = z.object({
  category: z.enum(CODES_CATEGORIES, { error: "Catégorie invalide." }),
  title: z.string().trim().min(1, { error: "Donnez un titre au document." }).max(120),
  propertyId: z.string(),
});

/**
 * Dépôt d'un document : par la gérante pour un client (ownerId), ou par le propriétaire pour lui-même
 * (« envoyer un document à Lyze », 2026-11-22 ; signalé à la gérante dans « Documents reçus »).
 * Route handler plutôt que server action : les actions sont limitées à 1 Mo.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Session expirée, reconnectez-vous." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Envoi invalide." }, { status: 400 });

  const ownerId = user.role === "ADMIN" ? String(form.get("ownerId") ?? "") : user.id;
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { id: true, role: true } });
  if (!owner || owner.role !== "OWNER") return NextResponse.json({ error: "Client introuvable." }, { status: 404 });

  const champs = Champs.safeParse({
    category: form.get("category") ?? "",
    title: form.get("title") ?? "",
    propertyId: String(form.get("propertyId") ?? ""),
  });
  if (!champs.success) return NextResponse.json({ error: champs.error.issues[0]?.message }, { status: 400 });

  let propertyId: string | null = null;
  if (champs.data.propertyId) {
    const bien = await db.property.findFirst({ where: { id: champs.data.propertyId, ownerId }, select: { id: true } });
    if (!bien) return NextResponse.json({ error: "Bien introuvable." }, { status: 404 });
    propertyId = bien.id;
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  if (file.size > MAX_DOC_BYTES) return NextResponse.json({ error: "Fichier trop lourd (4 Mo maximum)." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const type = detecterDocument(buf);
  if (!type) return NextResponse.json({ error: "Format non accepté : PDF, JPG, PNG ou WebP." }, { status: 400 });

  if ((await db.document.count({ where: { ownerId } })) >= MAX_DOCS_PAR_CLIENT) {
    return NextResponse.json({ error: `Maximum ${MAX_DOCS_PAR_CLIENT} documents par compte.` }, { status: 400 });
  }

  await db.document.create({
    data: {
      ownerId,
      propertyId,
      category: champs.data.category,
      title: champs.data.title,
      fileName: file.name.slice(0, 200) || "document",
      mimeType: type.mime,
      size: buf.length,
      data: new Uint8Array(buf),
      byAdmin: user.role === "ADMIN",
    },
    select: { id: true },
  });

  revalidatePath("/espace", "layout");
  revalidatePath(`/admin/clients/${ownerId}`, "layout");
  return NextResponse.json({ ok: true });
}
