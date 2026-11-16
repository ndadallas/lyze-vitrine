"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { logout } from "@/app/actions/auth";
import { ajouterBien, supprimerBien } from "@/app/actions/espace";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Depenses } from "@/components/Depenses";
import { DemandesProprio } from "@/components/Demandes";
import { Documents } from "@/components/Documents";
import { FicheBienForm } from "@/components/FicheBienForm";
import { PhotoManager, type PhotoItem } from "@/components/PhotoManager";
import type { DemandeItem, DepenseItem, DocumentItem, FicheBien } from "@/lib/espace";
import { Simulateur } from "@/components/Simulateur";
import { DAY_MS, daysInMonth, formatMAD, monthStart, parseDay } from "@/lib/dates";
import { monthStats, nights } from "@/lib/stats";
import { LogoPlateforme, PLATEFORMES, type Plateforme } from "@/lib/plateformes";
import { EditeurResa, type Brouillon } from "./EditeurResa";
import { MonCompte, type CompteEspace } from "./MonCompte";
import { Planning } from "./Planning";
import { Revenus } from "./Revenus";

export type ResaEspace = {
  id: string;
  type: "RESERVED" | "BLOCKED" | "MANAGED";
  du: string; // arrivée, "2026-11-12"
  au: string; // départ (exclu), "2026-11-16"
  initiale: string | null;
  montant: number;
  plateforme: Plateforme;
  note: string | null;
};

export type BienEspace = {
  id: string;
  nom: string;
  ville: string;
  fiche: FicheBien;
  photos: PhotoItem[]; // dans l'ordre ; la première = couverture
  resas: ResaEspace[];
};

type Props = {
  nom: string;
  aujourdhui: string;
  biens: BienEspace[];
  documents: DocumentItem[];
  demandes: DemandeItem[];
  depenses: DepenseItem[];
  compte: CompteEspace;
  contact: string;
};

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

const ONGLETS = [
  ["haut", "Mes biens"],
  ["calendrier", "Calendrier"],
  ["planning", "Planning"],
  ["releve", "Revenus"],
  ["depenses", "Dépenses"],
  ["photos", "Photos"],
  ["fiche", "Fiche du bien"],
  ["documents", "Documents"],
  ["demandes", "Demandes"],
  ["revenus", "Simulateur"],
  ["compte", "Mon compte"],
] as const;

export function EspaceProprietaire({ nom, aujourdhui, biens, documents, demandes, depenses, compte, contact }: Props) {
  const listeBiens = biens.map((b) => ({ id: b.id, nom: b.nom }));
  const aTraiter = demandes.filter((d) => d.reponse && d.statut !== "NOUVELLE").length;
  // Onglet souligné = section visible à l'écran (et pas seulement la page)
  const [onglet, setOnglet] = useState<string>("haut");
  useEffect(() => {
    const maj = () => {
      let actif = "haut";
      for (const [id] of ONGLETS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 160) actif = id;
      }
      // tout en bas de la page : dernière section
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) actif = ONGLETS[ONGLETS.length - 1][0];
      setOnglet(actif);
    };
    maj();
    window.addEventListener("scroll", maj, { passive: true });
    window.addEventListener("resize", maj);
    return () => {
      window.removeEventListener("scroll", maj);
      window.removeEventListener("resize", maj);
    };
  }, []);
  const t0 = jour(aujourdhui);
  const [bienId, setBienId] = useState<string | undefined>(biens[0]?.id);
  const [mois, setMois] = useState(() => monthStart(t0.getUTCFullYear(), t0.getUTCMonth()));
  const bien = biens.find((b) => b.id === bienId);
  const [resaId, setResaId] = useState(() => premiereResaDuMois(biens[0], mois)?.id ?? null);
  const resa = bien?.resas.find((r) => r.id === resaId) ?? null;

  // Jour libre cliqué : nouvelle ligne pré-remplie dans le panneau de droite
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);

  function choisir(b: BienEspace | undefined, m: Date) {
    setBienId(b?.id);
    setMois(m);
    setResaId(premiereResaDuMois(b, m)?.id ?? null);
    setBrouillon(null);
  }

  /** Jour cliqué (calendrier ou planning) : ouvre la ligne existante, sinon un ajout pré-rempli. */
  function ouvrirJour(b: BienEspace, jourIso: string) {
    const d = jour(jourIso);
    const r = resaDuJour(b, d.getTime());
    setBienId(b.id);
    setMois(monthStart(d.getUTCFullYear(), d.getUTCMonth()));
    if (r) {
      setResaId(r.id);
      setBrouillon(null);
    } else {
      setResaId(null);
      setBrouillon({ du: jourIso, au: isoJour(d.getTime() + DAY_MS) });
    }
    document.getElementById("calendrier")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          {ONGLETS.map(([id, libelle]) => (
            <a key={id} href={`#${id}`} aria-current={onglet === id ? "location" : undefined}>
              {libelle}
            </a>
          ))}
        </nav>
        <div className="bas">
          <a className="contacter" href={contact} {...(contact.startsWith("https://") ? { target: "_blank", rel: "noopener" } : {})}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M4 5h16v11H9l-5 4z" />
            </svg>
            Contacter Lyze
          </a>
          <span>
            Connecté·e : <strong>{nom}</strong>
          </span>
          <form action={logout}>
            <button type="submit">Se déconnecter</button>
          </form>
        </div>
      </aside>

      <main className="contenu" id="haut">
        <header className="entete-app">
          <span className="eyebrow eyebrow--brique">Espace propriétaire</span>
          <h1>Mes biens</h1>
          <p className="lead">Vos réservations, vos photos et vos revenus, réunis au même endroit.</p>
        </header>

        {!bien ? (
          <section className="panneau vide-biens">
            <span className="titre-p">Vos biens</span>
            <p>Aucun bien n&apos;est encore rattaché à votre compte. Ajoutez votre premier bien : son calendrier, sa fiche et ses photos apparaîtront ici.</p>
            <AjoutBien ouvertAuDepart />
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
              <button type="button" className="lz-bouton lz-petit" onClick={() => ouvrirJour(bien, jourParDefaut(mois, aujourdhui))}>
                + Ajouter au calendrier
              </button>
              <div className="legende-app">
                <span>
                  <i className="l-vert" style={{ color: "var(--creme)" }}>
                    <IconeCoche width={12} height={12} />
                  </i>
                  Réservation sélectionnée
                </span>
                <span><i className="l-brique" />Réservé</span>
                <span><i className="l-barka" />Réservé par l’entreprise</span>
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
                <AjoutBien />
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
                <Calendrier bien={bien} mois={mois} resaChoisie={resa} onJour={(j) => ouvrirJour(bien, j)} />
              </section>

              <EditeurResa
                key={`${bien.id}-${resa?.id ?? ""}-${brouillon?.du ?? ""}`}
                bien={bien}
                resa={resa}
                brouillon={brouillon}
                onFini={() => setBrouillon(null)}
              />
            </div>

            <Planning
              biens={biens}
              mois={mois}
              aujourdhui={aujourdhui}
              onMois={changerMois}
              onResa={(b, r) => ouvrirJour(b, r.du < isoJour(mois.getTime()) ? isoJour(mois.getTime()) : r.du)}
              onJourLibre={ouvrirJour}
            />

            <Revenus biens={biens} aujourdhui={aujourdhui} depenses={depenses} />

            <section className="panneau lz-section" id="depenses">
              <span className="eyebrow eyebrow--brique">Dépenses</span>
              <h2>Vos dépenses</h2>
              <p className="aide-p">
                Ménage, réparations, charges, taxes : notez chaque dépense, elle est déduite de vos revenus dans le relevé.
              </p>
              <Depenses depenses={depenses} biens={listeBiens} aujourdhui={aujourdhui} />
            </section>

            <section className="panneau photos" id="photos">
              <span className="eyebrow eyebrow--brique">Photos</span>
              <h2>{bien.nom}</h2>
              <p className="aide-p">
                Glissez vos photos dans le cadre pour les ajouter à l&apos;annonce. Faites-les glisser entre elles pour
                changer l&apos;ordre : la première est la photo de couverture.
              </p>
              <PhotoManager key={bien.id} propertyId={bien.id} initial={bien.photos} />
            </section>

            <section className="panneau lz-section" id="fiche">
              <span className="eyebrow eyebrow--brique">Fiche du bien</span>
              <h2>{bien.nom}</h2>
              <p className="aide-p">
                Les informations pratiques de votre logement. Lyze s’en sert pour préparer chaque arrivée : tenez-les à
                jour.
              </p>
              {biens.length > 1 && (
                <div className="lz-choix-bien" role="group" aria-label="Bien affiché">
                  {biens.map((b) => (
                    <button key={b.id} type="button" aria-pressed={b.id === bien.id} onClick={() => choisir(b, mois)}>
                      {b.nom}
                    </button>
                  ))}
                </div>
              )}
              <FicheBienForm key={bien.id} propertyId={bien.id} fiche={bien.fiche} />
              <form action={supprimerBien} className="lz-zone-suppr">
                <input type="hidden" name="propertyId" value={bien.id} />
                <ConfirmButton
                  message={`Supprimer « ${bien.nom} » avec ses photos, son calendrier et ses dépenses ? C'est définitif.`}
                  className="lz-lien lz-danger"
                >
                  Supprimer ce bien
                </ConfirmButton>
              </form>
            </section>
          </>
        )}

        <section className="panneau lz-section" id="documents">
          <span className="eyebrow eyebrow--brique">Documents</span>
          <h2>Vos documents</h2>
          <p className="aide-p">
            Contrat, relevés, factures, états des lieux : tout est classé par catégorie. Vous pouvez aussi déposer vos
            propres pièces (assurance, titre de propriété).
          </p>
          <Documents documents={documents} biens={listeBiens} />
        </section>

        <section className="panneau lz-section" id="demandes">
          <span className="eyebrow eyebrow--brique">Demandes</span>
          <h2>Une demande pour Lyze ?</h2>
          <p className="aide-p">
            Bloquez des dates pour vous, demandez un ménage ou signalez un problème : Barka suit chaque demande et vous
            répond ici.
            {aTraiter > 0 && ` ${aTraiter} réponse${aTraiter > 1 ? "s" : ""} de Lyze ci-dessous.`}
          </p>
          <DemandesProprio demandes={demandes} biens={listeBiens} />
        </section>

        <section className="panneau simulateur" id="revenus">
          <span className="eyebrow eyebrow--brique">Simulateur de revenus</span>
          <Simulateur />
        </section>

        <MonCompte compte={compte} />
      </main>
    </div>
  );
}

function Calendrier({
  bien,
  mois,
  resaChoisie,
  onJour,
}: {
  bien: BienEspace;
  mois: Date;
  resaChoisie: ResaEspace | null;
  onJour: (jourIso: string) => void;
}) {
  const an = mois.getUTCFullYear();
  const m = mois.getUTCMonth();
  const decalage = (mois.getUTCDay() + 6) % 7; // lundi = 0
  const cases: React.ReactNode[] = [];

  for (let i = 0; i < decalage; i++) cases.push(<div key={`v${i}`} className="jour vide" />);

  for (let d = 1; d <= daysInMonth(mois); d++) {
    const t = Date.UTC(an, m, d);
    const leJour = isoJour(t);
    const r = resaDuJour(bien, t);
    const debutOuPremier = r && (d === 1 || t === jour(r.du).getTime());
    const choisie = !!r && r.id === resaChoisie?.id;

    if (!r) {
      cases.push(
        <button key={d} type="button" className="jour" aria-label={`${d} ${MOIS[m]} : libre, ajouter`} onClick={() => onJour(leJour)}>
          {d}
        </button>,
      );
    } else if (r.type !== "RESERVED") {
      cases.push(
        <button
          key={d}
          type="button"
          className={`jour ${r.type === "MANAGED" ? "barka" : "bloque"}${choisie ? " choisi" : ""}`}
          aria-label={`${d} ${MOIS[m]} : ${r.type === "MANAGED" ? "Réservé par l’entreprise" : "bloqué"}`}
          onClick={() => onJour(leJour)}
        >
          {d}
          {debutOuPremier && <span className="etiquette">{r.type === "MANAGED" ? "Entreprise" : "Bloqué"}</span>}
        </button>,
      );
    } else {
      cases.push(
        <button
          key={d}
          type="button"
          className={`jour ${choisie ? "reserve" : "loue"}`}
          aria-label={`${d} ${MOIS[m]} : réservé via ${PLATEFORMES[r.plateforme].nom}`}
          onClick={() => onJour(leJour)}
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

const isoJour = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Jour proposé par « + Ajouter » : aujourd'hui si on regarde le mois en cours, sinon le 1er du mois affiché. */
function jourParDefaut(mois: Date, aujourdhui: string) {
  const debut = isoJour(mois.getTime());
  const fin = isoJour(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + 1, 1));
  return aujourdhui >= debut && aujourdhui < fin ? aujourdhui : debut;
}

/** Ajout d'un bien par le propriétaire (nom + ville), dépliable. */
function AjoutBien({ ouvertAuDepart = false }: { ouvertAuDepart?: boolean }) {
  const [ouvert, setOuvert] = useState(ouvertAuDepart);
  const [etat, action, envoi] = useActionState(async (prev: Awaited<ReturnType<typeof ajouterBien>>, fd: FormData) => {
    const r = await ajouterBien(prev, fd);
    if (r?.ok && !ouvertAuDepart) setOuvert(false);
    return r;
  }, undefined);

  if (!ouvert) {
    return (
      <button type="button" className="lz-lien lz-ajout-bien" onClick={() => setOuvert(true)}>
        + Ajouter un bien
      </button>
    );
  }
  return (
    <form action={action} className="lz-form lz-form-bien">
      <label className="lz-champ">
        <span>Nom du bien</span>
        <input name="name" required maxLength={120} placeholder="Appartement Vue Mer" />
      </label>
      <label className="lz-champ">
        <span>Ville</span>
        <input name="city" required maxLength={80} list="lz-villes-ajout" placeholder="El Jadida" />
        <datalist id="lz-villes-ajout">
          <option value="El Jadida" />
          <option value="Casablanca" />
          <option value="Marrakech" />
        </datalist>
      </label>
      {etat?.error && <p className="lz-msg lz-erreur" role="alert">{etat.error}</p>}
      <div className="lz-actions-resa">
        <button type="submit" className="lz-bouton lz-petit" disabled={envoi}>
          {envoi ? "Ajout…" : "Ajouter le bien"}
        </button>
        {!ouvertAuDepart && (
          <button type="button" className="lz-lien" onClick={() => setOuvert(false)}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
