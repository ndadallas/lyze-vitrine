"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { ajouterBien, basculerPublication, supprimerBien } from "@/app/actions/espace";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Depenses } from "@/components/Depenses";
import { DemandeAdmin, DemandesProprio } from "@/components/Demandes";
import { MessagesAdmin, MessagesProprio } from "@/components/Messages";
import { CompteClientAdmin, type CompteClient } from "@/components/CompteClientAdmin";
import { marquerAvisLus } from "@/app/actions/espace";
import { Documents } from "@/components/Documents";
import { FicheBienForm } from "@/components/FicheBienForm";
import { PhotoManager, type PhotoItem } from "@/components/PhotoManager";
import type { AvisItem, DemandeItem, DepenseItem, DocumentItem, FicheBien } from "@/lib/espace";
import { DAY_MS, daysInMonth, formatMAD, monthStart, parseDay } from "@/lib/dates";
import { monthStats, nights } from "@/lib/stats";
import { LogoPlateforme, PLATEFORMES, type Plateforme } from "@/lib/plateformes";
import { EditeurResa, type Brouillon } from "./EditeurResa";
import { MonCompte, type CompteEspace } from "./MonCompte";
import { ChoixMois, Planning } from "./Planning";
import { Revenus } from "./Revenus";
import { ONGLETS, lienOnglet } from "./onglets";

export type ResaEspace = {
  id: string;
  type: "RESERVED" | "BLOCKED" | "MANAGED";
  du: string; // arrivée, "2026-11-12"
  au: string; // départ (exclu), "2026-11-16"
  initiale: string | null;
  montant: number;
  plateforme: Plateforme;
  plateformeAutre: string | null; // « Autre » précisé
  voyageur?: string | null; // nom complet : vue gérante seulement
  note: string | null;
  attente: boolean; // saisi par le propriétaire, pas encore validé par Lyze
};

export type BienEspace = {
  id: string;
  nom: string;
  ville: string;
  fiche: FicheBien;
  photos: PhotoItem[]; // dans l'ordre ; la première = couverture
  resas: ResaEspace[];
};

/** Vue gérante de l'espace d'un client (demande 2026-11-18) : même affichage que le client, mais tout est modifiable. */
export type AdminVue = { clientId: string; clients: { id: string; nom: string }[]; compte: CompteClient };

type Props = {
  /** absent = espace du propriétaire, en lecture seule (il consulte, Lyze modifie) */
  admin?: AdminVue;
  nom: string;
  salutation: string; // « Mme Barka Exemple » : civilité + prénom + nom
  avis: AvisItem[];
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
      if (r.type !== "BLOCKED") return r;
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

export function EspaceProprietaire({ admin, nom, salutation, avis, aujourdhui, biens, documents, demandes, depenses, compte, contact }: Props) {
  const listeBiens = biens.map((b) => ({ id: b.id, nom: b.nom }));
  const aTraiter = demandes.filter((d) => d.reponse && d.statut !== "NOUVELLE").length;
  // Une page par rubrique (URL /espace/<id>) ; changement de page par pushState : bien et mois choisis sont gardés
  const base = admin ? `/admin/clients/${admin.clientId}` : "/espace";
  const lien = (id: string) => lienOnglet(id, base);
  const onglet = usePathname().slice(base.length).split("/")[1] || "biens";
  // sans bien, seuls les onglets qui ne dépendent pas d'un bien sont proposés
  const onglets = biens.length ? ONGLETS : ONGLETS.filter(([id]) => ["biens", "documents", "demandes", "messages", "compte"].includes(id));
  // messages non lus à l'arrivée : gardés pour la pastille « Nouveau » le temps de la visite
  const [nonLus] = useState(() => avis.filter((a) => (admin ? a.reponses.some((r) => !r.deLyze && !r.lu) : !a.lu || a.reponses.some((r) => r.deLyze && !r.lu))).map((a) => a.id));
  // page Messages déjà ouverte pendant la visite (ou arrivée directe sur /espace/messages)
  const [vuMessages, setVuMessages] = useState(onglet === "messages");
  const lus = vuMessages || onglet === "messages";
  function aller(id: string) {
    if (id !== onglet) window.history.pushState(null, "", lien(id));
    if (id === "messages") setVuMessages(true);
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    const libelle = ONGLETS.find(([id]) => id === onglet)?.[1];
    if (libelle) document.title = admin ? `${libelle} — ${nom} — Lyze` : `${libelle} — Espace propriétaire Lyze`;
    // téléphone : la barre des rubriques défile, garder la rubrique ouverte visible
    document.querySelector(".side nav [aria-current]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [onglet, admin, nom]);
  // page Messages ouverte (lien ou adresse directe) : messages marqués lus
  useEffect(() => {
    if (!admin && lus && nonLus.length) marquerAvisLus();
  }, [admin, lus, nonLus.length]);
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
      setBrouillon(admin ? { du: jourIso, au: isoJour(d.getTime() + DAY_MS) } : null);
    }
    if (onglet !== "biens") window.history.pushState(null, "", lien("biens"));
    requestAnimationFrame(() => document.getElementById("calendrier")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function changerMois(delta: number) {
    choisir(bien, new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + delta, 1)));
  }

  const stats = useMemo(() => (bien ? monthStats(bien.resas.map(versStats), mois, 1) : null), [bien, mois]);
  const titreMois = `${capital(MOIS[mois.getUTCMonth()])} ${mois.getUTCFullYear()}`;

  return (
    <div className="app">
      <aside className="side">
        <a className="logo" href={admin ? "/admin" : "/"}><img src="/assets/img/logo-lyze-creme.png" alt="Lyze Conciergerie" width={599} height={200} />{/* eslint-disable-line @next/next/no-img-element */}</a>
        <span className="role">{admin ? "VUE GÉRANTE" : "ESPACE PROPRIÉTAIRE"}</span>
        {admin && (
          <label className="lz-choix-client">
            <span>Client</span>
            <select value={admin.clientId} onChange={(e) => (window.location.href = `/admin/clients/${e.target.value}`)}>
              {admin.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </label>
        )}
        <nav aria-label="Espace propriétaire">
          {onglets.map(([id, libelle]) => (
            <a
              key={id}
              href={lien(id)}
              aria-current={onglet === id ? "page" : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // nouvel onglet du navigateur
                e.preventDefault();
                aller(id);
              }}
            >
              {libelle}
              {id === "messages" && nonLus.length > 0 && !lus && (
                <span className="lz-badge" aria-label={`${nonLus.length} non lu${nonLus.length > 1 ? "s" : ""}`}>{nonLus.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="bas">
          <a className="contacter" href="/">← Retour au site</a>
          {admin ? (
            <a className="contacter" href="/admin">← Tous les clients</a>
          ) : (
          <a className="contacter" href={contact} {...(contact.startsWith("https://") ? { target: "_blank", rel: "noopener" } : {})}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M4 5h16v11H9l-5 4z" />
            </svg>
            Contacter Lyze
          </a>
          )}
          {!admin && (
            <span>
              Connecté·e : <strong>{nom}</strong>
            </span>
          )}
          <form action={logout}>
            <button type="submit">Se déconnecter</button>
          </form>
        </div>
      </aside>

      <main className="contenu" id="haut">
        <header className="entete-app" hidden={onglet !== "biens"}>
          <span className="eyebrow eyebrow--brique">{admin ? "Vue gérante : ce que voit le client" : "Espace propriétaire"}</span>
          <h1>{admin ? salutation : `Bienvenue dans votre espace, ${salutation}`}</h1>
          <p className="lead">
            {admin
              ? "Le même affichage que le client. Ici vous pouvez tout modifier ; lui ne fait que consulter."
              : "Vos réservations, vos photos et vos revenus, réunis au même endroit."}
          </p>
          {!admin && nonLus.length > 0 && !lus && (
            <button type="button" className="lz-alerte-msg" onClick={() => aller("messages")}>
              {nonLus.length === 1 ? "Vous avez un nouveau message de Lyze" : `Vous avez ${nonLus.length} nouveaux messages de Lyze`} →
            </button>
          )}
        </header>

        {!bien ? (
          <section className="panneau vide-biens" hidden={onglet !== "biens"}>
            <span className="titre-p">Vos biens</span>
            <p>
              {admin
                ? "Aucun bien pour ce client. Ajoutez son premier bien : calendrier, fiche et photos apparaîtront ici."
                : "Aucun bien n’est encore rattaché à votre compte : Lyze l’ajoute pour vous."}
            </p>
            {admin && <AjoutBien ouvertAuDepart ownerId={admin.clientId} />}
          </section>
        ) : (
          <>
            <div className="outils" id="calendrier" hidden={onglet !== "biens"}>
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
              <ChoixMois mois={mois} aujourdhui={aujourdhui} onMois={changerMois} />
              {admin && (
                <form action={basculerPublication}>
                  <input type="hidden" name="propertyId" value={bien.id} />
                  <button type="submit" className={`lz-bouton lz-petit${bien.fiche.published ? " lz-bouton-clair" : ""}`}>
                    {bien.fiche.published ? "Retirer du site" : "Afficher ce bien sur le site"}
                  </button>
                </form>
              )}
              <div className="legende-app">
                <span>
                  <i className="l-vert" style={{ color: "var(--creme)" }}>
                    <IconeCoche width={12} height={12} />
                  </i>
                  Réservation sélectionnée
                </span>
                <span><i className="l-brique" />Réservé</span>
                <span><i className="l-bloque" />Bloqué par le propriétaire</span>
                <span><i className="l-attente" />En attente de validation</span>
                <span><i className="l-libre" />Libre</span>
              </div>
            </div>

            <div className="grille-app" hidden={onglet !== "biens"}>
              <section className="panneau cal" aria-label="Calendrier du mois">
                <div className="cal-entete">
                  {JOURS.map((j) => <span key={j}>{j}</span>)}
                </div>
                <Calendrier bien={bien} mois={mois} resaChoisie={resa} modifiable={!!admin} onJour={(j) => ouvrirJour(bien, j)} />
              </section>

              <EditeurResa
                key={`${bien.id}-${resa?.id ?? ""}-${brouillon?.du ?? ""}`}
                bien={bien}
                resa={resa}
                brouillon={brouillon}
                onFini={() => setBrouillon(null)}
                lectureSeule={!admin}
              />

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
                {admin && <AjoutBien ownerId={admin.clientId} />}
                {stats && (
                  <div className="stats">
                    <span className="titre-p">{titreMois}</span>
                    <div><span>Taux d’occupation</span><strong>{stats.occupancy} %</strong></div>
                    <div><span>Nuits réservées</span><strong>{stats.reservedNights}</strong></div>
                    <div><span>Revenus du mois</span><strong>{formatMAD(stats.revenue)}</strong></div>
                  </div>
                )}
              </section>
            </div>

            <div hidden={onglet !== "planning"}>
            <Planning
              titre={admin ? "Tous ses biens" : "Tous vos biens"}
              aide={
                admin
                  ? "Le mois en un coup d’œil. Cliquez sur une case libre pour ajouter une réservation ou bloquer une date, ou sur une barre pour la modifier."
                  : "Le mois en un coup d’œil. Cliquez sur une barre pour voir le détail de la réservation."
              }
              biens={biens}
              mois={mois}
              aujourdhui={aujourdhui}
              onMois={changerMois}
              onResa={(b, r) => ouvrirJour(b, r.du < isoJour(mois.getTime()) ? isoJour(mois.getTime()) : r.du)}
              onJourLibre={ouvrirJour}
            />

            </div>

            <div hidden={onglet !== "revenus"}>
              <Revenus biens={biens} aujourdhui={aujourdhui} depenses={depenses} titre={admin ? "Ses revenus" : "Vos revenus"} />
            </div>

            <section className="panneau lz-section" id="depenses" hidden={onglet !== "depenses"}>
              <span className="eyebrow eyebrow--brique">Dépenses</span>
              <h2>Vos dépenses</h2>
              <p className="aide-p">
                {admin
                  ? "Ménage, réparations, charges, taxes : notez chaque dépense, elle est déduite des revenus dans le relevé du client."
                  : "Ménage, réparations, charges, taxes : les dépenses notées par Lyze, déduites de vos revenus dans le relevé."}
              </p>
              <Depenses depenses={depenses} biens={listeBiens} aujourdhui={aujourdhui} admin={!!admin} lectureSeule={!admin} />
            </section>

            <section className="panneau photos" id="photos" hidden={onglet !== "photos"}>
              <span className="eyebrow eyebrow--brique">Photos</span>
              <h2>{bien.nom}</h2>
              <p className="aide-p">
                {admin
                  ? "Glissez les photos dans le cadre pour les ajouter. Faites-les glisser entre elles pour changer l’ordre : la première est la photo de couverture."
                  : "Les photos de votre logement, gérées par Lyze. La première est la photo de couverture."}
              </p>
              {admin ? <PhotoManager key={bien.id} propertyId={bien.id} initial={bien.photos} /> : <GaleriePhotos nom={bien.nom} photos={bien.photos} />}
            </section>

            <section className="panneau lz-section" id="fiche" hidden={onglet !== "fiche"}>
              <span className="eyebrow eyebrow--brique">Fiche du bien</span>
              <h2>{bien.nom}</h2>
              <p className="aide-p">
                {admin
                  ? "Les informations pratiques du logement : Lyze s’en sert pour préparer chaque arrivée."
                  : "Les informations pratiques de votre logement, tenues à jour par Lyze pour préparer chaque arrivée."}
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
              {!admin && <FicheLecture fiche={bien.fiche} />}
              {admin && <FicheBienForm key={bien.id} propertyId={bien.id} fiche={bien.fiche} />}
              {admin && (
              <form action={supprimerBien} className="lz-zone-suppr">
                <input type="hidden" name="propertyId" value={bien.id} />
                <ConfirmButton
                  message={`Supprimer « ${bien.nom} » avec ses photos, son calendrier et ses dépenses ? C'est définitif.`}
                  className="lz-lien lz-danger"
                >
                  Supprimer ce bien
                </ConfirmButton>
              </form>
              )}
            </section>
          </>
        )}

        <section className="panneau lz-section" id="documents" hidden={onglet !== "documents"}>
          <span className="eyebrow eyebrow--brique">Documents</span>
          <h2>Vos documents</h2>
          <p className="aide-p">
            Contrat, relevés, factures, états des lieux : tout est classé par catégorie.
          </p>
          <Documents documents={documents} biens={listeBiens} admin={!!admin} ownerId={admin?.clientId} lectureSeule={!admin} />
        </section>

        <section className="panneau lz-section" id="demandes" hidden={onglet !== "demandes"}>
          <span className="eyebrow eyebrow--brique">Demandes</span>
          <h2>Une demande pour Lyze ?</h2>
          <p className="aide-p">
            Bloquez des dates pour vous, demandez un ménage ou signalez un problème : Barka suit chaque demande et vous
            répond ici.
            {aTraiter > 0 && ` ${aTraiter} réponse${aTraiter > 1 ? "s" : ""} de Lyze ci-dessous.`}
          </p>
          {admin ? (
            demandes.length ? (
              <ul className="lz-liste-dem">
                {demandes.map((d) => (
                  <DemandeAdmin key={`${d.id}-${d.statut}-${d.reponse ?? ""}`} d={d} />
                ))}
              </ul>
            ) : (
              <p className="lz-vide">Aucune demande de ce client.</p>
            )
          ) : (
            <DemandesProprio demandes={demandes} biens={listeBiens} />
          )}
        </section>

        <section className="panneau lz-section" id="messages" hidden={onglet !== "messages"}>
          <span className="eyebrow eyebrow--brique">Messages</span>
          <h2>Messages de Lyze</h2>
          <p className="aide-p">
            Interventions, pannes, informations sur vos biens : Lyze vous tient au courant ici. Répondez directement sous
            chaque message, comme à un mail.
          </p>
          {admin ? (
            <MessagesAdmin ownerId={admin.clientId} nomClient={nom} biens={listeBiens} avis={avis} />
          ) : (
            <MessagesProprio avis={avis} nonLus={nonLus} />
          )}
        </section>

        <div hidden={onglet !== "compte"}>
          {admin ? <CompteClientAdmin compte={admin.compte} /> : <MonCompte compte={compte} />}
        </div>
      </main>
    </div>
  );
}

function Calendrier({
  bien,
  mois,
  resaChoisie,
  modifiable,
  onJour,
}: {
  bien: BienEspace;
  mois: Date;
  resaChoisie: ResaEspace | null;
  modifiable: boolean;
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

    if (!r && !modifiable) {
      cases.push(<div key={d} className="jour">{d}</div>);
    } else if (!r) {
      cases.push(
        <button key={d} type="button" className="jour" aria-label={`${d} ${MOIS[m]} : libre, ajouter`} onClick={() => onJour(leJour)}>
          {d}
        </button>,
      );
    } else if (r.type === "BLOCKED") {
      cases.push(
        <button
          key={d}
          type="button"
          className={`jour bloque${choisie ? " choisi" : ""}${r.attente ? " attente" : ""}`}
          aria-label={`${d} ${MOIS[m]} : bloqué`}
          onClick={() => onJour(leJour)}
        >
          {d}
          {debutOuPremier && <span className="etiquette">Bloqué</span>}
        </button>,
      );
    } else {
      cases.push(
        <button
          key={d}
          type="button"
          className={`jour ${choisie ? "reserve" : "loue"}${r.attente ? " attente" : ""}`}
          aria-label={`${d} ${MOIS[m]} : réservé via ${PLATEFORMES[r.plateforme].nom}`}
          onClick={() => onJour(leJour)}
        >
          {d}
          {choisie && <IconeCoche className="coche" />}
          {debutOuPremier && (
            <span className="etiquette">
              <LogoPlateforme code={r.plateforme} autre={r.plateformeAutre} avecNom={false} taille={14} />
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

/** Espace du propriétaire : photos en consultation (seule Lyze les ajoute ou les range). */
function GaleriePhotos({ nom, photos }: { nom: string; photos: PhotoItem[] }) {
  if (!photos.length) return <p className="lz-vide">Lyze n’a pas encore ajouté de photo pour ce bien.</p>;
  return (
    <ul className="lz-galerie-lecture">
      {photos.map((p, i) => (
        <li key={p.id}>
          <a href={p.url} target="_blank" rel="noopener">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`${nom}, photo ${i + 1}`} loading="lazy" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Espace du propriétaire : fiche du bien en consultation. */
function FicheLecture({ fiche }: { fiche: FicheBien }) {
  const lignes = (
    [
      ["Catégorie", fiche.kind],
      ["Adresse", fiche.address],
      ["Chambres", fiche.bedrooms?.toString() ?? ""],
      ["Voyageurs max.", fiche.capacity?.toString() ?? ""],
      ["Surface", fiche.surface ? `${fiche.surface} m²` : ""],
      ["Équipements", fiche.equipment.join(", ")],
      ["Wifi", [fiche.wifiName, fiche.wifiPassword].filter(Boolean).join(" · mot de passe : ")],
      ["Consignes d’arrivée", fiche.arrival],
      ["Présentation sur le site", fiche.description],
      ["Prix à partir de", fiche.price ? `${formatMAD(fiche.price)} / nuit` : ""],
    ] as [string, string][]
  ).filter(([, v]) => v);
  if (!lignes.length) return <p className="lz-vide">Lyze n’a pas encore rempli la fiche de ce bien.</p>;
  return (
    <dl className="lz-fiche-lecture">
      {lignes.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Ajout d'un bien par le propriétaire (nom + ville), dépliable. */
function AjoutBien({ ouvertAuDepart = false, ownerId }: { ouvertAuDepart?: boolean; ownerId: string }) {
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
      <input type="hidden" name="ownerId" value={ownerId} />
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
