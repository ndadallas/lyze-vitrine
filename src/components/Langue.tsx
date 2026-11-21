"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { COOKIE_LANGUE, LANGUES, LOCALES, NOMS_LANGUES, traduire, type Langue } from "@/lib/langue";

// Langue de l'espace propriétaire. Sans fournisseur (vues gérante) : français.
const Ctx = createContext<Langue>("fr");

export function LangueProvider({ langue, memoriser = false, children }: { langue: Langue; memoriser?: boolean; children: ReactNode }) {
  // arrivée par /connexion?lang=xx : la langue est gardée pour les visites suivantes
  useEffect(() => {
    if (memoriser) document.cookie = `${COOKIE_LANGUE}=${langue}; path=/; max-age=31536000; samesite=lax`;
  }, [langue, memoriser]);
  return (
    <Ctx.Provider value={langue}>
      <div className="lz-langue" dir={langue === "ar" ? "rtl" : undefined} lang={langue}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** t("Texte français", { var }) → traduction de la langue courante. */
export function useT() {
  const langue = useContext(Ctx);
  const locale = LOCALES[langue];
  const t = (fr: string, vars?: Record<string, string | number>) => traduire(langue, fr, vars);
  const mois = (i: number, format: "long" | "short" = "long") =>
    new Intl.DateTimeFormat(locale, { month: format, timeZone: "UTC" }).format(Date.UTC(2026, i, 1));
  // lundi → dimanche (le 5 janvier 2026 est un lundi)
  const jours = (format: "short" | "narrow" = "short") =>
    Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: format, timeZone: "UTC" }).format(Date.UTC(2026, 0, 5 + i)));
  return { t, langue, locale, mois, jours };
}

/** Choix de la langue (barre de l'espace, page de connexion) : cookie puis rechargement. */
export function ChoixLangue({ className }: { className?: string }) {
  const { langue, t } = useT();
  return (
    <label className={className ?? "lz-choix-langue"}>
      <span className="sr-only">{t("Langue")}</span>
      <select
        value={langue}
        onChange={(e) => {
          document.cookie = `${COOKIE_LANGUE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          const url = new URL(window.location.href);
          url.searchParams.delete("lang");
          window.location.href = url.toString();
        }}
      >
        {LANGUES.map((l) => (
          <option key={l} value={l}>
            {NOMS_LANGUES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
