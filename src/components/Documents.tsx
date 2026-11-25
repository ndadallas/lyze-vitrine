"use client";

import { useT } from "@/components/Langue";
import "@/styles/lz.css";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supprimerDocument } from "@/app/actions/espace";
import { ConfirmButton } from "@/components/ConfirmButton";
import { confirmer } from "@/components/Envoye";
import {
  CATEGORIES_DOC,
  CODES_CATEGORIES,
  MAX_DOC_BYTES,
  documentUrl,
  tailleFichier,
  type CategorieDoc,
  type DocumentItem,
} from "@/lib/espace";

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
// date du jour en toutes lettres courtes, dans la langue de l'espace (« 12 nov. 2026 »)
const dateCourte = (iso: string, locale = "fr-FR") =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

function IconeFichier({ pdf }: { pdf: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" d="M6 3h8l4 4v14H6z M14 3v4h4" />
      {pdf ? (
        <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M9 12h6M9 15h6M9 18h4" />
      ) : (
        <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" d="M8 18l3-4 2 2 2-3 2 5z" />
      )}
    </svg>
  );
}

/**
 * Documents d'un propriétaire, classés par catégorie, avec dépôt de fichier.
 * admin = vue gérante (dépose pour le client ownerId, peut tout supprimer).
 */
export function Documents({
  documents,
  biens,
  admin = false,
  ownerId,
  lectureSeule = false,
}: {
  lectureSeule?: boolean; // espace du propriétaire : consultation seulement
  documents: DocumentItem[];
  biens: { id: string; nom: string }[];
  admin?: boolean;
  ownerId?: string;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const [filtre, setFiltre] = useState<CategorieDoc | "TOUS">("TOUS");
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const presentes = CODES_CATEGORIES.filter((c) => documents.some((d) => d.categorie === c));
  const visibles = filtre === "TOUS" ? documents : documents.filter((d) => d.categorie === filtre);

  async function deposer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur(null);
    setOk(false);
    const form = e.currentTarget;
    const data = new FormData(form);
    const fichier = data.get("file");
    if (fichier instanceof File && fichier.size > MAX_DOC_BYTES) {
      setErreur("Fichier trop lourd (4 Mo maximum).");
      return;
    }
    if (ownerId) data.set("ownerId", ownerId);
    setEnvoi(true);
    try {
      const rep = await fetch("/api/documents", { method: "POST", body: data });
      const json = (await rep.json().catch(() => ({}))) as { error?: string };
      if (!rep.ok) {
        setErreur(json.error ?? "L'envoi a échoué, réessayez.");
        return;
      }
      form.reset();
      confirmer(admin ? "Document ajouté." : t("Document envoyé à Lyze."));
      setOk(true);
      setOuvert(false);
      router.refresh();
    } catch {
      setErreur("Connexion impossible, réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="lz-docs">
      <div className="lz-docs-barre">
        <div className="lz-filtres" role="group" aria-label={t("Filtrer par catégorie")}>
          <button type="button" aria-pressed={filtre === "TOUS"} onClick={() => setFiltre("TOUS")}>
            {t("Tous")} <small>{documents.length}</small>
          </button>
          {presentes.map((c) => (
            <button key={c} type="button" aria-pressed={filtre === c} onClick={() => setFiltre(c)}>
              {t(CATEGORIES_DOC[c])} <small>{documents.filter((d) => d.categorie === c).length}</small>
            </button>
          ))}
        </div>
        {!lectureSeule && (
          <button type="button" className="lz-bouton" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)}>
            {ouvert ? t("Fermer") : admin ? "+ Ajouter un document" : t("+ Envoyer un document à Lyze")}
          </button>
        )}
      </div>

      {ouvert && (
        <form className="lz-form lz-depot" onSubmit={deposer}>
          <div className="lz-grille">
            <label className="lz-champ lz-large">
              <span>{t("Titre")}</span>
              <input name="title" required maxLength={120} placeholder={admin ? "Relevé d'octobre" : "Attestation d'assurance"} />
            </label>
            <label className="lz-champ">
              <span>{t("Catégorie")}</span>
              <select name="category" defaultValue={admin ? "RELEVE" : "ASSURANCE"}>
                {CODES_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(CATEGORIES_DOC[c])}</option>
                ))}
              </select>
            </label>
            <label className="lz-champ">
              <span>{t("Bien concerné")}</span>
              <select name="propertyId" defaultValue="">
                <option value="">{t("Tous les biens")}</option>
                {biens.map((b) => (
                  <option key={b.id} value={b.id}>{b.nom}</option>
                ))}
              </select>
            </label>
            <label className="lz-champ lz-pleine">
              <span>{t("Fichier (PDF, JPG ou PNG, 4 Mo max.)")}</span>
              <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" />
            </label>
          </div>
          {erreur && <p className="lz-msg lz-erreur" role="alert">{t(erreur)}</p>}
          <button type="submit" className="lz-bouton" disabled={envoi}>
            {envoi ? t("Envoi…") : admin ? "Envoyer le document" : t("Envoyer à Lyze")}
          </button>
        </form>
      )}
      {ok && !ouvert && <p className="lz-msg lz-ok" role="status">{admin ? "Document ajouté." : t("Document envoyé à Lyze.")}</p>}

      {visibles.length === 0 ? (
        <p className="lz-vide">
          {documents.length === 0
            ? admin
              ? "Aucun document pour ce client. Déposez son contrat, ses relevés ou ses factures."
              : t("Aucun document pour l'instant. Lyze déposera ici votre contrat, vos relevés et vos factures.")
            : t("Aucun document dans cette catégorie.")}
        </p>
      ) : (
        <ul className="lz-liste-docs">
          {visibles.map((d) => (
            <li key={d.id}>
              <span className="lz-doc-ico"><IconeFichier pdf={d.mime === "application/pdf"} /></span>
              <span className="lz-doc-texte">
                <a href={documentUrl(d.id)} target="_blank" rel="noopener">{d.titre}</a>
                <small>
                  {t(CATEGORIES_DOC[d.categorie])} · {d.bien ?? t("Tous les biens")} · {dateCourte(d.date, locale)} · {tailleFichier(d.taille)}
                  {!d.parLyze && (admin ? " · déposé par le client" : ` · ${t("déposé par vous")}`)}
                </small>
              </span>
              <span className="lz-doc-actions">
                <a className="lz-lien" href={documentUrl(d.id)} target="_blank" rel="noopener">{t("Ouvrir")}</a>
                {!lectureSeule && (admin || !d.parLyze) && (
                  <form action={supprimerDocument} data-ok={t("Document supprimé.")}>
                    <input type="hidden" name="documentId" value={d.id} />
                    <ConfirmButton message={t("Supprimer « {titre} » ?", { titre: d.titre })} className="lz-lien lz-danger">
                      {t("Supprimer")}
                    </ConfirmButton>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
