"use client";

import { useState } from "react";
import { formatMAD } from "@/lib/dates";
import { PLATEFORMES } from "@/lib/plateformes";

import { COMMISSION_LYZE as COMMISSION, TAUX_PLATEFORME } from "@/lib/tarifs";

const TAUX = { AIRBNB: TAUX_PLATEFORME.AIRBNB, BOOKING: TAUX_PLATEFORME.BOOKING } as const;
const TAUX_AUTRE = TAUX_PLATEFORME.OTHER; // « Autre » : taux fixe, non modifiable (demande 2026-11-16)
type Code = keyof typeof TAUX | "AUTRE";
const CODES = Object.keys(TAUX) as (keyof typeof TAUX)[];
const pct = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/** Simulateur de revenus annuels, identique à celui de la vitrine : prix × nuits − commission plateforme − commission Lyze,
 *  les deux calculées sur le montant total (demande client 2026-11-11). Styles .calcul de style.css. */
export function Simulateur() {
  const [prix, setPrix] = useState(1200);
  const [nuits, setNuits] = useState(120);
  const [plateforme, setPlateforme] = useState<Code>("AIRBNB");
  const taux = plateforme === "AUTRE" ? TAUX_AUTRE : TAUX[plateforme];
  const nomPlateforme = plateforme === "AUTRE" ? "Autre plateforme" : PLATEFORMES[plateforme].nom;
  const brut = prix * nuits;
  const frais = (brut * taux) / 100;
  const lyze = (brut * COMMISSION) / 100;
  const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v || 0)));
  const remplissage = (v: number, min: number, max: number) =>
    ({ "--pct": `${((borne(v, min, max) - min) / (max - min)) * 100}%` }) as React.CSSProperties;

  return (
    <form className="calcul" aria-labelledby="titre-calcul" onSubmit={(e) => e.preventDefault()}>
      <h2 className="titre" id="titre-calcul">Estimez vos revenus</h2>
      <label className="calcul-prix">
        <span className="ligne-prix">
          <span>Prix de la nuit</span>
          <span className="saisie">
            <input type="number" min={0} max={10000} step={50} inputMode="numeric" value={prix}
              aria-label="Prix de la nuit en dirhams" onChange={(e) => setPrix(borne(+e.target.value, 0, 10000))} />
            <small>MAD</small>
          </span>
        </span>
        <input type="range" min={200} max={10000} step={50} value={prix} aria-label="Curseur du prix de la nuit"
          style={remplissage(prix, 200, 10000)} onChange={(e) => setPrix(+e.target.value)} />
      </label>
      <label className="calcul-prix">
        <span className="ligne-prix">
          <span>Nuits louées par an</span>
          <span className="saisie">
            <input type="number" min={0} max={365} step={1} inputMode="numeric" value={nuits}
              aria-label="Nombre de nuits louées par an" onChange={(e) => setNuits(borne(+e.target.value, 0, 365))} />
            <small>nuits</small>
          </span>
        </span>
        <input type="range" min={1} max={365} step={1} value={nuits} aria-label="Curseur du nombre de nuits louées par an"
          style={remplissage(nuits, 1, 365)} onChange={(e) => setNuits(+e.target.value)} />
      </label>
      <fieldset>
        <legend>Plateforme</legend>
        <div className="plats">
          {CODES.map((c) => (
            <label className="plat" key={c}>
              <input type="radio" name="plateforme" checked={plateforme === c} onChange={() => setPlateforme(c)} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PLATEFORMES[c].logo} alt="" />
              <b>{PLATEFORMES[c].nom}</b>
              <small>{pct(TAUX[c])} %</small>
            </label>
          ))}
          <label className="plat">
            <input type="radio" name="plateforme" checked={plateforme === "AUTRE"} onChange={() => setPlateforme("AUTRE")} />
            <svg className="plat-ico" aria-hidden="true" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
            <b>Autre</b>
            <small>{pct(TAUX_AUTRE)} %</small>
          </label>
        </div>
      </fieldset>
      <ul className="resultats" aria-live="polite">
        <li className="ligne-annee"><span>Revenus bruts<small>par an</small></span><strong>{formatMAD(brut)}</strong></li>
        <li className="ligne-annee">
          <span>Commission {nomPlateforme}<small>{pct(taux)} % sur les nuitées / an</small></span>
          <strong>−{formatMAD(frais)}</strong>
        </li>
        <li className="ligne-annee">
          <span>Commission Lyze Conciergerie<small>{COMMISSION} % sur les nuitées / an</small></span>
          <strong>−{formatMAD(lyze)}</strong>
        </li>
        <li className="ligne-annee total"><span>Vous recevez<small>par an</small></span><strong>{formatMAD(brut - frais - lyze)}</strong></li>
      </ul>
      <p className="note-calcul">
        Commissions de la plateforme et de Lyze Conciergerie ({COMMISSION} %) calculées sur le montant total des nuitées. Taux indicatifs, hors frais de ménage et taxe de séjour.
      </p>
    </form>
  );
}
