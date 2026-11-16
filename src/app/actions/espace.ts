"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireOwner } from "@/lib/auth";
import { parseDay, today } from "@/lib/dates";
import { CODES_STATUTS, CODES_TYPES_DEMANDE, EQUIPEMENTS, TYPES_BIEN } from "@/lib/espace";
import { getManageableProperty } from "@/lib/photos";
import { getSessionUser } from "@/lib/session";

export type EspaceState = { error?: string; ok?: number } | undefined;

const premier = (e: z.ZodError) => e.issues[0]?.message ?? "Formulaire invalide.";
const texte = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max} caractères maximum.` })
    .transform((v) => v || null);
const entier = (max: number, nom: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number({ error: `${nom} : nombre invalide.` }).int().min(0).max(max).nullable());

function rafraichir(ownerId: string) {
  revalidatePath("/espace");
  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${ownerId}`);
}

/* ------------------------------------------------------------------ */
/* Fiche du bien (propriétaire ou gérante)                             */
/* ------------------------------------------------------------------ */

const FicheSchema = z.object({
  kind: z.union([z.enum(TYPES_BIEN), z.literal("")]).transform((v) => v || null),
  address: texte(300),
  bedrooms: entier(50, "Chambres"),
  capacity: entier(100, "Voyageurs"),
  surface: entier(10000, "Surface"),
  equipment: z.array(z.enum(EQUIPEMENTS)),
  wifiName: texte(100),
  wifiPassword: texte(100),
  arrival: texte(2000),
  notes: texte(2000),
});

export async function enregistrerFiche(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  const bien = await getManageableProperty(String(formData.get("propertyId") ?? ""));
  if (!bien) return { error: "Accès refusé." };

  const parsed = FicheSchema.safeParse({
    kind: formData.get("kind") ?? "",
    address: formData.get("address") ?? "",
    bedrooms: formData.get("bedrooms") ?? "",
    capacity: formData.get("capacity") ?? "",
    surface: formData.get("surface") ?? "",
    equipment: formData.getAll("equipment").map(String),
    wifiName: formData.get("wifiName") ?? "",
    wifiPassword: formData.get("wifiPassword") ?? "",
    arrival: formData.get("arrival") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: premier(parsed.error) };

  await db.property.update({ where: { id: bien.id }, data: parsed.data });
  rafraichir(bien.ownerId);
  return { ok: Date.now() };
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

/** La gérante supprime tout ; un propriétaire seulement les documents qu'il a lui-même déposés. */
export async function supprimerDocument(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const doc = await db.document.findUnique({
    where: { id: String(formData.get("documentId") ?? "") },
    select: { id: true, ownerId: true, byAdmin: true },
  });
  if (!doc) return;
  const permis = user.role === "ADMIN" || (doc.ownerId === user.id && !doc.byAdmin);
  if (!permis) return;
  await db.document.delete({ where: { id: doc.id } });
  rafraichir(doc.ownerId);
}

/* ------------------------------------------------------------------ */
/* Demandes du propriétaire                                            */
/* ------------------------------------------------------------------ */

const DemandeSchema = z
  .object({
    type: z.enum(CODES_TYPES_DEMANDE, { error: "Choisissez le type de demande." }),
    propertyId: z.string().transform((v) => v || null),
    du: z.string().transform((v) => (v ? parseDay(v) : null)),
    au: z.string().transform((v) => (v ? parseDay(v) : null)),
    message: z.string().trim().max(2000, { error: "Message trop long (2000 caractères maximum)." }),
  })
  .superRefine((d, ctx) => {
    if (d.type === "USAGE_PERSO") {
      if (!d.propertyId) ctx.addIssue({ code: "custom", message: "Choisissez le bien concerné." });
      if (!d.du || !d.au) ctx.addIssue({ code: "custom", message: "Indiquez les dates d'arrivée et de départ." });
      else if (d.au <= d.du) ctx.addIssue({ code: "custom", message: "Le départ doit être après l'arrivée." });
      else if (d.du < today()) ctx.addIssue({ code: "custom", message: "Les dates sont déjà passées." });
    } else if (d.message.length < 5) {
      ctx.addIssue({ code: "custom", message: "Décrivez votre demande en quelques mots." });
    }
  });

export async function envoyerDemande(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  const user = await requireOwner();
  const parsed = DemandeSchema.safeParse({
    type: formData.get("type") ?? "",
    propertyId: String(formData.get("propertyId") ?? ""),
    du: String(formData.get("du") ?? ""),
    au: String(formData.get("au") ?? ""),
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) return { error: premier(parsed.error) };
  const d = parsed.data;

  if (d.propertyId) {
    const bien = await db.property.findFirst({ where: { id: d.propertyId, ownerId: user.id }, select: { id: true } });
    if (!bien) return { error: "Bien introuvable." };
  }
  const enCours = await db.ownerRequest.count({ where: { ownerId: user.id, status: "NOUVELLE" } });
  if (enCours >= 20) return { error: "Vous avez déjà 20 demandes en attente. Lyze vous répond au plus vite." };

  await db.ownerRequest.create({
    data: {
      ownerId: user.id,
      propertyId: d.propertyId,
      type: d.type,
      startDate: d.type === "USAGE_PERSO" ? d.du : null,
      endDate: d.type === "USAGE_PERSO" ? d.au : null,
      message: d.message || "Usage personnel",
    },
  });
  rafraichir(user.id);
  return { ok: Date.now() };
}

/** Le propriétaire retire une demande que Lyze n'a pas encore prise en charge. */
export async function annulerDemande(formData: FormData) {
  const user = await requireOwner();
  await db.ownerRequest.deleteMany({
    where: { id: String(formData.get("demandeId") ?? ""), ownerId: user.id, status: "NOUVELLE" },
  });
  rafraichir(user.id);
}

/* ------------------------------------------------------------------ */
/* Traitement par la gérante                                           */
/* ------------------------------------------------------------------ */

const TraitementSchema = z.object({
  status: z.enum(CODES_STATUTS),
  reply: texte(2000),
  bloquer: z.boolean(),
});

export async function traiterDemande(_prev: EspaceState, formData: FormData): Promise<EspaceState> {
  await requireAdmin();
  const demande = await db.ownerRequest.findUnique({ where: { id: String(formData.get("demandeId") ?? "") } });
  if (!demande) return { error: "Demande introuvable." };

  const parsed = TraitementSchema.safeParse({
    status: formData.get("status") ?? "",
    reply: formData.get("reply") ?? "",
    bloquer: formData.get("bloquer") === "on",
  });
  if (!parsed.success) return { error: premier(parsed.error) };
  const t = parsed.data;

  // « Accepter et bloquer » : les dates demandées deviennent un blocage dans le calendrier.
  if (t.bloquer && demande.type === "USAGE_PERSO" && demande.propertyId && demande.startDate && demande.endDate) {
    const conflit = await db.booking.findFirst({
      where: {
        propertyId: demande.propertyId,
        kind: "RESERVED",
        startDate: { lt: demande.endDate },
        endDate: { gt: demande.startDate },
      },
      select: { id: true },
    });
    if (conflit) return { error: "Une réservation voyageur existe déjà sur ces dates : impossible de les bloquer." };
    await db.booking.create({
      data: {
        propertyId: demande.propertyId,
        kind: "BLOCKED",
        startDate: demande.startDate,
        endDate: demande.endDate,
        note: "Usage personnel du propriétaire",
      },
    });
  }

  await db.ownerRequest.update({
    where: { id: demande.id },
    data: { status: t.bloquer ? "TRAITEE" : t.status, reply: t.reply },
  });
  rafraichir(demande.ownerId);
  return { ok: Date.now() };
}
