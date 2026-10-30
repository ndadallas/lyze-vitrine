// Toutes les dates de réservation sont stockées à minuit UTC (une date = un jour, sans heure).
export const DAY_MS = 24 * 60 * 60 * 1000;
export const TIMEZONE = "Africa/Casablanca";

/** "2026-10-02" -> Date à minuit UTC */
export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDayString(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Aujourd'hui au Maroc, à minuit UTC. */
export function today(): Date {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
  return parseDay(s)!;
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY_MS);
}

export function monthStart(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1));
}

export function addMonths(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

export function daysInMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** "2026-10" -> 1er octobre 2026 ; sinon mois en cours. */
export function parseMonth(value: string | undefined): Date {
  const m = value?.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const month = Number(m[2]) - 1;
    if (month >= 0 && month < 12) return monthStart(Number(m[1]), month);
  }
  const t = today();
  return monthStart(t.getUTCFullYear(), t.getUTCMonth());
}

export function monthKey(d: Date) {
  return toDayString(d).slice(0, 7);
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...opts });

const monthFmt = fmt({ month: "long", year: "numeric" });
const longFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortFmt = fmt({ day: "numeric", month: "short" });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const formatMonth = (d: Date) => capitalize(monthFmt.format(d));
export const formatLongDate = (d: Date) => capitalize(longFmt.format(d));
export const formatShortDate = (d: Date) => shortFmt.format(d);

export function formatMAD(amount: number) {
  // Espace insécable classique : l'espace fine (U+202F) n'existe pas dans les polices du site.
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(amount)).replace(/ /g, " ")} MAD`;
}
