"use client";

import { useState, type ReactNode } from "react";

/** Bouton qui ouvre / ferme un panneau juste en dessous (formulaires d'édition de la fiche client). */
export function Repli({
  label,
  openLabel = "Fermer",
  buttonClassName = "btn btn-outline btn-sm",
  children,
}: {
  label: string;
  openLabel?: string;
  buttonClassName?: string;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="repli">
      <button type="button" className={buttonClassName} aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)}>
        {ouvert ? openLabel : label}
      </button>
      {ouvert && <div className="repli-panneau">{children}</div>}
    </div>
  );
}
