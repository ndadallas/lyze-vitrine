"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { createSession, deleteSession } from "@/lib/session";

const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

const LoginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, { error: "Saisissez votre identifiant." }),
  // trim : espaces parasites quand le client colle le mot de passe reçu par message
  password: z.string().trim().min(1,{ error: "Saisissez votre mot de passe." }),
  remember: z.literal("on").optional(),
});

export type LoginState = { error?: string; username?: string } | undefined;

// Comparaison factice quand l'identifiant n'existe pas : même temps de réponse,
// pour ne pas révéler quels identifiants existent.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("lyze-dummy-password"));

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    remember: formData.get("remember") ?? undefined,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
      username: String(formData.get("username") ?? ""),
    };
  }
  const { username, password, remember } = parsed.data;

  const since = new Date(Date.now() - LOCK_WINDOW_MS);
  const recentFailures = await db.loginAttempt.count({
    where: { username, createdAt: { gte: since } },
  });
  if (recentFailures >= MAX_ATTEMPTS) {
    return {
      error: "Trop de tentatives. Réessayez dans 15 minutes ou contactez votre conciergerie.",
      username,
    };
  }

  const user = await db.user.findUnique({ where: { username } });
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, await getDummyHash()), false);

  if (!user || !valid || !user.active) {
    await db.loginAttempt.create({ data: { username } });
    return { error: "Identifiant ou mot de passe incorrect.", username };
  }

  await db.$transaction([
    db.loginAttempt.deleteMany({ where: { username } }),
    db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);
  await createSession(user.id, remember === "on");

  redirect(homeFor(user.role));
}

export async function logout() {
  await deleteSession();
  redirect("/connexion");
}
