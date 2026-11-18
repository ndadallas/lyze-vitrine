import { db } from "@/lib/db";
import { getManageableProperty } from "@/lib/photos";

/** Sert une photo à tout le monde si le bien est affiché sur le site, sinon seulement à la gérante ou au propriétaire. */
export async function GET(_request: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  const photo = await db.photo.findUnique({ where: { id }, select: { propertyId: true, property: { select: { published: true } } } });
  const publique = !!photo?.property.published;
  if (!photo || (!publique && !(await getManageableProperty(photo.propertyId)))) {
    return new Response("Introuvable", { status: 404 });
  }

  const file = await db.photo.findUnique({ where: { id }, select: { data: true, mimeType: true } });
  if (!file) return new Response("Introuvable", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      // bien publié : cache partagé court, pour qu'un bien retiré du site cesse vite d'exposer ses photos
      "Cache-Control": publique ? "public, max-age=3600, s-maxage=600" : "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
