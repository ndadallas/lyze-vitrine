"use client";

import { useT } from "@/components/Langue";
import { useActionState } from "react";
import { avecConfirmation } from "@/components/Envoye";
import { changerMotDePasse, modifierProfil } from "@/app/actions/profil";
import { ChampTelephone } from "@/components/ChampTelephone";
import { MotDePasse } from "@/components/MotDePasse";

export type CompteEspace = {
  identifiant: string;
  phone: string; // "+212 612345678"
  email: string;
  address: string;
  country: string;
  contactPreference: string;
};

function Message({ state, ok }: { state: { error?: string; ok?: number } | undefined; ok: string }) {
  const { t } = useT();
  if (state?.error) return <p className="message-compte erreur" role="alert">{t(state.error)}</p>;
  if (state?.ok) return <p className="message-compte ok" role="status">{ok}</p>;
  return null;
}

export function MonCompte({ compte }: { compte: CompteEspace }) {
  const { t } = useT();
  const [profil, actionProfil, envoiProfil] = useActionState(avecConfirmation(modifierProfil, t("Coordonnées enregistrées.")), undefined);
  const [mdp, actionMdp, envoiMdp] = useActionState(avecConfirmation(changerMotDePasse, t("Mot de passe modifié.")), undefined);
  const [indicatif, ...reste] = compte.phone.split(" ");

  return (
    <section className="panneau compte" id="compte">
      <span className="eyebrow eyebrow--brique">{t("Mon compte")}</span>
      <h2>{t("Vos informations")}</h2>
      <p className="aide-p">
        {t("Identifiant de connexion :")} <strong>{compte.identifiant}</strong>{t(". Lyze utilise ces coordonnées pour vous joindre et vous adresser vos comptes rendus.")}
      </p>

      <div className="compte-grille">
        <form action={actionProfil} noValidate>
          <span className="titre-p">{t("Coordonnées")}</span>
          <label className="champ">
            <span>{t("Téléphone")}</span>
            <ChampTelephone defaut={indicatif?.startsWith("+") ? indicatif : "+212"} numero={reste.join(" ")} />
          </label>
          <label className="champ">
            <span>{t("E-mail")}</span>
            <input type="email" name="email" autoComplete="email" required defaultValue={compte.email} />
          </label>
          <label className="champ">
            <span>{t("Adresse postale")}</span>
            <input name="address" autoComplete="street-address" required defaultValue={compte.address} />
          </label>
          <label className="champ">
            <span>{t("Pays de résidence")}</span>
            <input name="country" autoComplete="country-name" required defaultValue={compte.country} />
          </label>
          <fieldset className="champ choix-contact">
            <span>{t("Comment préférez-vous être contacté·e ?")}</span>
            {["WhatsApp", "Téléphone", "E-mail"].map((c, i) => (
              <label key={c}>
                <input
                  type="radio"
                  name="contactPreference"
                  value={c}
                  defaultChecked={compte.contactPreference ? compte.contactPreference === c : i === 0}
                />
                {t(c)}
              </label>
            ))}
          </fieldset>
          <Message state={profil} ok={t("Vos coordonnées sont enregistrées.")} />
          <button className="btn btn--plein" type="submit" disabled={envoiProfil}>
            {envoiProfil ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>

        <form action={actionMdp} noValidate>
          <span className="titre-p">{t("Mot de passe")}</span>
          <label className="champ">
            <span>{t("Mot de passe actuel")}</span>
            <MotDePasse name="actuel" autoComplete="current-password" required />
          </label>
          <label className="champ">
            <span>{t("Nouveau mot de passe")}</span>
            <MotDePasse name="nouveau" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="champ">
            <span>{t("Confirmer le nouveau")}</span>
            <MotDePasse name="confirmation" autoComplete="new-password" minLength={8} required />
          </label>
          <p className="aide-p">{t("Au moins 8 caractères. Vos autres appareils seront déconnectés.")}</p>
          <Message state={mdp} ok={t("Mot de passe modifié.")} />
          <button className="btn btn--plein" type="submit" disabled={envoiMdp}>
            {envoiMdp ? t("Modification…") : t("Changer le mot de passe")}
          </button>
        </form>
      </div>
    </section>
  );
}
