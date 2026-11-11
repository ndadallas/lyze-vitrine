"use client";

import { useState } from "react";
import { addMonths, daysInMonth, formatMAD, parseDay } from "@/lib/dates";
import { nights, overlapNights } from "@/lib/stats";
import { LogoPlateforme } from "@/lib/plateformes";
import type { BienEspace } from "./EspaceProprietaire";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const jour = (iso: string) => parseDay(iso)!;
const court = (d: Date) => `${d.getUTCDate()} ${MOIS_COURT[d.getUTCMonth()]}`;

/** Relevé mois par mois (12 derniers mois, mois en cours compris) + prochaines arrivées, tous biens ou un seul. */
export function Revenus({ biens, aujourdhui }: { biens: BienEspace[]; aujourdhui: string }) {
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
    for (const r of resas) {
      const n = overlapNights(r, debut, fin);
      if (!n) continue;
      nuits += n;
      montant += (r.montant * n) / (nights(r) || 1); // réservation à cheval : au prorata des nuits
    }
    const dispo = daysInMonth(debut) * choisis.length;
    return {
      cle: debut.toISOString(),
      libelle: `${MOIS[debut.getUTCMonth()]} ${debut.getUTCFullYear()}`,
      enCours: i === 0,
      nuits,
      occupation: dispo ? Math.round((nuits / dispo) * 100) : 0,
      montant: Math.round(montant),
    };
  });
  // pas de mois vides avant la première réservation (au moins 3 lignes)
  const derniere = lignes.findLastIndex((l) => l.nuits > 0);
  lignes.splice(Math.max(derniere + 1, 3));
  const total = lignes.reduce((s, l) => ({ nuits: s.nuits + l.nuits, montant: s.montant + l.montant }), { nuits: 0, montant: 0 });

  const prochaines = resas
    .filter((r) => r.startDate.getTime() >= t0.getTime())
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .slice(0, 5);

  return (
    <section className="panneau revenus" id="releve">
      <span className="eyebrow eyebrow--brique">Revenus</span>
      <h2>Vos revenus</h2>
      <p className="aide-p">Montants nets qui vous reviennent, après frais de plateforme et commission Lyze Conciergerie.</p>

      {biens.length > 1 && (
        <label className="champ-app select revenus-filtre">
          <select aria-label="Biens pris en compte" value={filtre} onChange={(e) => setFiltre(e.target.value)}>
            <option value="tous">Tous mes biens</option>
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
        <div><span>{lignes.length === 12 ? "Sur 12 mois" : `Depuis ${lignes[lignes.length - 1].libelle.toLowerCase()}`}</span><strong>{formatMAD(total.montant)}</strong></div>
        <div><span>Nuits réservées</span><strong>{total.nuits}</strong></div>
        <div><span>Ce mois-ci</span><strong>{formatMAD(lignes[0].montant)}</strong></div>
      </div>

      <div className="revenus-grille">
        <div>
          <span className="titre-p">Relevé mois par mois</span>
          <table className="releve">
            <thead>
              <tr><th scope="col">Mois</th><th scope="col">Nuits</th><th scope="col">Occupation</th><th scope="col">Montant net</th></tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.cle}>
                  <th scope="row">{l.libelle}{l.enCours && <small> en cours</small>}</th>
                  <td>{l.nuits}</td>
                  <td>{l.occupation} %</td>
                  <td>{l.montant ? formatMAD(l.montant) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row">Total</th><td>{total.nuits}</td><td /><td>{formatMAD(total.montant)}</td></tr>
            </tfoot>
          </table>
        </div>

        <div>
          <span className="titre-p">Prochaines arrivées</span>
          {prochaines.length ? (
            <ul className="arrivees">
              {prochaines.map((r) => (
                <li key={r.id}>
                  <span className="arrivee-date">{court(r.startDate)}</span>
                  <span>
                    <strong>{r.bien}</strong>
                    <small>Voyageur {r.initiale}. · {nights(r)} nuits</small>
                  </span>
                  <LogoPlateforme code={r.plateforme} avecNom={false} taille={18} />
                  <span className="arrivee-montant">{r.montant ? formatMAD(r.montant) : "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="vide-msg">Aucune arrivée prévue pour le moment.</p>
          )}
        </div>
      </div>
    </section>
  );
}
