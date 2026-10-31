"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

const CONTACTS = ["WhatsApp", "Téléphone", "E-mail"] as const;

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

export type ProfilState = { error?: string } | undefined;

/** Fiche de bienvenue : complétée une fois, à la première connexion du propriétaire. */
export async function enregistrerProfil(_prev: ProfilState, formData: FormData): Promise<ProfilState> {
  const user = await requireOwner();
  const parsed = ProfilSchema.safeParse({
    indicatif: formData.get("indicatif") ?? "",
    numero: formData.get("numero") ?? "",
    email: String(formData.get("email") ?? "").trim(),
    address: formData.get("address") ?? "",
    country: formData.get("country") ?? "",
    contactPreference: formData.get("contactPreference") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const d = parsed.data;

  await db.user.update({
    where: { id: user.id },
    data: {
      phone: `${d.indicatif} ${d.numero.replace(/^0+(?=\d)/, "")}`, // 06… devient +212 6…
      email: d.email,
      address: d.address,
      country: d.country,
      contactPreference: d.contactPreference,
      onboardedAt: new Date(),
    },
  });
  redirect("/espace");
}
