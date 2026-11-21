"use client";

import { useT } from "@/components/Langue";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { MotDePasse } from "@/components/MotDePasse";

export function LoginForm() {
  const { t } = useT();
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="connexion-form" noValidate>
      <a className="retour" href="/">{t("← Retour au site")}</a>
      <span className="eyebrow eyebrow--brique" style={{ marginTop: 50 }}>{t("Espace propriétaire")}</span>
      <h1>{t("Bon retour.")}</h1>
      <p className="lead">{t("Connectez-vous avec les identifiants que Lyze vous a remis.")}</p>

      <label className="champ">
        <span>{t("Identifiant")}</span>
        <input
          type="text"
          name="username"
          placeholder="prenom.nom"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state?.username}
        />
      </label>
      <label className="champ">
        <span>{t("Mot de passe")}</span>
        <MotDePasse name="password" placeholder="xxxx-xxxx-xxxx" autoComplete="current-password" required />
      </label>

      <label className="souvenir">
        <input type="checkbox" name="remember" />
        {t("Rester connecté sur cet appareil")}
      </label>

      {state?.error && (
        <p className="erreur" role="alert">
          {t(state.error)}
        </p>
      )}

      <button className="btn btn--plein" type="submit" disabled={pending}>
        {pending ? t("Connexion…") : t("Se connecter")}
      </button>
      <p className="aide">
        {t("Pas encore d'accès ou identifiants perdus ? Ils sont créés par Lyze :")}{" "}
        <a href="mailto:contact@lyze.com">{t("écrivez-nous à contact@lyze.com")}</a>.
      </p>
    </form>
  );
}
