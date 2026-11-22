"use client";

import { useEffect, useState } from "react";

/** Bandeau « Envoyé » bien visible (bas de l'écran, 4 s) après un envoi réussi. `ok` = horodatage renvoyé par l'action. */
export function Envoye({ ok, texte }: { ok?: number; texte: string }) {
  const [vu, setVu] = useState<number | undefined>();
  useEffect(() => {
    if (!ok) return;
    setVu(ok);
    const id = setTimeout(() => setVu(undefined), 4000);
    return () => clearTimeout(id);
  }, [ok]);
  if (!vu) return null;
  return (
    <p className="lz-envoye" role="status">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {texte}
    </p>
  );
}
