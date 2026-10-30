"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="connexion-form" noValidate>
      <a className="retour" href="/">← Retour au site</a>
      <span className="eyebrow eyebrow--brique" style={{ marginTop: 50 }}>Espace propriétaire</span>
      <h1>Bon retour.</h1>
      <p className="lead">Connectez-vous avec les identifiants que Lyze vous a remis.</p>

      <label className="champ">
        <span>Identifiant</span>
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
        <span>Mot de passe</span>
        <input type="password" name="password" placeholder="xxxx-xxxx-xxxx" autoComplete="current-password" required />
      </label>

      <label className="souvenir">
        <input type="checkbox" name="remember" />
        Rester connecté sur cet appareil
      </label>

      {state?.error && (
        <p className="erreur" role="alert">
          {state.error}
        </p>
      )}

      <button className="btn btn--plein" type="submit" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="aide">
        Pas encore d&apos;accès ou identifiants perdus ? Ils sont créés par Lyze :{" "}
        <a href="tel:+212000000000">appelez-nous</a>.
      </p>
    </form>
  );
}
