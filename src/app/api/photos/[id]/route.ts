import { db } from "@/lib/db";
import { getManageableProperty } from "@/lib/photos";

/** Sert une photo uniquement à la gérante ou au propriétaire du bien. */
export async function GET(_request: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  const photo = await db.photo.findUnique({ where: { id }, select: { propertyId: true } });
  if (!photo || !(await getManageableProperty(photo.propertyId))) {
    return new Response("Introuvable", { status: 404 });
  }

  const file = await db.photo.findUnique({ where: { id }, select: { data: true, mimeType: true } });
  if (!file) return new Response("Introuvable", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
