import { DAY_MS, addMonths, daysInMonth } from "@/lib/dates";

export type BookingLike = {
  kind: "RESERVED" | "BLOCKED";
  startDate: Date;
  endDate: Date; // jour de départ, exclu
  amount: number;
};

export function nights(b: { startDate: Date; endDate: Date }) {
  return Math.max(0, Math.round((b.endDate.getTime() - b.startDate.getTime()) / DAY_MS));
}

/** Nuits de la réservation comprises dans [from, to). */
export function overlapNights(b: { startDate: Date; endDate: Date }, from: Date, to: Date) {
  const start = Math.max(b.startDate.getTime(), from.getTime());
  const end = Math.min(b.endDate.getTime(), to.getTime());
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

/**
 * Chiffres d'un mois pour un ensemble de biens.
 * Le montant d'une réservation à cheval sur deux mois est réparti au prorata des nuits.
 */
export function monthStats(bookings: BookingLike[], month: Date, propertyCount: number) {
  const next = addMonths(month, 1);
  let revenue = 0;
  let reservedNights = 0;

  for (const b of bookings) {
    if (b.kind !== "RESERVED") continue;
    const n = overlapNights(b, month, next);
    if (n === 0) continue;
    reservedNights += n;
    const total = nights(b);
    revenue += total > 0 ? (b.amount * n) / total : 0;
  }

  const availableNights = daysInMonth(month) * propertyCount;
  return {
    revenue: Math.round(revenue),
    reservedNights,
    availableNights,
    occupancy: availableNights > 0 ? Math.round((reservedNights / availableNights) * 100) : 0,
  };
}

/** État d'un jour donné : réservation, blocage ou libre. */
export function dayStatus(bookings: BookingLike[], day: Date): "RESERVED" | "BLOCKED" | "FREE" {
  const t = day.getTime();
  let status: "RESERVED" | "BLOCKED" | "FREE" = "FREE";
  for (const b of bookings) {
    if (b.startDate.getTime() <= t && t < b.endDate.getTime()) {
      if (b.kind === "RESERVED") return "RESERVED";
      status = "BLOCKED";
    }
  }
  return status;
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
