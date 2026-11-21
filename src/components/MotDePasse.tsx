"use client";

import { useState, type InputHTMLAttributes } from "react";
import { useT } from "@/components/Langue";

/** Champ mot de passe avec un œil pour afficher / masquer la saisie. */
export function MotDePasse(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  return (
    <span className="mdp">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="mdp-oeil"
        aria-label={visible ? t("Masquer le mot de passe") : t("Afficher le mot de passe")}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </span>
  );
}
