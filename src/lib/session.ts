import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "lyze_session";

const SHORT_SESSION_MS = 12 * 60 * 60 * 1000; // 12 h
const LONG_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours ("se souvenir de moi")

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, remember: boolean) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (remember ? LONG_SESSION_MS : SHORT_SESSION_MS));

  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Sans "se souvenir", cookie de session navigateur (la session serveur expire quand même après 12 h).
    expires: remember ? expiresAt : undefined,
  });
}

/** Utilisateur connecté pour la requête en cours, ou null. Mémorisé le temps d'un rendu. */
export const getSessionUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;

  return session.user;
});

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { id: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Déconnecte un utilisateur partout (mot de passe régénéré, compte désactivé). */
export async function revokeUserSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
