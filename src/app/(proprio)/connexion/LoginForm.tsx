"use client";

import { useT } from "@/components/Langue";
import { useActionState, useState } from "react";
import { login, motDePasseOublie } from "@/app/actions/auth";
import { MotDePasse } from "@/components/MotDePasse";

export function LoginForm() {
  const { t } = useT();
  const [state, action, pending] = useActionState(login, undefined);
  const [oublie, setOublie] = useState(false);

  if (oublie) return <MotDePasseOublie retour={() => setOublie(false)} />;

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
      <button type="button" className="lien-oublie" onClick={() => setOublie(true)}>
        {t("Mot de passe oublié ?")}
      </button>

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

function MotDePasseOublie({ retour }: { retour: () => void }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(motDePasseOublie, undefined);

  return (
    <form action={action} className="connexion-form" noValidate>
      <button type="button" className="retour lien-oublie" onClick={retour}>{t("← Retour à la connexion")}</button>
      <span className="eyebrow eyebrow--brique" style={{ marginTop: 50 }}>{t("Espace propriétaire")}</span>
      <h1>{t("Mot de passe oublié ?")}</h1>
      {state?.ok ? (
        <p className="lead" role="status">
          {t("Demande envoyée. Lyze vous recontacte rapidement pour vous redonner votre mot de passe.")}
        </p>
      ) : (
        <>
          <p className="lead">{t("Indiquez votre identifiant : Lyze reçoit votre demande et vous recontacte rapidement.")}</p>
          <label className="champ">
            <span>{t("Identifiant")}</span>
            <input type="text" name="username" placeholder="prenom.nom" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
          </label>
          <label className="champ">
            <span>{t("Téléphone (facultatif)")}</span>
            <input type="tel" name="telephone" placeholder="+212 6 00 00 00 00" autoComplete="tel" />
          </label>
          {state?.error && <p className="erreur" role="alert">{t(state.error)}</p>}
          <button className="btn btn--plein" type="submit" disabled={pending}>
            {pending ? t("Envoi…") : t("Envoyer la demande")}
          </button>
        </>
      )}
    </form>
  );
}
