import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

/** Sert un document uniquement à la gérante ou au propriétaire concerné. */
export async function GET(_request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  const meta = await db.document.findUnique({ where: { id }, select: { ownerId: true } });
  if (!user || !meta || (user.role !== "ADMIN" && meta.ownerId !== user.id)) {
    return new Response("Introuvable", { status: 404 });
  }

  const doc = await db.document.findUnique({ where: { id }, select: { data: true, mimeType: true, fileName: true } });
  if (!doc) return new Response("Introuvable", { status: 404 });

  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mimeType,
      // inline : le PDF s'ouvre dans le navigateur ; le nom sert si on l'enregistre
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
