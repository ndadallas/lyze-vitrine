"use client";

import { useState } from "react";
import { formatMAD } from "@/lib/dates";
import { PLATEFORMES } from "@/lib/plateformes";

// shortcut: mêmes taux et commission que le simulateur de la vitrine (public/index.html), à confirmer par Lyze
const COMMISSION = 20;
const TAUX = { AIRBNB: 18, BOOKING: 20, EXPEDIA: 15 } as const;
type Code = keyof typeof TAUX;
const CODES = Object.keys(TAUX) as Code[];
const pct = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/** Simulateur de revenus : prix de la nuit − frais de la plateforme − commission Lyze (styles .calcul de style.css). */
export function Simulateur() {
  const [prix, setPrix] = useState(1200);
  const [cochees, setCochees] = useState<Code[]>(["AIRBNB", "BOOKING"]);
  const basculer = (c: Code) => setCochees((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));

  return (
    <form className="calcul" aria-labelledby="titre-calcul" onSubmit={(e) => e.preventDefault()}>
      <h2 className="titre" id="titre-calcul">Combien vous rapporte une nuit&nbsp;?</h2>
      <label className="calcul-prix">
        <span className="ligne-prix">
          <span>Prix de la nuit</span>
          <span className="saisie">
            <input
              type="number" min={0} max={10000} step={50} inputMode="numeric" value={prix}
              aria-label="Prix de la nuit en dirhams"
              onChange={(e) => setPrix(Math.min(10000, Math.max(0, Math.round(+e.target.value || 0))))}
            />
            <small>MAD</small>
          </span>
        </span>
        <input
          type="range" min={200} max={10000} step={50} value={prix} aria-label="Curseur du prix de la nuit"
          style={{ "--pct": `${((Math.min(10000, Math.max(200, prix)) - 200) / 9800) * 100}%` } as React.CSSProperties}
          onChange={(e) => setPrix(+e.target.value)}
        />
      </label>
      <fieldset>
        <legend>Plateformes utilisées</legend>
        <div className="plats">
          {CODES.map((c) => (
            <label className="plat" key={c}>
              <input type="checkbox" checked={cochees.includes(c)} onChange={() => basculer(c)} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PLATEFORMES[c].logo} alt="" />
              <b>{PLATEFORMES[c].nom}</b>
              <small>{pct(TAUX[c])} %</small>
            </label>
          ))}
        </div>
      </fieldset>
      <ul className="resultats" aria-live="polite">
        {cochees.length === 0 && <li className="vide">Cochez au moins une plateforme.</li>}
        {CODES.filter((c) => cochees.includes(c)).map((c) => {
          const frais = (prix * TAUX[c]) / 100;
          const lyze = ((prix - frais) * COMMISSION) / 100;
          const net = prix - frais - lyze;
          return (
            <li key={c}>
              <div className="tete">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span><img src={PLATEFORMES[c].logo} alt="" />{PLATEFORMES[c].nom}</span>
                <strong>{formatMAD(net)}</strong>
              </div>
              <p className="detail">
                {formatMAD(prix)} − {formatMAD(frais)} ({PLATEFORMES[c].nom} {pct(TAUX[c])} %) − {formatMAD(lyze)} (Lyze Conciergerie {COMMISSION} %) = vous touchez {formatMAD(net)}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="note-calcul">
        Montant net par nuit : frais de la plateforme retirés du prix, puis commission Lyze Conciergerie de {COMMISSION} % sur le reste. Taux indicatifs, hors frais de ménage et taxe de séjour.
      </p>
    </form>
  );
}
