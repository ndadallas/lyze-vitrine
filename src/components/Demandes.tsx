"use client";

import "@/styles/lz.css";

import { useActionState, useState } from "react";
import { annulerDemande, envoyerDemande, traiterDemande } from "@/app/actions/espace";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  CODES_STATUTS,
  CODES_TYPES_DEMANDE,
  STATUTS_DEMANDE,
  TYPES_DEMANDE,
  type DemandeItem,
  type TypeDemande,
} from "@/lib/espace";

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dateCourte = (iso: string) => {
  const [a, m, j] = iso.split("-").map(Number);
  return `${j} ${MOIS[m - 1]} ${a}`;
};

function Resume({ d }: { d: DemandeItem }) {
  return (
    <>
      <div className="lz-dem-tete">
        <strong>{TYPES_DEMANDE[d.type]}</strong>
        <span className={`lz-statut lz-statut-${d.statut.toLowerCase()}`}>{STATUTS_DEMANDE[d.statut]}</span>
      </div>
      <small className="lz-dem-meta">
        {d.bien ?? "Tous les biens"} · envoyée le {dateCourte(d.date)}
        {d.du && d.au && ` · du ${dateCourte(d.du)} au ${dateCourte(d.au)}`}
      </small>
      {d.message && d.message !== "Usage personnel" && <p className="lz-dem-message">{d.message}</p>}
    </>
  );
}

/** Espace propriétaire : nouvelle demande + suivi des demandes envoyées. */
export function DemandesProprio({ demandes, biens }: { demandes: DemandeItem[]; biens: { id: string; nom: string }[] }) {
  const [etat, action, envoi] = useActionState(envoyerDemande, undefined);
  const [type, setType] = useState<TypeDemande>("USAGE_PERSO");
  const dates = type === "USAGE_PERSO";

  return (
    <div className="lz-demandes">
      <form action={action} className="lz-form lz-nouvelle">
        <span className="titre-p">Nouvelle demande</span>
        <div className="lz-types" role="radiogroup" aria-label="Type de demande">
          {CODES_TYPES_DEMANDE.map((t) => (
            <label key={t}>
              <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} />
              {TYPES_DEMANDE[t]}
            </label>
          ))}
        </div>
        <div className="lz-grille">
          <label className="lz-champ lz-large">
            <span>Bien concerné</span>
            <select name="propertyId" defaultValue={biens.length === 1 ? biens[0].id : ""} key={dates ? "d" : "s"}>
              {!dates && <option value="">Tous mes biens</option>}
              {dates && biens.length !== 1 && <option value="">— Choisir —</option>}
              {biens.map((b) => (
                <option key={b.id} value={b.id}>{b.nom}</option>
              ))}
            </select>
          </label>
          {dates && (
            <>
              <label className="lz-champ">
                <span>Arrivée</span>
                <input type="date" name="du" required />
              </label>
              <label className="lz-champ">
                <span>Départ</span>
                <input type="date" name="au" required />
              </label>
            </>
          )}
          <label className="lz-champ lz-pleine">
            <span>{dates ? "Message (facultatif)" : "Votre message"}</span>
            <textarea
              name="message"
              rows={3}
              required={!dates}
              placeholder={
                type === "MAINTENANCE"
                  ? "Ex. la climatisation du salon ne refroidit plus."
                  : type === "MENAGE"
                    ? "Ex. ménage complet avant mon arrivée du 20."
                    : dates
                      ? "Ex. je viens avec ma famille, merci de préparer le linge."
                      : "Votre question"
              }
            />
          </label>
        </div>
        {etat?.error && <p className="lz-msg lz-erreur" role="alert">{etat.error}</p>}
        <button type="submit" className="lz-bouton" disabled={envoi || biens.length === 0}>
          {envoi ? "Envoi…" : "Envoyer à Lyze"}
        </button>
        {etat?.ok && !etat.error && (
          <p className="lz-msg lz-ok" role="status">Demande envoyée. Barka vous répond sous 24 h.</p>
        )}
      </form>

      <div className="lz-suivi">
        <span className="titre-p">Vos demandes</span>
        {demandes.length === 0 ? (
          <p className="lz-vide">Aucune demande envoyée pour l’instant.</p>
        ) : (
          <ul className="lz-liste-dem">
            {demandes.map((d) => (
              <li key={d.id}>
                <Resume d={d} />
                {d.reponse && (
                  <p className="lz-reponse">
                    <strong>Réponse de Lyze :</strong> {d.reponse}
                  </p>
                )}
                {d.statut === "NOUVELLE" && (
                  <form action={annulerDemande}>
                    <input type="hidden" name="demandeId" value={d.id} />
                    <ConfirmButton message="Retirer cette demande ?" className="lz-lien lz-danger">
                      Retirer la demande
                    </ConfirmButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Admin : une demande avec son traitement (statut, réponse, blocage des dates). */
export function DemandeAdmin({ d, client }: { d: DemandeItem; client?: { nom: string; lien: string } }) {
  const [etat, action, envoi] = useActionState(traiterDemande, undefined);
  const blocable = d.type === "USAGE_PERSO" && d.statut !== "TRAITEE" && d.statut !== "REFUSEE";

  return (
    <li className="lz-dem-admin">
      {client && (
        <a className="lz-lien lz-dem-client" href={client.lien}>{client.nom}</a>
      )}
      <Resume d={d} />
      <form action={action} className="lz-form lz-traiter">
        <input type="hidden" name="demandeId" value={d.id} />
        <div className="lz-grille">
          <label className="lz-champ">
            <span>Statut</span>
            <select name="status" defaultValue={d.statut === "NOUVELLE" ? "EN_COURS" : d.statut}>
              {CODES_STATUTS.map((s) => (
                <option key={s} value={s}>{s === "NOUVELLE" ? "Nouvelle" : STATUTS_DEMANDE[s]}</option>
              ))}
            </select>
          </label>
          <label className="lz-champ lz-large">
            <span>Réponse au propriétaire</span>
            <input name="reply" defaultValue={d.reponse ?? ""} maxLength={2000} placeholder="Visible dans son espace" />
          </label>
        </div>
        {blocable && (
          <label className="lz-coche-seule">
            <input type="checkbox" name="bloquer" />
            Accepter et bloquer ces dates dans le calendrier
          </label>
        )}
        {etat?.error && <p className="lz-msg lz-erreur" role="alert">{etat.error}</p>}
        {etat?.ok && !etat.error && <p className="lz-msg lz-ok" role="status">Enregistré.</p>}
        <button type="submit" className="lz-bouton lz-petit" disabled={envoi}>
          {envoi ? "…" : "Enregistrer"}
        </button>
      </form>
    </li>
  );
}
