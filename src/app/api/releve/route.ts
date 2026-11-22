import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { addMonths, daysInMonth, formatMonth, monthStart, toDayString } from "@/lib/dates";
import { nights, overlapNights } from "@/lib/stats";
import { PLATEFORMES } from "@/lib/plateformes";
import { CATEGORIES_DEPENSE } from "@/lib/espace";
import { deviseCourante } from "@/lib/langue-serveur";
import { classeur, type Cellule } from "@/lib/xlsx";

/**
 * Relevé de revenus d'un client en .xlsx, pour la gérante (demande 2026-11-22).
 * /api/releve?client=<id>&annee=2026[&mois=1..12][&bien=<id>] : une année entière ou un seul mois.
 * Mêmes calculs que l'onglet Revenus : séjour à cheval réparti au prorata des nuits.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return new Response("Introuvable", { status: 404 });

  const q = new URL(request.url).searchParams;
  const annee = Number(q.get("annee"));
  const mois = q.get("mois") ? Number(q.get("mois")) : null;
  if (!Number.isInteger(annee) || annee < 2000 || annee > 2100 || (mois !== null && (!Number.isInteger(mois) || mois < 1 || mois > 12))) {
    return new Response("Période invalide", { status: 400 });
  }
  const owner = await db.user.findFirst({ where: { id: q.get("client") ?? "", role: "OWNER" } });
  if (!owner) return new Response("Introuvable", { status: 404 });

  const debut = monthStart(annee, mois ? mois - 1 : 0);
  const fin = addMonths(debut, mois ? 1 : 12);
  const biens = await db.property.findMany({
    where: { ownerId: owner.id, ...(q.get("bien") ? { id: q.get("bien")! } : {}) },
    orderBy: { createdAt: "asc" },
    include: {
      bookings: { where: { kind: "RESERVED", endDate: { gt: debut }, startDate: { lt: fin } }, orderBy: { startDate: "asc" } },
      expenses: { where: { date: { gte: debut, lt: fin } }, orderBy: { date: "asc" } },
    },
  });
  if (!biens.length) return new Response("Aucun bien", { status: 404 });

  const { devise, tauxEur } = await deviseCourante();
  const m = (mad: number) => (devise === "EUR" ? mad / tauxEur : mad);
  const unite = devise === "EUR" ? "€" : "MAD";
  const g = (v: string | number): Cellule => ({ v, gras: true });
  const date = (d: Date) => toDayString(d).split("-").reverse().join("/");

  const resas = biens.flatMap((b) => b.bookings.map((r) => ({ ...r, bien: b.name })));
  const depenses = biens.flatMap((b) => b.expenses.map((e) => ({ ...e, bien: b.name })));

  // Feuille 1 : mois par mois
  const lignesMois: Cellule[][] = [];
  const total = { nuits: 0, ca: 0, frais: 0, com: 0, dep: 0, dispo: 0 };
  for (let d = debut; d < fin; d = addMonths(d, 1)) {
    const f = addMonths(d, 1);
    const l = { nuits: 0, ca: 0, frais: 0, com: 0, dep: 0 };
    for (const r of resas) {
      const n = overlapNights(r, d, f);
      if (!n) continue;
      const part = n / (nights(r) || 1);
      l.nuits += n;
      l.ca += r.amount * part;
      l.frais += r.fees * part;
      l.com += r.commission * part;
    }
    l.dep = depenses.filter((e) => e.date >= d && e.date < f).reduce((s, e) => s + e.amount, 0);
    const dispo = daysInMonth(d) * biens.length;
    lignesMois.push([formatMonth(d), l.nuits, `${dispo ? Math.round((l.nuits / dispo) * 100) : 0} %`, m(l.ca), m(l.frais), m(l.com), m(l.dep), m(l.ca - l.frais - l.com - l.dep)]);
    total.nuits += l.nuits; total.ca += l.ca; total.frais += l.frais; total.com += l.com; total.dep += l.dep; total.dispo += dispo;
  }
  const periode = mois ? formatMonth(debut) : `Année ${annee}`;
  const releve: Cellule[][] = [
    [g("Lyze Conciergerie : relevé de revenus")],
    ["Propriétaire", `${owner.firstName} ${owner.lastName}`],
    ["Période", periode],
    ["Bien(s)", biens.map((b) => b.name).join(", ")],
    ["Montants en", unite],
    ["Édité le", date(new Date())],
    [],
    ["Mois", "Nuits", "Occupation", "Chiffre d'affaires", "Frais plateformes", "Commission Lyze", "Dépenses", "Net propriétaire"].map(g),
    ...lignesMois,
    [g("Total"), g(total.nuits), g(`${total.dispo ? Math.round((total.nuits / total.dispo) * 100) : 0} %`), g(m(total.ca)), g(m(total.frais)), g(m(total.com)), g(m(total.dep)), g(m(total.ca - total.frais - total.com - total.dep))],
    [],
    ["Net = chiffre d'affaires - frais de plateforme (Airbnb, Booking...) - commission Lyze - dépenses. Séjour à cheval sur deux mois : réparti au prorata des nuits."],
  ];

  // Feuille 2 : séjours (part de la période)
  const sejours: Cellule[][] = [
    ["Bien", "Plateforme", "Voyageur", "Arrivée", "Départ", "Nuits sur la période", "Chiffre d'affaires", "Frais plateforme", "Commission Lyze", "Net"].map(g),
    ...resas.map((r) => {
      const n = overlapNights(r, debut, fin);
      const p = n / (nights(r) || 1);
      return [r.bien, r.platform === "OTHER" && r.platformOther ? r.platformOther : PLATEFORMES[r.platform].nom, r.guestName ?? "", date(r.startDate), date(r.endDate), n, m(r.amount * p), m(r.fees * p), m(r.commission * p), m((r.amount - r.fees - r.commission) * p)];
    }),
  ];
  if (sejours.length === 1) sejours.push(["Aucun séjour sur la période."]);

  // Feuille 3 : dépenses
  const feuilleDep: Cellule[][] = [
    ["Date", "Bien", "Catégorie", "Libellé", "Montant"].map(g),
    ...depenses.map((e) => [date(e.date), e.bien, CATEGORIES_DEPENSE[e.category], e.label, m(e.amount)]),
  ];
  if (feuilleDep.length === 1) feuilleDep.push(["Aucune dépense sur la période."]);

  const fichier = classeur([
    { nom: "Relevé", largeurs: [22, 10, 12, 18, 18, 18, 14, 18], lignes: releve },
    { nom: "Séjours", largeurs: [22, 14, 22, 12, 12, 12, 18, 16, 16, 14], lignes: sejours },
    { nom: "Dépenses", largeurs: [12, 22, 28, 36, 14], lignes: feuilleDep },
  ]);
  const nom = `Releve Lyze - ${owner.firstName} ${owner.lastName} - ${mois ? `${annee}-${String(mois).padStart(2, "0")}` : annee}.xlsx`;
  return new Response(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
