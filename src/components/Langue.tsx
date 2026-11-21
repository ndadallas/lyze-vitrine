"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { COOKIE_LANGUE, LANGUES, LOCALES, NOMS_LANGUES, traduire, type Langue } from "@/lib/langue";
import { COOKIE_DEVISE, DEVISES, TAUX_EUR_DEFAUT, formatMontant, type Devise } from "@/lib/devise";

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

/** Choix de la devise d'affichage (MAD ou €) : cookie puis rechargement. Les montants restent enregistrés en MAD. */
export function ChoixDevise({ className }: { className?: string }) {
  const { devise, tauxEur, t } = useT();
  return (
    <label className={className ?? "lz-choix-langue"} title={t("1 € = {taux} MAD (taux indicatif)", { taux: tauxEur })}>
      <span className="sr-only">{t("Devise")}</span>
      <select
        value={devise}
        onChange={(e) => {
          document.cookie = `${COOKIE_DEVISE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          window.location.reload();
        }}
      >
        {DEVISES.map((d) => (
          <option key={d} value={d}>
            {d === "EUR" ? "€ EUR" : "MAD"}
          </option>
        ))}
      </select>
    </label>
  );
}
