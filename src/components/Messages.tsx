"use client";

import { useT } from "@/components/Langue";
import "@/styles/lz.css";

import { useActionState, useEffect } from "react";
import { envoyerAvis, marquerReponsesLues, repondreAvis, supprimerAvis } from "@/app/actions/espace";
import { ConfirmButton } from "@/components/ConfirmButton";
import type { AvisItem } from "@/lib/espace";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// date du jour en toutes lettres courtes, dans la langue de l'espace (« 12 nov. 2026 »)
const dateLongue = (iso: string, locale = "fr-FR") =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

function Avis({ a, nouveau }: { a: AvisItem; nouveau?: boolean }) {
  const { t, locale } = useT();
  return (
    <>
      <div className="lz-dem-tete">
        <strong>{a.titre}</strong>
        {nouveau && <span className="lz-statut lz-statut-nouvelle">{t("Nouveau")}</span>}
      </div>
      <small className="lz-dem-meta">
        {a.bien ?? t("Tous vos biens")} · {t("envoyé le {date}", { date: dateLongue(a.date, locale) })}
      </small>
      {a.intervention && <p className="lz-avis-date">{t("Intervention prévue le {date}", { date: dateLongue(a.intervention, locale) })}</p>}
      <p className="lz-dem-message lz-avis-texte">{a.message}</p>
    </>
  );
}

/** Fil de réponses sous un message + champ « Répondre » (comme un échange de mails). `cote` = qui lit. */
function Fil({ a, cote, nomClient }: { a: AvisItem; cote: "admin" | "proprio"; nomClient?: string }) {
  const { t, locale } = useT();
  const [etat, action, envoi] = useActionState(repondreAvis, undefined);
  const auteur = (deLyze: boolean) => (deLyze ? (cote === "admin" ? "Vous (Lyze)" : "Lyze") : cote === "admin" ? (nomClient ?? "Le propriétaire") : t("Vous"));

  return (
    <div className="lz-fil">
      {a.reponses.length > 0 && (
        <ol className="lz-fil-liste" aria-label={t("Réponses")}>
          {a.reponses.map((r) => (
            <li key={r.id} className={r.deLyze ? "lz-fil-lyze" : "lz-fil-proprio"}>
              <small className="lz-fil-tete">
                <strong>{auteur(r.deLyze)}</strong> · {r.date}
                {/* « Lu » seulement sur ses propres réponses : l'autre côté les a ouvertes */}
                {(cote === "admin") === r.deLyze && (r.lu ? " · Lu" : " · Pas encore lu")}
              </small>
              <p>{r.texte}</p>
            </li>
          ))}
        </ol>
      )}
      <form action={action} className="lz-fil-form" key={etat?.ok}>
        <input type="hidden" name="noticeId" value={a.id} />
        <textarea name="body" rows={2} required maxLength={3000} placeholder={t("Répondre…")} aria-label={t("Répondre à « {titre} »", { titre: a.titre })} />
        <button type="submit" className="lz-bouton lz-petit" disabled={envoi}>
          {envoi ? t("Envoi…") : t("Répondre")}
        </button>
        {etat?.error && <p className="lz-msg lz-erreur" role="alert">{t(etat.error)}</p>}
      </form>
    </div>
  );
}

/** Espace propriétaire : messages reçus de Lyze. `nonLus` = ids encore non lus à l'ouverture de la page. */
export function MessagesProprio({ avis, nonLus }: { avis: AvisItem[]; nonLus: string[] }) {
  const { t, locale } = useT();
  if (avis.length === 0) return <p className="lz-vide">{t("Aucun message de Lyze pour l’instant.")}</p>;
  return (
    <ul className="lz-liste-dem">
      {avis.map((a) => (
        <li key={a.id} className={nonLus.includes(a.id) ? "lz-avis-nouveau" : undefined}>
          <Avis a={a} nouveau={nonLus.includes(a.id)} />
          <Fil a={a} cote="proprio" />
        </li>
      ))}
    </ul>
  );
}

/** Admin (fiche client) : écrire un message au propriétaire + messages déjà envoyés avec leurs fils. */
export function MessagesAdmin({ ownerId, nomClient, biens, avis }: { ownerId: string; nomClient: string; biens: { id: string; nom: string }[]; avis: AvisItem[] }) {
  const { t, locale } = useT();
  const [etat, action, envoi] = useActionState(envoyerAvis, undefined);
  const aLire = avis.some((a) => a.reponses.some((r) => !r.deLyze && !r.lu));
  // la gérante a ouvert les messages : les réponses du client deviennent « lues »
  useEffect(() => {
    if (aLire) marquerReponsesLues(ownerId);
  }, [aLire, ownerId]);

  return (
    <div className="lz-demandes">
      <form action={action} className="lz-form lz-nouvelle" key={etat?.ok}>
        <span className="titre-p">{t("Nouveau message")}</span>
        <input type="hidden" name="ownerId" value={ownerId} />
        <div className="lz-grille">
          <label className="lz-champ lz-large">
            <span>{t("Bien concerné")}</span>
            <select name="propertyId" defaultValue={biens.length === 1 ? biens[0].id : ""}>
              <option value="">{t("Tous ses biens")}</option>
              {biens.map((b) => (
                <option key={b.id} value={b.id}>{b.nom}</option>
              ))}
            </select>
          </label>
          <label className="lz-champ">
            <span>{t("Intervention prévue le (facultatif)")}</span>
            <input type="date" name="eventDate" />
          </label>
          <label className="lz-champ lz-pleine">
            <span>{t("Objet")}</span>
            <input name="title" required maxLength={120} placeholder={t("Ex. Fuite d’eau dans la salle de bain")} />
          </label>
          <label className="lz-champ lz-pleine">
            <span>{t("Message")}</span>
            <textarea
              name="message"
              rows={4}
              required
              maxLength={3000}
              placeholder={t("Ex. Une fuite a été constatée sous le lavabo. Le plombier intervient jeudi matin, aucune action de votre part n’est nécessaire.")}
            />
          </label>
        </div>
        {etat?.error && <p className="lz-msg lz-erreur" role="alert">{t(etat.error)}</p>}
        <button type="submit" className="lz-bouton" disabled={envoi}>
          {envoi ? "Envoi…" : "Envoyer au propriétaire"}
        </button>
        {etat?.ok && !etat.error && (
          <p className="lz-msg lz-ok" role="status">{t("Message envoyé : il apparaît dans son espace, onglet Messages.")}</p>
        )}
      </form>

      <div className="lz-suivi">
        <span className="titre-p">{t("Messages envoyés")}</span>
        {avis.length === 0 ? (
          <p className="lz-vide">{t("Aucun message envoyé à ce client.")}</p>
        ) : (
          <ul className="lz-liste-dem">
            {avis.map((a) => {
              const nouvelles = a.reponses.filter((r) => !r.deLyze && !r.lu).length;
              return (
                <li key={a.id} className={nouvelles ? "lz-avis-nouveau" : undefined}>
                  <Avis a={a} nouveau={nouvelles > 0} />
                  <small className="lz-dem-meta">{a.lu ? `Lu le ${dateLongue(a.lu, locale)}` : "Pas encore lu"}</small>
                  <Fil a={a} cote="admin" nomClient={nomClient} />
                  <form action={supprimerAvis}>
                    <input type="hidden" name="avisId" value={a.id} />
                    <ConfirmButton message="Supprimer ce message et ses réponses ? Il disparaîtra aussi de l’espace du propriétaire." className="lz-lien lz-danger">
                      {t("Supprimer")}
                    </ConfirmButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
