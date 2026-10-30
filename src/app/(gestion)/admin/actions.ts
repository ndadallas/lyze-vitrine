"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatShortDate, parseDay } from "@/lib/dates";
import { generatePassword, hashPassword, slugUsername } from "@/lib/passwords";
import { revokeUserSessions } from "@/lib/session";

export type Credentials = {
  name: string;
  username: string;
  password: string;
  phone: string | null;
  email: string | null;
};
export type ActionState =
  | { error?: string; message?: string; credentials?: Credentials; done?: number }
  | undefined;

const optionalText = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v || null);

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Formulaire invalide.";

/* ------------------------------------------------------------------ */
/* Clients (propriétaires)                                             */
/* ------------------------------------------------------------------ */

const OwnerSchema = z.object({
  firstName: z.string().trim().min(1, { error: "Prénom requis." }).max(80),
  lastName: z.string().trim().min(1, { error: "Nom requis." }).max(80),
  email: optionalText.pipe(z.email({ error: "Email invalide." }).nullable()),
  phone: optionalText,
});

async function uniqueUsername(base: string) {
  const root = base || "client";
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? root : `${root}${i}`;
    const taken = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
}

export async function createOwner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = OwnerSchema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const data = parsed.data;

  const username = await uniqueUsername(slugUsername(data.firstName, data.lastName));
  const password = generatePassword();

  await db.user.create({
    data: { ...data, username, passwordHash: await hashPassword(password), role: "OWNER" },
  });

  revalidatePath("/admin");
  return {
    credentials: {
      name: `${data.firstName} ${data.lastName}`,
      username,
      password,
      phone: data.phone,
      email: data.email,
    },
    done: Date.now(),
  };
}

/**
 * Nouveau mot de passe (choisi par la gérante, ou généré si le champ est vide) :
 * l'ancien ne fonctionne plus et le client est déconnecté partout.
 */
export async function resetOwnerPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("userId") ?? "");
  // Espaces ignorés, comme à la connexion.
  const chosen = String(formData.get("password") ?? "").trim();
  if (chosen && (chosen.length < 8 || chosen.length > 100)) {
    return { error: "Le mot de passe choisi doit faire au moins 8 caractères." };
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user || user.role !== "OWNER") return { error: "Client introuvable." };

  const password = chosen || generatePassword();
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  await revokeUserSessions(id);

  revalidatePath(`/admin/clients/${id}`);
  return {
    credentials: {
      name: `${user.firstName} ${user.lastName}`,
      username: user.username,
      password,
      phone: user.phone,
      email: user.email,
    },
    done: Date.now(),
  };
}

const OwnerUpdateSchema = OwnerSchema.extend({
  id: z.string().min(1),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+([.-][a-z0-9]+)*$/, {
      error: "Identifiant : lettres sans accent, chiffres, points ou tirets (ex. nadia.el-amrani).",
    })
    .max(60),
});

export async function updateOwner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = OwnerUpdateSchema.safeParse({
    id: formData.get("userId") ?? "",
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    username: formData.get("username") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, ...data } = parsed.data;

  const user = await db.user.findUnique({ where: { id }, select: { role: true, username: true } });
  if (!user || user.role !== "OWNER") return { error: "Client introuvable." };

  if (data.username !== user.username) {
    const taken = await db.user.findUnique({ where: { username: data.username }, select: { id: true } });
    if (taken) return { error: `L'identifiant « ${data.username} » est déjà pris.` };
  }

  await db.user.update({ where: { id }, data });

  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${id}`);
  return {
    message:
      data.username !== user.username
        ? `Modifications enregistrées. Pensez à prévenir le client : son identifiant est maintenant « ${data.username} ».`
        : "Modifications enregistrées.",
    done: Date.now(),
  };
}

/** Supprime le client avec ses biens, réservations et sessions (cascade). Irréversible. */
export async function deleteOwner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("userId") ?? "");

  const user = await db.user.findUnique({
    where: { id },
    select: { role: true, properties: { select: { id: true } } },
  });
  if (!user || user.role !== "OWNER") return;

  await db.user.delete({ where: { id } });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function setOwnerActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";

  const user = await db.user.findUnique({ where: { id }, select: { role: true } });
  if (!user || user.role !== "OWNER") return;

  await db.user.update({ where: { id }, data: { active } });
  if (!active) await revokeUserSessions(id);

  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${id}`);
}

/* ------------------------------------------------------------------ */
/* Biens                                                              */
/* ------------------------------------------------------------------ */

const PropertySchema = z.object({
  ownerId: z.string().min(1),
  name: z.string().trim().min(1, { error: "Nom du bien requis." }).max(120),
  city: z.string().trim().min(1, { error: "Ville requise." }).max(80),
});

export async function addProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = PropertySchema.safeParse({
    ownerId: formData.get("ownerId") ?? "",
    name: formData.get("name") ?? "",
    city: formData.get("city") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const owner = await db.user.findUnique({ where: { id: parsed.data.ownerId }, select: { role: true } });
  if (!owner || owner.role !== "OWNER") return { error: "Client introuvable." };

  const property = await db.property.create({ data: parsed.data });
  revalidatePath(`/admin/clients/${parsed.data.ownerId}`);
  // On ouvre directement le nouveau bien pour y ajouter photos et réservations.
  redirect(`/admin/clients/${parsed.data.ownerId}?bien=${property.id}`);
}

export async function updateProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("propertyId") ?? "");
  const parsed = PropertySchema.omit({ ownerId: true }).safeParse({
    name: formData.get("name") ?? "",
    city: formData.get("city") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const property = await db.property.update({ where: { id }, data: parsed.data }).catch(() => null);
  if (!property) return { error: "Bien introuvable." };

  revalidatePath(`/admin/clients/${property.ownerId}`);
  return { message: "Bien mis à jour.", done: Date.now() };
}

export async function deleteProperty(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("propertyId") ?? "");
  const property = await db.property.delete({ where: { id } }).catch(() => null);
  if (!property) return;
  revalidatePath(`/admin/clients/${property.ownerId}`);
}

/* ------------------------------------------------------------------ */
/* Réservations / blocages                                            */
/* ------------------------------------------------------------------ */

const BookingSchema = z
  .object({
    propertyId: z.string().min(1),
    kind: z.enum(["RESERVED", "BLOCKED"]),
    startDate: z.string().transform((v, ctx) => {
      const d = parseDay(v);
      if (!d) ctx.addIssue({ code: "custom", message: "Date d'arrivée invalide." });
      return d ?? new Date(NaN);
    }),
    endDate: z.string().transform((v, ctx) => {
      const d = parseDay(v);
      if (!d) ctx.addIssue({ code: "custom", message: "Date de départ invalide." });
      return d ?? new Date(NaN);
    }),
    guestName: optionalText,
    amount: z.coerce
      .number({ error: "Montant invalide." })
      .int({ error: "Montant en MAD, sans centimes." })
      .min(0, { error: "Montant invalide." })
      .max(10_000_000),
    note: optionalText,
  })
  .refine((b) => b.endDate > b.startDate, {
    error: "La date de départ doit être après la date d'arrivée.",
  });

function parseBooking(formData: FormData) {
  return BookingSchema.safeParse({
    propertyId: formData.get("propertyId") ?? "",
    kind: formData.get("kind") ?? "RESERVED",
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    guestName: formData.get("guestName") ?? "",
    amount: formData.get("amount") || 0,
    note: formData.get("note") ?? "",
  });
}

/** Message d'erreur si les dates chevauchent une autre ligne du même bien (hors `exceptId`). */
async function findClash(propertyId: string, start: Date, end: Date, exceptId?: string) {
  const clash = await db.booking.findFirst({
    where: {
      propertyId,
      startDate: { lt: end },
      endDate: { gt: start },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    orderBy: { startDate: "asc" },
  });
  if (!clash) return null;
  return `Ces dates chevauchent ${clash.kind === "RESERVED" ? "une réservation" : "un blocage"} existant (${formatShortDate(clash.startDate)} → ${formatShortDate(clash.endDate)}).`;
}

export async function addBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseBooking(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const b = parsed.data;

  const property = await db.property.findUnique({ where: { id: b.propertyId } });
  if (!property) return { error: "Bien introuvable." };

  const clash = await findClash(b.propertyId, b.startDate, b.endDate);
  if (clash) return { error: clash };

  await db.booking.create({
    data: { ...b, amount: b.kind === "RESERVED" ? b.amount : 0 },
  });
  revalidatePath(`/admin/clients/${property.ownerId}`);
  return {
    message: b.kind === "RESERVED" ? "Réservation ajoutée." : "Blocage ajouté.",
    done: Date.now(),
  };
}

/** Modifie une réservation ou un blocage (type, dates, voyageur, montant, motif). */
export async function updateBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("bookingId") ?? "");
  const existing = await db.booking.findUnique({
    where: { id },
    include: { property: { select: { ownerId: true } } },
  });
  if (!existing) return { error: "Réservation introuvable." };

  formData.set("propertyId", existing.propertyId);
  const parsed = parseBooking(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const b = parsed.data;

  const clash = await findClash(existing.propertyId, b.startDate, b.endDate, id);
  if (clash) return { error: clash };

  await db.booking.update({
    where: { id },
    data: {
      kind: b.kind,
      startDate: b.startDate,
      endDate: b.endDate,
      guestName: b.guestName,
      amount: b.kind === "RESERVED" ? b.amount : 0,
      note: b.note,
    },
  });
  revalidatePath(`/admin/clients/${existing.property.ownerId}`);
  return { message: "Modifications enregistrées.", done: Date.now() };
}

export async function deleteBooking(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("bookingId") ?? "");
  const booking = await db.booking
    .delete({ where: { id }, include: { property: { select: { ownerId: true } } } })
    .catch(() => null);
  if (booking) revalidatePath(`/admin/clients/${booking.property.ownerId}`);
}
