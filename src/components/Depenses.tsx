"use client";

import { useT } from "@/components/Langue";
import "@/styles/lz.css";

import { useActionState, useState } from "react";
import { ajouterDepense, modifierDepense, supprimerDepense } from "@/app/actions/espace";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatMAD } from "@/lib/dates";
import { CATEGORIES_DEPENSE, CODES_DEPENSES, type DepenseItem } from "@/lib/espace";

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
// date du jour en toutes lettres courtes, dans la langue de l'espace (« 12 nov. 2026 »)
const dateCourte = (iso: string, locale = "fr-FR") =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/** Dépenses des biens (ménage, réparations, charges…) : liste filtrable, ajout, suppression. */
export function Depenses({
  depenses,
  biens,
  aujourdhui,
  admin = false,
  lectureSeule = false,
}: {
  lectureSeule?: boolean; // espace du propriétaire : consultation seulement
  depenses: DepenseItem[];
  biens: { id: string; nom: string }[];
  aujourdhui: string;
  admin?: boolean;
}) {
  const { t, locale } = useT();
  const [etat, action, envoi] = useActionState(ajouterDepense, undefined);
  const [filtre, setFiltre] = useState("tous");
  const [ouvert, setOuvert] = useState(false);
  const [edition, setEdition] = useState<string | null>(null);
  const nomBien = new Map(biens.map((b) => [b.id, b.nom]));
  const visibles = filtre === "tous" ? depenses : depenses.filter((d) => d.bienId === filtre);
  const total = visibles.reduce((s, d) => s + d.montant, 0);

  return (
    <div className="lz-depenses">
      <div className="lz-docs-barre">
        {biens.length > 1 ? (
          <div className="lz-filtres" role="group" aria-label={t("Filtrer par bien")}>
            <button type="button" aria-pressed={filtre === "tous"} onClick={() => setFiltre("tous")}>{t("Tous les biens")}</button>
            {biens.map((b) => (
              <button key={b.id} type="button" aria-pressed={filtre === b.id} onClick={() => setFiltre(b.id)}>
                {b.nom}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        {!lectureSeule && (
          <button type="button" className="lz-bouton" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)} disabled={!biens.length}>
            {ouvert ? "Fermer" : "+ Ajouter une dépense"}
          </button>
        )}
      </div>

      {ouvert && (
        <form action={action} className="lz-form lz-depot">
          <div className="lz-grille">
            <label className="lz-champ">
              <span>{t("Bien")}</span>
              <select name="propertyId" defaultValue={filtre !== "tous" ? filtre : biens[0]?.id}>
                {biens.map((b) => (
                  <option key={b.id} value={b.id}>{b.nom}</option>
                ))}
              </select>
            </label>
            <label className="lz-champ">
              <span>{t("Date")}</span>
              <input type="date" name="date" defaultValue={aujourdhui} required />
            </label>
            <label className="lz-champ">
              <span>{t("Catégorie")}</span>
              <select name="category" defaultValue="MENAGE">
                {CODES_DEPENSES.map((c) => (
                  <option key={c} value={c}>{t(CATEGORIES_DEPENSE[c])}</option>
                ))}
              </select>
            </label>
            <label className="lz-champ lz-large">
              <span>{t("Libellé")}</span>
              <input name="label" required maxLength={120} placeholder={t("Ex. remplacement du chauffe-eau")} />
            </label>
            <label className="lz-champ">
              <span>{t("Montant (MAD)")}</span>
              <input name="amount" type="number" min={1} step={1} inputMode="numeric" required />
            </label>
          </div>
          {etat?.error && <p className="lz-msg lz-erreur" role="alert">{etat.error}</p>}
          <button type="submit" className="lz-bouton" disabled={envoi}>
            {envoi ? "Enregistrement…" : "Ajouter la dépense"}
          </button>
          {etat?.ok && !etat.error && <p className="lz-msg lz-ok" role="status">{t("Dépense ajoutée.")}</p>}
        </form>
      )}

      {edition && depenses.some((d) => d.id === edition) && (
        <ModifierDepense key={edition} d={depenses.find((d) => d.id === edition)!} onFini={() => setEdition(null)} />
      )}

      {visibles.length === 0 ? (
        <p className="lz-vide">{t("Aucune dépense enregistrée.")}</p>
      ) : (
        <div className="lz-table-defile">
          <table className="releve lz-table-dep lz-fiches-mobile">
            <thead>
              <tr>
                <th scope="col">{t("Date")}</th>
                <th scope="col">{t("Dépense")}</th>
                <th scope="col">{t("Bien")}</th>
                <th scope="col">{t("Montant")}</th>
                <th scope="col"><span className="sr-only">{t("Actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((d) => (
                <tr key={d.id}>
                  <th scope="row">{dateCourte(d.date, locale)}</th>
                  <td className="lz-dep-libelle">
                    {d.libelle}
                    <small>
                      {t(CATEGORIES_DEPENSE[d.categorie])}
                      {d.parProprio ? (admin ? " · saisie par le client" : " · saisie par vous") : " · saisie par Lyze"}
                    </small>
                  </td>
                  <td data-label={t("Bien")}>{nomBien.get(d.bienId) ?? "—"}</td>
                  <td data-label={t("Montant")}>{formatMAD(d.montant)}</td>
                  <td className="lz-actions-cellule">
                    {!lectureSeule && (admin || d.parProprio) && (
                      <>
                      <button type="button" className="lz-lien" onClick={() => setEdition(edition === d.id ? null : d.id)}>
                        {edition === d.id ? "Fermer" : "Modifier"}
                      </button>
                      <form action={supprimerDepense}>
                        <input type="hidden" name="expenseId" value={d.id} />
                        <ConfirmButton message={`Supprimer « ${d.libelle} » ?`} className="lz-lien lz-danger">
                          {t("Supprimer")}
                        </ConfirmButton>
                      </form>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t("Total")}</th>
                <td className="lz-vide-mobile" />
                <td className="lz-vide-mobile" />
                <td data-label={t("Montant")}>{formatMAD(total)}</td>
                <td className="lz-vide-mobile" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/** Formulaire de modification d'une dépense (date, catégorie, libellé, montant). */
function ModifierDepense({ d, onFini }: { d: DepenseItem; onFini: () => void }) {
  const { t, locale } = useT();
  const [etat, action, envoi] = useActionState(async (prev: Awaited<ReturnType<typeof modifierDepense>>, fd: FormData) => {
    const r = await modifierDepense(prev, fd);
    if (r?.ok) onFini();
    return r;
  }, undefined);
  return (
    <form action={action} className="lz-form lz-depot">
      <input type="hidden" name="expenseId" value={d.id} />
      <div className="lz-grille">
        <label className="lz-champ">
          <span>{t("Date")}</span>
          <input type="date" name="date" defaultValue={d.date} required />
        </label>
        <label className="lz-champ">
          <span>{t("Catégorie")}</span>
          <select name="category" defaultValue={d.categorie}>
            {CODES_DEPENSES.map((c) => (
              <option key={c} value={c}>{t(CATEGORIES_DEPENSE[c])}</option>
            ))}
          </select>
        </label>
        <label className="lz-champ lz-large">
          <span>{t("Libellé")}</span>
          <input name="label" required maxLength={120} defaultValue={d.libelle} />
        </label>
        <label className="lz-champ">
          <span>{t("Montant (MAD)")}</span>
          <input name="amount" type="number" min={1} step={1} inputMode="numeric" required defaultValue={d.montant} />
        </label>
      </div>
      {etat?.error && <p className="lz-msg lz-erreur" role="alert">{etat.error}</p>}
      <div className="lz-actions-resa">
        <button type="submit" className="lz-bouton" disabled={envoi}>
          {envoi ? "Enregistrement…" : "Enregistrer la dépense"}
        </button>
        <button type="button" className="lz-lien" onClick={onFini}>{t("Annuler")}</button>
      </div>
    </form>
  );
}
