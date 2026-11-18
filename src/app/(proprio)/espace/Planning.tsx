"use client";

import "@/styles/lz.css";

import { daysInMonth, parseDay } from "@/lib/dates";
import { LogoPlateforme } from "@/lib/plateformes";
import type { BienEspace, ResaEspace } from "./EspaceProprietaire";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const INITIALES_JOURS = ["D", "L", "M", "M", "J", "V", "S"];
const jour = (iso: string) => parseDay(iso)!.getTime();
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const DAY = 86_400_000;

/** Flèches + menus déroulants mois / année (demande 2026-11-17). `onMois` reçoit un décalage en mois. */
export function ChoixMois({ mois, aujourdhui, onMois }: { mois: Date; aujourdhui: string; onMois: (delta: number) => void }) {
  const m = mois.getUTCMonth();
  const an = mois.getUTCFullYear();
  const an0 = Number(aujourdhui.slice(0, 4));
  // la page charge 12 mois en arrière et 18 en avant : années proposées en conséquence
  const annees = [an0 - 1, an0, an0 + 1, an0 + 2];
  if (!annees.includes(an)) annees.push(an);
  return (
    <div className="champ-app mois-nav">
      <button type="button" onClick={() => onMois(-1)} aria-label="Mois précédent">‹</button>
      <span>
        <select aria-label="Mois" value={m} onChange={(e) => onMois(Number(e.target.value) - m)}>
          {MOIS.map((nom, i) => <option key={nom} value={i}>{nom}</option>)}
        </select>
        <select aria-label="Année" value={an} onChange={(e) => onMois((Number(e.target.value) - an) * 12)}>
          {annees.sort().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </span>
      <button type="button" onClick={() => onMois(1)} aria-label="Mois suivant">›</button>
    </div>
  );
}

/** Barres du mois pour un bien : colonne de départ (1 = 1er du mois) et longueur en jours. */
function barres(bien: BienEspace, debutMois: number, nbJours: number) {
  const finMois = debutMois + nbJours * DAY;
  return bien.resas
    .filter((r) => jour(r.au) > debutMois && jour(r.du) < finMois)
    .map((r) => {
      const de = Math.max(jour(r.du), debutMois);
      const a = Math.min(jour(r.au), finMois);
      return { r, col: Math.round((de - debutMois) / DAY) + 1, span: Math.max(1, Math.round((a - de) / DAY)) };
    });
}

/** Planning du mois : une ligne par bien, une colonne par jour, cliquable pour ajouter ou modifier. */
export function Planning({
  biens,
  mois,
  aujourdhui,
  onMois,
  onResa,
  onJourLibre,
  titre = "Tous vos biens",
  aide = "Le mois en un coup d’œil. Cliquez sur une case libre pour ajouter une réservation ou bloquer une date, ou sur une barre pour la modifier.",
}: {
  titre?: string;
  aide?: string;
  biens: BienEspace[];
  mois: Date;
  aujourdhui: string;
  onMois: (delta: number) => void;
  onResa: (bien: BienEspace, resa: ResaEspace) => void;
  onJourLibre: (bien: BienEspace, jourIso: string) => void;
}) {
  const debut = mois.getTime();
  const nb = daysInMonth(mois);
  const t0 = jour(aujourdhui);
  const colonnes = `minmax(150px, 1.4fr) repeat(${nb}, minmax(26px, 1fr))`;

  return (
    <section className="panneau lz-section" id="planning">
      <span className="eyebrow eyebrow--brique">Planning</span>
      <h2>{titre}</h2>
      <p className="aide-p">{aide}</p>
      <div className="lz-planning-tete">
        <ChoixMois mois={mois} aujourdhui={aujourdhui} onMois={onMois} />
        <div className="legende-app">
          <span><i className="l-brique" />Réservé</span>
          <span><i className="l-barka" />Réservé par l’entreprise</span>
          <span><i className="l-bloque" />Bloqué par le propriétaire</span>
        </div>
      </div>

      <div className="lz-planning-defile">
        <div className="lz-planning" style={{ gridTemplateColumns: colonnes }}>
          <div className="lz-pl-coin" />
          {Array.from({ length: nb }, (_, i) => {
            const t = debut + i * DAY;
            const d = new Date(t);
            return (
              <div key={i} className={`lz-pl-jour${t === t0 ? " lz-aujourdhui" : ""}${d.getUTCDay() % 6 === 0 ? " lz-we" : ""}`}>
                <small>{INITIALES_JOURS[d.getUTCDay()]}</small>
                {i + 1}
              </div>
            );
          })}

          {biens.flatMap((b, ligne) => {
            const rangee = ligne + 2;
            return [
              <div key={`${b.id}-nom`} className="lz-pl-bien" style={{ gridRow: rangee, gridColumn: 1 }}>
                <strong>{b.nom}</strong>
                <small>{b.ville}</small>
              </div>,
              ...Array.from({ length: nb }, (_, i) => (
                <button
                  key={`${b.id}-${i}`}
                  type="button"
                  className="lz-pl-case"
                  style={{ gridRow: rangee, gridColumn: i + 2 }}
                  aria-label={`${b.nom}, ${i + 1} ${MOIS[mois.getUTCMonth()]} : ajouter`}
                  onClick={() => onJourLibre(b, iso(debut + i * DAY))}
                />
              )),
              ...barres(b, debut, nb).map(({ r, col, span }) => (
                <button
                  key={r.id}
                  type="button"
                  className={`lz-pl-barre lz-pl-${r.type.toLowerCase()}${r.attente ? " lz-pl-attente" : ""}`}
                  style={{ gridRow: rangee, gridColumn: `${col + 1} / span ${span}` }}
                  title={r.type === "RESERVED" ? `Voyageur ${r.initiale}.` : (r.note ?? undefined)}
                  onClick={() => onResa(b, r)}
                >
                  {r.type === "RESERVED" ? (
                    <>
                      <LogoPlateforme code={r.plateforme} avecNom={false} taille={12} />
                      {span > 1 && <span>{r.initiale}.</span>}
                    </>
                  ) : (
                    span > 2 && <span>{r.type === "MANAGED" ? "Entreprise" : r.note || "Bloqué"}</span>
                  )}
                </button>
              )),
            ];
          })}
        </div>
      </div>
    </section>
  );
}
