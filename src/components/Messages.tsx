"use client";

import "@/styles/lz.css";

import { useActionState } from "react";
import { envoyerAvis, supprimerAvis } from "@/app/actions/espace";
import { ConfirmButton } from "@/components/ConfirmButton";
import type { AvisItem } from "@/lib/espace";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dateLongue = (iso: string) => {
  const [a, m, j] = iso.split("-").map(Number);
  return `${j} ${MOIS[m - 1]} ${a}`;
};

function Avis({ a, nouveau }: { a: AvisItem; nouveau?: boolean }) {
  return (
    <>
      <div className="lz-dem-tete">
        <strong>{a.titre}</strong>
        {nouveau && <span className="lz-statut lz-statut-nouvelle">Nouveau</span>}
      </div>
      <small className="lz-dem-meta">
        {a.bien ?? "Tous vos biens"} · envoyé le {dateLongue(a.date)}
      </small>
      {a.intervention && <p className="lz-avis-date">Intervention prévue le {dateLongue(a.intervention)}</p>}
      <p className="lz-dem-message lz-avis-texte">{a.message}</p>
    </>
  );
}

/** Espace propriétaire : messages reçus de Lyze. `nonLus` = ids encore non lus à l'ouverture de la page. */
export function MessagesProprio({ avis, nonLus }: { avis: AvisItem[]; nonLus: string[] }) {
  if (avis.length === 0) return <p className="lz-vide">Aucun message de Lyze pour l’instant.</p>;
  return (
    <ul className="lz-liste-dem">
      {avis.map((a) => (
        <li key={a.id} className={nonLus.includes(a.id) ? "lz-avis-nouveau" : undefined}>
          <Avis a={a} nouveau={nonLus.includes(a.id)} />
        </li>
      ))}
    </ul>
  );
}

/** Admin (fiche client) : écrire un message au propriétaire + messages déjà envoyés. */
export function MessagesAdmin({ ownerId, biens, avis }: { ownerId: string; biens: { id: string; nom: string }[]; avis: AvisItem[] }) {
  const [etat, action, envoi] = useActionState(envoyerAvis, undefined);

  return (
    <div className="lz-demandes">
      <form action={action} className="lz-form lz-nouvelle" key={etat?.ok}>
        <span className="titre-p">Nouveau message</span>
        <input type="hidden" name="ownerId" value={ownerId} />
        <div className="lz-grille">
          <label className="lz-champ lz-large">
            <span>Bien concerné</span>
            <select name="propertyId" defaultValue={biens.length === 1 ? biens[0].id : ""}>
              <option value="">Tous ses biens</option>
              {biens.map((b) => (
                <option key={b.id} value={b.id}>{b.nom}</option>
              ))}
            </select>
          </label>
          <label className="lz-champ">
            <span>Intervention prévue le (facultatif)</span>
            <input type="date" name="eventDate" />
          </label>
          <label className="lz-champ lz-pleine">
            <span>Objet</span>
            <input name="title" required maxLength={120} placeholder="Ex. Fuite d’eau dans la salle de bain" />
          </label>
          <label className="lz-champ lz-pleine">
            <span>Message</span>
            <textarea
              name="message"
              rows={4}
              required
              maxLength={3000}
              placeholder="Ex. Une fuite a été constatée sous le lavabo. Le plombier intervient jeudi matin, aucune action de votre part n’est nécessaire."
            />
          </label>
        </div>
        {etat?.error && <p className="lz-msg lz-erreur" role="alert">{etat.error}</p>}
        <button type="submit" className="lz-bouton" disabled={envoi}>
          {envoi ? "Envoi…" : "Envoyer au propriétaire"}
        </button>
        {etat?.ok && !etat.error && (
          <p className="lz-msg lz-ok" role="status">Message envoyé : il apparaît dans son espace, onglet Messages.</p>
        )}
      </form>

      <div className="lz-suivi">
        <span className="titre-p">Messages envoyés</span>
        {avis.length === 0 ? (
          <p className="lz-vide">Aucun message envoyé à ce client.</p>
        ) : (
          <ul className="lz-liste-dem">
            {avis.map((a) => (
              <li key={a.id}>
                <Avis a={a} />
                <small className="lz-dem-meta">{a.lu ? `Lu le ${dateLongue(a.lu)}` : "Pas encore lu"}</small>
                <form action={supprimerAvis}>
                  <input type="hidden" name="avisId" value={a.id} />
                  <ConfirmButton message="Supprimer ce message ? Il disparaîtra aussi de l’espace du propriétaire." className="lz-lien lz-danger">
                    Supprimer
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
