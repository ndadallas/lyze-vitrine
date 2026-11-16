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
    kind: z.enum(["RESERVED", "BLOCKED", "MANAGED"]),
    platform: z.enum(CODES_PLATEFORMES, { error: "Plateforme invalide." }),
    startDate: jour("Date d'arrivée invalide."),
    endDate: jour("Date de départ invalide."),
    guestName: texteFacultatif,
    amount: z.coerce
      .number({ error: "Montant invalide." })
      .int({ error: "Montant en MAD, sans centimes." })
      .min(0, { error: "Montant invalide." })
      .max(10_000_000),
    note: texteFacultatif,
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
    guestName: formData.get("guestName") ?? "",
    amount: formData.get("amount") || 0,
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
  return `Ces dates chevauchent ${clash.kind === "RESERVED" ? "une réservation" : clash.kind === "MANAGED" ? "une période « Réservé par l’entreprise »" : "un blocage"} existant (${formatShortDate(clash.startDate)} → ${formatShortDate(clash.endDate)}).`;
}
