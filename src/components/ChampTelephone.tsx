"use client";

import { Fragment, useEffect, useRef, useState } from "react";

type Pays = { tel: string; nom: string; iso: string };

const drapeau = (iso: string) => `/assets/img/drapeaux/${iso.toLowerCase()}.svg`;

/**
 * Indicatif de tous les pays (liste partagée avec la vitrine) + numéro. Noms traduits par le navigateur.
 * Liste maison pour afficher les drapeaux (impossible dans un <select>) ; la valeur part dans un champ caché.
 */
export function ChampTelephone({ defaut = "+212", numero = "" }: { defaut?: string; numero?: string }) {
  const [pays, setPays] = useState<Pays[]>([{ tel: "+212", nom: "Maroc", iso: "MA" }]);
  const [choix, setChoix] = useState<number | null>(null); // index dans `pays`, choisi à la main
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const recherche = useRef({ texte: "", minuterie: 0 });

  useEffect(() => {
    let actif = true;
    fetch("/assets/data/indicatifs.json")
      .then((r) => r.json() as Promise<[string, string][]>)
      .then((brut) => {
        const noms = new Intl.DisplayNames(["fr"], { type: "region" });
        const lignes = brut
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

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => {
      if (!boite.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("click", fermer);
    const sel = liste.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    sel?.focus();
    sel?.scrollIntoView({ block: "nearest" });
    return () => document.removeEventListener("click", fermer);
  }, [ouvert]);

  const i = choix ?? Math.max(0, pays.findIndex((p) => p.tel === defaut));
  const actuel = pays[i] ?? pays[0];

  function choisir(n: number) {
    setChoix(n);
    setOuvert(false);
    bouton.current?.focus();
  }

  function clavier(e: React.KeyboardEvent<HTMLUListElement>) {
    const items = [...(liste.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const pos = items.indexOf(document.activeElement as HTMLElement);
    const aller = (el?: HTMLElement) => {
      el?.focus();
      el?.scrollIntoView({ block: "nearest" });
    };
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      aller(items[Math.min(items.length - 1, Math.max(0, pos + (e.key === "ArrowDown" ? 1 : -1)))]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (pos >= 0) choisir(Number(items[pos].dataset.i));
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOuvert(false);
      if (e.key === "Escape") bouton.current?.focus();
    } else if (e.key.length === 1) {
      // taper les premières lettres d'un pays
      const r = recherche.current;
      r.texte += e.key.toLowerCase();
      window.clearTimeout(r.minuterie);
      r.minuterie = window.setTimeout(() => (r.texte = ""), 700);
      aller(items.slice(2).find((li) => li.textContent?.toLowerCase().startsWith(r.texte)));
    }
  }

  return (
    <span className="tel-groupe">
      <input type="hidden" name="indicatif" value={actuel.tel} />
      <div className="pays-choix" ref={boite}>
        <button
          ref={bouton}
          type="button"
          className="pays-bouton"
          aria-haspopup="listbox"
          aria-expanded={ouvert}
          aria-label={`Indicatif du pays : ${actuel.nom} (${actuel.tel})`}
          onClick={() => setOuvert((o) => !o)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={drapeau(actuel.iso)} alt="" width={24} height={18} />
          <span>{actuel.tel}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {ouvert && (
          <ul className="pays-liste" role="listbox" tabIndex={-1} ref={liste} onKeyDown={clavier}>
            {pays.map((p, n) => (
              <Fragment key={`${p.iso}-${n}`}>
                <li
                  role="option"
                  tabIndex={-1}
                  data-i={n}
                  aria-selected={n === i}
                  // preventDefault : le champ est dans un <label>, qui renverrait sinon le clic au bouton (liste rouverte)
                  onClick={(e) => {
                    e.preventDefault();
                    choisir(n);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={drapeau(p.iso)} alt="" width={24} height={18} loading="lazy" />
                  <span>
                    {p.nom} ({p.tel})
                  </span>
                </li>
                {n === 1 && pays.length > 2 && <li className="pays-sep" role="separator" />}
              </Fragment>
            ))}
          </ul>
        )}
      </div>
      <input name="numero" type="tel" autoComplete="tel-national" placeholder="6 12 34 56 78" defaultValue={numero} required aria-label="Numéro" />
    </span>
  );
}
