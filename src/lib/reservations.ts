import "server-only";
import * as z from "zod";
import { db } from "@/lib/db";
import { formatShortDate, parseDay } from "@/lib/dates";
import { CODES_PLATEFORMES } from "@/lib/plateformes";

// Règles communes aux réservations saisies par la gérante (admin) et par le propriétaire (espace).

const texteFacultatif = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v || null);

const jour = (message: string) =>
  z.string().transform((v, ctx) => {
    const d = parseDay(v);
    if (!d) ctx.addIssue({ code: "custom", message });
    return d ?? new Date(NaN);
  });

export const BookingSchema = z
  .object({
    propertyId: z.string().min(1),
    kind: z.enum(["RESERVED", "BLOCKED"]), // « Réservé par l’entreprise » retiré le 2026-11-18 (→ plateforme Lyze)
    platform: z.enum(CODES_PLATEFORMES, { error: "Plateforme invalide." }),
    platformOther: texteFacultatif, // « Autre » à préciser
    startDate: jour("Date d'arrivée invalide."),
    endDate: jour("Date de départ invalide."),
    guestName: texteFacultatif,
    amount: z.coerce
      .number({ error: "Montant invalide." })
      .int({ error: "Montant en MAD, sans centimes." })
      .min(0, { error: "Montant invalide." })
      .max(10_000_000),
    nightPrice: z.coerce
      .number({ error: "Prix de la nuit invalide." })
      .int({ error: "Montant en MAD, sans centimes." })
      .min(0, { error: "Prix de la nuit invalide." })
      .max(10_000_000),
    fees: z.coerce
      .number({ error: "Frais invalides." })
      .int({ error: "Montant en MAD, sans centimes." })
      .min(0, { error: "Frais invalides." })
      .max(10_000_000),
    commission: z.coerce
      .number({ error: "Commission invalide." })
      .int({ error: "Montant en MAD, sans centimes." })
      .min(0, { error: "Commission invalide." })
      .max(10_000_000),
    note: texteFacultatif,
  })
  .refine((b) => b.kind !== "RESERVED" || b.platform !== "OTHER" || !!b.platformOther, {
    error: "Précisez la plateforme (champ « Laquelle ? »).",
  })
  .refine((b) => b.fees + b.commission <= b.amount, {
    error: "Les frais et la commission dépassent le chiffre d'affaires.",
  })
  .refine((b) => b.endDate > b.startDate, {
    error: "La date de départ doit être après la date d'arrivée.",
  });

export function parseBooking(formData: FormData) {
  return BookingSchema.safeParse({
    propertyId: formData.get("propertyId") ?? "",
    kind: formData.get("kind") ?? "RESERVED",
    platform: formData.get("platform") ?? "AIRBNB",
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    platformOther: formData.get("platformOther") ?? "",
    guestName: formData.get("guestName") ?? "",
    amount: formData.get("amount") || 0,
    nightPrice: formData.get("nightPrice") || 0,
    fees: formData.get("fees") || 0,
    commission: formData.get("commission") || 0,
    note: formData.get("note") ?? "",
  });
}

/** Message d'erreur si les dates chevauchent une autre ligne du même bien (hors `exceptId`). */
export async function findClash(propertyId: string, start: Date, end: Date, exceptId?: string) {
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
  return `Ces dates chevauchent ${clash.kind === "BLOCKED" ? "un blocage" : "une réservation"} existant (${formatShortDate(clash.startDate)} → ${formatShortDate(clash.endDate)}).`;
}
