"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { revokeOtherSessions } from "@/lib/session";

const CONTACTS = ["WhatsApp", "Téléphone", "E-mail"] as const;
const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

const ProfilSchema = z.object({
  indicatif: z.string().regex(/^\+\d{1,4}$/, { error: "Indicatif invalide." }),
  numero: z
    .string()
    .trim()
    .regex(/^[\d\s.\-()]{4,20}$/, { error: "Numéro de téléphone invalide." }),
  email: z.email({ error: "Adresse e-mail invalide." }).max(200),
  address: z.string().trim().min(5, { error: "Indiquez votre adresse postale." }).max(300),
  country: z.string().trim().min(2, { error: "Indiquez votre pays de résidence." }).max(80),
  contactPreference: z.enum(CONTACTS, { error: "Choisissez comment vous joindre." }),
});

export type ProfilState = { error?: string; ok?: number } | undefined;

function lireProfil(formData: FormData) {
  return ProfilSchema.safeParse({
    indicatif: formData.get("indicatif") ?? "",
    numero: formData.get("numero") ?? "",
    email: String(formData.get("email") ?? "").trim(),
    address: formData.get("address") ?? "",
    country: formData.get("country") ?? "",
    contactPreference: formData.get("contactPreference") ?? "",
  });
}

function versBase(d: z.infer<typeof ProfilSchema>) {
  return {
    phone: `${d.indicatif} ${d.numero.replace(/^0+(?=\d)/, "")}`, // 06… devient +212 6…
    email: d.email,
    address: d.address,
    country: d.country,
    contactPreference: d.contactPreference,
  };
}

/** Fiche de bienvenue : complétée une fois, à la première connexion du propriétaire. */
export async function enregistrerProfil(_prev: ProfilState, formData: FormData): Promise<ProfilState> {
  const user = await requireOwner();
  const parsed = lireProfil(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  await db.user.update({ where: { id: user.id }, data: { ...versBase(parsed.data), onboardedAt: new Date() } });
  redirect("/espace");
}

/** « Mon compte » : le propriétaire corrige ses coordonnées. */
export async function modifierProfil(_prev: ProfilState, formData: FormData): Promise<ProfilState> {
  const user = await requireOwner();
  const parsed = lireProfil(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  await db.user.update({ where: { id: user.id }, data: versBase(parsed.data) });
  revalidatePath("/espace");
  return { ok: Date.now() };
}

/** « Mon compte » : nouveau mot de passe choisi par le propriétaire. Déconnecte ses autres appareils. */
export async function changerMotDePasse(_prev: ProfilState, formData: FormData): Promise<ProfilState> {
  const user = await requireOwner();
  // Espaces ignorés, comme à la connexion.
  const actuel = String(formData.get("actuel") ?? "").trim();
  const nouveau = String(formData.get("nouveau") ?? "").trim();
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  if (!actuel) return { error: "Saisissez votre mot de passe actuel." };
  if (nouveau.length < 8 || nouveau.length > 100) return { error: "Le nouveau mot de passe doit faire au moins 8 caractères." };
  if (nouveau !== confirmation) return { error: "Les deux nouveaux mots de passe ne correspondent pas." };

  // Même limite que la connexion (compteur partagé) : 5 erreurs = 15 min de blocage.
  const since = new Date(Date.now() - LOCK_WINDOW_MS);
  if ((await db.loginAttempt.count({ where: { username: user.username, createdAt: { gte: since } } })) >= MAX_ATTEMPTS) {
    return { error: "Trop de tentatives. Réessayez dans 15 minutes." };
  }
  if (!(await verifyPassword(actuel, user.passwordHash))) {
    await db.loginAttempt.create({ data: { username: user.username } });
    return { error: "Mot de passe actuel incorrect." };
  }

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(nouveau) } });
  await revokeOtherSessions(user.id);
  return { ok: Date.now() };
}
