"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { COOKIE_LANGUE, LANGUES, LOCALES, NOMS_LANGUES, traduire, type Langue } from "@/lib/langue";
import { TAUX_EUR_DEFAUT, formatMontant, type Devise } from "@/lib/devise";

// Langue et devise de l'espace. Sans fournisseur : français et MAD.
type Reglages = { langue: Langue; devise: Devise; tauxEur: number };
const Ctx = createContext<Reglages>({ langue: "fr", devise: "MAD", tauxEur: TAUX_EUR_DEFAUT });

export function LangueProvider({
  langue,
  devise = "MAD",
  tauxEur = TAUX_EUR_DEFAUT,
  memoriser = false,
  children,
}: {
  langue: Langue;
  devise?: Devise;
  tauxEur?: number;
  memoriser?: boolean;
  children: ReactNode;
}) {
  // arrivée par /connexion?lang=xx : la langue est gardée pour les visites suivantes
  useEffect(() => {
    if (memoriser) document.cookie = `${COOKIE_LANGUE}=${langue}; path=/; max-age=31536000; samesite=lax`;
  }, [langue, memoriser]);
  return (
    <Ctx.Provider value={{ langue, devise, tauxEur }}>
      <div className="lz-langue" dir={langue === "ar" ? "rtl" : undefined} lang={langue}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** t("Texte français", { var }) → traduction de la langue courante. */
export function useT() {
  const { langue, devise, tauxEur } = useContext(Ctx);
  const locale = LOCALES[langue];
  const t = (fr: string, vars?: Record<string, string | number>) => traduire(langue, fr, vars);
  const mois = (i: number, format: "long" | "short" = "long") =>
    new Intl.DateTimeFormat(locale, { month: format, timeZone: "UTC" }).format(Date.UTC(2026, i, 1));
  // lundi → dimanche (le 5 janvier 2026 est un lundi)
  const jours = (format: "short" | "narrow" = "short") =>
    Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: format, timeZone: "UTC" }).format(Date.UTC(2026, 0, 5 + i)));
  /** montant enregistré en MAD → affiché dans la devise choisie */
  const montant = (mad: number) => formatMontant(mad, devise, tauxEur);
  return { t, langue, locale, mois, jours, montant, devise, tauxEur };
}

/** Choix de la langue, même rendu que l'accueil : drapeau + code, liste déroulante (demande 2026-11-22). Cookie puis rechargement. */
const DRAPEAUX: Record<Langue, string> = { fr: "fr", en: "gb", ar: "ma", it: "it", es: "es", de: "de" };
export function ChoixLangue({ className }: { className?: string }) {
  const { langue, t } = useT();
  const choisir = (l: Langue) => {
    document.cookie = `${COOKIE_LANGUE}=${l}; path=/; max-age=31536000; samesite=lax`;
    const url = new URL(window.location.href);
    url.searchParams.delete("lang");
    window.location.href = url.toString();
  };
  const drapeau = (l: Langue) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="drapeau" src={`/assets/img/drapeaux/${DRAPEAUX[l]}.svg`} alt="" width={20} height={15} />
  );
  return (
    <details className={`langues ${className ?? ""}`}>
      <summary className="lien-langue" aria-label={t("Langue")}>
        {drapeau(langue)}
        {langue.toUpperCase()}
      </summary>
      <div className="langues-liste">
        {LANGUES.filter((l) => l !== langue).map((l) => (
          <button key={l} type="button" lang={l} onClick={() => choisir(l)}>
            {drapeau(l)}
            {NOMS_LANGUES[l]}
          </button>
        ))}
      </div>
    </details>
  );
}
