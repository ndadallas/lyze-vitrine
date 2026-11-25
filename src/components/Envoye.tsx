"use client";

import "@/styles/lz.css";
import { useEffect, useState } from "react";

const EVENEMENT = "lz-confirmation";

/** Affiche le bandeau de confirmation (bas de l'écran, 4 s). Nécessite un <Confirmations /> monté dans la page. */
export function confirmer(texte: string) {
  window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: texte }));
}

/**
 * Bandeau de confirmation unique de la page, monté une fois (espace propriétaire, vue client, tableau de bord gérante).
 * Monté au plus haut niveau pour survivre au rechargement des données qui démonte le formulaire d'origine.
 * Les formulaires sans retour (supprimer, valider…) n'ont qu'à porter `data-ok="Message supprimé."`.
 */
export function Confirmations() {
  const [message, setMessage] = useState<{ texte: string; n: number }>();
  useEffect(() => {
    let minuterie: ReturnType<typeof setTimeout>;
    const montrer = (texte: string) => {
      sessionStorage.setItem(EVENEMENT, JSON.stringify({ texte, n: Date.now() }));
      setMessage({ texte, n: Date.now() });
      clearTimeout(minuterie);
      minuterie = setTimeout(() => setMessage(undefined), 4000);
    };
    // action qui redirige vers une autre page : le bandeau reprend sur la nouvelle page s'il a moins de 4 s
    const enCours = JSON.parse(sessionStorage.getItem(EVENEMENT) ?? "null") as { texte: string; n: number } | null;
    const reprise =
      enCours && Date.now() - enCours.n < 4000
        ? setTimeout(() => {
            setMessage(enCours);
            minuterie = setTimeout(() => setMessage(undefined), 4000 - (Date.now() - enCours.n));
          })
        : undefined;
    const surEvenement = (e: Event) => montrer((e as CustomEvent<string>).detail);
    // shortcut: le bandeau part à l'envoi (l'action void ne renvoie rien) ; une erreur serveur affiche de toute façon la page d'erreur
    const surEnvoi = (e: SubmitEvent) => {
      const ok = (e.target as HTMLElement).closest("form")?.dataset.ok;
      if (ok) montrer(ok);
    };
    window.addEventListener(EVENEMENT, surEvenement);
    document.addEventListener("submit", surEnvoi, true);
    return () => {
      clearTimeout(reprise);
      clearTimeout(minuterie);
      window.removeEventListener(EVENEMENT, surEvenement);
      document.removeEventListener("submit", surEnvoi, true);
    };
  }, []);
  if (!message) return null;
  return (
    <p className="lz-envoye" role="status" key={message.n}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message.texte}
    </p>
  );
}

/**
 * Action avec état qui affiche la confirmation dès son succès, même si le formulaire disparaît ensuite
 * (ex. conversation clôturée qui passe dans les archives).
 */
export function avecConfirmation<S extends { ok?: number; done?: number; error?: string } | undefined>(
  action: (prev: S, formData: FormData) => Promise<S>,
  texte: string | ((formData: FormData) => string),
) {
  return async (prev: S, formData: FormData) => {
    const r = await action(prev, formData);
    if ((r?.ok || r?.done) && !r.error) confirmer(typeof texte === "string" ? texte : texte(formData));
    return r;
  };
}

