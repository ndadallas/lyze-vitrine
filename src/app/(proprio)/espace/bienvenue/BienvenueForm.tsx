"use client";

import { useActionState } from "react";
import { enregistrerProfil } from "@/app/actions/profil";
import { ChampTelephone } from "@/components/ChampTelephone";

export function BienvenueForm({ prenom, email }: { prenom: string; email: string }) {
  const [state, action, pending] = useActionState(enregistrerProfil, undefined);

  return (
    <form action={action} className="connexion-form bienvenue-form" noValidate>
      <span className="eyebrow eyebrow--brique">Première connexion</span>
      <h1>Bienvenue, {prenom}.</h1>
      <p className="lead">
        Quelques informations pour que Lyze puisse vous joindre et vous adresser vos comptes rendus. Une seule fois :
        vous accédez ensuite à votre espace.
      </p>

      <label className="champ">
        <span>Téléphone</span>
        <ChampTelephone />
      </label>
      <label className="champ">
        <span>E-mail</span>
        <input type="email" name="email" autoComplete="email" required defaultValue={email} />
      </label>
      <label className="champ">
        <span>Adresse postale</span>
        <input name="address" autoComplete="street-address" required placeholder="Rue, code postal, ville" />
      </label>
      <label className="champ">
        <span>Pays de résidence</span>
        <input name="country" autoComplete="country-name" required placeholder="Maroc" />
      </label>
      <fieldset className="champ choix-contact">
        <span>Comment préférez-vous être contacté·e ?</span>
        {["WhatsApp", "Téléphone", "E-mail"].map((c, i) => (
          <label key={c}>
            <input type="radio" name="contactPreference" value={c} defaultChecked={i === 0} />
            {c}
          </label>
        ))}
      </fieldset>

      {state?.error && (
        <p className="erreur" role="alert">
          {state.error}
        </p>
      )}

      <button className="btn btn--plein" type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Accéder à mon espace"}
      </button>
    </form>
  );
}
