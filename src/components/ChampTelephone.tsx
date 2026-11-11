"use client";

import { useEffect, useState } from "react";

type Pays = { tel: string; nom: string; iso: string };

/** Indicatif de tous les pays (liste partagée avec la vitrine) + numéro. Noms traduits par le navigateur. */
export function ChampTelephone({ defaut = "+212", numero = "" }: { defaut?: string; numero?: string }) {
  const [pays, setPays] = useState<Pays[]>([{ tel: "+212", nom: "Maroc", iso: "MA" }]);
  const [iso, setIso] = useState<string | null>(null); // pays choisi à la main (sinon celui de l'indicatif par défaut)

  useEffect(() => {
    let actif = true;
    fetch("/assets/data/indicatifs.json")
      .then((r) => r.json() as Promise<[string, string][]>)
      .then((liste) => {
        const noms = new Intl.DisplayNames(["fr"], { type: "region" });
        const lignes = liste
          .map(([iso, tel]) => ({ iso, tel: `+${tel}`, nom: noms.of(iso) ?? iso }))
          .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
        const tete = ["MA", "FR"].flatMap((iso) => lignes.filter((l) => l.iso === iso));
        if (actif) setPays([...tete, ...lignes]);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, []);

  const drapeau = (iso ?? pays.find((p) => p.tel === defaut)?.iso ?? "MA").toLowerCase();

  return (
    <span className="tel-groupe">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="drapeau" src={`/assets/img/drapeaux/${drapeau}.svg`} alt="" width={24} height={18} />
      {/* key : remonté une fois la liste chargée, sinon un indicatif hors Maroc (+33…) ne serait pas resélectionné */}
      <select key={pays.length} name="indicatif" defaultValue={defaut} aria-label="Indicatif du pays" onChange={(e) => setIso(e.target.selectedOptions[0]?.dataset.iso ?? null)}>
        {pays.map((p, i) => (
          <option key={`${p.iso}-${i}`} value={p.tel} data-iso={p.iso}>
            {p.nom} ({p.tel})
          </option>
        ))}
      </select>
      <input name="numero" type="tel" autoComplete="tel-national" placeholder="6 12 34 56 78" defaultValue={numero} required aria-label="Numéro" />
    </span>
  );
}
