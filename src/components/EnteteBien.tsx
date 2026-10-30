"use client";

import { useState, type ReactNode } from "react";

/**
 * En-tête du bien sélectionné dans la fiche client : couverture, nom, ville, chiffres,
 * boutons Modifier / Supprimer bien visibles. Le formulaire de modification s'ouvre dessous.
 */
export function EnteteBien({
  nom,
  ville,
  couverture,
  details,
  formulaire,
  suppression,
}: {
  nom: string;
  ville: string;
  couverture: string | null;
  details: string;
  formulaire: ReactNode;
  suppression: ReactNode;
}) {
  const [edition, setEdition] = useState(false);

  return (
    <div className="bien-tete-bloc">
      <header className="bien-tete">
        {couverture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bien-couv" src={couverture} alt="" />
        ) : (
          <span className="bien-couv bien-couv-vide" aria-hidden="true">{nom.charAt(0)}</span>
        )}
        <div className="bien-titre">
          <h3>{nom}</h3>
          <p>{ville}</p>
          <p className="muted">{details}</p>
        </div>
        <div className="bien-actions">
          <button type="button" className="btn btn-outline btn-sm" aria-expanded={edition} onClick={() => setEdition((v) => !v)}>
            {edition ? "Fermer" : "Modifier le bien"}
          </button>
          {suppression}
        </div>
      </header>
      {edition && <div className="repli-panneau">{formulaire}</div>}
    </div>
  );
}
