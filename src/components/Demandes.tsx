"use client";

import { useT } from "@/components/Langue";
import "@/styles/lz.css";

import { useActionState, useState } from "react";
import { annulerDemande, envoyerDemande, traiterDemande } from "@/app/actions/espace";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Envoye } from "@/components/Envoye";
import {
  CODES_STATUTS,
  CODES_TYPES_DEMANDE,
  STATUTS_DEMANDE,
  TYPES_DEMANDE,
  type DemandeItem,
  type TypeDemande,
} from "@/lib/espace";

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
// date du jour en toutes lettres courtes, dans la langue de l'espace (« 12 nov. 2026 »)
const dateCourte = (iso: string, locale = "fr-FR") =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

function Resume({ d }: { d: DemandeItem }) {
  const { t, locale } = useT();
  return (
    <>
      <div className="lz-dem-tete">
        <strong>{t(TYPES_DEMANDE[d.type])}</strong>
        <span className={`lz-statut lz-statut-${d.statut.toLowerCase()}`}>{t(STATUTS_DEMANDE[d.statut])}</span>
      </div>
      <small className="lz-dem-meta">
        {d.bien ?? t("Tous les biens")} · <strong className="lz-date">{t("envoyée le {date}", { date: dateCourte(d.date, locale) })}</strong>
        {d.du && d.au && ` · ${t("du {du} au {au}", { du: dateCourte(d.du, locale), au: dateCourte(d.au, locale) })}`}
      </small>
      {d.message && d.message !== "Usage personnel" && <p className="lz-dem-message">{d.message}</p>}
    </>
  );
}

/** Espace propriétaire : nouvelle demande + suivi des demandes envoyées. */
export function DemandesProprio({ demandes, biens }: { demandes: DemandeItem[]; biens: { id: string; nom: string }[] }) {
  const { t, locale } = useT();
  const [etat, action, envoi] = useActionState(envoyerDemande, undefined);
  const [type, setType] = useState<TypeDemande>("USAGE_PERSO");
  const dates = type === "USAGE_PERSO";

  return (
    <div className="lz-demandes">
      <Envoye ok={etat?.error ? undefined : etat?.ok} texte={t("Demande envoyée. Barka vous répond sous 24 h.")} />
      <form action={action} className="lz-form lz-nouvelle" key={etat?.error ? "e" : etat?.ok}>
        <span className="titre-p">{t("Nouvelle demande")}</span>
        <div className="lz-types" role="radiogroup" aria-label={t("Type de demande")}>
          {CODES_TYPES_DEMANDE.map((code) => (
            <label key={code}>
              <input type="radio" name="type" value={code} checked={type === code} onChange={() => setType(code)} />
              {t(TYPES_DEMANDE[code])}
            </label>
          ))}
        </div>
        <div className="lz-grille">
          <label className="lz-champ lz-large">
            <span>{t("Bien concerné")}</span>
            <select name="propertyId" defaultValue={biens.length === 1 ? biens[0].id : ""} key={dates ? "d" : "s"}>
              {!dates && <option value="">{t("Tous mes biens")}</option>}
              {dates && biens.length !== 1 && <option value="">{t("— Choisir —")}</option>}
              {biens.map((b) => (
                <option key={b.id} value={b.id}>{b.nom}</option>
              ))}
            </select>
          </label>
          {dates && (
            <>
              <label className="lz-champ">
                <span>{t("Arrivée")}</span>
                <input type="date" name="du" required />
              </label>
              <label className="lz-champ">
                <span>{t("Départ")}</span>
                <input type="date" name="au" required />
              </label>
            </>
          )}
          <label className="lz-champ lz-pleine">
            <span>{dates ? t("Message (facultatif)") : t("Votre message")}</span>
            <textarea
              name="message"
              rows={3}
              required={!dates}
              placeholder={
                type === "MAINTENANCE"
                  ? t("Ex. la climatisation du salon ne refroidit plus.")
                  : type === "MENAGE"
                    ? t("Ex. ménage complet avant mon arrivée du 20.")
                    : dates
                      ? t("Ex. je viens avec ma famille, merci de préparer le linge.")
                      : t("Votre question")
              }
            />
          </label>
        </div>
        {etat?.error && <p className="lz-msg lz-erreur" role="alert">{t(etat.error)}</p>}
        <button type="submit" className="lz-bouton" disabled={envoi || biens.length === 0}>
          {envoi ? t("Envoi…") : t("Envoyer à Lyze")}
        </button>
        {etat?.ok && !etat.error && (
          <p className="lz-msg lz-ok" role="status">{t("Demande envoyée. Barka vous répond sous 24 h.")}</p>
        )}
      </form>

      <div className="lz-suivi">
        <span className="titre-p">{t("Vos demandes")}</span>
        {demandes.length === 0 ? (
          <p className="lz-vide">{t("Aucune demande envoyée pour l’instant.")}</p>
        ) : (
          <ul className="lz-liste-dem">
            {demandes.map((d) => (
              <li key={d.id}>
                <Resume d={d} />
                {d.reponse && (
                  <p className="lz-reponse">
                    <strong>{t("Réponse de Lyze :")}</strong> {d.reponse}
                  </p>
                )}
                {d.statut === "NOUVELLE" && (
                  <form action={annulerDemande}>
                    <input type="hidden" name="demandeId" value={d.id} />
                    <ConfirmButton message={t("Retirer cette demande ?")} className="lz-lien lz-danger">
                      {t("Retirer la demande")}
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
  const { t, locale } = useT();
  const [etat, action, envoi] = useActionState(traiterDemande, undefined);
  const blocable = d.type === "USAGE_PERSO" && d.statut !== "TRAITEE" && d.statut !== "REFUSEE";

  return (
    <li className="lz-dem-admin">
      {client && (
        <a className="lz-lien lz-dem-client" href={client.lien}>{client.nom}</a>
      )}
      <Resume d={d} />
      <Envoye ok={etat?.error ? undefined : etat?.ok} texte="Demande enregistrée." />
      <form action={action} className="lz-form lz-traiter">
        <input type="hidden" name="demandeId" value={d.id} />
        <div className="lz-grille">
          <label className="lz-champ">
            <span>{t("Statut")}</span>
            <select name="status" defaultValue={d.statut === "NOUVELLE" ? "EN_COURS" : d.statut}>
              {CODES_STATUTS.map((s) => (
                <option key={s} value={s}>{s === "NOUVELLE" ? "Nouvelle" : STATUTS_DEMANDE[s]}</option>
              ))}
            </select>
          </label>
          <label className="lz-champ lz-large">
            <span>{t("Réponse au propriétaire")}</span>
            <input name="reply" defaultValue={d.reponse ?? ""} maxLength={2000} placeholder={t("Visible dans son espace")} />
          </label>
        </div>
        {blocable && (
          <label className="lz-coche-seule">
            <input type="checkbox" name="bloquer" />
            {t("Accepter et bloquer ces dates dans le calendrier")}
          </label>
        )}
        {etat?.error && <p className="lz-msg lz-erreur" role="alert">{etat.error}</p>}
        {etat?.ok && !etat.error && <p className="lz-msg lz-ok" role="status">{t("Enregistré.")}</p>}
        <button type="submit" className="lz-bouton lz-petit" disabled={envoi}>
          {envoi ? "…" : "Enregistrer"}
        </button>
      </form>
    </li>
  );
}
