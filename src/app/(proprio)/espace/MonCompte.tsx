"use client";

import { useActionState } from "react";
import { changerMotDePasse, modifierProfil } from "@/app/actions/profil";
import { ChampTelephone } from "@/components/ChampTelephone";

export type CompteEspace = {
  identifiant: string;
  phone: string; // "+212 612345678"
  email: string;
  address: string;
  country: string;
  contactPreference: string;
};

function Message({ state, ok }: { state: { error?: string; ok?: number } | undefined; ok: string }) {
  if (state?.error) return <p className="message-compte erreur" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="message-compte ok" role="status">{ok}</p>;
  return null;
}

export function MonCompte({ compte }: { compte: CompteEspace }) {
  const [profil, actionProfil, envoiProfil] = useActionState(modifierProfil, undefined);
  const [mdp, actionMdp, envoiMdp] = useActionState(changerMotDePasse, undefined);
  const [indicatif, ...reste] = compte.phone.split(" ");

  return (
    <section className="panneau compte" id="compte">
      <span className="eyebrow eyebrow--brique">Mon compte</span>
      <h2>Vos informations</h2>
      <p className="aide-p">
        Identifiant de connexion : <strong>{compte.identifiant}</strong>. Lyze utilise ces coordonnées pour vous joindre et
        vous adresser vos comptes rendus.
      </p>

      <div className="compte-grille">
        <form action={actionProfil} noValidate>
          <span className="titre-p">Coordonnées</span>
          <label className="champ">
            <span>Téléphone</span>
            <ChampTelephone defaut={indicatif?.startsWith("+") ? indicatif : "+212"} numero={reste.join(" ")} />
          </label>
          <label className="champ">
            <span>E-mail</span>
            <input type="email" name="email" autoComplete="email" required defaultValue={compte.email} />
          </label>
          <label className="champ">
            <span>Adresse postale</span>
            <input name="address" autoComplete="street-address" required defaultValue={compte.address} />
          </label>
          <label className="champ">
            <span>Pays de résidence</span>
            <input name="country" autoComplete="country-name" required defaultValue={compte.country} />
          </label>
          <fieldset className="champ choix-contact">
            <span>Comment préférez-vous être contacté·e ?</span>
            {["WhatsApp", "Téléphone", "E-mail"].map((c, i) => (
              <label key={c}>
                <input
                  type="radio"
                  name="contactPreference"
                  value={c}
                  defaultChecked={compte.contactPreference ? compte.contactPreference === c : i === 0}
                />
                {c}
              </label>
            ))}
          </fieldset>
          <Message state={profil} ok="Vos coordonnées sont enregistrées." />
          <button className="btn btn--plein" type="submit" disabled={envoiProfil}>
            {envoiProfil ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>

        <form action={actionMdp} noValidate>
          <span className="titre-p">Mot de passe</span>
          <label className="champ">
            <span>Mot de passe actuel</span>
            <input type="password" name="actuel" autoComplete="current-password" required />
          </label>
          <label className="champ">
            <span>Nouveau mot de passe</span>
            <input type="password" name="nouveau" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="champ">
            <span>Confirmer le nouveau</span>
            <input type="password" name="confirmation" autoComplete="new-password" minLength={8} required />
          </label>
          <p className="aide-p">Au moins 8 caractères. Vos autres appareils seront déconnectés.</p>
          <Message state={mdp} ok="Mot de passe modifié." />
          <button className="btn btn--plein" type="submit" disabled={envoiMdp}>
            {envoiMdp ? "Modification…" : "Changer le mot de passe"}
          </button>
        </form>
      </div>
    </section>
  );
}
