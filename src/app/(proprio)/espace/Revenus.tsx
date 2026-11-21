"use client";

import { useT } from "@/components/Langue";
import { useState } from "react";
import { addMonths, daysInMonth, formatMAD, parseDay } from "@/lib/dates";
import { nights, overlapNights } from "@/lib/stats";
import { LogoPlateforme, type Plateforme } from "@/lib/plateformes";
import type { DepenseItem } from "@/lib/espace";
import type { BienEspace } from "./EspaceProprietaire";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const jour = (iso: string) => parseDay(iso)!;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const court = (d: Date, locale = "fr-FR") => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(d);

/** Relevé mois par mois (12 derniers mois, mois en cours compris) + prochaines arrivées, tous biens ou un seul. */
export function Revenus({ biens, aujourdhui, depenses, titre = "Vos revenus" }: { biens: BienEspace[]; aujourdhui: string; depenses: DepenseItem[]; titre?: string }) {
  const { t, locale, mois: nomMois } = useT();
  const [filtre, setFiltre] = useState("tous");
  const choisis = filtre === "tous" ? biens : biens.filter((b) => b.id === filtre);
  const t0 = jour(aujourdhui);
  const moisCourant = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth(), 1));

  const resas = choisis.flatMap((b) =>
    b.resas
      .filter((r) => r.type === "RESERVED")
      .map((r) => ({ ...r, bien: b.nom, startDate: jour(r.du), endDate: jour(r.au) })),
  );

  const lignes = Array.from({ length: 12 }, (_, i) => {
    const debut = addMonths(moisCourant, -i);
    const fin = addMonths(debut, 1);
    let nuits = 0;
    let montant = 0;
    let commissions = 0;
    for (const r of resas) {
      const n = overlapNights(r, debut, fin);
      if (!n) continue;
      nuits += n;
      montant += (r.montant * n) / (nights(r) || 1); // réservation à cheval : au prorata des nuits
      commissions += ((r.frais + r.commission) * n) / (nights(r) || 1);
    }
    const dispo = daysInMonth(debut) * choisis.length;
    const ids = new Set(choisis.map((b) => b.id));
    const frais = depenses
      .filter((d) => ids.has(d.bienId) && jour(d.date) >= debut && jour(d.date) < fin)
      .reduce((s, d) => s + d.montant, 0);
    return {
      cle: debut.toISOString(),
      libelle: `${capital(nomMois(debut.getUTCMonth()))} ${debut.getUTCFullYear()}`,
      enCours: i === 0,
      nuits,
      occupation: dispo ? Math.round((nuits / dispo) * 100) : 0,
      montant: Math.round(montant),
      commissions: Math.round(commissions),
      frais,
    };
  });
  // pas de mois vides avant la première réservation (au moins 3 lignes)
  const derniere = lignes.findLastIndex((l) => l.nuits > 0 || l.frais > 0 || l.commissions > 0);
  lignes.splice(Math.max(derniere + 1, 3));
  const total = lignes.reduce(
    (s, l) => ({ nuits: s.nuits + l.nuits, montant: s.montant + l.montant, commissions: s.commissions + l.commissions, frais: s.frais + l.frais }),
    { nuits: 0, montant: 0, commissions: 0, frais: 0 },
  );

  // Détail par plateforme sur la même période (au prorata des nuits) + séjours du propriétaire à 0
  const debutPeriode = addMonths(moisCourant, -(lignes.length - 1));
  const finPeriode = addMonths(moisCourant, 1);
  const parPlateforme = new Map<Plateforme, { resas: number; nuits: number; ca: number; frais: number; commission: number }>();
  for (const r of resas) {
    const n = overlapNights(r, debutPeriode, finPeriode);
    if (!n) continue;
    const part = n / (nights(r) || 1);
    const p = parPlateforme.get(r.plateforme) ?? { resas: 0, nuits: 0, ca: 0, frais: 0, commission: 0 };
    p.resas += 1;
    p.nuits += n;
    p.ca += r.montant * part;
    p.frais += r.frais * part;
    p.commission += r.commission * part;
    parPlateforme.set(r.plateforme, p);
  }
  const sejoursProprio = choisis.flatMap((b) => b.resas.filter((r) => r.type === "BLOCKED"))
    .map((r) => overlapNights({ startDate: jour(r.du), endDate: jour(r.au) }, debutPeriode, finPeriode))
    .filter((n) => n > 0);

  const prochaines = resas
    .filter((r) => r.startDate.getTime() >= t0.getTime())
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .slice(0, 5);

  return (
    <section className="panneau revenus" id="releve">
      <span className="eyebrow eyebrow--brique">{t("Revenus")}</span>
      <h2>{titre}</h2>
      <p className="aide-p">{t("Net = chiffre d’affaires − frais de plateforme (Airbnb, Booking…) − commission Lyze Conciergerie − dépenses.")}</p>

      {biens.length > 1 && (
        <label className="champ-app select revenus-filtre">
          <select aria-label={t("Biens pris en compte")} value={filtre} onChange={(e) => setFiltre(e.target.value)}>
            <option value="tous">{t("Tous mes biens")}</option>
            {biens.map((b) => (
              <option key={b.id} value={b.id}>{b.nom}</option>
            ))}
          </select>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth="2" d="M5 9l7 7 7-7" />
          </svg>
        </label>
      )}

      <div className="revenus-chiffres">
        <div><span>{lignes.length === 12 ? t("Chiffre d’affaires sur 12 mois") : t("Chiffre d’affaires depuis {mois}", { mois: lignes[lignes.length - 1].libelle.toLowerCase() })}</span><strong>{formatMAD(total.montant)}</strong></div>
        <div><span>{t("Frais et dépenses")}</span><strong>{formatMAD(total.commissions + total.frais)}</strong></div>
        <div><span>{t("Net")}</span><strong>{formatMAD(total.montant - total.commissions - total.frais)}</strong></div>
      </div>

      <div className="revenus-grille">
        <div>
          <span className="titre-p">{t("Relevé mois par mois")}</span>
          <table className="releve lz-fiches-mobile">
            <thead>
              <tr><th scope="col">{t("Mois")}</th><th scope="col">{t("Nuits")}</th><th scope="col">{t("Occupation")}</th><th scope="col">{t("Chiffre d’affaires")}</th><th scope="col">{t("Frais")}</th><th scope="col">{t("Dépenses")}</th><th scope="col">{t("Net")}</th></tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.cle}>
                  <th scope="row">{l.libelle}{l.enCours && <small> {t("en cours")}</small>}</th>
                  <td data-label={t("Nuits")}>{l.nuits}</td>
                  <td data-label={t("Occupation")}>{l.occupation} %</td>
                  <td data-label={t("Chiffre d’affaires")}>{l.montant ? formatMAD(l.montant) : "—"}</td>
                  <td data-label={t("Frais")}>{l.commissions ? `− ${formatMAD(l.commissions)}` : "—"}</td>
                  <td data-label={t("Dépenses")}>{l.frais ? `− ${formatMAD(l.frais)}` : "—"}</td>
                  <td data-label={t("Net")}>{l.montant || l.frais || l.commissions ? formatMAD(l.montant - l.commissions - l.frais) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row">{t("Total")}</th><td data-label={t("Nuits")}>{total.nuits}</td><td className="lz-vide-mobile" /><td data-label={t("Chiffre d’affaires")}>{formatMAD(total.montant)}</td><td data-label={t("Frais")}>{total.commissions ? `− ${formatMAD(total.commissions)}` : "—"}</td><td data-label={t("Dépenses")}>{total.frais ? `− ${formatMAD(total.frais)}` : "—"}</td><td data-label={t("Net")}>{formatMAD(total.montant - total.commissions - total.frais)}</td></tr>
            </tfoot>
          </table>
        </div>

        <div className="revenus-plateformes">
          <span className="titre-p">{t("Détail par plateforme")}</span>
          <table className="releve lz-fiches-mobile">
            <thead>
              <tr><th scope="col">{t("Plateforme")}</th><th scope="col">{t("Séjours")}</th><th scope="col">{t("Nuits")}</th><th scope="col">{t("Chiffre d’affaires")}</th><th scope="col">{t("Frais plateforme")}</th><th scope="col">{t("Commission Lyze")}</th><th scope="col">{t("Net")}</th></tr>
            </thead>
            <tbody>
              {[...parPlateforme].map(([code, p]) => (
                <tr key={code}>
                  <th scope="row"><LogoPlateforme code={code} taille={16} /></th>
                  <td data-label={t("Séjours")}>{p.resas}</td>
                  <td data-label={t("Nuits")}>{p.nuits}</td>
                  <td data-label={t("Chiffre d’affaires")}>{formatMAD(p.ca)}</td>
                  <td data-label={t("Frais plateforme")}>{p.frais ? `− ${formatMAD(p.frais)}` : "—"}</td>
                  <td data-label={t("Commission Lyze")}>{p.commission ? `− ${formatMAD(p.commission)}` : "—"}</td>
                  <td data-label={t("Net")}>{formatMAD(p.ca - p.frais - p.commission)}</td>
                </tr>
              ))}
              {sejoursProprio.length > 0 && (
                <tr>
                  <th scope="row">{t("Séjours du propriétaire")}</th>
                  <td data-label={t("Séjours")}>{sejoursProprio.length}</td>
                  <td data-label={t("Nuits")}>{sejoursProprio.reduce((a, n) => a + n, 0)}</td>
                  <td data-label={t("Chiffre d’affaires")}>{formatMAD(0)}</td>
                  <td data-label={t("Frais plateforme")}>—</td>
                  <td data-label={t("Commission Lyze")}>—</td>
                  <td data-label={t("Net")}>{formatMAD(0)}</td>
                </tr>
              )}
              {parPlateforme.size === 0 && sejoursProprio.length === 0 && (
                <tr><td colSpan={7} className="vide-msg">{t("Aucun séjour sur la période.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <span className="titre-p">{t("Prochaines arrivées")}</span>
          {prochaines.length ? (
            <ul className="arrivees">
              {prochaines.map((r) => (
                <li key={r.id}>
                  <span className="arrivee-date">{court(r.startDate, locale)}</span>
                  <span>
                    <strong>{r.bien}</strong>
                    <small>{t("Voyageur {i}.", { i: r.initiale ?? "" })} · {t("{n} nuits", { n: nights(r) })}</small>
                  </span>
                  <LogoPlateforme code={r.plateforme} avecNom={false} taille={18} />
                  <span className="arrivee-montant">{r.montant ? formatMAD(r.montant) : "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="vide-msg">{t("Aucune arrivée prévue pour le moment.")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
