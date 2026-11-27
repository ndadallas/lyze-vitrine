import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { addMonths, daysInMonth, formatMonth, monthStart, toDayString } from "@/lib/dates";
import { nights, overlapNights } from "@/lib/stats";
import { PLATEFORMES } from "@/lib/plateformes";
import { CATEGORIES_DEPENSE } from "@/lib/espace";
import { deviseCourante } from "@/lib/langue-serveur";
import { classeur, type Rapport, type Valeur } from "@/lib/xlsx";

const capitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  const resas = biens.flatMap((b) => b.bookings.map((r) => ({ ...r, bien: b.name })));
  const depenses = biens.flatMap((b) => b.expenses.map((e) => ({ ...e, bien: b.name })));

  // Feuille 1 : mois par mois
  const lignesMois: Valeur[][] = [];
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
    lignesMois.push([capitale(formatMonth(d)), l.nuits, dispo ? l.nuits / dispo : 0, m(l.ca), m(l.frais), m(l.com), m(l.dep), m(l.ca - l.frais - l.com - l.dep)]);
    total.nuits += l.nuits; total.ca += l.ca; total.frais += l.frais; total.com += l.com; total.dep += l.dep; total.dispo += dispo;
  }
  const periode = mois ? capitale(formatMonth(debut)) : `Année ${annee}`;
  const titre = "Lyze Conciergerie";
  const sousTitre = `Relevé de revenus · ${periode}`;
  const infos: [string, string][] = [
    ["Propriétaire", `${owner.firstName} ${owner.lastName}`],
    ["Période", periode],
    [biens.length > 1 ? "Biens" : "Bien", biens.map((b) => b.name).join(", ")],
    ["Devise", devise === "EUR" ? `Euro (1 € = ${tauxEur} MAD)` : "Dirham marocain (DH)"],
    ["Édité le", toDayString(new Date()).split("-").reverse().join("/")],
  ];

  const releve: Rapport = {
    nom: "Relevé",
    titre,
    sousTitre,
    infos,
    colonnes: [
      { titre: "Mois", type: "texte", largeur: 20 },
      { titre: "Nuits", type: "entier", largeur: 9 },
      { titre: "Occupation", type: "pourcent", largeur: 12 },
      { titre: "Chiffre d'affaires", type: "montant", largeur: 18 },
      { titre: "Frais plateformes", type: "montant", largeur: 18 },
      { titre: "Commission Lyze", type: "montant", largeur: 18 },
      { titre: "Dépenses", type: "montant", largeur: 15 },
      { titre: "Net propriétaire", type: "montant", largeur: 19, fort: true },
    ],
    lignes: lignesMois,
    total: ["Total", total.nuits, total.dispo ? total.nuits / total.dispo : 0, m(total.ca), m(total.frais), m(total.com), m(total.dep), m(total.ca - total.frais - total.com - total.dep)],
    note: "Net propriétaire = chiffre d'affaires − frais de plateforme (Airbnb, Booking…) − commission Lyze − dépenses. Un séjour à cheval sur deux mois est réparti au prorata des nuits.",
  };

  // Feuille 2 : séjours (part de la période)
  const sejours: Rapport = {
    nom: "Séjours",
    titre,
    sousTitre: `Détail des séjours · ${periode}`,
    infos: infos.slice(0, 1),
    colonnes: [
      { titre: "Bien", type: "texte", largeur: 22 },
      { titre: "Plateforme", type: "texte", largeur: 14 },
      { titre: "Voyageur", type: "texte", largeur: 22 },
      { titre: "Arrivée", type: "date", largeur: 12 },
      { titre: "Départ", type: "date", largeur: 12 },
      { titre: "Nuits sur la période", type: "entier", largeur: 12 },
      { titre: "Chiffre d'affaires", type: "montant", largeur: 18 },
      { titre: "Frais plateforme", type: "montant", largeur: 17 },
      { titre: "Commission Lyze", type: "montant", largeur: 17 },
      { titre: "Net", type: "montant", largeur: 17, fort: true },
    ],
    lignes: resas.map((r) => {
      const n = overlapNights(r, debut, fin);
      const p = n / (nights(r) || 1);
      return [r.bien, r.platform === "OTHER" && r.platformOther ? r.platformOther : PLATEFORMES[r.platform].nom, r.guestName ?? "", r.startDate, r.endDate, n, m(r.amount * p), m(r.fees * p), m(r.commission * p), m((r.amount - r.fees - r.commission) * p)];
    }),
    vide: "Aucun séjour sur la période.",
  };
  if (resas.length) sejours.total = ["Total", null, null, null, null, total.nuits, m(total.ca), m(total.frais), m(total.com), m(total.ca - total.frais - total.com)];

  // Feuille 3 : dépenses
  const feuilleDep: Rapport = {
    nom: "Dépenses",
    titre,
    sousTitre: `Dépenses · ${periode}`,
    infos: infos.slice(0, 1),
    colonnes: [
      { titre: "Date", type: "date", largeur: 12 },
      { titre: "Bien", type: "texte", largeur: 22 },
      { titre: "Catégorie", type: "texte", largeur: 24 },
      { titre: "Libellé", type: "texte", largeur: 38 },
      { titre: "Montant", type: "montant", largeur: 16, fort: true },
    ],
    lignes: depenses.map((e) => [e.date, e.bien, CATEGORIES_DEPENSE[e.category], e.label, m(e.amount)]),
    vide: "Aucune dépense sur la période.",
  };
  if (depenses.length) feuilleDep.total = ["Total", null, null, null, m(total.dep)];

  const fichier = classeur([releve, sejours, feuilleDep], devise);
  const nom = `Releve Lyze - ${owner.firstName} ${owner.lastName} - ${mois ? `${annee}-${String(mois).padStart(2, "0")}` : annee}.xlsx`;
  return new Response(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
