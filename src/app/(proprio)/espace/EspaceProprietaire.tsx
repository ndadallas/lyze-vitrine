"use client";

import { useMemo, useState } from "react";
import { logout } from "@/app/actions/auth";
import { PhotoManager, type PhotoItem } from "@/components/PhotoManager";
import { Simulateur } from "@/components/Simulateur";
import { DAY_MS, daysInMonth, formatMAD, monthStart, parseDay } from "@/lib/dates";
import { monthStats, nights } from "@/lib/stats";
import { LogoPlateforme, PLATEFORMES, type Plateforme } from "@/lib/plateformes";

export type ResaEspace = {
  id: string;
  type: "RESERVED" | "BLOCKED" | "MANAGED";
  du: string; // arrivée, "2026-11-12"
  au: string; // départ (exclu), "2026-11-16"
  initiale: string | null;
  montant: number;
  plateforme: Plateforme;
};

export type BienEspace = {
  id: string;
  nom: string;
  ville: string;
  photos: PhotoItem[]; // dans l'ordre ; la première = couverture
  resas: ResaEspace[];
};

type Props = { nom: string; aujourdhui: string; biens: BienEspace[] };

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const jour = (iso: string) => parseDay(iso)!;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const court = (d: Date) => `${d.getUTCDate()} ${MOIS_COURT[d.getUTCMonth()]}`;
const versStats = (r: ResaEspace) => ({ kind: r.type, startDate: jour(r.du), endDate: jour(r.au), amount: r.montant });

/** Réservation (ou blocage) qui occupe la nuit du jour t ; une réservation l'emporte sur un blocage. */
function resaDuJour(bien: BienEspace, t: number) {
  let blocage: ResaEspace | null = null;
  for (const r of bien.resas) {
    if (jour(r.du).getTime() <= t && t < jour(r.au).getTime()) {
      if (r.type === "RESERVED") return r;
      blocage = r;
    }
  }
  return blocage;
}

function statut(bien: BienEspace, t: number) {
  if (resaDuJour(bien, t)?.type === "RESERVED") return "Occupé";
  const bientot = bien.resas.some((r) => {
    const debut = jour(r.du).getTime();
    return r.type === "RESERVED" && debut > t && debut - t < 10 * DAY_MS;
  });
  return bientot ? "Réservé" : "Libre";
}

function premiereResaDuMois(bien: BienEspace | undefined, mois: Date) {
  if (!bien) return null;
  const fin = Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + 1, 1);
  return (
    bien.resas.find(
      (r) => r.type === "RESERVED" && jour(r.au).getTime() > mois.getTime() && jour(r.du).getTime() < fin,
    ) ?? null
  );
}

function IconeCoche(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M4 12l5 5L20 6" />
    </svg>
  );
}

export function EspaceProprietaire({ nom, aujourdhui, biens }: Props) {
  const t0 = jour(aujourdhui);
  const [bienId, setBienId] = useState<string | undefined>(biens[0]?.id);
  const [mois, setMois] = useState(() => monthStart(t0.getUTCFullYear(), t0.getUTCMonth()));
  const bien = biens.find((b) => b.id === bienId);
  const [resaId, setResaId] = useState(() => premiereResaDuMois(biens[0], mois)?.id ?? null);
  const resa = bien?.resas.find((r) => r.id === resaId) ?? null;

  function choisir(b: BienEspace | undefined, m: Date) {
    setBienId(b?.id);
    setMois(m);
    setResaId(premiereResaDuMois(b, m)?.id ?? null);
  }

  function changerMois(delta: number) {
    choisir(bien, new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + delta, 1)));
  }

  const stats = useMemo(() => (bien ? monthStats(bien.resas.map(versStats), mois, 1) : null), [bien, mois]);
  const titreMois = `${capital(MOIS[mois.getUTCMonth()])} ${mois.getUTCFullYear()}`;

  return (
    <div className="app">
      <aside className="side">
        <a className="logo" href="/"><img src="/assets/img/logo-lyze-creme.png" alt="Lyze Conciergerie" width={599} height={200} />{/* eslint-disable-line @next/next/no-img-element */}</a>
        <span className="role">ESPACE PROPRIÉTAIRE</span>
        <nav aria-label="Espace propriétaire">
          <a href="#haut" aria-current="page">Mes biens</a>
          <a href="#calendrier">Calendrier</a>
          <a href="#photos">Photos</a>
          <a href="#revenus">Simulateur</a>
        </nav>
        <div className="bas">
          <span>
            Connecté·e : <strong>{nom}</strong>
          </span>
          <form action={logout}>
            <button type="submit">Se déconnecter</button>
          </form>
        </div>
      </aside>

      <main className="contenu" id="haut">
        <h1>Mes biens</h1>

        {!bien ? (
          <section className="panneau vide-biens">
            <span className="titre-p">Vos biens</span>
            <p>Aucun bien n&apos;est encore rattaché à votre compte. Lyze les ajoute pour vous : ils apparaîtront ici avec leur calendrier.</p>
          </section>
        ) : (
          <>
            <div className="outils" id="calendrier">
              <label className="champ-app select">
                <select
                  aria-label="Bien affiché"
                  value={bien.id}
                  onChange={(e) => choisir(biens.find((b) => b.id === e.target.value), mois)}
                >
                  {biens.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nom} — {b.ville}
                    </option>
                  ))}
                </select>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="none" stroke="currentColor" strokeWidth="2" d="M5 9l7 7 7-7" />
                </svg>
              </label>
              <div className="champ-app mois-nav">
                <button type="button" onClick={() => changerMois(-1)} aria-label="Mois précédent">‹</button>
                <span>{titreMois}</span>
                <button type="button" onClick={() => changerMois(1)} aria-label="Mois suivant">›</button>
              </div>
              <div className="legende-app">
                <span>
                  <i className="l-vert" style={{ color: "var(--creme)" }}>
                    <IconeCoche width={12} height={12} />
                  </i>
                  Réservation sélectionnée
                </span>
                <span><i className="l-brique" />Loué / complet</span>
                <span><i className="l-barka" />Barka s’en charge</span>
                <span><i className="l-bloque" />Bloqué</span>
                <span><i className="l-libre" />Libre</span>
              </div>
            </div>

            <div className="grille-app">
              <section className="panneau liste" aria-labelledby="titre-liste">
                <span className="titre-p" id="titre-liste">Vos biens</span>
                <p className="aide-p">Cliquez sur un bien pour voir son calendrier</p>
                <ul>
                  {biens.map((b) => (
                    <li key={b.id}>
                      <button type="button" aria-pressed={b.id === bien.id} onClick={() => choisir(b, mois)}>
                        {b.photos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.photos[0].url} alt="" />
                        ) : (
                          <span className="pastille" aria-hidden="true">{b.nom.charAt(0)}</span>
                        )}
                        <span>
                          <strong>{b.nom}</strong>
                          <small>{b.ville}</small>
                        </span>
                        <span className="statut">{statut(b, t0.getTime())}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {stats && (
                  <div className="stats">
                    <span className="titre-p">{titreMois}</span>
                    <div><span>Taux d’occupation</span><strong>{stats.occupancy} %</strong></div>
                    <div><span>Nuits réservées</span><strong>{stats.reservedNights}</strong></div>
                    <div><span>Revenus du mois</span><strong>{formatMAD(stats.revenue)}</strong></div>
                  </div>
                )}
              </section>

              <section className="panneau cal" aria-label="Calendrier du mois">
                <div className="cal-entete">
                  {JOURS.map((j) => <span key={j}>{j}</span>)}
                </div>
                <Calendrier bien={bien} mois={mois} resaChoisie={resa} onChoisir={setResaId} />
              </section>

              <section className="panneau detail" aria-live="polite">
                <span className="titre-p">Réservation sélectionnée</span>
                {resa ? (
                  <>
                    <h2>Voyageur {resa.initiale}.</h2>
                    <dl>
                      <div>
                        <dt>Séjour</dt>
                        <dd>
                          {court(jour(resa.du))} → {court(jour(resa.au))} ({nights(versStats(resa))} nuits)
                        </dd>
                      </div>
                      <div>
                        <dt>Plateforme</dt>
                        <dd><LogoPlateforme code={resa.plateforme} taille={18} /></dd>
                      </div>
                      <div><dt>Montant</dt><dd>{resa.montant > 0 ? formatMAD(resa.montant) : "—"}</dd></div>
                      <div>
                        <dt>Statut</dt>
                        <dd className="ok">Réservé <IconeCoche width={14} height={14} /></dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <p className="vide-msg">
                    Aucune réservation ce mois-ci pour ce bien. Cliquez sur un jour loué pour voir son détail.
                  </p>
                )}
              </section>
            </div>

            <section className="panneau photos" id="photos">
              <h2>Photos — {bien.nom}</h2>
              <p className="aide-p">
                Glissez vos photos dans le cadre pour les ajouter à l&apos;annonce. Faites-les glisser entre elles pour
                changer l&apos;ordre : la première est la photo de couverture.
              </p>
              <PhotoManager key={bien.id} propertyId={bien.id} initial={bien.photos} />
            </section>
          </>
        )}

        <section className="panneau simulateur" id="revenus">
          <h2>Simulateur de revenus</h2>
          <Simulateur />
        </section>
      </main>
    </div>
  );
}

function Calendrier({
  bien,
  mois,
  resaChoisie,
  onChoisir,
}: {
  bien: BienEspace;
  mois: Date;
  resaChoisie: ResaEspace | null;
  onChoisir: (id: string) => void;
}) {
  const an = mois.getUTCFullYear();
  const m = mois.getUTCMonth();
  const decalage = (mois.getUTCDay() + 6) % 7; // lundi = 0
  const cases: React.ReactNode[] = [];

  for (let i = 0; i < decalage; i++) cases.push(<div key={`v${i}`} className="jour vide" />);

  for (let d = 1; d <= daysInMonth(mois); d++) {
    const t = Date.UTC(an, m, d);
    const r = resaDuJour(bien, t);
    const debutOuPremier = r && (d === 1 || t === jour(r.du).getTime());

    if (!r) {
      cases.push(<div key={d} className="jour">{d}</div>);
    } else if (r.type === "MANAGED") {
      cases.push(
        <div key={d} className="jour barka">
          {d}
          {debutOuPremier && <span className="etiquette">Barka</span>}
        </div>,
      );
    } else if (r.type === "BLOCKED") {
      cases.push(
        <div key={d} className="jour bloque">
          {d}
          {debutOuPremier && <span className="etiquette">Bloqué</span>}
        </div>,
      );
    } else {
      const choisie = r.id === resaChoisie?.id;
      cases.push(
        <button
          key={d}
          type="button"
          className={`jour ${choisie ? "reserve" : "loue"}`}
          aria-label={`${d} ${MOIS[m]} : réservé via ${PLATEFORMES[r.plateforme].nom}`}
          onClick={() => onChoisir(r.id)}
        >
          {d}
          {choisie && <IconeCoche className="coche" />}
          {debutOuPremier && (
            <span className="etiquette">
              <LogoPlateforme code={r.plateforme} avecNom={false} taille={14} />
              {choisie && `${r.initiale}.`}
            </span>
          )}
        </button>,
      );
    }
  }

  return <div className="cal-jours">{cases}</div>;
}
